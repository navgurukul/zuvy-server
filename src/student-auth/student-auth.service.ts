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
} from 'drizzle/schema';
import { AuthService } from 'src/auth/auth.service';
import { CaptchaService } from './captcha.service';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SCRYPT_KEYLEN = 64;

// No 0/O, 1/I/L: Student IDs are read aloud and copied by children.
const STUDENT_ID_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const STUDENT_ID_PREFIX = 'ZV';
const STUDENT_ID_RANDOM_LENGTH = 6;
const GENERATED_PASSWORD_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GENERATED_PASSWORD_LENGTH = 8;

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const INVALID_CREDENTIALS = 'Invalid Student ID or password';

@Injectable()
export class StudentAuthService {
  private readonly logger = new Logger(StudentAuthService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  async signup(
    name: string,
    password: string,
    captchaToken?: string,
    clientIp?: string,
  ) {
    // Before any database work, so bots never create rows.
    await this.captchaService.verify(captchaToken, clientIp);

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
        passwordHash,
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
      const session = await this.authService.issueLoginSession(user);
      return { studentId, ...session };
    } catch (error) {
      // The account exists at this point, so never lose the Student ID.
      this.logger.error(`Session after signup failed: ${error?.message}`);
      throw new InternalServerErrorException(
        `Account created with Student ID ${studentId}, but sign-in failed. Please log in with this Student ID.`,
      );
    }
  }

  async login(studentId: string, password: string) {
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

    const session = await this.authService.issueLoginSession(user);
    return { studentId: credential.studentId, ...session };
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
   */
  async enrollStudent(
    actorUserId: number,
    studentId: string,
    bootcampId: number,
    batchId?: number,
  ) {
    await this.assertSuperAdmin(actorUserId);
    const { user } = await this.getStudentOrThrow(studentId);

    const [bootcamp] = await db
      .select({ id: zuvyBootcamps.id, name: zuvyBootcamps.name })
      .from(zuvyBootcamps)
      .where(eq(zuvyBootcamps.id, bootcampId))
      .limit(1);
    if (!bootcamp) throw new NotFoundException('Course not found');

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
    };
  }

  private async insertCredentialWithUniqueId(
    userId: bigint,
    passwordHash: string,
  ): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const studentId = this.generateStudentId();
      try {
        await db.insert(zuvyStudentCredentials).values({
          userId,
          studentId,
          passwordHash,
        });
        return studentId;
      } catch (error) {
        // 23505 = unique violation; only the random Student ID can collide.
        const code = error?.code ?? error?.cause?.code;
        if (code !== '23505') throw error;
      }
    }
    throw new Error('Could not generate a unique Student ID');
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

  private generateStudentId(): string {
    let id = STUDENT_ID_PREFIX;
    for (let i = 0; i < STUDENT_ID_RANDOM_LENGTH; i++) {
      id += STUDENT_ID_ALPHABET[randomInt(STUDENT_ID_ALPHABET.length)];
    }
    return id;
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
