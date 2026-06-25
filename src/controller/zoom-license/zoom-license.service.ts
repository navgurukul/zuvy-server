import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import {
  zuvyUserLicenses,
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
    return sql<string>`lower(${zuvyUserLicenses.zoomEmail})`;
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

  private blockingAssignmentCondition() {
    return or(
      and(
        eq(licenseAssignments.sourceType, 'class_session'),
        this.blockingSessionCondition(),
      ),
      eq(licenseAssignments.sourceType, 'mentor_slot'),
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
      .select({ id: zuvyUserLicenses.id })
      .from(zuvyUserLicenses)
      .where(eq(zuvyUserLicenses.zoomEmail, normalizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return Number(existing[0].id);
    }

    const inserted = await trx
      .insert(zuvyUserLicenses)
      .values({
        zoomEmail: normalizedEmail,
        userName: normalizedEmail,
        licenseType: 1,
        status: 'active',
        isProtected: false,
      } as any)
      .returning({ id: zuvyUserLicenses.id });

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

  // Remove the codesnippet later - For debugging and monitoring purposes, not meant for regular use
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
    const protectedEmailList = Array.from(protectedEmails) as string[];
    const availableLicenses = instructorIsProtected
      ? Math.max(1 - usedLicenses, 0)
      : Math.max(transferableLicenses - usedLicenses, 0);

    const protectedLicenseUsers = await trx
      .select({
        email: zuvyUserLicenses.zoomEmail,
        name: zuvyUserLicenses.userName,
      })
      .from(zuvyUserLicenses)
      .where(
        and(
          eq(zuvyUserLicenses.isProtected, true),
          eq(zuvyUserLicenses.status, 'active'),
          eq(zuvyUserLicenses.licenseType, 2),
        ),
      );

    const reservedLicenseUsers = await trx
      .select({
        licenseEmail: zuvyUserLicenses.zoomEmail,
        licenseName: zuvyUserLicenses.userName,
        instructorEmail: users.email,
        instructorName: users.name,
        sessionId: zuvySessions.id,
        sessionTitle: zuvySessions.title,
        mentorSlotAvailabilityId: licenseAssignments.mentorSlotAvailabilityId,
        sourceType: licenseAssignments.sourceType,
        startTime: licenseAssignments.startTime,
        endTime: licenseAssignments.endTime,
      })
      .from(licenseAssignments)
      .innerJoin(
        zuvyUserLicenses,
        eq(licenseAssignments.licenseId, zuvyUserLicenses.id),
      )
      .leftJoin(zuvySessions, eq(licenseAssignments.sessionId, zuvySessions.id))
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingAssignmentCondition(),
          lt(licenseAssignments.startTime, dto.endTime),
          sql`${licenseAssignments.endTime} + ${buildZoomLicenseCooldownIntervalSql()} > ${dto.startTime}`,
          this.buildInstructorPoolCondition(
            protectedEmailList,
            instructorEmail,
          ),
        ),
      );

    const formatUsers = (
      rows: Array<{ email?: string | null; name?: string | null }>,
    ) =>
      rows
        .map((row) =>
          row.name && row.name !== row.email
            ? `${row.email} (${row.name})`
            : row.email,
        )
        .filter(Boolean)
        .join(', ') || 'none';

    const reservedDetails =
      reservedLicenseUsers
        .map((row) => {
          const transferLabel =
            row.licenseEmail?.toLowerCase() ===
            row.instructorEmail?.toLowerCase()
              ? 'self'
              : 'transfer';

          const resourceLabel =
            row.sourceType === 'mentor_slot'
              ? `mentor slot ${row.mentorSlotAvailabilityId}`
              : `session ${row.sessionId}: "${row.sessionTitle}"`;

          return `${row.licenseEmail} (${row.licenseName || 'license'}) -> ${row.instructorEmail} (${row.instructorName || 'instructor'}) [${transferLabel}] | ${resourceLabel} | ${row.startTime.toISOString()} -> ${row.endTime.toISOString()}`;
        })
        .join('; ') || 'none';

    const message = `[Zoom License Pool][${context}] total=${totalLicenses}, protected=${protectedLicenses}, transferable=${transferableLicenses}, reserved=${usedLicenses}, available=${availableLicenses}, instructor=${instructorEmail || 'unknown'}, window=${dto.startTime.toISOString()} -> ${dto.endTime.toISOString()}`;
    const detailMessage = `[Zoom License Pool][${context}] protectedUsers=${formatUsers(protectedLicenseUsers)}, reservedUsers=${reservedDetails}`;
    this.logger.log(message);
    this.logger.log(detailMessage);
    console.log(message);
    console.log(detailMessage);
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
      .leftJoin(zuvySessions, eq(licenseAssignments.sessionId, zuvySessions.id))
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingAssignmentCondition(),
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
      .leftJoin(zuvySessions, eq(licenseAssignments.sessionId, zuvySessions.id))
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingAssignmentCondition(),
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
      .select({ id: zuvyUserLicenses.id, zoomId: zuvyUserLicenses.zoomEmail })
      .from(zuvyUserLicenses)
      .where(
        and(
          eq(zuvyUserLicenses.status, 'active'),
          eq(zuvyUserLicenses.licenseType, 2),
          instructorIsProtected
            ? eq(normalizedLicenseEmail, instructorEmail!)
            : protectedEmailList.length
              ? notInArray(normalizedLicenseEmail, protectedEmailList)
              : this.alwaysTrueCondition(),
          notExists(
            db
              .select({ one: sql`1` })
              .from(licenseAssignments)
              .leftJoin(
                zuvySessions,
                eq(licenseAssignments.sessionId, zuvySessions.id),
              )
              .where(
                and(
                  this.blockingAssignmentCondition(),
                  eq(licenseAssignments.licenseId, zuvyUserLicenses.id),
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
      .where(
        and(
          eq(zuvyUserLicenses.status, 'active'),
          eq(zuvyUserLicenses.licenseType, 2),
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
      hostType: 'all',
      page_size: 300,
    });

    if (!zoomUsers.success) {
      throw new BadRequestException(
        zoomUsers.error || 'Failed to fetch licensed Zoom users.',
      );
    }

    const activeZoomUsers = zoomUsers.data?.users || [];
    const activeZoomEmails = activeZoomUsers
      .map((user) => user.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email));
    const activeLicensedZoomEmails = activeZoomUsers
      .filter((user) => user.userType === 2)
      .map((user) => user.email?.trim().toLowerCase())
      .filter((email): email is string => Boolean(email));

    for (const user of activeZoomUsers) {
      await this.zoomService.syncZoomLicenseUser({
        email: user.email,
        zoomUserId: user.id,
        userName: user.displayName || user.name || user.email,
        licenseType: user.userType,
        status: user.status,
      });
    }

    const staleUserCondition = activeZoomEmails.length
      ? notInArray(
          sql<string>`lower(${zuvyUserLicenses.zoomEmail})`,
          activeZoomEmails,
        )
      : this.alwaysTrueCondition();
    const notActiveLicensedUserCondition = activeLicensedZoomEmails.length
      ? notInArray(
          sql<string>`lower(${zuvyUserLicenses.zoomEmail})`,
          activeLicensedZoomEmails,
        )
      : this.alwaysTrueCondition();
    const staleLegacyLicenseCondition = activeLicensedZoomEmails.length
      ? notInArray(
          sql<string>`lower(${zuvyUserLicenses.zoomEmail})`,
          activeLicensedZoomEmails,
        )
      : this.alwaysTrueCondition();

    await db
      .update(zuvyUserLicenses)
      .set({
        licenseType: 1,
        status: 'inactive',
        isProtected: false,
        updatedAt: sql`NOW()`,
      } as any)
      .where(staleUserCondition);

    await db
      .update(zuvyUserLicenses)
      .set({
        isProtected: false,
        updatedAt: sql`NOW()`,
      } as any)
      .where(notActiveLicensedUserCondition);

    this.logger.log(
      `Synced Zoom users. Active licensed emails: ${activeLicensedZoomEmails.join(', ') || 'none'}. Active non-licensed or missing Zoom users are no longer protected/active licensed locally.`,
    );

    return activeLicensedZoomEmails.length;
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
    const transferablePoolCapacity = instructorIsProtected
      ? 1
      : await this.getTransferableLicensePoolCount(trx);

    if (!instructorIsProtected && transferablePoolCapacity <= 0) {
      throw new BadRequestException(
        'No transferable Zoom Business licenses are available. All Business licenses are protected.',
      );
    }

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
      let poolCapacity = transferablePoolCapacity;
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
          : await this.getTransferableLicensePoolCount(trx);
        poolCapacity = instructorIsProtected ? 1 : Number(totalCount);

        if (!instructorIsProtected && poolCapacity <= 0) {
          throw new BadRequestException(
            'No transferable Zoom Business licenses are available. All Business licenses are protected.',
          );
        }
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
      .leftJoin(zuvySessions, eq(licenseAssignments.sessionId, zuvySessions.id))
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingAssignmentCondition(),
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

  private buildZoomScopeError(
    action: 'list' | 'transfer',
    sourceEmail?: string,
    targetEmail?: string,
  ) {
    if (action === 'list') {
      return 'Cannot inspect currently licensed Zoom users because the configured Zoom access token is missing the required admin read scope (user:read:list_users:admin). Please reconnect Zoom with admin permissions or update the OAuth app scopes.';
    }

    return `Cannot transfer the Zoom license from ${sourceEmail} to ${targetEmail} because the configured Zoom access token is missing the required admin scopes (user:update:user and user:update:user:admin). Please reconnect Zoom with admin permissions or update the OAuth app scopes.`;
  }

  private async isZoomEmailFreeForTimeRange(
    email: string,
    startTime: Date,
    endTime: Date,
  ) {
    const overlapping = await db
      .select({ count: sql<number>`count(*)` })
      .from(licenseAssignments)
      .leftJoin(zuvySessions, eq(licenseAssignments.sessionId, zuvySessions.id))
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          this.blockingAssignmentCondition(),
          eq(sql<string>`lower(${users.email})`, email.toLowerCase()),
          sql`${licenseAssignments.startTime} < ${endTime}`,
          sql`${licenseAssignments.endTime} + ${buildZoomLicenseCooldownIntervalSql()} > ${startTime}`,
        ),
      );

    return Number(overlapping[0]?.count || 0) === 0;
  }

  private async findAvailableLicensedDonor(
    instructorEmail: string,
    startTime: Date,
    endTime: Date,
  ) {
    const licensedUsers = await this.zoomService.listAuthorizedUsers({
      status: 'active',
      hostType: 'licensed',
      page_size: 300,
    });

    if (!licensedUsers.success) {
      if (
        /does not contain scopes/i.test(licensedUsers.error || '') &&
        /user:read:list_users:admin/i.test(licensedUsers.error || '')
      ) {
        throw new BadRequestException(this.buildZoomScopeError('list'));
      }

      throw new BadRequestException(
        `Failed to inspect Zoom licensed users: ${licensedUsers.error || 'Unknown Zoom error'}`,
      );
    }

    const protectedEmails = await this.getProtectedLicenseEmails();
    const donors = (licensedUsers.data?.users || [])
      .filter(
        (user) =>
          user.email?.trim().toLowerCase() !== instructorEmail.toLowerCase(),
      )
      .filter(
        (user) => !protectedEmails.has(user.email?.trim().toLowerCase() || ''),
      );

    for (const donor of donors) {
      const donorEmail = donor.email?.trim().toLowerCase();

      if (
        donorEmail &&
        (await this.isZoomEmailFreeForTimeRange(donorEmail, startTime, endTime))
      ) {
        return donorEmail;
      }
    }

    return null;
  }

  async ensureHostLicensedForWindow(
    hostEmail: string,
    startTime: Date,
    endTime: Date,
  ) {
    let licenseResult = await this.zoomService.ensureLicensedUser(
      hostEmail,
      '',
      '',
    );

    if (licenseResult.success && licenseResult.licensed) {
      return;
    }

    const needsSeatTransfer =
      licenseResult.step === 'license' ||
      /license/i.test(licenseResult.error || '') ||
      /maximum number of .* paying users/i.test(licenseResult.error || '');

    const isZoomLicensePoolFull =
      licenseResult.step === 'verify' &&
      /currently basic/i.test(licenseResult.error || '');

    if (!needsSeatTransfer && !isZoomLicensePoolFull) {
      throw new BadRequestException(
        `Failed to assign Zoom license to ${hostEmail}: ${licenseResult.error || 'Unknown Zoom licensing error'}`,
      );
    }

    const donorEmail = await this.findAvailableLicensedDonor(
      hostEmail,
      startTime,
      endTime,
    );

    if (!donorEmail) {
      throw new BadRequestException(
        `No free licensed Zoom user is available to transfer a seat to ${hostEmail} for this session time.`,
      );
    }

    const downgradeResult = await this.zoomService.downgradeUser(donorEmail);

    if (!downgradeResult.success) {
      if (
        /does not contain scopes/i.test(downgradeResult.error || '') &&
        /user:update:user(?::admin)?/i.test(downgradeResult.error || '')
      ) {
        throw new BadRequestException(
          this.buildZoomScopeError('transfer', donorEmail, hostEmail),
        );
      }

      throw new BadRequestException(
        `Failed to transfer Zoom license from ${donorEmail} to ${hostEmail}: ${downgradeResult.error}`,
      );
    }

    licenseResult = await this.zoomService.ensureLicensedUser(
      hostEmail,
      '',
      '',
    );

    if (licenseResult.success && licenseResult.licensed) {
      this.logger.log(
        `Transferred Zoom license from ${donorEmail} to ${hostEmail} for ${startTime.toISOString()} - ${endTime.toISOString()}.`,
      );
      return;
    }

    const rollbackResult = await this.zoomService.ensureLicensedUser(
      donorEmail,
      '',
      '',
    );

    if (!rollbackResult.success || !rollbackResult.licensed) {
      this.logger.error(
        `Failed to restore Zoom license to donor ${donorEmail} after unsuccessful transfer to ${hostEmail}.`,
      );
    }

    throw new BadRequestException(
      `Failed to assign Zoom license to ${hostEmail}: ${licenseResult.error || 'Unknown Zoom licensing error'}`,
    );
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
      sessionId?: number;
      mentorSlotAvailabilityId?: number;
      sourceType?: 'class_session' | 'mentor_slot';
      startTime: Date;
      endTime: Date;
    },
  ) {
    const sourceType =
      dto.sourceType ??
      (dto.mentorSlotAvailabilityId ? 'mentor_slot' : 'class_session');

    if (sourceType === 'class_session' && !dto.sessionId) {
      throw new BadRequestException(
        'sessionId is required for class license assignment.',
      );
    }

    if (sourceType === 'mentor_slot' && !dto.mentorSlotAvailabilityId) {
      throw new BadRequestException(
        'mentorSlotAvailabilityId is required for mentor slot license assignment.',
      );
    }

    await trx.insert(licenseAssignments).values({
      licenseId: dto.licenseId,
      instructorId: dto.instructorId,
      sessionId: dto.sessionId ?? null,
      mentorSlotAvailabilityId: dto.mentorSlotAvailabilityId ?? null,
      sourceType,
      startTime: dto.startTime,
      endTime: dto.endTime,
    } as any);
  }

  async releaseMentorSlotAssignment(
    trx: any,
    mentorSlotAvailabilityId: number,
  ) {
    await trx
      .delete(licenseAssignments)
      .where(
        and(
          eq(licenseAssignments.sourceType, 'mentor_slot'),
          eq(
            licenseAssignments.mentorSlotAvailabilityId,
            mentorSlotAvailabilityId,
          ),
        ),
      );
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
    const syncedLicensedUsers = await this.syncLicensedUsersFromZoom();
    const now = new Date();

    const totalLicenses = await this.getActiveLicensePoolCount();

    const activeAssignments = await db
      .select({ count: sql<number>`count(*)` })
      .from(licenseAssignments)
      .leftJoin(zuvySessions, eq(licenseAssignments.sessionId, zuvySessions.id))
      .where(
        and(
          this.blockingAssignmentCondition(),
          lt(licenseAssignments.startTime, now),
          gt(licenseAssignments.endTime, now),
        ),
      );

    const usedCount = Number(activeAssignments[0]?.count || 0);

    return {
      totalLicenses,
      usedLicenses: usedCount,
      availableLicenses: totalLicenses - usedCount,
      syncedLicensedUsers,
      timestamp: now,
    };
  }

  async seedLicenses() {
    const syncedCount = await this.syncLicensedUsersFromZoom();

    return {
      message: `Synced ${syncedCount} licensed Zoom users to zuvy_user_licenses.`,
    };
  }

  // Remove the codesnippet later - For debugging and monitoring purposes, not meant for regular use
  async logLicenseStatus(context: string) {
    try {
      await this.syncLicensedUsersFromZoom();
      const now = new Date();

      const activeLicensePool = await db
        .select({
          licenseId: zuvyUserLicenses.id,
          zoomEmail: zuvyUserLicenses.zoomEmail,
          userName: zuvyUserLicenses.userName,
          zoomUserId: zuvyUserLicenses.zoomUserId,
          isProtected: zuvyUserLicenses.isProtected,
        })
        .from(zuvyUserLicenses)
        .where(
          and(
            eq(zuvyUserLicenses.status, 'active'),
            eq(zuvyUserLicenses.licenseType, 2),
          ),
        );

      // Currently active assignments (sessions happening right now)
      const activeAssignments = await db
        .select({
          licenseId: licenseAssignments.licenseId,
          licenseEmail: zuvyUserLicenses.zoomEmail,
          instructorEmail: users.email,
          instructorName: users.name,
          startTime: licenseAssignments.startTime,
          endTime: licenseAssignments.endTime,
          sessionId: zuvySessions.id,
          sessionTitle: zuvySessions.title,
          sessionStatus: zuvySessions.status,
          mentorSlotAvailabilityId: licenseAssignments.mentorSlotAvailabilityId,
          sourceType: licenseAssignments.sourceType,
        })
        .from(licenseAssignments)
        .innerJoin(
          zuvyUserLicenses,
          eq(licenseAssignments.licenseId, zuvyUserLicenses.id),
        )
        .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
        .leftJoin(
          zuvySessions,
          eq(licenseAssignments.sessionId, zuvySessions.id),
        )
        .where(
          and(
            lt(licenseAssignments.startTime, now),
            sql`${licenseAssignments.endTime} + ${buildZoomLicenseCooldownIntervalSql()} > ${now}`,
            this.blockingAssignmentCondition(),
          ),
        );

      const protectedLicenses = activeLicensePool.filter(
        (license) => license.isProtected,
      );
      const transferableLicenses = activeLicensePool.filter(
        (license) => !license.isProtected,
      );
      const protectedEmailSet = new Set(
        protectedLicenses
          .map((license) => license.zoomEmail?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      );
      const transferableCapacity = Math.max(
        this.getConfiguredTotalLicenseCount() - protectedLicenses.length,
        0,
      );
      const reservedProtectedAssignments = activeAssignments.filter(
        (assignment) =>
          protectedEmailSet.has(assignment.licenseEmail?.toLowerCase() || ''),
      );
      const reservedTransferableAssignments = activeAssignments.filter(
        (assignment) =>
          !protectedEmailSet.has(assignment.licenseEmail?.toLowerCase() || ''),
      );
      const availableProtectedSeats = Math.max(
        protectedLicenses.length - reservedProtectedAssignments.length,
        0,
      );
      const availableTransferableSeats = Math.max(
        transferableCapacity - reservedTransferableAssignments.length,
        0,
      );
      const availableTotalSeats =
        availableProtectedSeats + availableTransferableSeats;
      const formatEmails = (
        rows: Array<{ zoomEmail?: string | null; userName?: string | null }>,
      ) =>
        rows
          .map((row) =>
            row.userName && row.userName !== row.zoomEmail
              ? `${row.zoomEmail} (${row.userName})`
              : row.zoomEmail,
          )
          .filter(Boolean)
          .join(', ') || 'none';
      const formatAssignments = (assignments: typeof activeAssignments) =>
        assignments
          .map(
            (assignment) =>
              `${assignment.licenseEmail} -> ${assignment.instructorEmail} (${assignment.instructorName || 'unknown'}) | ${
                assignment.sourceType === 'mentor_slot'
                  ? `mentor slot ${assignment.mentorSlotAvailabilityId}`
                  : `session ${assignment.sessionId}: "${assignment.sessionTitle}"`
              } | ${assignment.startTime} -> ${assignment.endTime}`,
          )
          .join('\n') || 'none';

      this.logger.log(`
  === LICENSE STATUS DETAIL [${context}] ===
  Configured total seats       : ${this.getConfiguredTotalLicenseCount()}
  Active licensed rows in DB   : ${activeLicensePool.length}
  Protected licenses           : ${protectedLicenses.length} -> ${formatEmails(protectedLicenses)}
  Transferable seat capacity   : ${transferableCapacity}
  Transferable DB rows         : ${transferableLicenses.length} -> ${formatEmails(transferableLicenses)}
  Reserved protected seats     : ${reservedProtectedAssignments.length}
${formatAssignments(reservedProtectedAssignments)
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  Reserved transferable seats  : ${reservedTransferableAssignments.length}
${formatAssignments(reservedTransferableAssignments)
  .split('\n')
  .map((line) => `    ${line}`)
  .join('\n')}
  Available protected seats    : ${availableProtectedSeats}
  Available transferable seats : ${availableTransferableSeats}
  Available total seats        : ${availableTotalSeats}
  =========================================
      `);
    } catch (error: any) {
      this.logger.error(`Failed to log license status: ${error.message}`);
    }
  }
}
