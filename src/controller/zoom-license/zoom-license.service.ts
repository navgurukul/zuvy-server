import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import {
  zuvyUserLicenses,
  licenses,
  licenseAssignments,
  users,
  zuvySessions,
} from '../../../drizzle/schema';
import {
  eq,
  and,
  or,
  ne,
  isNull,
  sql,
  lt,
  gt,
  notExists,
  notInArray,
} from 'drizzle-orm';
import { ZoomService } from '../../services/zoom/zoom.service';
import {
  ZOOM_LICENSE_COOLDOWN_MS,
  buildZoomLicenseCooldownIntervalSql,
} from '../../common/constants/zoom-license.constants';

@Injectable()
export class ZoomLicenseService {
  private readonly logger = new Logger(ZoomLicenseService.name);
  private readonly licenseCooldownMs = ZOOM_LICENSE_COOLDOWN_MS;

  constructor(private readonly zoomService: ZoomService) {}

  async getProtectedLicenseEmails(trx: any = db) {
    const rows = await trx
      .select({ email: zuvyUserLicenses.zoomEmail })
      .from(zuvyUserLicenses)
      .where(eq(zuvyUserLicenses.isProtected, true));

    return new Set(
      rows
        .map((row) => row.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );
  }

  private getConfiguredTotalLicenseCount() {
    const configured = Number(process.env.ZOOM_TOTAL_LICENSES || 7);
    return Number.isFinite(configured) && configured > 0 ? configured : 7;
  }

  private async getInstructorEmail(trx: any, instructorId: number) {
    const rows = await trx
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, BigInt(instructorId)))
      .limit(1);

