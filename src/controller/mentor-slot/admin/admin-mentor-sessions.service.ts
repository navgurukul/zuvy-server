import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SQL,
  and,
  count,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  isNotNull,
  lte,
  not,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '../../../db';
import {
  users,
  zuvyBatchEnrollments,
  zuvyBatches,
  zuvyBootcamps,
  zuvyMentorSessionRecordings,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
  zuvyOrganizations,
  zuvyStudentBookingMetrics,
} from '../../../../drizzle/schema';
import { AdminMentorSessionsQueryDto } from './dto/admin-mentor-sessions-query.dto';

/**
 * Annual mentorship quota per learner. Mirrors the hard-coded limit enforced
 * in MentorSlotService (validateLearnerBookingEligibility / getStudentMetrics).
 * Keep these in sync until the quota is moved to configuration.
 */
const MENTORSHIP_ANNUAL_SESSION_QUOTA = 3;

/**
 * Status the recording worker sets once the merged video has been uploaded and
 * `drive_link` holds the final URL (RecordingWorkerService upload step).
 */
const RECORDING_FINAL_STATUS = 'COMPLETED';

const studentUser = alias(users, 'student_user');
const mentorUser = alias(users, 'mentor_user');

interface AdminRequester {
  id: number | string;
  roles?: string[];
  orgId?: number | string | null;
}

@Injectable()
export class AdminMentorSessionsService {
  /* ==========================================================================
     ORG ACCESS RESOLUTION
  ========================================================================== */

  /**
   * Returns the organisation the requester may query, or `null` for an
   * unrestricted Super Admin view across all organisations.
   */
  private async resolveOrganizationScope(
    user: AdminRequester,
    requestedOrgId?: number,
  ): Promise<number | null> {
    const roles = new Set(Array.isArray(user?.roles) ? user.roles : []);

    if (roles.has('super_admin')) {
      if (!requestedOrgId) return null;

      const [org] = await db
        .select({ id: zuvyOrganizations.id })
        .from(zuvyOrganizations)
        .where(eq(zuvyOrganizations.id, requestedOrgId))
        .limit(1);

      if (!org) throw new NotFoundException('Organization not found');
      return requestedOrgId;
    }

    if (!roles.has('admin')) {
      throw new ForbiddenException('Only admins can view mentorship sessions.');
    }

    // Roles on the JWT user are resolved for the token's org, so an org admin
    // is only trusted for that org — never for an arbitrary orgId.
    const userOrgId = Number(user.orgId);
    if (!Number.isInteger(userOrgId) || userOrgId <= 0) {
      throw new ForbiddenException('Organization context missing');
    }

    if (requestedOrgId && requestedOrgId !== userOrgId) {
      throw new ForbiddenException(
        'You do not have permission to view sessions of this organization.',
      );
    }

    return userOrgId;
  }

  /* ==========================================================================
     LIST SESSIONS
  ========================================================================== */

