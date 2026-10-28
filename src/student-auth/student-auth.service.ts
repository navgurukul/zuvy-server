import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { db } from 'src/db';
import {
  users,
  zuvyBatchEnrollments,
  zuvyBatches,
  zuvyBootcamps,
  zuvyStudentCredentials,
  zuvyStudentIdCounters,
} from 'drizzle/schema';
import { AuthService, LoginClientInfo } from 'src/auth/auth.service';
import { SchoolsService } from 'src/schools/schools.service';
import { placeKey } from 'src/schools/school-rows';
import { CaptchaService } from './captcha.service';
import { transliterateDevanagari } from './devanagari';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEYLEN = 64;

// Student IDs are first + last name in lowercase, "ct" and a number:
// "Arunesh Dhar" → aruneshdharct1, the next Arunesh Dhar → aruneshdharct2.
// The number is counted per name, so IDs stay short.
const STUDENT_ID_MAX_BASE_LENGTH = 30;
const STUDENT_ID_FALLBACK_BASE = 'student';
const STUDENT_ID_ATTEMPTS = 5;
const GENERATED_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GENERATED_PASSWORD_LENGTH = 8;

const ENROLL_ROLES = ['admin', 'ops'];

/**
 * Org admins and ops may enrol students by Student ID only into courses of
 * the organisation they are currently logged into. (Super admins are
 * checked separately and may enrol into any course.)
 */
export function canEnrollInCourse(
  orgRoles: string[],
  actorOrgId: number | null,
  courseOrgId: number | null,
): boolean {
  if (actorOrgId == null || courseOrgId == null) return false;
  if (Number(actorOrgId) !== Number(courseOrgId)) return false;
  return orgRoles.some((role) => ENROLL_ROLES.includes(role));
}

/**
 * The name part of a Student ID: first name + last name, lowercase, letters
 * only. Middle names are skipped and accents removed; Hindi (Devanagari) is
 * spelled in English letters:
 *   "Arunesh Kumar Dhar" → "aruneshdhar", "Arunesh" → "arunesh",
 *   "José Ñúñez" → "josenunez", "रवि" → "ravi".
 * Names with no usable letters (e.g. another script) use "student".
 */
export function studentIdBaseFromName(name: string): string {
  const parts = transliterateDevanagari(name)
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/\s+/)
    .map((part) => part.replace(/[^a-z]/g, ''))
    .filter(Boolean);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  const base = (first + last).slice(0, STUDENT_ID_MAX_BASE_LENGTH);
  return base || STUDENT_ID_FALLBACK_BASE;
}

