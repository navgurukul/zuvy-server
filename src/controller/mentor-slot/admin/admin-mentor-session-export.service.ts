import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { and, eq, gte, ilike, inArray, lte, or, sql, SQL } from 'drizzle-orm';
import { alias, PgSelect } from 'drizzle-orm/pg-core';

import { db } from '../../../db';
import {
  users,
  zuvyBatchEnrollments,
  zuvyBatches,
  zuvyBootcamps,
  zuvyMentorSessionAttendance,
  zuvyMentorSessionRecordings,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
  zuvyStudentBookingMetrics,
} from '../../../../drizzle/schema';
import {
  ATTENTION_AFTER_START_MIN,
  AdminMentorSessionService,
  RequestUser,
  getMentorDashboardRangeDates,
} from './admin-mentor-session.service';
import { ExportSessionsQueryDto } from './dto/export-sessions.dto';
import { SessionListTab, SessionsListQueryDto } from './dto/sessions-list.dto';

/** Sessions a student gets per quota window (same rule as MentorSlotService). */
export const MENTORSHIP_SESSION_QUOTA = 3;
/** Longest date range one export may cover. */
export const EXPORT_MAX_RANGE_DAYS = 366;
const TZ = 'Asia/Kolkata';
const IST_OFFSET = '+05:30';
const DAY = 24 * 60 * 60 * 1000;
const MINUTE = 60 * 1000;

const LIFECYCLE_LABELS: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  MISSED: 'Missed',
  CANCELLED: 'Cancelled',
  RESCHEDULE_PENDING: 'Reschedule pending',
};

const OUTCOME_LABELS: Record<string, string> = {
  BOTH_JOINED: 'Both joined',
  STUDENT_NO_SHOW: 'Student no-show',
  MENTOR_NO_SHOW: 'Mentor no-show',
  NOBODY_JOINED: 'Nobody joined',
};

/** CSV header for the frontend: key in each session object -> column title. */
export const EXPORT_COLUMNS = [
  { key: 'bookingId', label: 'Booking ID' },
  { key: 'course', label: 'Course' },
  { key: 'batch', label: 'Batch' },
  { key: 'mentorName', label: 'Mentor name' },
  { key: 'mentorEmail', label: 'Mentor email' },
  { key: 'studentName', label: 'Student name' },
  { key: 'studentEmail', label: 'Student email' },
  { key: 'creditsUsed', label: 'Credits used' },
  { key: 'creditsLeft', label: 'Credits left' },
  { key: 'sessionDate', label: 'Session date' },
  { key: 'start', label: 'Start' },
  { key: 'end', label: 'End' },
  { key: 'status', label: 'Status' },
  { key: 'joinStatus', label: 'Join status' },
  { key: 'mentorJoinedAt', label: 'Mentor joined at' },
  { key: 'studentJoinedAt', label: 'Student joined at' },
  { key: 'bookedAt', label: 'Booked at' },
  { key: 'cancelledBy', label: 'Cancelled by' },
  { key: 'cancellationAskedBy', label: 'Cancellation requested by' },
  { key: 'cancellationCategory', label: 'Cancellation category' },
  { key: 'cancellationReason', label: 'Cancellation reason' },
  { key: 'mentorRating', label: 'Mentor rating' },
  { key: 'studentRating', label: 'Student rating' },
  { key: 'mentorFeedback', label: 'Mentor feedback' },
  { key: 'studentFeedback', label: 'Student feedback' },
  { key: 'recordingUrl', label: 'Recording URL' },
] as const;

