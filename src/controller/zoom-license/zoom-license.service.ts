import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { db } from '../../db/index';
import {
  zuvyUserLicenses,
  licenses,
  licenseAssignments,
  users,
} from '../../../drizzle/schema';
import { eq, and, sql, lt, gt, notExists, notInArray } from 'drizzle-orm';
import { ZoomService } from '../../services/zoom/zoom.service';

@Injectable()
export class ZoomLicenseService {
  private readonly logger = new Logger(ZoomLicenseService.name);

  constructor(private readonly zoomService: ZoomService) {}

  private getProtectedLicenseEmails() {
    return new Set(
      [
        process.env.TEAM_EMAIL,
        'Laasya@navgurukul.org',
        'Vinit@navgurukul.org',
        'dutta.aniket1399@gmail.com',
        'poonam@navgurukul.org',
      ]
        .filter(Boolean)
        .map((email) => String(email).trim().toLowerCase()),
    );
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

  private buildInstructorPoolCondition(instructorEmail: string | null) {
    const protectedEmails = Array.from(this.getProtectedLicenseEmails());
    const instructorIsProtected = instructorEmail
      ? this.getProtectedLicenseEmails().has(instructorEmail)
      : false;

    return instructorIsProtected
      ? eq(this.normalizedUserEmail(), instructorEmail!)
      : notInArray(this.normalizedUserEmail(), protectedEmails);
  }

  private async getProtectedActiveSeatCount(trx: any = db): Promise<number> {
    const protectedEmails = Array.from(this.getProtectedLicenseEmails());
    const normalizedLicenseEmail = this.normalizedLicenseEmail();

    const protectedSeatCount = await trx
      .select({ count: sql<number>`count(*)` })
      .from(zuvyUserLicenses)
      .innerJoin(licenses, eq(licenses.zoomId, zuvyUserLicenses.zoomEmail))
      .where(
        and(
          eq(zuvyUserLicenses.status, 'active'),
          eq(zuvyUserLicenses.licenseType, 2),
          eq(licenses.status, 'active'),
          sql`${normalizedLicenseEmail} in (${sql.join(
            protectedEmails.map((email) => sql`${email}`),
            sql`, `,
          )})`,
        ),
      );

    return Number(protectedSeatCount[0]?.count || 0);
  }

  async getTransferableLicensePoolCount(trx: any = db): Promise<number> {
    const total = await this.getActiveLicensePoolCount(trx);
    const protectedSeats = await this.getProtectedActiveSeatCount(trx);
    return Math.max(total - protectedSeats, 0);
  }

  private async getOverlappingAssignmentCountForPool(
    trx: any,
    dto: { startTime: Date; endTime: Date },
    instructorEmail: string | null,
  ): Promise<number> {
    const overlappingCount = await trx
      .select({ count: sql<number>`count(*)` })
      .from(licenseAssignments)
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          lt(licenseAssignments.startTime, dto.endTime),
          gt(licenseAssignments.endTime, dto.startTime),
          this.buildInstructorPoolCondition(instructorEmail),
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
    const protectedEmails = this.getProtectedLicenseEmails();
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
            : notInArray(normalizedLicenseEmail, protectedEmailList),
          notExists(
            db
              .select({ one: sql`1` })
              .from(licenseAssignments)
              .where(
                and(
                  eq(licenseAssignments.licenseId, licenses.id),
                  sql`${licenseAssignments.startTime} < ${dto.endTime}`,
                  sql`${licenseAssignments.endTime} > ${dto.startTime}`,
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
    const protectedEmails = this.getProtectedLicenseEmails();
    const instructorEmail = options?.instructorEmail
      ? options.instructorEmail.toLowerCase()
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
          instructorIsProtected
            ? eq(normalizedLicenseEmail, instructorEmail!)
            : notInArray(normalizedLicenseEmail, protectedEmailList),
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
    const instructorIsProtected = instructorEmail
      ? this.getProtectedLicenseEmails().has(instructorEmail)
      : false;

    if (!instructorIsProtected) {
      const transferablePoolCount =
        await this.getTransferableLicensePoolCount(trx);
      const overlappingSharedAssignments =
        await this.getOverlappingAssignmentCountForPool(
          trx,
          dto,
          instructorEmail,
        );

      if (overlappingSharedAssignments >= transferablePoolCount) {
        throw new BadRequestException(
          `No Zoom licenses available for this time period. Active licensed pool: ${transferablePoolCount}, overlapping assignments: ${overlappingSharedAssignments}.`,
        );
      }
    }

    // Each overlapping Zoom session consumes one license. Even if the same
    // instructor already has another overlapping session, we must allocate a
    // distinct free license or reject the new session once the pool is exhausted.
    let availableLicenses = await this.fetchAvailableLicenseIds(trx, {
      ...dto,
      instructorEmail,
    });

    if (availableLicenses.length === 0) {
      let totalCount = await this.getActiveLicensePoolCount(trx, {
        instructorEmail,
      });
      if (totalCount === 0) {
        this.logger.warn(
          'Active Zoom license pool is empty in DB. Attempting one-time sync from Zoom before rejecting allocation.',
        );
        await this.syncLicensedUsersFromZoom();
        availableLicenses = await this.fetchAvailableLicenseIds(trx, {
          ...dto,
          instructorEmail,
        });
        totalCount = await this.getActiveLicensePoolCount(trx, {
          instructorEmail,
        });
      }

      if (availableLicenses.length > 0) {
        const assignedLicenseId = availableLicenses[0].id as number;
        this.logger.log(
          `Recovered Zoom license allocation after pool sync. Assigned license ${assignedLicenseId} to instructor ${dto.instructorId}.`,
        );
        return assignedLicenseId;
      }

      const usedCount = await this.getOverlappingAssignmentCountForPool(
        trx,
        dto,
        instructorEmail,
      );

      throw new BadRequestException(
        `No Zoom licenses available for this time period. Active licensed pool: ${totalCount}, overlapping assignments: ${usedCount}.`,
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
      .innerJoin(users, eq(licenseAssignments.instructorId, users.id))
      .where(
        and(
          lt(licenseAssignments.startTime, dto.endTime),
          gt(licenseAssignments.endTime, dto.startTime),
          this.buildInstructorPoolCondition(instructorEmail),
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
      .where(
        and(
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