  async listSessions(user: AdminRequester, query: AdminMentorSessionsQueryDto) {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    const orgId = await this.resolveOrganizationScope(user, query.orgId);

    const conditions: SQL[] = [];

    if (orgId !== null) {
      conditions.push(eq(zuvyMentorSlotBooking.organizationId, orgId));
    }
    if (query.mentorId) {
      conditions.push(
        eq(zuvyMentorSlotBooking.mentorUserId, BigInt(query.mentorId)),
      );
    }
    if (query.status) {
      conditions.push(eq(zuvyMentorSlotBooking.status, query.status));
    }
    if (query.lifecycleState) {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, query.lifecycleState),
      );
    }
    if (query.from) {
      conditions.push(
        gte(zuvyMentorSlotAvailability.slotStartDateTime, new Date(query.from)),
      );
    }
    if (query.to) {
      conditions.push(
        lte(zuvyMentorSlotAvailability.slotStartDateTime, new Date(query.to)),
      );
    }
    if (query.bootcampId) {
      conditions.push(
        eq(zuvyMentorSlotManagement.bootcampId, query.bootcampId),
      );
    }
    if (query.batchId) {
      conditions.push(eq(zuvyBatchEnrollments.batchId, query.batchId));
    }
    if (query.search) {
      const pattern = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      conditions.push(
        or(
          ilike(studentUser.name, pattern),
          ilike(studentUser.email, pattern),
          ilike(mentorUser.name, pattern),
          ilike(mentorUser.email, pattern),
        ),
      );
    }
    if (query.hasRecording !== undefined) {
      const finalRecordingExists = exists(
        db
          .select({ one: sql`1` })
          .from(zuvyMentorSessionRecordings)
          .where(
            and(
              eq(
                zuvyMentorSessionRecordings.mentorBookingId,
                zuvyMentorSlotBooking.id,
              ),
              eq(zuvyMentorSessionRecordings.status, RECORDING_FINAL_STATUS),
              isNotNull(zuvyMentorSessionRecordings.driveLink),
            ),
          ),
      );
      conditions.push(
        query.hasRecording ? finalRecordingExists : not(finalRecordingExists),
      );
    }

    const where = conditions.length ? and(...conditions) : undefined;

    // Every join below is many-to-one (enrollments are unique per
    // user+bootcamp, metrics unique per user), so rows never multiply and
    // COUNT(*) equals the number of matching bookings.
    const needsMgmt = Boolean(query.bootcampId || query.batchId);
    const needsSlot = Boolean(query.from || query.to || needsMgmt);
    const needsEnrollment = Boolean(query.batchId);
    const needsUsers = Boolean(query.search);

    let countQuery = db
      .select({ total: count() })
      .from(zuvyMentorSlotBooking)
      .$dynamic();

    if (needsSlot) {
      countQuery = countQuery.leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      );
    }
    if (needsMgmt) {
      countQuery = countQuery.leftJoin(
        zuvyMentorSlotManagement,
        eq(
          zuvyMentorSlotManagement.id,
          zuvyMentorSlotAvailability.mentorSlotManagementId,
        ),
      );
    }
    if (needsEnrollment) {
      countQuery = countQuery.leftJoin(
        zuvyBatchEnrollments,
        and(
          eq(zuvyBatchEnrollments.userId, zuvyMentorSlotBooking.studentUserId),
          eq(
            zuvyBatchEnrollments.bootcampId,
            zuvyMentorSlotManagement.bootcampId,
          ),
        ),
      );
    }
    if (needsUsers) {
      countQuery = countQuery
        .leftJoin(
          studentUser,
          eq(studentUser.id, zuvyMentorSlotBooking.studentUserId),
        )
        .leftJoin(
          mentorUser,
          eq(mentorUser.id, zuvyMentorSlotBooking.mentorUserId),
        );
    }

    const pageQuery = db
      .select({
        bookingId: zuvyMentorSlotBooking.id,
        courseName: zuvyBootcamps.name,
        batchName: zuvyBatches.name,
        mentorId: zuvyMentorSlotBooking.mentorUserId,
        mentorName: mentorUser.name,
        mentorEmail: mentorUser.email,
        studentId: zuvyMentorSlotBooking.studentUserId,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
        status: zuvyMentorSlotBooking.status,
        lifecycleState: zuvyMentorSlotBooking.sessionLifecycleState,
        rescheduleStatus: zuvyMentorSlotBooking.rescheduleStatus,
        // Participant join URL only — never expose the Zoom host start URL.
        meetingLink: zuvyMentorSlotBooking.meetingLink,
        joinedAt: zuvyMentorSlotBooking.joinedAt,
        leftAt: zuvyMentorSlotBooking.leftAt,
        bookedAt: zuvyMentorSlotBooking.bookedAt,
        cancelledAt: zuvyMentorSlotBooking.cancelledAt,
        completedAt: zuvyMentorSlotBooking.completedAt,
        cancelledBy: zuvyMentorSlotBooking.cancelledBy,
        cancellationReason: zuvyMentorSlotBooking.cancellationReason,
        mentorRating: zuvyMentorSlotBooking.mentorRating,
        studentRating: zuvyMentorSlotBooking.studentRating,
        mentorFeedback: zuvyMentorSlotBooking.mentorFeedback,
        studentFeedback: zuvyMentorSlotBooking.studentFeedback,
        quotaUsed: zuvyStudentBookingMetrics.quotaUsed,
        quotaResetDate: zuvyStudentBookingMetrics.quotaResetDate,
        cooldownEndDate: zuvyStudentBookingMetrics.cooldownEndDate,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .leftJoin(
        zuvyMentorSlotManagement,
        eq(
          zuvyMentorSlotManagement.id,
          zuvyMentorSlotAvailability.mentorSlotManagementId,
        ),
      )
      .leftJoin(
        zuvyBootcamps,
        eq(zuvyBootcamps.id, zuvyMentorSlotManagement.bootcampId),
      )
      .leftJoin(
        zuvyBatchEnrollments,
        and(
          eq(zuvyBatchEnrollments.userId, zuvyMentorSlotBooking.studentUserId),
          eq(
            zuvyBatchEnrollments.bootcampId,
            zuvyMentorSlotManagement.bootcampId,
          ),
        ),
      )
      .leftJoin(zuvyBatches, eq(zuvyBatches.id, zuvyBatchEnrollments.batchId))
      .leftJoin(
        studentUser,
        eq(studentUser.id, zuvyMentorSlotBooking.studentUserId),
      )
      .leftJoin(
        mentorUser,
        eq(mentorUser.id, zuvyMentorSlotBooking.mentorUserId),
      )
      .leftJoin(
        zuvyStudentBookingMetrics,
        eq(
          zuvyStudentBookingMetrics.userId,
          zuvyMentorSlotBooking.studentUserId,
        ),
      )
      .where(where)
      .orderBy(
        desc(zuvyMentorSlotAvailability.slotStartDateTime),
        desc(zuvyMentorSlotBooking.id),
      )
      .limit(limit)
      .offset(offset);

    const [rows, [{ total }]] = await Promise.all([
      pageQuery,
      countQuery.where(where),
    ]);

    const recordingsByBooking = await this.getRecordingsForBookings(
      rows.map((row) => row.bookingId),
    );

    const now = new Date();

    const data = rows.map((row) => {
      const recording = recordingsByBooking.get(row.bookingId);
      const credits = this.deriveCredits(row, now);

      return {
        bookingId: row.bookingId,
        courseName: row.courseName ?? null,
        batchName: row.batchName ?? null,
        mentor: {
          id: Number(row.mentorId),
          name: row.mentorName ?? null,
          email: row.mentorEmail ?? null,
        },
        student: {
          id: Number(row.studentId),
          name: row.studentName ?? null,
          email: row.studentEmail ?? null,
        },
        slotStart: row.slotStart ?? null,
        slotEnd: row.slotEnd ?? null,
        status: row.status,
        lifecycleState: row.lifecycleState,
        rescheduleStatus: row.rescheduleStatus,
        meetingLink: row.meetingLink,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
        bookedAt: row.bookedAt,
        cancelledAt: row.cancelledAt,
        completedAt: row.completedAt,
        cancelledBy: row.cancelledBy,
        cancellationReason: row.cancellationReason,
        mentorRating: row.mentorRating,
        studentRating: row.studentRating,
        mentorFeedback: row.mentorFeedback,
        studentFeedback: row.studentFeedback,
        recordingUrl: recording?.url ?? null,
        recordingStatus: recording?.status ?? null,
        ...credits,
      };
    });

    return {
      status: 'success',
      data,
      total: Number(total),
      limit,
      offset,
    };
  }

  /* ==========================================================================
     HELPERS
  ========================================================================== */

  /**
   * One recording row per booking: a finished upload (COMPLETED + drive_link)
   * if any exists, otherwise the most recent row so in-progress/failed states
   * are still visible. Only queried for the current page's bookings.
   */
  private async getRecordingsForBookings(bookingIds: number[]) {
    const result = new Map<number, { url: string | null; status: string }>();
    if (!bookingIds.length) return result;

    const isFinal = sql`(${zuvyMentorSessionRecordings.status} = ${RECORDING_FINAL_STATUS} AND ${zuvyMentorSessionRecordings.driveLink} IS NOT NULL)`;

    const recordings = await db
      .selectDistinctOn([zuvyMentorSessionRecordings.mentorBookingId], {
        mentorBookingId: zuvyMentorSessionRecordings.mentorBookingId,
        status: zuvyMentorSessionRecordings.status,
        driveLink: zuvyMentorSessionRecordings.driveLink,
      })
      .from(zuvyMentorSessionRecordings)
      .where(inArray(zuvyMentorSessionRecordings.mentorBookingId, bookingIds))
      .orderBy(
        zuvyMentorSessionRecordings.mentorBookingId,
        desc(isFinal),
        desc(zuvyMentorSessionRecordings.id),
      );

    for (const rec of recordings) {
      const final = rec.status === RECORDING_FINAL_STATUS && !!rec.driveLink;
      result.set(rec.mentorBookingId, {
        url: final ? rec.driveLink : null,
        status: rec.status,
      });
    }

    return result;
  }

  /**
   * Learner credit snapshot derived from zuvy_student_booking_metrics using the
   * same rules as MentorSlotService: quota of 3 per window, quota treated as
   * reset once quotaResetDate has passed, next eligibility = cooldownEndDate.
   * These are the learner's CURRENT credits, not a per-booking historical value.
   */
  private deriveCredits(
    row: {
      quotaUsed: number | null;
      quotaResetDate: Date | null;
      cooldownEndDate: Date | null;
    },
    now: Date,
  ) {
    const quotaWindowExpired =
      row.quotaResetDate !== null && now >= row.quotaResetDate;
    const creditsUsed = quotaWindowExpired
      ? 0
      : Math.min(row.quotaUsed ?? 0, MENTORSHIP_ANNUAL_SESSION_QUOTA);

    return {
      creditsAssigned: MENTORSHIP_ANNUAL_SESSION_QUOTA,
      creditsUsed,
      creditsLeft: Math.max(0, MENTORSHIP_ANNUAL_SESSION_QUOTA - creditsUsed),
      nextEligibleDate: row.cooldownEndDate ?? null,
    };
  }
}