/** "2026-10-18" in IST. */
const istDate = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: TZ });
/** "18:05" in IST. */
const istTime = (d: Date) =>
  d.toLocaleTimeString('en-GB', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
/** "2026-10-18 18:05" in IST, which Sheets reads as a date-time. */
const istDateTime = (d: Date | string | null | undefined) => {
  if (!d) return '';
  const date = new Date(d);
  return isNaN(date.getTime()) ? '' : `${istDate(date)} ${istTime(date)}`;
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'course';

/** Feedback is free-form JSON; pull out the text a person wrote. */
export const feedbackText = (fb: unknown): string => {
  if (fb === null || fb === undefined) return '';
  if (typeof fb === 'string') return fb;
  if (typeof fb === 'object') {
    for (const key of ['comment', 'comments', 'text', 'feedback', 'message']) {
      const v = (fb as Record<string, unknown>)[key];
      if (typeof v === 'string' && v.trim()) return v;
    }
    return JSON.stringify(fb);
  }
  return String(fb);
};

/**
 * "Both joined", "Joined late (8 min)", "Student no-show"… for one session.
 * Uses the attendance job's recorded outcome when there is one, else the
 * join times from Zoom join events. Blank when we can't tell (cancelled,
 * not finished yet, or no join data for the session).
 */
export function joinStatus(
  r: {
    cancelled: boolean;
    slotStart: Date;
    slotEnd: Date;
    mentorJoinedAt: Date | null;
    studentJoinedAt: Date | null;
    outcome?: string | null;
  },
  now: Date,
): string {
  if (r.cancelled) return '';

  const start = r.slotStart.getTime();
  const lateBy = (...joins: Array<Date | null>) => {
    const last = Math.max(...joins.filter(Boolean).map((d) => d!.getTime()));
    const min = Math.round((last - start) / MINUTE);
    return min > ATTENTION_AFTER_START_MIN ? min : 0;
  };

  const bothJoined = Boolean(r.mentorJoinedAt && r.studentJoinedAt);
  if (r.outcome && r.outcome !== 'BOTH_JOINED') {
    return OUTCOME_LABELS[r.outcome] ?? r.outcome;
  }
  if (r.outcome === 'BOTH_JOINED' || bothJoined) {
    const late = bothJoined ? lateBy(r.mentorJoinedAt, r.studentJoinedAt) : 0;
    return late ? `Joined late (${late} min)` : 'Both joined';
  }

  if (now.getTime() < r.slotEnd.getTime()) return '';
  if (r.mentorJoinedAt) return 'Student no-show';
  if (r.studentJoinedAt) return 'Mentor no-show';
  return '';
}

/**
 * Status, attendance and whether ops can cancel, for one non-cancelled row of
 * the "Today's sessions" table.
 */
export function daySessionState(
  r: {
    lifecycleState: string | null;
    slotStart: Date;
    slotEnd: Date;
    completedAt: Date | null;
    mentorJoinedAt: Date | null;
    studentJoinedAt: Date | null;
    outcome?: string | null;
  },
  now: Date,
) {
  const t = now.getTime();
  const start = r.slotStart.getTime();
  const end = r.slotEnd.getTime();

  const status =
    r.lifecycleState === 'COMPLETED'
      ? 'completed'
      : r.lifecycleState === 'MISSED'
        ? 'missed'
        : r.lifecycleState === 'RESCHEDULE_PENDING'
          ? 'reschedule_pending'
          : t < start
            ? 'upcoming'
            : 'in_progress';

  // Same rule as the live cards: not joined only counts 5 min after start,
  // and only while the session is running.
  let attendance: string | null;
  if (t < start) {
    attendance = 'Scheduled';
  } else if (t < end && status === 'in_progress') {
    const late = t >= start + ATTENTION_AFTER_START_MIN * MINUTE;
    attendance =
      late && !r.mentorJoinedAt
        ? 'Mentor not joined'
        : late && !r.studentJoinedAt
          ? 'Student not joined'
          : 'In progress';
  } else {
    attendance =
      joinStatus(
        {
          cancelled: false,
          slotStart: r.slotStart,
          slotEnd: r.slotEnd,
          mentorJoinedAt: r.mentorJoinedAt,
          studentJoinedAt: r.studentJoinedAt,
          outcome: r.outcome,
        },
        now,
      ) || null;
  }

  // Matches AdminMentorSessionService.assertCancellableAt.
  const canCancel =
    !r.completedAt &&
    t < end &&
    r.lifecycleState !== 'COMPLETED' &&
    r.lifecycleState !== 'MISSED';

  return { status, attendance, canCancel };
}

const isCancelledSql = sql`(COALESCE(${zuvyMentorSlotBooking.status}, '') = 'cancelled' OR COALESCE(${zuvyMentorSlotBooking.sessionLifecycleState}, '') = 'CANCELLED')`;

/** Latest Drive link of the session's recording, if any. */
const latestRecordingUrlSql = sql<string | null>`(
  SELECT ${zuvyMentorSessionRecordings.driveLink}
  FROM ${zuvyMentorSessionRecordings}
  WHERE ${zuvyMentorSessionRecordings.mentorBookingId} = ${zuvyMentorSlotBooking.id}
    AND ${zuvyMentorSessionRecordings.driveLink} IS NOT NULL
  ORDER BY ${zuvyMentorSessionRecordings.id} DESC
  LIMIT 1
)`;

const hasRecordingSql = sql`EXISTS (
  SELECT 1 FROM ${zuvyMentorSessionRecordings}
  WHERE ${zuvyMentorSessionRecordings.mentorBookingId} = ${zuvyMentorSlotBooking.id}
    AND ${zuvyMentorSessionRecordings.driveLink} IS NOT NULL
)`;

/**
 * Status tabs of the sessions table. No-shows are MISSED sessions (the
 * attendance job sets MISSED whenever someone didn't join).
 */
export function tabConditions(now: Date): Record<SessionListTab, SQL> {
  const lifecycle = sql`COALESCE(${zuvyMentorSlotBooking.sessionLifecycleState}, '')`;
  return {
    upcoming: sql`(NOT ${isCancelledSql} AND ${zuvyMentorSlotAvailability.slotStartDateTime} > ${now.toISOString()} AND ${lifecycle} NOT IN ('COMPLETED', 'MISSED'))`,
    completed: sql`(NOT ${isCancelledSql} AND ${lifecycle} = 'COMPLETED')`,
    no_show: sql`(NOT ${isCancelledSql} AND ${lifecycle} = 'MISSED')`,
    cancelled: isCancelledSql,
  };
}

@Injectable()
export class AdminMentorSessionExportService {
  private readonly logger = new Logger(AdminMentorSessionExportService.name);

  constructor(private readonly adminService: AdminMentorSessionService) {}

  /**
   * Every matching session (not paginated) as JSON, one object per row of the
   * "Download session data" file. Times are IST strings, ready to write out.
   */
  async exportSessions(user: RequestUser, query: ExportSessionsQueryDto) {
    const ctx = await this.prepare(user, query);
    const now = new Date();

    const rows = await this.withJoins(
      db
        .select({
          bookingId: zuvyMentorSlotBooking.id,
          courseName: zuvyBootcamps.name,
          batchName: ctx.batchName,
          mentorName: ctx.mentorUser.name,
          mentorEmail: ctx.mentorUser.email,
          studentName: ctx.studentUser.name,
          studentEmail: ctx.studentUser.email,
          quotaUsed: zuvyStudentBookingMetrics.quotaUsed,
          quotaResetDate: zuvyStudentBookingMetrics.quotaResetDate,
          slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
          slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
          status: zuvyMentorSlotBooking.status,
          lifecycleState: zuvyMentorSlotBooking.sessionLifecycleState,
          mentorJoinedAt: zuvyMentorSlotBooking.mentorJoinedAt,
          studentJoinedAt: zuvyMentorSlotBooking.studentJoinedAt,
          bookedAt: zuvyMentorSlotBooking.bookedAt,
          cancelledBy: zuvyMentorSlotBooking.cancelledBy,
          cancellationAskedBy: zuvyMentorSlotBooking.cancellationAskedBy,
          cancellationCategory: zuvyMentorSlotBooking.cancellationCategory,
          cancellationReason: zuvyMentorSlotBooking.cancellationReason,
          mentorRating: zuvyMentorSlotBooking.mentorRating,
          studentRating: zuvyMentorSlotBooking.studentRating,
          mentorFeedback: zuvyMentorSlotBooking.mentorFeedback,
          studentFeedback: zuvyMentorSlotBooking.studentFeedback,
          recordingUrl: latestRecordingUrlSql,
        })
        .from(zuvyMentorSlotBooking)
        .$dynamic(),
      ctx,
    ).orderBy(
      zuvyMentorSlotAvailability.slotStartDateTime,
      zuvyMentorSlotBooking.id,
    );

    const outcomes = await this.outcomesFor(rows.map((r) => r.bookingId));

    const sessions = rows.map((r) => {
      const slotStart = new Date(r.slotStart);
      const slotEnd = new Date(r.slotEnd);
      const cancelled =
        r.status === 'cancelled' || r.lifecycleState === 'CANCELLED';

      const quotaExpired =
        r.quotaResetDate !== null && now >= new Date(r.quotaResetDate);
      const creditsUsed = quotaExpired
        ? 0
        : Math.min(r.quotaUsed ?? 0, MENTORSHIP_SESSION_QUOTA);

      return {
        bookingId: r.bookingId,
        course: r.courseName ?? null,
        batch: r.batchName ?? null,
        mentorName: r.mentorName ?? null,
        mentorEmail: r.mentorEmail ?? null,
        studentName: r.studentName ?? null,
        studentEmail: r.studentEmail ?? null,
        creditsUsed,
        creditsLeft: MENTORSHIP_SESSION_QUOTA - creditsUsed,
        sessionDate: istDate(slotStart),
        start: istTime(slotStart),
        end: istTime(slotEnd),
        status: cancelled
          ? 'Cancelled'
          : (LIFECYCLE_LABELS[r.lifecycleState ?? ''] ??
            r.lifecycleState ??
            null),
        joinStatus:
          joinStatus(
            {
              cancelled,
              slotStart,
              slotEnd,
              mentorJoinedAt: r.mentorJoinedAt
                ? new Date(r.mentorJoinedAt)
                : null,
              studentJoinedAt: r.studentJoinedAt
                ? new Date(r.studentJoinedAt)
                : null,
              outcome: outcomes.get(r.bookingId),
            },
            now,
          ) || null,
        mentorJoinedAt: istDateTime(r.mentorJoinedAt) || null,
        studentJoinedAt: istDateTime(r.studentJoinedAt) || null,
        bookedAt: istDateTime(r.bookedAt) || null,
        cancelledBy: r.cancelledBy ?? null,
        cancellationAskedBy: r.cancellationAskedBy ?? null,
        cancellationCategory: r.cancellationCategory ?? null,
        cancellationReason: r.cancellationReason ?? null,
        mentorRating: r.mentorRating ?? null,
        studentRating: r.studentRating ?? null,
        mentorFeedback: feedbackText(r.mentorFeedback) || null,
        studentFeedback: feedbackText(r.studentFeedback) || null,
        recordingUrl: r.recordingUrl ?? null,
      };
    });

    return {
      count: sessions.length,
      fileName: ctx.fileName,
      filters: {
        orgId: query.orgId,
        bootcampId: query.bootcampId ?? null,
        courseName: ctx.courseName,
        mentorId: query.mentorId ?? null,
        batchId: query.batchId ?? null,
        status: query.status ?? null,
        from: ctx.from,
        to: ctx.to,
      },
      columns: EXPORT_COLUMNS,
      sessions,
    };
  }

  /**
   * Sessions table (today's table and the course "Bookings" tab): sessions in
   * an IST date range, earliest first, with credits, status, attendance,
   * ratings, recording and whether it can still be cancelled. Supports the
   * status tabs (with counts), search, mentor, batch and has-recording
   * filters, and pagination.
   */
  async getDaySessions(user: RequestUser, query: SessionsListQueryDto) {
    const preset = getMentorDashboardRangeDates(query.range);
    const from = query.from ?? query.to ?? query.date ?? preset.from;
    const to = query.to ?? query.from ?? query.date ?? preset.to;
    const ctx = await this.prepare(user, {
      orgId: query.orgId,
      bootcampId: query.bootcampId,
      mentorId: query.mentorId,
      batchId: query.batchId,
      from,
      to,
    });
    const now = new Date();
    const limit = query.limit ?? 50;
    const offset = query.offset ?? 0;

    const filters: SQL[] = [ctx.where!];
    const search = query.search?.trim();
    if (search) {
      const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      filters.push(
        or(
          ilike(ctx.studentUser.name, like),
          ilike(ctx.studentUser.email, like),
          ilike(ctx.mentorUser.name, like),
          ilike(ctx.mentorUser.email, like),
        )!,
      );
    }
    if (query.hasRecording) filters.push(hasRecordingSql);
    const baseWhere = and(...filters);

    const tabs = tabConditions(now);

    // Tab counts use every filter except the status tab itself.
    const [counts] = await this.withJoins(
      db
        .select({
          all: sql<number>`COUNT(*)::int`,
          upcoming: sql<number>`COUNT(*) FILTER (WHERE ${tabs.upcoming})::int`,
          completed: sql<number>`COUNT(*) FILTER (WHERE ${tabs.completed})::int`,
          no_show: sql<number>`COUNT(*) FILTER (WHERE ${tabs.no_show})::int`,
          cancelled: sql<number>`COUNT(*) FILTER (WHERE ${tabs.cancelled})::int`,
        })
        .from(zuvyMentorSlotBooking)
        .$dynamic(),
      { ...ctx, where: baseWhere },
    );

    const where = query.status ? and(baseWhere, tabs[query.status]) : baseWhere;

    const rows = await this.withJoins(
      db
        .select({
          bookingId: zuvyMentorSlotBooking.id,
          bootcampId: ctx.courseId,
          courseName: zuvyBootcamps.name,
          batchName: ctx.batchName,
          slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
          slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
          bookingStatus: zuvyMentorSlotBooking.status,
          lifecycleState: zuvyMentorSlotBooking.sessionLifecycleState,
          completedAt: zuvyMentorSlotBooking.completedAt,
          cancelledBy: zuvyMentorSlotBooking.cancelledBy,
          cancellationAskedBy: zuvyMentorSlotBooking.cancellationAskedBy,
          cancellationCategory: zuvyMentorSlotBooking.cancellationCategory,
          cancellationReason: zuvyMentorSlotBooking.cancellationReason,
          mentorId: zuvyMentorSlotBooking.mentorUserId,
          mentorName: ctx.mentorUser.name,
          mentorEmail: ctx.mentorUser.email,
          studentId: zuvyMentorSlotBooking.studentUserId,
          studentName: ctx.studentUser.name,
          studentEmail: ctx.studentUser.email,
          mentorJoinedAt: zuvyMentorSlotBooking.mentorJoinedAt,
          studentJoinedAt: zuvyMentorSlotBooking.studentJoinedAt,
          quotaUsed: zuvyStudentBookingMetrics.quotaUsed,
          quotaResetDate: zuvyStudentBookingMetrics.quotaResetDate,
          mentorRating: zuvyMentorSlotBooking.mentorRating,
          studentRating: zuvyMentorSlotBooking.studentRating,
          recordingUrl: latestRecordingUrlSql,
          hasRecordingRow: sql<boolean>`EXISTS (
            SELECT 1 FROM ${zuvyMentorSessionRecordings}
            WHERE ${zuvyMentorSessionRecordings.mentorBookingId} = ${zuvyMentorSlotBooking.id}
          )`,
        })
        .from(zuvyMentorSlotBooking)
        .$dynamic(),
      { ...ctx, where },
    )
      .orderBy(
        zuvyMentorSlotAvailability.slotStartDateTime,
        zuvyMentorSlotBooking.id,
      )
      .limit(limit)
      .offset(offset);

    const outcomes = await this.outcomesFor(rows.map((r) => r.bookingId));

    const sessions = rows.map((r) => {
      const slotStart = new Date(r.slotStart);
      const slotEnd = new Date(r.slotEnd);
      const cancelled =
        r.bookingStatus === 'cancelled' || r.lifecycleState === 'CANCELLED';

      const quotaExpired =
        r.quotaResetDate !== null && now >= new Date(r.quotaResetDate);
      const creditsUsed = quotaExpired
        ? 0
        : Math.min(r.quotaUsed ?? 0, MENTORSHIP_SESSION_QUOTA);

      const state = cancelled
        ? { status: 'cancelled', attendance: null, canCancel: false }
        : daySessionState(
            {
              lifecycleState: r.lifecycleState,
              slotStart,
              slotEnd,
              completedAt: r.completedAt ? new Date(r.completedAt) : null,
              mentorJoinedAt: r.mentorJoinedAt
                ? new Date(r.mentorJoinedAt)
                : null,
              studentJoinedAt: r.studentJoinedAt
                ? new Date(r.studentJoinedAt)
                : null,
              outcome: outcomes.get(r.bookingId),
            },
            now,
          );

      // Watch link / Processing / Not held / After session.
      const recording = r.recordingUrl
        ? { status: 'available', url: r.recordingUrl }
        : r.hasRecordingRow
          ? { status: 'processing', url: null }
          : !cancelled && now < slotEnd
            ? { status: 'after_session', url: null }
            : { status: 'not_held', url: null };

      return {
        bookingId: r.bookingId,
        slotStart: slotStart.toISOString(),
        slotEnd: slotEnd.toISOString(),
        bootcampId: r.bootcampId ?? null,
        courseName: r.courseName ?? null,
        batchName: r.batchName ?? null,
        mentor: {
          id: r.mentorId?.toString(),
          name: r.mentorName ?? null,
          email: r.mentorEmail ?? null,
        },
        student: {
          id: r.studentId?.toString(),
          name: r.studentName ?? null,
          email: r.studentEmail ?? null,
        },
        cancelledBy: r.cancelledBy ?? null,
        cancellationAskedBy: r.cancellationAskedBy ?? null,
        cancellationCategory: r.cancellationCategory ?? null,
        cancellationReason: r.cancellationReason ?? null,
        credits: {
          left: MENTORSHIP_SESSION_QUOTA - creditsUsed,
          total: MENTORSHIP_SESSION_QUOTA,
        },
        ratings: {
          studentToMentor: r.studentRating ?? null,
          mentorToStudent: r.mentorRating ?? null,
        },
        recording,
        ...state,
      };
    });

    return {
      serverTime: now.toISOString(),
      date: from === to ? from : undefined,
      from,
      to,
      counts: counts ?? {
        all: 0,
        upcoming: 0,
        completed: 0,
        no_show: 0,
        cancelled: 0,
      },
      total: query.status ? (counts?.[query.status] ?? 0) : (counts?.all ?? 0),
      limit,
      offset,
      sessions,
    };
  }

  /* ---------------------------------------------------------------------- */

  private async prepare(user: RequestUser, query: ExportSessionsQueryDto) {
    this.adminService.assertCanViewOrg(user, query.orgId);

    let courseName: string | null = null;
    if (query.bootcampId) {
      await this.adminService.assertCourseHasMentorship(
        query.orgId,
        query.bootcampId,
      );
      const [course] = await db
        .select({ name: zuvyBootcamps.name })
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, query.bootcampId))
        .limit(1);
      courseName = course?.name ?? null;
    }

    const preset = getMentorDashboardRangeDates(query.range);
    const to = query.to ?? query.from ?? preset.to;
    const from = query.from ?? preset.from;
    const rangeStart = new Date(`${from}T00:00:00.000${IST_OFFSET}`);
    const rangeEnd = new Date(`${to}T23:59:59.999${IST_OFFSET}`);
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      throw new BadRequestException('from and to must be valid dates.');
    }
    if (rangeStart > rangeEnd) {
      throw new BadRequestException('from must be on or before to.');
    }
    if (
      rangeEnd.getTime() - rangeStart.getTime() >
      EXPORT_MAX_RANGE_DAYS * DAY
    ) {
      throw new BadRequestException(
        `The date range can be at most ${EXPORT_MAX_RANGE_DAYS} days.`,
      );
    }

    const mentorUser = alias(users, 'mentor_user');
    const studentUser = alias(users, 'student_user');

    // Older bookings have no bootcamp_id; use the mentor profile's course.
    const courseId = sql<
      number | null
    >`COALESCE(${zuvyMentorSlotBooking.bootcampId}, ${zuvyMentorSlotManagement.bootcampId})`;

    // The student's batch in this course (latest enrollment if several).
    const batchName = sql<string | null>`(
      SELECT ${zuvyBatches.name}
      FROM ${zuvyBatchEnrollments}
      JOIN ${zuvyBatches} ON ${zuvyBatches.id} = ${zuvyBatchEnrollments.batchId}
      WHERE ${zuvyBatchEnrollments.userId} = ${zuvyMentorSlotBooking.studentUserId}
        AND ${zuvyBatchEnrollments.bootcampId} = ${courseId}
      ORDER BY ${zuvyBatchEnrollments.id} DESC
      LIMIT 1
    )`;

    const conditions: SQL[] = [
      eq(zuvyMentorSlotBooking.organizationId, query.orgId),
      gte(zuvyMentorSlotAvailability.slotStartDateTime, rangeStart),
      lte(zuvyMentorSlotAvailability.slotStartDateTime, rangeEnd),
    ];
    if (query.bootcampId) {
      conditions.push(sql`${courseId} = ${query.bootcampId}`);
    }
    if (query.mentorId) {
      conditions.push(
        eq(zuvyMentorSlotBooking.mentorUserId, BigInt(query.mentorId)),
      );
    }
    if (query.batchId) {
      conditions.push(sql`EXISTS (
        SELECT 1 FROM ${zuvyBatchEnrollments}
        WHERE ${zuvyBatchEnrollments.userId} = ${zuvyMentorSlotBooking.studentUserId}
          AND ${zuvyBatchEnrollments.bootcampId} = ${courseId}
          AND ${zuvyBatchEnrollments.batchId} = ${query.batchId}
      )`);
    }
    const statusCondition = this.statusCondition(query.status);
    if (statusCondition) conditions.push(statusCondition);

    const fileName = `mentorship-sessions_${slug(courseName ?? 'all-courses')}_${from}_${to}.csv`;

    return {
      from,
      to,
      courseName,
      fileName,
      mentorUser,
      studentUser,
      batchName,
      courseId,
      where: and(...conditions),
    };
  }

  private statusCondition(status?: string): SQL | undefined {
    const b = zuvyMentorSlotBooking;
    const isCancelled = or(
      eq(b.status, 'cancelled'),
      eq(b.sessionLifecycleState, 'CANCELLED'),
    )!;
    const notCancelled = sql`NOT (${isCancelled})`;
    const lifecycle = (state: string) =>
      and(eq(b.sessionLifecycleState, state), notCancelled);

    switch (status) {
      case undefined:
        return undefined;
      case 'cancelled':
        return isCancelled;
      default:
        return lifecycle(status.toUpperCase());
    }
  }

  /** Joins and filters shared by the count and the export. */
  private withJoins<Q extends PgSelect>(
    qb: Q,
    ctx: Awaited<ReturnType<AdminMentorSessionExportService['prepare']>>,
  ) {
    return qb
      .innerJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotBooking.slotAvailabilityId,
          zuvyMentorSlotAvailability.id,
        ),
      )
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(
          zuvyMentorSlotAvailability.mentorSlotManagementId,
          zuvyMentorSlotManagement.id,
        ),
      )
      .leftJoin(zuvyBootcamps, sql`${zuvyBootcamps.id} = ${ctx.courseId}`)
      .leftJoin(
        ctx.mentorUser,
        eq(zuvyMentorSlotBooking.mentorUserId, ctx.mentorUser.id),
      )
      .leftJoin(
        ctx.studentUser,
        eq(zuvyMentorSlotBooking.studentUserId, ctx.studentUser.id),
      )
      .leftJoin(
        zuvyStudentBookingMetrics,
        eq(
          zuvyStudentBookingMetrics.userId,
          zuvyMentorSlotBooking.studentUserId,
        ),
      )
      .where(ctx.where);
  }

  /**
   * Recorded attendance outcomes (from MentorAttendanceJob). Read separately
   * so the export still works where migration 0049 isn't applied yet.
   */
  private async outcomesFor(bookingIds: number[]) {
    const result = new Map<number, string>();
    if (!bookingIds.length) return result;
    try {
      const rows = await db
        .select({
          bookingId: zuvyMentorSessionAttendance.mentorBookingId,
          outcome: zuvyMentorSessionAttendance.outcome,
        })
        .from(zuvyMentorSessionAttendance)
        .where(
          and(
            inArray(zuvyMentorSessionAttendance.mentorBookingId, bookingIds),
            eq(zuvyMentorSessionAttendance.status, 'RECORDED'),
          ),
        );
      for (const r of rows) if (r.outcome) result.set(r.bookingId, r.outcome);
    } catch (err: any) {
      this.logger.warn(
        `Attendance outcomes unavailable for export (is migration 0049 applied?): ${err.message}`,
      );
    }
    return result;
  }
}
