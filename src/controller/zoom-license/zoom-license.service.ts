import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { db } from '../../db/index';
import { licenses, licenseAssignments, users } from '../../../drizzle/schema';
import { eq, and, sql, lt, gt } from 'drizzle-orm';
import { ZoomService } from '../../services/zoom/zoom.service';

@Injectable()
export class ZoomLicenseService {
  private readonly logger = new Logger(ZoomLicenseService.name);

  constructor(private readonly zoomService: ZoomService) {}

  /**
   * Internal method to find and reserve a license for a specific time range.
   * Should be called within a transaction.
   */
  async assignLicense(
    trx: any,
    dto: { instructorId: number; startTime: Date; endTime: Date },
  ): Promise<number> {
    // 1. Check if instructor already has a license assigned for this time period
    const existingAssignment = await trx
      .select({ licenseId: licenseAssignments.licenseId })
      .from(licenseAssignments)
      .where(
        and(
          eq(licenseAssignments.instructorId, dto.instructorId),
          sql`${licenseAssignments.startTime} < ${dto.endTime}`,
          sql`${licenseAssignments.endTime} > ${dto.startTime}`,
        ),
      )
      .limit(1);

    if (existingAssignment.length > 0) {
      const assignedLicenseId = existingAssignment[0].licenseId;
      this.logger.log(
        `Instructor ${dto.instructorId} already has license ${assignedLicenseId} for this time.`,
      );
      return assignedLicenseId;
    }

    // 2. Find a free license among the 6 total licenses
    const availableLicenses = await trx.execute(sql`
      SELECT l.id 
      FROM licenses l
      WHERE l.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM license_assignments la
        WHERE la.license_id = l.id
        AND la.start_time < ${dto.endTime}
        AND la.end_time > ${dto.startTime}
      )
      LIMIT 1
      FOR UPDATE OF l
    `);

    if (availableLicenses.rows.length === 0) {
      throw new BadRequestException(
        'No Zoom licenses available for this time period.',
      );
    }

    console.log('Available licenses:', availableLicenses.rows);
    const assignedLicenseId = availableLicenses.rows[0].id as number;

    console.log('Available licenses ID:', assignedLicenseId);
    // Log current license usage and availability
    const totalCount = 6;
    const activeAssignments = await trx.execute(sql`
      SELECT count(*) as count FROM license_assignments la
      WHERE la.start_time < ${dto.endTime}
      AND la.end_time > ${dto.startTime}
    `);
    console.log('Active assignments:', activeAssignments.rows);
    const usedCount = Number(activeAssignments.rows[0].count);
    const availableCount = totalCount - usedCount - 1; // -1 for the one we just assigned if not yet in DB

    console.log('availableCount', availableCount);

    const currentUsers = await trx.execute(sql`
      SELECT u.name, u.email 
      FROM license_assignments la
      JOIN users u ON la.instructor_id = u.id
      WHERE la.start_time < ${dto.endTime}
      AND la.end_time > ${dto.startTime}
    `);

    const userList = currentUsers.rows
      .map((r) => `${r.name} (${r.email})`)
      .join(', ');
    this.logger.log(`dto.instructorId: ${dto.instructorId}`);
    this.logger.log(`currentUsers: ${currentUsers}`);
    this.logger.log(`userList: ${userList}`);
    this.logger.log(`totalCount: ${totalCount}`);
    this.logger.log(`usedCount: ${usedCount}`);
    this.logger.log(`availableCount: ${availableCount}`);
    this.logger.log(
      `License ${assignedLicenseId} assigned to instructor ${dto.instructorId}.`,
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
        licenseName: licenses.name,
      })
      .from(licenseAssignments)
      .innerJoin(licenses, eq(licenseAssignments.licenseId, licenses.id))
      .where(eq(licenseAssignments.instructorId, instructorId))
      .orderBy(sql`${licenseAssignments.startTime} DESC`);
  }

  async getDashboard() {
    const totalLicenses = 6;
    const now = new Date();

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
    const existing = await db.select().from(licenses);
    if (existing.length > 0) return { message: 'Licenses already exist' };

    const initialLicenses = [
      { zoomId: 'zoom_lic_1', name: 'Zoom License 1' },
      { zoomId: 'zoom_lic_2', name: 'Zoom License 2' },
      { zoomId: 'zoom_lic_3', name: 'Zoom License 3' },
      { zoomId: 'zoom_lic_4', name: 'Zoom License 4' },
      { zoomId: 'zoom_lic_5', name: 'Zoom License 5' },
      { zoomId: 'zoom_lic_6', name: 'Zoom License 6' },
    ];

    await db.insert(licenses).values(initialLicenses);
    return { message: '6 licenses seeded successfully.' };
  }
}
