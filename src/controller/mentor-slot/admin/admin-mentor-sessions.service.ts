import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SQL,
  and,
  asc,
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
  zuvyBootcampType,
  zuvyMentorSessionRecordings,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
  zuvyOrganizations,
  zuvyStudentBookingMetrics,
  zuvyMentorSessionAttendanceIntervals,
  zuvyZoomWebhookEvents,
} from '../../../../drizzle/schema';
import {
  AdminMentorSessionsFilterDto,
  AdminMentorSessionsQueryDto,
  AdminMentorsQueryDto,
  MentorSessionAttendanceFilter,
} from './dto/admin-mentor-sessions-query.dto';
import {
  LATE_JOIN_THRESHOLD_MINUTES,
  summarizeBookingAttendance,
} from '../attendance/mentor-session-attendance';

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

  /** Uses the same bootcamp setting that guards mentorship session details. */
  private async assertMentorshipEnabled(bootcampId: number | null | undefined) {
    const enabled =
      bootcampId === null || bootcampId === undefined
        ? undefined
        : (
            await db
              .select({ one: sql<number>`1` })
              .from(zuvyBootcampType)
              .where(
                and(
                  eq(zuvyBootcampType.bootcampId, bootcampId),
                  eq(zuvyBootcampType.mentorshipEnabled, true),
                ),
              )
              .limit(1)
          )[0];

    if (!enabled) {
      throw new ForbiddenException('Mentorship is not enabled for this course');
    }
  }

  /* ==========================================================================
     SHARED FILTERS
  ========================================================================== */

  /**
   * Org scope + WHERE clause shared by the listing and metrics endpoints, so
   * both always match the same bookings. Callers must join slot availability,
   * slot management, batch enrollment and the student/mentor user aliases
   * whenever the corresponding filter is set.
   */
  private async buildSessionsWhere(
    user: AdminRequester,
    query: AdminMentorSessionsFilterDto,
  ): Promise<SQL | undefined> {
    const orgId = await this.resolveOrganizationScope(user, query.orgId);

    // Without a requested course, this endpoint can intentionally span
    // multiple bootcamps, so do not let one disabled course block others.
    if (query.bootcampId) {
      await this.assertMentorshipEnabled(query.bootcampId);
    }

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

    if (query.attendanceStatus) {
      conditions.push(this.buildAttendanceFilter(query.attendanceStatus));
    }

    return conditions.length ? and(...conditions) : undefined;
  }

  /* ==========================================================================
     MENTOR FILTER OPTIONS
  ========================================================================== */

  /**
   * Returns mentors from their organisation-level mentor-management mapping.
   * This is deliberately not derived from roles or bookings: a mentor can have
   * a valid assignment before receiving a booking, and historical assignments
   * must remain selectable. The mapping is unique per mentor + organisation,
   * so it cannot produce duplicate mentors.
   */
  async listAllMentors(user: AdminRequester, query: AdminMentorsQueryDto) {
    const orgId = await this.resolveOrganizationScope(user, query.orgId);

    // orgId is mandatory in this endpoint's DTO. Keep this defensive check so
    // a future DTO change cannot accidentally expose a cross-org dropdown.
    if (orgId === null) {
      throw new ForbiddenException('Organization context missing');
    }

    if (query.bootcampId) {
      await this.assertMentorshipEnabled(query.bootcampId);
    }

    const conditions: SQL[] = [
      eq(zuvyMentorSlotManagement.organizationId, orgId),
    ];
    if (query.bootcampId) {
      conditions.push(
        eq(zuvyMentorSlotManagement.bootcampId, query.bootcampId),
      );
    }

    const mentors = await db
      .select({
        id: zuvyMentorSlotManagement.mentorUserId,
        name: users.name,
        email: users.email,
      })
      .from(zuvyMentorSlotManagement)
      // Keep the management row as the source of truth. A left join avoids
      // discarding historical mappings because of a missing user projection.
      .leftJoin(users, eq(users.id, zuvyMentorSlotManagement.mentorUserId))
      .where(and(...conditions))
      .orderBy(asc(users.name), asc(zuvyMentorSlotManagement.mentorUserId));

    return {
      status: 'success',
      data: mentors.map((mentor) => ({
        id: Number(mentor.id),
        name: mentor.name,
        email: mentor.email,
      })),
    };
  }

  /* ==========================================================================
     LIST SESSIONS
  ========================================================================== */

  async listMentorSessions(
    user: AdminRequester,
    query: AdminMentorSessionsQueryDto,
  ) {
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;

    const { data, total } = await this.getSessionsData(user, query, {
      limit,
      offset,
    });

    return { status: 'success', data, total, limit, offset };
  }

  /** Shared listing/export query and response enrichment. */
  private async getSessionsData(
    user: AdminRequester,
    query: AdminMentorSessionsFilterDto,
    pagination?: { limit: number; offset: number },
  ) {
    const limit = pagination?.limit;
    const offset = pagination?.offset;

    const where = await this.buildSessionsWhere(user, query);

    // Every join below is many-to-one (enrollments are unique per
    // user+bootcamp, metrics unique per user), so rows never multiply and
    // COUNT(*) equals the number of matching bookings.
    const needsMgmt = Boolean(query.bootcampId || query.batchId);
    const needsSlot = Boolean(
      query.from ||
      query.to ||
      needsMgmt ||
      query.attendanceStatus === 'SCHEDULED' ||
      query.attendanceStatus === 'JOINED_LATE',
    );
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

    let pageQuery = db
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
        // meetingLink: zuvyMentorSlotBooking.meetingLink,
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
        // Internal only — used to derive participant attendance.
        isZoomMeet: zuvyMentorSlotBooking.isZoomMeet,
        zoomMeetingId: zuvyMentorSlotBooking.zoomMeetingId,
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
      .$dynamic();

    if (limit !== undefined) {
      pageQuery = pageQuery.limit(limit).offset(offset ?? 0);
    }

    const [rows, [{ total }]] = await Promise.all([
      pageQuery,
      countQuery.where(where),
    ]);

    const now = new Date();

    const [recordingsByBooking, attendanceByBooking] = await Promise.all([
      this.getRecordingsForBookings(rows.map((row) => row.bookingId)),
      this.getParticipantAttendanceForBookings(rows, now),
    ]);

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
        // meetingLink: row.meetingLink,
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
        ...attendanceByBooking.get(row.bookingId),
      };
    });

    return { data, total: Number(total) };
  }

  async exportSessionsData(
    user: AdminRequester,
    query: AdminMentorSessionsFilterDto,
  ) {
    const { data } = await this.getSessionsData(user, query);
    return {
      status: 'success',
      data,
      total: data.length,
      limit: data.length,
      offset: 0,
    };
  }

  /* ==========================================================================
     METRICS
  ========================================================================== */

  /**
   * Aggregate metrics over every booking the listing API would return for the
   * same filters (no pagination), in a single SQL aggregate. Uses the
   * listing's many-to-one joins only, so each booking is counted once.
   */
  async getMentorSessionMetrics(
    user: AdminRequester,
    query: AdminMentorSessionsFilterDto,
  ) {
    const where = await this.buildSessionsWhere(user, query);

    const booking = zuvyMentorSlotBooking;
    const isCancelled = sql`(COALESCE(${booking.status}, '') = 'cancelled' OR COALESCE(${booking.sessionLifecycleState}, '') = 'CANCELLED')`;
    const notCancelled = sql`NOT ${isCancelled}`;
    // Reuses the listing's attendance filter: requires a verified meeting.ended
    // webhook, so nobody is marked absent before the meeting has really ended.
    const studentNoShow = and(
      notCancelled,
      this.buildAttendanceFilter('STUDENT_NO_SHOW'),
    );
    const mentorNoShow = and(
      notCancelled,
      this.buildAttendanceFilter('MENTOR_NO_SHOW'),
    );

    const [row] = await db
      .select({
        totalSessions: count(),
        completedSessions: sql<number>`COUNT(*) FILTER (WHERE ${booking.sessionLifecycleState} = 'COMPLETED' AND ${notCancelled})`,
        cancelledSessions: sql<number>`COUNT(*) FILTER (WHERE ${isCancelled})`,
        scheduledSessions: sql<number>`COUNT(*) FILTER (WHERE ${booking.sessionLifecycleState} = 'SCHEDULED' AND ${notCancelled})`,
        studentNoShows: sql<number>`COUNT(*) FILTER (WHERE ${studentNoShow})`,
        mentorNoShows: sql<number>`COUNT(*) FILTER (WHERE ${mentorNoShow})`,
        // AVG ignores NULL ratings.
        averageMentorRating: sql<
          string | null
        >`ROUND(AVG(${booking.mentorRating})::numeric, 2)`,
        averageStudentRating: sql<
          string | null
        >`ROUND(AVG(${booking.studentRating})::numeric, 2)`,
      })
      .from(booking)
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId),
      )
      .leftJoin(
        zuvyMentorSlotManagement,
        eq(
          zuvyMentorSlotManagement.id,
          zuvyMentorSlotAvailability.mentorSlotManagementId,
        ),
      )
      .leftJoin(
        zuvyBatchEnrollments,
        and(
          eq(zuvyBatchEnrollments.userId, booking.studentUserId),
          eq(
            zuvyBatchEnrollments.bootcampId,
            zuvyMentorSlotManagement.bootcampId,
          ),
        ),
      )
      .leftJoin(studentUser, eq(studentUser.id, booking.studentUserId))
      .leftJoin(mentorUser, eq(mentorUser.id, booking.mentorUserId))
      .where(where);

    const toAvg = (v: string | null) => (v === null ? null : Number(v));

    return {
      status: 'success',
      data: {
        totalSessions: Number(row.totalSessions),
        completedSessions: Number(row.completedSessions),
        cancelledSessions: Number(row.cancelledSessions),
        scheduledSessions: Number(row.scheduledSessions),
        studentNoShows: Number(row.studentNoShows),
        mentorNoShows: Number(row.mentorNoShows),
        averageMentorRating: toAvg(row.averageMentorRating),
        averageStudentRating: toAvg(row.averageStudentRating),
      },
    };
  }

  /* ==========================================================================
     SESSION DETAIL
  ========================================================================== */

  async getMentorSessionBookingDetails(
    user: AdminRequester,
    bookingId: number,
  ) {
    const orgId = await this.resolveOrganizationScope(user);
    const [row] = await db
      .select({
        bookingId: zuvyMentorSlotBooking.id,
        courseName: zuvyBootcamps.name,
        batchName: zuvyBatches.name,
        bootcampId: zuvyMentorSlotManagement.bootcampId,
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
        joinedAt: zuvyMentorSlotBooking.joinedAt,
        leftAt: zuvyMentorSlotBooking.leftAt,
        bookedAt: zuvyMentorSlotBooking.bookedAt,
        confirmedAt: zuvyMentorSlotBooking.confirmedAt,
        rescheduleRequestedAt: zuvyMentorSlotBooking.rescheduleRequestedAt,
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
        isZoomMeet: zuvyMentorSlotBooking.isZoomMeet,
        zoomMeetingId: zuvyMentorSlotBooking.zoomMeetingId,
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
      .where(
        and(
          eq(zuvyMentorSlotBooking.id, bookingId),
          orgId === null
            ? undefined
            : eq(zuvyMentorSlotBooking.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!row) throw new NotFoundException('Booking not found');

    await this.assertMentorshipEnabled(row.bootcampId);

    const now = new Date();
    const [attendanceByBooking, recordings, intervals, meetingEvents] =
      await Promise.all([
        this.getParticipantAttendanceForBookings([row], now),
        db
          .select({
            id: zuvyMentorSessionRecordings.id,
            zoomMeetingId: zuvyMentorSessionRecordings.zoomMeetingId,
            zoomMeetingUuid: zuvyMentorSessionRecordings.zoomMeetingUuid,
            zoomRecordingId: zuvyMentorSessionRecordings.zoomRecordingId,
            status: zuvyMentorSessionRecordings.status,
            driveLink: zuvyMentorSessionRecordings.driveLink,
            recordingStart: zuvyMentorSessionRecordings.recordingStart,
            recordingEnd: zuvyMentorSessionRecordings.recordingEnd,
            isFinalMerged: zuvyMentorSessionRecordings.isFinalMerged,
            segmentsCount: zuvyMentorSessionRecordings.segmentsCount,
            createdAt: zuvyMentorSessionRecordings.createdAt,
            updatedAt: zuvyMentorSessionRecordings.updatedAt,
          })
          .from(zuvyMentorSessionRecordings)
          .where(eq(zuvyMentorSessionRecordings.mentorBookingId, bookingId))
          .orderBy(desc(zuvyMentorSessionRecordings.createdAt)),
        db
          .select({
            participantRole:
              zuvyMentorSessionAttendanceIntervals.participantRole,
            joinedAt: zuvyMentorSessionAttendanceIntervals.joinedAt,
            leftAt: zuvyMentorSessionAttendanceIntervals.leftAt,
          })
          .from(zuvyMentorSessionAttendanceIntervals)
          .where(
            and(
              eq(zuvyMentorSessionAttendanceIntervals.bookingId, bookingId),
              inArray(zuvyMentorSessionAttendanceIntervals.participantRole, [
                'STUDENT',
                'MENTOR',
              ]),
            ),
          ),
        row.zoomMeetingId
          ? db
              .select({
                eventType: zuvyZoomWebhookEvents.eventType,
                timestamp: sql<Date>`COALESCE((${zuvyZoomWebhookEvents.payload}->'payload'->'object'->>'start_time')::timestamptz, (${zuvyZoomWebhookEvents.payload}->'payload'->'object'->>'end_time')::timestamptz, ${zuvyZoomWebhookEvents.receivedAt})`,
              })
              .from(zuvyZoomWebhookEvents)
              .where(
                and(
                  eq(zuvyZoomWebhookEvents.meetingId, row.zoomMeetingId),
                  eq(zuvyZoomWebhookEvents.processingStatus, 'PROCESSED'),
                  inArray(zuvyZoomWebhookEvents.eventType, [
                    'meeting.started',
                    'meeting.ended',
                  ]),
                ),
              )
          : Promise.resolve([]),
      ]);

    const timeline = [
      row.bookedAt && { event: 'BOOKED', timestamp: row.bookedAt },
      row.confirmedAt && { event: 'CONFIRMED', timestamp: row.confirmedAt },
      row.rescheduleRequestedAt && {
        event: 'RESCHEDULED',
        timestamp: row.rescheduleRequestedAt,
      },
      row.cancelledAt && {
        event: 'CANCELLED',
        timestamp: row.cancelledAt,
        metadata: {
          cancelledBy: row.cancelledBy,
          reason: row.cancellationReason,
        },
      },
      ...intervals.flatMap((interval) => [
        {
          event: `${interval.participantRole}_JOINED`,
          timestamp: interval.joinedAt,
        },
        interval.leftAt && {
          event: `${interval.participantRole}_LEFT`,
          timestamp: interval.leftAt,
        },
      ]),
      ...meetingEvents.map((event) => ({
        event:
          event.eventType === 'meeting.started'
            ? 'MEETING_STARTED'
            : 'MEETING_ENDED',
        timestamp: event.timestamp,
      })),
      row.completedAt && { event: 'COMPLETED', timestamp: row.completedAt },
    ]
      .filter(Boolean)
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

    return {
      status: 'success',
      data: {
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
        joinedAt: row.joinedAt,
        leftAt: row.leftAt,
        bookedAt: row.bookedAt,
        cancelledAt: row.cancelledAt,
        cancelledBy: row.cancelledBy,
        cancellationReason: row.cancellationReason,
        completedAt: row.completedAt,
        mentorRating: row.mentorRating,
        studentRating: row.studentRating,
        mentorFeedback: row.mentorFeedback,
        studentFeedback: row.studentFeedback,
        ...attendanceByBooking.get(bookingId),
        timeline,
        recordings,
        ...this.deriveCredits(row, now),
      },
    };
  }

  /* ==========================================================================
     HELPERS
  ========================================================================== */

  /**
   * SQL condition for the attendance filter, evaluated per booking with
   * correlated EXISTS subqueries (no joins, so rows never multiply and the
   * filter applies before LIMIT/OFFSET and COUNT). Mirrors the rules in
   * summarizeBookingAttendance(): only verified MENTOR / STUDENT intervals
   * count, and "meeting ended" requires a verified meeting.ended webhook not
   * older than the latest join.
   */
  private buildAttendanceFilter(filter: MentorSessionAttendanceFilter): SQL {
    const intervals = zuvyMentorSessionAttendanceIntervals;
    const booking = zuvyMentorSlotBooking;

    const roleIntervals = (role?: 'STUDENT' | 'MENTOR') =>
      db
        .select({ one: sql`1` })
        .from(intervals)
        .where(
          and(
            eq(intervals.bookingId, booking.id),
            role ? eq(intervals.participantRole, role) : undefined,
          ),
        );

    const studentJoined = exists(roleIntervals('STUDENT'));
    const mentorJoined = exists(roleIntervals('MENTOR'));
    const anyoneJoined = exists(roleIntervals());

    const meetingEnded = exists(
      db
        .select({ one: sql`1` })
        .from(zuvyZoomWebhookEvents)
        .where(
          and(
            eq(zuvyZoomWebhookEvents.eventType, 'meeting.ended'),
            eq(zuvyZoomWebhookEvents.processingStatus, 'PROCESSED'),
            eq(zuvyZoomWebhookEvents.meetingId, booking.zoomMeetingId),
            sql`COALESCE((${zuvyZoomWebhookEvents.payload}->'payload'->'object'->>'end_time')::timestamptz, ${zuvyZoomWebhookEvents.receivedAt})
              >= COALESCE((SELECT MAX(${intervals.joinedAt}) FROM ${intervals} WHERE ${intervals.bookingId} = ${booking.id}), '-infinity'::timestamptz)`,
          ),
        ),
    );

    const joinedLate = (role: 'STUDENT' | 'MENTOR') =>
      sql`(SELECT MIN(${intervals.joinedAt}) FROM ${intervals}
            WHERE ${intervals.bookingId} = ${booking.id}
              AND ${intervals.participantRole} = ${role})
          >= ${zuvyMentorSlotAvailability.slotStartDateTime}
             + (${`${LATE_JOIN_THRESHOLD_MINUTES} minutes`})::interval`;

    switch (filter) {
      case 'BOTH_JOINED':
        return and(studentJoined, mentorJoined);
      case 'STUDENT_NO_SHOW':
        return and(meetingEnded, mentorJoined, not(studentJoined));
      case 'MENTOR_NO_SHOW':
        return and(meetingEnded, studentJoined, not(mentorJoined));
      case 'SCHEDULED':
        return and(
          gte(zuvyMentorSlotAvailability.slotStartDateTime, sql`NOW()`),
          sql`COALESCE(${booking.status}, '') <> 'cancelled'`,
          sql`COALESCE(${booking.sessionLifecycleState}, '') <> 'CANCELLED'`,
          not(anyoneJoined),
          not(meetingEnded),
        );
      case 'JOINED_LATE':
        return or(joinedLate('STUDENT'), joinedLate('MENTOR'));
    }
  }

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
   * Participant-wise attendance for the current page's bookings, from
   * zuvy_mentor_session_attendance_intervals (written by the Zoom
   * participant webhooks). "Meeting ended" comes only from verified
   * (PROCESSED) meeting.ended webhooks already stored in
   * zuvy_zoom_webhook_events — never from completedAt, recordings or time.
   * Two page-scoped queries; no joins added to the list query.
   */
  private async getParticipantAttendanceForBookings(
    rows: {
      bookingId: number;
      status: string | null;
      lifecycleState: string | null;
      isZoomMeet: boolean | null;
      zoomMeetingId: string | null;
      slotStart: Date | null;
    }[],
    now: Date,
  ) {
    const result = new Map<
      number,
      ReturnType<typeof summarizeBookingAttendance>
    >();
    if (!rows.length) return result;

    const bookingIds = rows.map((row) => row.bookingId);
    const meetingIds = [
      ...new Set(rows.map((row) => row.zoomMeetingId).filter(Boolean)),
    ] as string[];

    const [intervals, endedEvents] = await Promise.all([
      db
        .select({
          bookingId: zuvyMentorSessionAttendanceIntervals.bookingId,
          participantRole: zuvyMentorSessionAttendanceIntervals.participantRole,
          joinedAt: zuvyMentorSessionAttendanceIntervals.joinedAt,
          leftAt: zuvyMentorSessionAttendanceIntervals.leftAt,
        })
        .from(zuvyMentorSessionAttendanceIntervals)
        .where(
          inArray(zuvyMentorSessionAttendanceIntervals.bookingId, bookingIds),
        ),
      meetingIds.length
        ? db
            .select({
              meetingId: zuvyZoomWebhookEvents.meetingId,
              endedAt: sql<string>`MAX(COALESCE((${zuvyZoomWebhookEvents.payload}->'payload'->'object'->>'end_time')::timestamptz, ${zuvyZoomWebhookEvents.receivedAt}))`,
            })
            .from(zuvyZoomWebhookEvents)
            .where(
              and(
                eq(zuvyZoomWebhookEvents.eventType, 'meeting.ended'),
                eq(zuvyZoomWebhookEvents.processingStatus, 'PROCESSED'),
                inArray(zuvyZoomWebhookEvents.meetingId, meetingIds),
              ),
            )
            .groupBy(zuvyZoomWebhookEvents.meetingId)
        : Promise.resolve(
            [] as { meetingId: string | null; endedAt: string }[],
          ),
    ]);

    const endedByMeeting = new Map(
      endedEvents.map((e) => [e.meetingId, new Date(e.endedAt)]),
    );
    const intervalsByBooking = new Map<number, typeof intervals>();
    for (const interval of intervals) {
      const list = intervalsByBooking.get(interval.bookingId) ?? [];
      list.push(interval);
      intervalsByBooking.set(interval.bookingId, list);
    }

    for (const row of rows) {
      result.set(
        row.bookingId,
        summarizeBookingAttendance(
          intervalsByBooking.get(row.bookingId) ?? [],
          {
            hasZoomMeeting: row.isZoomMeet !== false && !!row.zoomMeetingId,
            isCancelled:
              row.status === 'cancelled' || row.lifecycleState === 'CANCELLED',
            meetingEndedAt: endedByMeeting.get(row.zoomMeetingId) ?? null,
            now,
            scheduledStart: row.slotStart ? new Date(row.slotStart) : null,
          },
        ),
      );
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