    return rows[0]?.email ? String(rows[0].email).toLowerCase() : null;
  }

  private normalizedLicenseEmail() {
    return sql<string>`lower(${licenses.zoomId})`;
  }

  private normalizedUserEmail() {
    return sql<string>`lower(${users.email})`;
  }

  private alwaysTrueCondition() {
    return sql.raw('1 = 1');
  }

  private blockingSessionCondition() {
    return and(
      or(isNull(zuvySessions.status), ne(zuvySessions.status, 'merged')),
      eq(zuvySessions.isZoomMeet, true),
    );
  }

  private getBufferedEndTime(date: Date) {
    return new Date(date.getTime() + this.licenseCooldownMs);
  }

  private async getOrCreatePlaceholderLicenseId(
    trx: any,
    instructorEmail: string,
  ): Promise<number> {
    const normalizedEmail = instructorEmail.trim().toLowerCase();
    const existing = await trx
      .select({ id: licenses.id })
      .from(licenses)
      .where(eq(licenses.zoomId, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return Number(existing[0].id);
    }

    const inserted = await trx
      .insert(licenses)
      .values({
        zoomId: normalizedEmail,
        name: normalizedEmail,
        status: 'inactive',
      } as any)
      .returning({ id: licenses.id });

    return Number(inserted[0].id);
  }

  private formatNextAvailableTime(date: Date) {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      day: 'numeric',
      month: 'short',
      timeZone: 'Asia/Calcutta',
    }).format(date);
  }

  private buildInstructorPoolCondition(
    protectedEmails: string[],
    instructorEmail: string | null,
  ) {
    const protectedEmailSet = new Set(protectedEmails);
    const instructorIsProtected = instructorEmail
      ? protectedEmailSet.has(instructorEmail)
      : false;

    return instructorIsProtected
      ? eq(this.normalizedUserEmail(), instructorEmail!)
      : protectedEmails.length
        ? notInArray(this.normalizedUserEmail(), protectedEmails)
        : this.alwaysTrueCondition();
  }

  private async getProtectedSeatReservationCount(
    trx: any = db,
  ): Promise<number> {
    const protectedCount = await trx
      .select({ count: sql<number>`count(*)` })
      .from(zuvyUserLicenses)
      .where(
        and(
          eq(zuvyUserLicenses.isProtected, true),
          eq(zuvyUserLicenses.status, 'active'),
          eq(zuvyUserLicenses.licenseType, 2),
        ),
      );

    return Number(protectedCount[0]?.count || 0);
  }

  async getTransferableLicensePoolCount(trx: any = db): Promise<number> {
    const total = this.getConfiguredTotalLicenseCount();
    const protectedSeats = await this.getProtectedSeatReservationCount(trx);
    return Math.max(total - protectedSeats, 0);
  }

  private async logLicensePoolSnapshot(
    trx: any,
    dto: { startTime: Date; endTime: Date },
    instructorEmail: string | null,
    context: string,
  ) {
    const totalLicenses = this.getConfiguredTotalLicenseCount();
    const protectedLicenses = await this.getProtectedSeatReservationCount(trx);
    const transferableLicenses = Math.max(totalLicenses - protectedLicenses, 0);
    const usedLicenses = await this.getOverlappingAssignmentCountForPool(
      trx,
      dto,
      instructorEmail,
    );
    const protectedEmails = await this.getProtectedLicenseEmails(trx);
    const instructorIsProtected = instructorEmail
      ? protectedEmails.has(instructorEmail)
      : false;
    const availableLicenses = instructorIsProtected
      ? Math.max(1 - usedLicenses, 0)
      : Math.max(transferableLicenses - usedLicenses, 0);

    const message = `[Zoom License Pool][${context}] total=${totalLicenses}, protected=${protectedLicenses}, transferable=${transferableLicenses}, reserved=${usedLicenses}, available=${availableLicenses}, instructor=${instructorEmail || 'unknown'}, window=${dto.startTime.toISOString()} -> ${dto.endTime.toISOString()}`;
    this.logger.log(message);
    console.log(message);
  }

  private async getNextPoolAvailabilityTime(
    trx: any,
    dto: { startTime: Date; endTime: Date },
    instructorEmail: string | null,
  ): Promise<Date | null> {
    const protectedEmails = await this.getProtectedLicenseEmails(trx);
    const protectedEmailList = Array.from(protectedEmails) as string[];
    const instructorIsProtected = instructorEmail
      ? protectedEmails.has(instructorEmail)
      : false;
    const requestedDurationMs = dto.endTime.getTime() - dto.startTime.getTime();
    const poolSize = instructorIsProtected
      ? 1
      : await this.getTransferableLicensePoolCount(trx);

    const assignments = await trx
      .select({
        startTime: licenseAssignments.startTime,
        endTime: licenseAssignments.endTime,
      })
      .from(licenseAssignments)
      .innerJoin(
        zuvySessions,
        eq(licenseAssignments.sessionId, zuvySessions.id),
      )
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingSessionCondition(),
          this.buildInstructorPoolCondition(
            protectedEmailList,
            instructorEmail,
          ),
        ),
      );

    if (!assignments.length) {
      return null;
    }

    const blockedWindows = assignments.map((assignment) => ({
      startTime: new Date(assignment.startTime),
      endTime: this.getBufferedEndTime(new Date(assignment.endTime)),
    }));

    const candidateTimes = [
      dto.startTime,
      ...blockedWindows.map((window) => window.endTime),
    ]
      .map((date) => new Date(date))
      .sort((a, b) => a.getTime() - b.getTime());

    for (const candidateStart of candidateTimes) {
      if (candidateStart.getTime() < dto.startTime.getTime()) {
        continue;
      }

      const candidateEnd = new Date(
        candidateStart.getTime() + requestedDurationMs,
      );

      const overlappingCount = blockedWindows.filter(
        (window) =>
          window.startTime.getTime() < candidateEnd.getTime() &&
          window.endTime.getTime() > candidateStart.getTime(),
      ).length;

      if (overlappingCount < poolSize) {
        return candidateStart;
      }
    }

    return candidateTimes[candidateTimes.length - 1] || null;
  }

  async getNextAvailableLicenseTimeForInstructor(
    trx: any,
    dto: { startTime: Date; endTime: Date },
    instructorEmail: string | null,
  ) {
    return this.getNextPoolAvailabilityTime(trx, dto, instructorEmail);
  }

  formatAvailabilityMessage(date: Date) {
    return this.formatNextAvailableTime(date);
  }

  private async getOverlappingAssignmentCountForPool(
    trx: any,
    dto: { startTime: Date; endTime: Date },
    instructorEmail: string | null,
  ): Promise<number> {
    const protectedEmails = await this.getProtectedLicenseEmails(trx);
    const protectedEmailList = Array.from(protectedEmails) as string[];
    const overlappingCount = await trx
      .select({ count: sql<number>`count(*)` })
      .from(licenseAssignments)
      .innerJoin(
        zuvySessions,
        eq(licenseAssignments.sessionId, zuvySessions.id),
      )
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingSessionCondition(),
          lt(licenseAssignments.startTime, dto.endTime),
          sql`${licenseAssignments.endTime} + ${buildZoomLicenseCooldownIntervalSql()} > ${dto.startTime}`,
          this.buildInstructorPoolCondition(
            protectedEmailList,
            instructorEmail,
          ),
        ),
      );

    return Number(overlappingCount[0]?.count || 0);
  }

  private async fetchAvailableLicenseIds(
    trx: any,
    dto: {
      instructorId: number;
      startTime: Date;
      endTime: Date;
      instructorEmail?: string | null;
    },
  ) {
    const protectedEmails = await this.getProtectedLicenseEmails(trx);
    const instructorEmail =
      dto.instructorEmail ||
      (await this.getInstructorEmail(trx, dto.instructorId));
    const instructorIsProtected = instructorEmail
      ? protectedEmails.has(instructorEmail)
      : false;
    const protectedEmailList = Array.from(protectedEmails);
    const normalizedLicenseEmail = this.normalizedLicenseEmail();

    return await trx
      .select({ id: licenses.id, zoomId: licenses.zoomId })
      .from(zuvyUserLicenses)
      .innerJoin(licenses, eq(licenses.zoomId, zuvyUserLicenses.zoomEmail))
      .where(
        and(
          eq(zuvyUserLicenses.status, 'active'),
          eq(zuvyUserLicenses.licenseType, 2),
          eq(licenses.status, 'active'),
          instructorIsProtected
            ? eq(normalizedLicenseEmail, instructorEmail!)
            : protectedEmailList.length
              ? notInArray(normalizedLicenseEmail, protectedEmailList)
              : this.alwaysTrueCondition(),
          notExists(
            db
              .select({ one: sql`1` })
              .from(licenseAssignments)
              .innerJoin(
                zuvySessions,
                eq(licenseAssignments.sessionId, zuvySessions.id),
              )
              .where(
                and(
                  this.blockingSessionCondition(),
                  eq(licenseAssignments.licenseId, licenses.id),
                  sql`${licenseAssignments.startTime} < ${dto.endTime}`,
                  sql`${licenseAssignments.endTime} + ${buildZoomLicenseCooldownIntervalSql()} > ${dto.startTime}`,
                ),
              ),
          ),
        ),
      )
      .limit(1)
      .for('update');
  }

  async getActiveLicensePoolCount(
    trx: any = db,
    options?: { instructorEmail?: string | null },
  ): Promise<number> {
    const protectedEmails = await this.getProtectedLicenseEmails(trx);
    const hasInstructorEmail = typeof options?.instructorEmail === 'string';
    const instructorEmail = hasInstructorEmail
      ? options!.instructorEmail!.toLowerCase()
      : null;
    const instructorIsProtected = instructorEmail
      ? protectedEmails.has(instructorEmail)
      : false;
    const protectedEmailList = Array.from(protectedEmails);
    const normalizedLicenseEmail = this.normalizedLicenseEmail();

    const totalLicenseCount = await trx
      .select({ count: sql<number>`count(*)` })
      .from(zuvyUserLicenses)
      .innerJoin(licenses, eq(licenses.zoomId, zuvyUserLicenses.zoomEmail))
      .where(
        and(
          eq(zuvyUserLicenses.status, 'active'),
          eq(zuvyUserLicenses.licenseType, 2),
          eq(licenses.status, 'active'),
          hasInstructorEmail
            ? instructorIsProtected
              ? eq(normalizedLicenseEmail, instructorEmail!)
              : protectedEmailList.length
                ? notInArray(normalizedLicenseEmail, protectedEmailList)
                : this.alwaysTrueCondition()
            : undefined,
        ),
      );

    return Number(totalLicenseCount[0]?.count || 0);
  }

  async syncLicensedUsersFromZoom() {
    const zoomUsers = await this.zoomService.listAuthorizedUsers({
      status: 'active',
      hostType: 'licensed',
      page_size: 300,
    });

    if (!zoomUsers.success) {
      throw new BadRequestException(
        zoomUsers.error || 'Failed to fetch licensed Zoom users.',
      );
    }

    const licensedUsers = zoomUsers.data?.users || [];
    for (const user of licensedUsers) {
      await this.zoomService.syncZoomLicenseUser({
        email: user.email,
        zoomUserId: user.id,
        userName: user.displayName || user.name || user.email,
        licenseType: user.userType,
        status: user.status,
      });
    }

    return licensedUsers.length;
  }

  /**
   * Internal method to find and reserve a license for a specific time range.
   * Should be called within a transaction.
   */
  async assignLicense(
    trx: any,
    dto: { instructorId: number; startTime: Date; endTime: Date },
  ): Promise<number> {
    const instructorEmail = await this.getInstructorEmail(
      trx,
      dto.instructorId,
    );
    const protectedEmails = await this.getProtectedLicenseEmails(trx);
    const instructorIsProtected = instructorEmail
      ? protectedEmails.has(instructorEmail)
      : false;

    await this.logLicensePoolSnapshot(
      trx,
      dto,
      instructorEmail,
      'before-allocation',
    );

    // Each overlapping Zoom session consumes one license. Even if the same
    // instructor already has another overlapping session, we must allocate a
    // distinct free license or reject the new session once the pool is exhausted.
    let availableLicenses = await this.fetchAvailableLicenseIds(trx, {
      ...dto,
      instructorEmail,
    });

    if (availableLicenses.length === 0) {
      const poolCapacity = instructorIsProtected
        ? 1
        : await this.getTransferableLicensePoolCount(trx);
      let totalCount = instructorIsProtected
        ? await this.getActiveLicensePoolCount(trx, {
            instructorEmail,
          })
        : poolCapacity;
      if (totalCount === 0) {
        this.logger.warn(
          'Active Zoom license pool is empty in DB. Attempting one-time sync from Zoom before rejecting allocation.',
        );
        await this.syncLicensedUsersFromZoom();
        availableLicenses = await this.fetchAvailableLicenseIds(trx, {
          ...dto,
          instructorEmail,
        });
        totalCount = instructorIsProtected
          ? await this.getActiveLicensePoolCount(trx, {
              instructorEmail,
            })
          : poolCapacity;
      }

      if (availableLicenses.length > 0) {
        const assignedLicenseId = availableLicenses[0].id as number;
        this.logger.log(
          `Recovered Zoom license allocation after pool sync. Assigned license ${assignedLicenseId} to instructor ${dto.instructorId}.`,
        );
        await this.logLicensePoolSnapshot(
          trx,
          dto,
          instructorEmail,
          'after-sync-recovery',
        );
        return assignedLicenseId;
      }

      const usedCount = await this.getOverlappingAssignmentCountForPool(
        trx,
        dto,
        instructorEmail,
      );

      if (
        !instructorIsProtected &&
        instructorEmail &&
        usedCount < poolCapacity
      ) {
        const placeholderLicenseId = await this.getOrCreatePlaceholderLicenseId(
          trx,
          instructorEmail,
        );
        this.logger.log(
          `Reserved shared Zoom pool seat ${placeholderLicenseId} for instructor ${dto.instructorId} using placeholder license row.`,
        );
        return placeholderLicenseId;
      }

      const nextAvailableAt = await this.getNextPoolAvailabilityTime(
        trx,
        dto,
        instructorEmail,
      );

      throw new BadRequestException(
        nextAvailableAt && nextAvailableAt.getTime() > dto.startTime.getTime()
          ? `No Zoom licenses available for this time period. You can create session after ${this.formatNextAvailableTime(nextAvailableAt)}.`
          : `No Zoom licenses available for this time period. Active licensed pool: ${totalCount}, overlapping assignments: ${usedCount}.`,
      );
    }

    const assignedLicenseId = availableLicenses[0].id as number;

    const totalCount = await this.getActiveLicensePoolCount(trx, {
      instructorEmail,
    });
    const usedCount = await this.getOverlappingAssignmentCountForPool(
      trx,
      dto,
      instructorEmail,
    );
    const availableCount = totalCount - usedCount - 1;

    const currentUsers = await trx
      .select({
        name: users.name,
        email: users.email,
      })
      .from(licenseAssignments)
      .innerJoin(
        zuvySessions,
        eq(licenseAssignments.sessionId, zuvySessions.id),
      )
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingSessionCondition(),
          lt(licenseAssignments.startTime, dto.endTime),
          sql`${licenseAssignments.endTime} + ${buildZoomLicenseCooldownIntervalSql()} > ${dto.startTime}`,
          this.buildInstructorPoolCondition(
            Array.from(protectedEmails) as string[],
            instructorEmail,
          ),
        ),
      );

    const userList = currentUsers
      .map((r) => `${r.name} (${r.email})`)
      .join(', ');
    this.logger.log(
      `Assigned license ${assignedLicenseId} to instructor ${dto.instructorId} for ${dto.startTime.toISOString()} - ${dto.endTime.toISOString()}.`,
    );
    this.logger.log(
      `Active licensed users for this period: ${userList || 'None'}`,
    );
    this.logger.log(
      `Available licenses for this period: ${totalCount - usedCount} active, ${availableCount} remaining in pool.`,
    );
    await this.logLicensePoolSnapshot(
      trx,
      dto,
      instructorEmail,
      'allocation-success',
    );

    return assignedLicenseId;
  }

  /**
   * Internal method to finalize a license assignment record.
   * Should be called within a transaction after the session is saved.
   */
  async createLicenseAssignment(
    trx: any,
    dto: {
      licenseId: number;
      instructorId: number;
      sessionId: number;
      startTime: Date;
      endTime: Date;
    },
  ) {
    await trx.insert(licenseAssignments).values({
      licenseId: dto.licenseId,
      instructorId: dto.instructorId,
      sessionId: dto.sessionId,
      startTime: dto.startTime,
      endTime: dto.endTime,
    } as any);
  }

  async getInstructorLicenses(instructorId: number) {
    return await db
      .select({
        assignmentId: licenseAssignments.id,
        licenseId: licenseAssignments.licenseId,
        sessionId: licenseAssignments.sessionId,
        startTime: licenseAssignments.startTime,
        endTime: licenseAssignments.endTime,
        licenseName: zuvyUserLicenses.userName,
        zoomEmail: zuvyUserLicenses.zoomEmail,
      })
      .from(licenseAssignments)
      .innerJoin(
        zuvyUserLicenses,
        eq(licenseAssignments.licenseId, zuvyUserLicenses.id),
      )
      .where(eq(licenseAssignments.instructorId, instructorId))
      .orderBy(sql`${licenseAssignments.startTime} DESC`);
  }

  async getDashboard() {
    const now = new Date();

    const totalLicenses = await this.getActiveLicensePoolCount();

    const activeAssignments = await db
      .select({ count: sql<number>`count(*)` })
      .from(licenseAssignments)
      .innerJoin(
        zuvySessions,
        eq(licenseAssignments.sessionId, zuvySessions.id),
      )
      .where(
        and(
          this.blockingSessionCondition(),
          lt(licenseAssignments.startTime, now),
          gt(licenseAssignments.endTime, now),
        ),
      );

    const usedCount = Number(activeAssignments[0]?.count || 0);

    return {
      totalLicenses,
      usedLicenses: usedCount,
      availableLicenses: totalLicenses - usedCount,
      timestamp: now,
    };
  }

  async seedLicenses() {
    const syncedCount = await this.syncLicensedUsersFromZoom();

    return {
      message: `Synced ${syncedCount} licensed Zoom users to zuvy_user_licenses.`,
    };
  }
}