/** aruneshdhar + 1 → aruneshdharct1; aruneshdhar + 900 → aruneshdharct900. */
export function formatStudentId(base: string, sequence: number): string {
  return `${base}ct${sequence}`;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INVALID_CREDENTIALS = 'Invalid Student ID or password';

export interface StudentSignupInput extends LoginClientInfo {
  name: string;
  password: string;
  state: string;
  city: string;
  udiseCode: string;
  captchaToken?: string;
}

/** The school saved on a Student ID account at sign-up. */
export interface StudentSchool {
  state: string;
  city: string;
  schoolName: string;
  udiseCode: string;
}

@Injectable()
export class StudentAuthService {
  private readonly logger = new Logger(StudentAuthService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
    private readonly schoolsService: SchoolsService,
  ) {}

  async signup(input: StudentSignupInput) {
    const { name, password, captchaToken, ip, userAgent } = input;

    // Only a read, so it can run first: a wrong pick does not use up the
    // captcha token, and the student can fix it and resubmit.
    const school = await this.resolveSchool(
      input.state,
      input.city,
      input.udiseCode,
    );

    // Before any database write, so bots never create rows.
    await this.captchaService.verify(captchaToken, ip);

    const cleanName = name.replace(/\s+/g, ' ').trim();
    const passwordHash = await this.hashPassword(password);
    const now = new Date().toISOString();

    // Email and Google ID stay NULL: this is what marks the account as a
    // Student ID account everywhere else in the system.
    const [user] = await db
      .insert(users)
      .values({
        name: cleanName,
        email: null,
        googleUserId: null,
        mode: 'student',
        createdAt: now,
        lastLoginAt: now,
      })
      .returning();

    let studentId: string;
    try {
      studentId = await this.insertCredentialWithUniqueId(
        user.id,
        cleanName,
        passwordHash,
        school,
      );
    } catch (error) {
      // No transaction (the app shares one DB connection), so undo by hand.
      await db
        .delete(users)
        .where(eq(users.id, user.id))
        .catch(() => null);
      this.logger.error(`Student signup failed: ${error?.message}`);
      throw new InternalServerErrorException('Could not create the account');
    }

    try {
      const session = await this.authService.issueLoginSession(user, {
        method: 'student_id',
        ip,
        userAgent,
        udiseCode: school.udiseCode,
      });
      return { studentId, school, ...session };
    } catch (error) {
      // The account exists at this point, so never lose the Student ID.
      this.logger.error(`Session after signup failed: ${error?.message}`);
      throw new InternalServerErrorException(
        `Account created with Student ID ${studentId}, but sign-in failed. Please log in with this Student ID.`,
      );
    }
  }

  async login(
    studentId: string,
    password: string,
    client: LoginClientInfo = {},
  ) {
    const [credential] = await db
      .select()
      .from(zuvyStudentCredentials)
      .where(eq(zuvyStudentCredentials.studentId, studentId))
      .limit(1);

    if (!credential) {
      // Spend the same time as a real check so IDs can't be probed by timing.
      await this.verifyPassword(password, null);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (
      credential.lockedUntil &&
      new Date(credential.lockedUntil).getTime() > Date.now()
    ) {
      throw new HttpException(
        `Too many wrong attempts. Try again after ${this.minutesUntil(credential.lockedUntil)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await this.verifyPassword(password, credential.passwordHash);
    if (!valid) {
      await this.recordFailedAttempt(credential.id);
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, credential.userId))
      .limit(1);
    if (!user) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const now = new Date().toISOString();
    await db
      .update(zuvyStudentCredentials)
      .set({ failedAttempts: 0, lockedUntil: null } as any)
      .where(eq(zuvyStudentCredentials.id, credential.id));
    await db
      .update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, user.id));
    user.lastLoginAt = now;

    const session = await this.authService.issueLoginSession(user, {
      method: 'student_id',
      ...client,
      udiseCode: credential.udiseCode,
    });
    return {
      studentId: credential.studentId,
      // Null for accounts created before school was asked at sign-up.
      school: credential.udiseCode
        ? {
            state: credential.state,
            city: credential.city,
            schoolName: credential.schoolName,
            udiseCode: credential.udiseCode,
          }
        : null,
      ...session,
    };
  }

  async resetPassword(
    actorUserId: number,
    studentId: string,
    newPassword?: string,
  ) {
    await this.assertSuperAdmin(actorUserId);
    const { credential, user } = await this.getStudentOrThrow(studentId);

    const password = newPassword || this.generatePassword();
    const now = new Date().toISOString();
    await db
      .update(zuvyStudentCredentials)
      .set({
        passwordHash: await this.hashPassword(password),
        passwordUpdatedAt: now,
        failedAttempts: 0,
        lockedUntil: null,
        lastResetBy: BigInt(actorUserId),
        lastResetAt: now,
      } as any)
      .where(eq(zuvyStudentCredentials.id, credential.id));

    this.logger.log(
      `Password reset for Student ID ${credential.studentId} (user ${user.id}) by user ${actorUserId}`,
    );

    return {
      status: 'success',
      message:
        'Password updated. Share it with the student; it is not shown again.',
      data: {
        studentId: credential.studentId,
        userId: user.id.toString(),
        name: user.name,
        password,
      },
    };
  }

  async findStudents(
    actorUserId: number,
    query: { studentId?: string; name?: string; limit?: number },
  ) {
    await this.assertSuperAdmin(actorUserId);
    if (!query.studentId && !query.name) {
      throw new BadRequestException('Pass a studentId or a name to search');
    }

    const rows = await db
      .select({
        userId: users.id,
        studentId: zuvyStudentCredentials.studentId,
        name: users.name,
        state: zuvyStudentCredentials.state,
        city: zuvyStudentCredentials.city,
        schoolName: zuvyStudentCredentials.schoolName,
        udiseCode: zuvyStudentCredentials.udiseCode,
        createdAt: zuvyStudentCredentials.createdAt,
        lastLoginAt: users.lastLoginAt,
        lockedUntil: zuvyStudentCredentials.lockedUntil,
        lastResetAt: zuvyStudentCredentials.lastResetAt,
      })
      .from(zuvyStudentCredentials)
      .innerJoin(users, eq(users.id, zuvyStudentCredentials.userId))
      .where(
        and(
          query.studentId
            ? eq(zuvyStudentCredentials.studentId, query.studentId)
            : undefined,
          query.name ? ilike(users.name, `%${query.name}%`) : undefined,
        ),
      )
      .orderBy(desc(zuvyStudentCredentials.createdAt))
      .limit(query.limit ?? 20);

    return {
      status: 'success',
      data: rows.map((r) => ({ ...r, userId: r.userId.toString() })),
    };
  }

  /**
   * Admin enrolment goes through POST /bootcamp/students/:id, which looks
   * students up by email, so email-less students are enrolled here by
   * Student ID instead. Public courses need nothing: students are enrolled
   * automatically when they open one.
   *
   * Allowed for super admins (any course) and for admins / ops of the
   * organisation that owns the course, in their current org session.
   */
  async enrollStudent(
    actor: { userId: number; orgId: number | null },
    studentId: string,
    bootcampId: number,
    batchId?: number,
  ) {
    const [bootcamp] = await db
      .select({
        id: zuvyBootcamps.id,
        name: zuvyBootcamps.name,
        organizationId: zuvyBootcamps.organizationId,
      })
      .from(zuvyBootcamps)
      .where(eq(zuvyBootcamps.id, bootcampId))
      .limit(1);

    // Authorise before revealing whether the course or Student ID exists.
    await this.assertCanEnroll(actor, bootcamp?.organizationId ?? null);
    if (!bootcamp) throw new NotFoundException('Course not found');

    const { user } = await this.getStudentOrThrow(studentId);

    if (batchId) {
      const [batch] = await db
        .select()
        .from(zuvyBatches)
        .where(
          and(
            eq(zuvyBatches.id, batchId),
            eq(zuvyBatches.bootcampId, bootcampId),
          ),
        )
        .limit(1);
      if (!batch) throw new NotFoundException('Batch not found in this course');

      if (batch.capEnrollment) {
        const [{ count }] = await db
          .select({ count: sql<number>`count(*)` })
          .from(zuvyBatchEnrollments)
          .where(eq(zuvyBatchEnrollments.batchId, batchId));
        if (Number(count) >= batch.capEnrollment) {
          throw new BadRequestException(
            'The maximum capacity for the batch has been reached',
          );
        }
      }
    }

    const [existing] = await db
      .select()
      .from(zuvyBatchEnrollments)
      .where(
        and(
          eq(zuvyBatchEnrollments.userId, user.id),
          eq(zuvyBatchEnrollments.bootcampId, bootcampId),
        ),
      )
      .limit(1);

    if (existing) {
      if (batchId && existing.batchId !== batchId) {
        await db
          .update(zuvyBatchEnrollments)
          .set({ batchId })
          .where(eq(zuvyBatchEnrollments.id, existing.id));
        return {
          status: 'success',
          message: 'Student moved to the selected batch',
          data: this.enrollmentSummary(user, studentId, bootcamp, batchId),
        };
      }
      throw new ConflictException('Student is already enrolled in this course');
    }

    const now = new Date().toISOString();
    await db.insert(zuvyBatchEnrollments).values({
      userId: user.id,
      bootcampId,
      batchId: batchId ?? null,
      enrolledDate: now,
      lastActiveDate: now,
      status: 'active',
    });

    return {
      status: 'success',
      message: `Student ${studentId} enrolled in ${bootcamp.name}`,
      data: this.enrollmentSummary(user, studentId, bootcamp, batchId),
    };
  }

  private enrollmentSummary(
    user: { id: bigint; name: string },
    studentId: string,
    bootcamp: { id: number; name: string },
    batchId?: number,
  ) {
    // The name lets the admin confirm they typed the right Student ID.
    return {
      studentId,
      userId: user.id.toString(),
      name: user.name,
      bootcampId: bootcamp.id,
      bootcampName: bootcamp.name,
      batchId: batchId ?? null,
    };
  }

  private async assertCanEnroll(
    actor: { userId: number; orgId: number | null },
    courseOrgId: number | null,
  ) {
    const globalRoles = await this.authService.getUserRoles(
      Number(actor.userId),
      null,
    );
    if (globalRoles.includes('super_admin')) return;

    const orgRoles = actor.orgId
      ? await this.authService.getUserRoles(
          Number(actor.userId),
          Number(actor.orgId),
        )
      : [];
    if (!canEnrollInCourse(orgRoles, actor.orgId, courseOrgId)) {
      throw new ForbiddenException(
        "Only super admins, or admins and ops of this course's organisation, can enrol students by Student ID",
      );
    }
  }

  /**
   * The school picked at sign-up, from our school list. The state and city
   * must be the ones the school is in, so a stale or tampered dropdown
   * cannot save a mismatched address.
   */
  private async resolveSchool(
    state: string,
    city: string,
    udiseCode: string,
  ): Promise<StudentSchool> {
    const school = await this.schoolsService.findActiveByUdise(udiseCode);
    if (!school) {
      throw new BadRequestException(
        'School not found. Please pick your school from the list.',
      );
    }
    if (
      placeKey(state) !== placeKey(school.state) ||
      placeKey(city) !== placeKey(school.district)
    ) {
      throw new BadRequestException(
        'This school is not in the selected state and city. Please pick it again.',
      );
    }
    return {
      state: school.state,
      city: school.district,
      schoolName: school.schoolName,
      udiseCode: school.udiseCode,
    };
  }

  private async insertCredentialWithUniqueId(
    userId: bigint,
    name: string,
    passwordHash: string,
    school: StudentSchool,
  ): Promise<string> {
    const base = studentIdBaseFromName(name);
    for (let attempt = 0; attempt < STUDENT_ID_ATTEMPTS; attempt++) {
      const studentId = formatStudentId(base, await this.nextNumberFor(base));
      try {
        await db.insert(zuvyStudentCredentials).values({
          userId,
          studentId,
          passwordHash,
          state: school.state,
          city: school.city,
          schoolName: school.schoolName,
          udiseCode: school.udiseCode,
        } as any);
        return studentId;
      } catch (error) {
        // 23505 = unique violation. The counter makes this practically
        // impossible; it can only happen if an ID was created outside this
        // code. Take the next number and try again.
        const code = error?.code ?? error?.cause?.code;
        if (code !== '23505') throw error;
      }
    }
    throw new Error('Could not generate a unique Student ID');
  }

  /**
   * Hands out the next number for a name in one atomic statement: the
   * first call for "aruneshdhar" returns 1, the next 2, and so on. Two
   * students with the same name signing up at the same moment get
   * different numbers, because Postgres locks the counter row while it
   * updates it. Numbers are never reused, even if an account is deleted.
   */
  private async nextNumberFor(base: string): Promise<number> {
    const [row] = await db
      .insert(zuvyStudentIdCounters)
      .values({ base, lastNumber: 1 })
      .onConflictDoUpdate({
        target: zuvyStudentIdCounters.base,
        set: {
          lastNumber: sql`${zuvyStudentIdCounters.lastNumber} + 1`,
          updatedAt: sql`now()`,
        } as any,
      })
      .returning({ lastNumber: zuvyStudentIdCounters.lastNumber });
    return Number(row.lastNumber);
  }

  private async getStudentOrThrow(studentId: string) {
    const [row] = await db
      .select({ credential: zuvyStudentCredentials, user: users })
      .from(zuvyStudentCredentials)
      .innerJoin(users, eq(users.id, zuvyStudentCredentials.userId))
      .where(eq(zuvyStudentCredentials.studentId, studentId))
      .limit(1);
    if (!row) throw new NotFoundException('Student ID not found');
    return row;
  }

  private async assertSuperAdmin(userId: number) {
    const roles = await this.authService.getUserRoles(Number(userId), null);
    if (!roles.includes('super_admin')) {
      throw new ForbiddenException('Only super admins can manage Student IDs');
    }
  }

  private async recordFailedAttempt(credentialId: number) {
    const [row] = await db
      .update(zuvyStudentCredentials)
      .set({
        failedAttempts: sql`${zuvyStudentCredentials.failedAttempts} + 1`,
      } as any)
      .where(eq(zuvyStudentCredentials.id, credentialId))
      .returning({ failedAttempts: zuvyStudentCredentials.failedAttempts });

    if (row && row.failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await db
        .update(zuvyStudentCredentials)
        .set({
          failedAttempts: 0,
          lockedUntil: new Date(
            Date.now() + LOCK_MINUTES * 60 * 1000,
          ).toISOString(),
        } as any)
        .where(eq(zuvyStudentCredentials.id, credentialId));
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16);
    const hash = await scryptAsync(
      password,
      salt,
      SCRYPT_KEYLEN,
      SCRYPT_PARAMS,
    );
    return [
      'scrypt',
      SCRYPT_PARAMS.N,
      SCRYPT_PARAMS.r,
      SCRYPT_PARAMS.p,
      salt.toString('base64'),
      hash.toString('base64'),
    ].join('$');
  }

  private async verifyPassword(
    password: string,
    stored: string | null,
  ): Promise<boolean> {
    const parts = stored?.split('$');
    if (!parts || parts.length !== 6 || parts[0] !== 'scrypt') {
      // Unknown ID or malformed hash: hash anyway to keep timing uniform.
      await scryptAsync(
        password,
        randomBytes(16),
        SCRYPT_KEYLEN,
        SCRYPT_PARAMS,
      );
      return false;
    }
    const [, n, r, p, saltB64, hashB64] = parts;
    const expected = Buffer.from(hashB64, 'base64');
    const actual = await scryptAsync(
      password,
      Buffer.from(saltB64, 'base64'),
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p) },
    );
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  }

  private generatePassword(): string {
    let password = '';
    for (let i = 0; i < GENERATED_PASSWORD_LENGTH; i++) {
      password +=
        GENERATED_PASSWORD_ALPHABET[
          randomInt(GENERATED_PASSWORD_ALPHABET.length)
        ];
    }
    return password;
  }

  private minutesUntil(timestamp: string): number {
    return Math.max(
      1,
      Math.ceil((new Date(timestamp).getTime() - Date.now()) / 60000),
    );
  }
}
