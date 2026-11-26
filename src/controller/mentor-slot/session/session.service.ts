import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../../../db';
import {
  users,
  zuvyBatchEnrollments,
  zuvyBatches,
  zuvyBootcamps,
  zuvyMentorSlotManagement,
  zuvyMentorProfile,
  zuvyMentorSessionAttendance,
  zuvyMentorSessionRecordings,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
} from '../../../../drizzle/schema';

import { and, eq, desc, inArray, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { withoutHostZoomFields } from '../booking-response.util';
import {
  MentorshipConfig,
  MentorshipConfigService,
} from '../mentorship-rules/mentorship-config.service';
import { CreditService } from '../mentorship-rules/credit.service';
import { creditData } from '../mentorship-rules/mentorship-rules';
import { CardCredits, buildSessionCard } from './session-card';
import { buildMentorSessionCard } from './mentor-session-card';

// The slot a pending reschedule would move the booking to.
const proposedSlot = alias(zuvyMentorSlotAvailability, 'proposed_slot');

// Not cancelled and not over yet. RESCHEDULE_PENDING and IN_PROGRESS used to
// be left out, so those sessions vanished from Upcoming.
const UPCOMING_STATES = ['SCHEDULED', 'RESCHEDULE_PENDING', 'IN_PROGRESS'];

@Injectable()
export class SessionService {
  constructor(
    private readonly mentorshipConfig: MentorshipConfigService,
    private readonly creditService: CreditService,
  ) {}

  private mapMeetingLink(booking: any, userId: bigint) {
    if (booking.mentorUserId === userId) {
      return booking.zoomStartUrl; // mentor
    }
    return booking.meetingLink; // student
  }

  /* ==========================================================================
     STUDENT SESSIONS
  ========================================================================== */

  /**
   * The student's sessions (My Sessions). Each item keeps the fields it
   * always had (booking, mentorName, slotStart, slotEnd) and adds what its
   * card shows (see session-card.ts): displayState, the times reschedule,
   * cancel and join open or close, `actions` with a reason when a button
   * doesn't work, the card's message, the reschedule request, who cancelled,
   * the recording, and whether it uses a credit. The response adds the
   * student's credits, the rule numbers and the server's clock.
   *
   * filter: all | upcoming (not cancelled, not yet over: scheduled,
   * reschedule requested or in progress) | completed | cancelled | missed.
   */
  async getStudentSessions(
    userId: bigint,
    filter = 'all',
    limit = 10,
    offset = 0,
    sort: 'asc' | 'desc' = 'desc',
  ) {
    // Lifecycle transitions (SCHEDULED -> IN_PROGRESS -> COMPLETED/MISSED) are
    // handled only by MentorSlotJob.handleSessionTransitions, which runs every
    // minute. This read path used to write those transitions too, racing the
    // cron with different rules. See MDA-09.
    void sort;
    const conditions = [eq(zuvyMentorSlotBooking.studentUserId, userId)];

    if (filter === 'upcoming') {
      conditions.push(
        ne(zuvyMentorSlotBooking.status, 'cancelled'),
        inArray(zuvyMentorSlotBooking.sessionLifecycleState, UPCOMING_STATES),
      );
    }

    if (filter === 'completed') {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'COMPLETED'),
      );
    }

    if (filter === 'cancelled') {
      conditions.push(eq(zuvyMentorSlotBooking.status, 'cancelled'));
    }

    if (filter === 'missed') {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'MISSED'),
      );
    }

    const config = await this.mentorshipConfig.get();
    const now = new Date();
    const rows = await this.studentSessionRows(and(...conditions), {
      limit,
      offset,
    });
    const credits = await this.creditService.getState(userId, config, db, now);
    const cards = await this.studentCards(rows, config, now, credits);

    const [counts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        upcoming: sql<number>`COUNT(*) FILTER (WHERE status <> 'cancelled' AND session_lifecycle_state IN ('SCHEDULED', 'RESCHEDULE_PENDING', 'IN_PROGRESS'))`,
        completed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'COMPLETED')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
        missed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'MISSED')`,
      })
      .from(zuvyMentorSlotBooking)
      .where(and(eq(zuvyMentorSlotBooking.studentUserId, userId)));

    return {
      data: cards,
      counts,
      // The header: "Credits: 1 of 3 left · Used: 2 · Next booking opens …"
      credits: creditData(credits),
      rules: {
        noticeHours: config.noticeHours,
        joinOpenMinutes: config.joinOpenMinutes,
      },
      serverTime: now,
    };
  }

  /** The student's bookings with what their cards need, newest booking first. */
  private async studentSessionRows(
    where: any,
    page?: { limit: number; offset: number },
  ) {
    let query = db
      .select({
        booking: zuvyMentorSlotBooking,
        mentorName: users.name,
        mentorTitle: zuvyMentorProfile.title,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
        proposedStart: proposedSlot.slotStartDateTime,
        proposedEnd: proposedSlot.slotEndDateTime,
        attendanceOutcome: zuvyMentorSessionAttendance.outcome,
        creditRefunded: zuvyMentorSessionAttendance.creditRefunded,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.mentorUserId))
      .leftJoin(
        zuvyMentorProfile,
        eq(zuvyMentorProfile.mentorUserId, zuvyMentorSlotBooking.mentorUserId),
      )
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .leftJoin(
        proposedSlot,
        eq(proposedSlot.id, zuvyMentorSlotBooking.rescheduleProposedSlotId),
      )
      .leftJoin(
        zuvyMentorSessionAttendance,
        eq(
          zuvyMentorSessionAttendance.mentorBookingId,
          zuvyMentorSlotBooking.id,
        ),
      )
      .where(where)
      .orderBy(
        desc(zuvyMentorSlotBooking.bookedAt),
        desc(zuvyMentorSlotBooking.id),
      )
      .$dynamic();
    if (page) query = query.limit(page.limit).offset(page.offset);
    return query;
  }

  /** Each row as before, plus its card. */
  private async studentCards(
    rows: Awaited<ReturnType<SessionService['studentSessionRows']>>,
    config: MentorshipConfig,
    now: Date,
    credits: CardCredits,
  ) {
    const recordings = await this.bestRecordings(
      rows.map((row) => row.booking.id),
    );
    return rows.map((row) => {
      const b = row.booking;
      const card = row.slotStart
        ? buildSessionCard(
            {
              bookingId: b.id,
              status: b.status,
              lifecycleState: b.sessionLifecycleState,
              start: new Date(row.slotStart),
              end: new Date(row.slotEnd),
              meetingLink: b.meetingLink,
              mentorName: row.mentorName,
              reschedule: {
                status: b.rescheduleStatus,
                proposedStart: row.proposedStart
                  ? new Date(row.proposedStart)
                  : null,
                proposedEnd: row.proposedEnd ? new Date(row.proposedEnd) : null,
                acceptedCount: b.acceptedRescheduleCount ?? 0,
              },
              cancellation: {
                cancelledBy: b.cancelledBy,
                reason: b.cancellationReason,
                at: b.cancelledAt ? new Date(b.cancelledAt) : null,
              },
              attendance:
                row.attendanceOutcome || row.creditRefunded
                  ? {
                      outcome: row.attendanceOutcome,
                      creditRefunded: row.creditRefunded === true,
                    }
                  : null,
              recording: recordings.get(b.id) ?? null,
              feedback: {
                submitted: !!b.studentFeedbackSubmittedAt,
                locked: b.studentFeedbackLocked === true,
              },
            },
            config,
            now,
            credits,
          )
        : null;
      return {
        booking: {
          ...withoutHostZoomFields(b),
          meetingLink: b.meetingLink,
        },
        mentorName: row.mentorName,
        mentorTitle: row.mentorTitle,
        slotStart: row.slotStart,
        slotEnd: row.slotEnd,
        ...(card ?? {}),
      };
    });
  }

  /**
   * Per booking, the recording to show: a finished one with a link if there
   * is one, otherwise the newest.
   */
  private async bestRecordings(bookingIds: number[]) {
    const best = new Map<
      number,
      { status: string | null; url: string | null }
    >();
    if (!bookingIds.length) return best;
    const rows = await db
      .select({
        bookingId: zuvyMentorSessionRecordings.mentorBookingId,
        status: zuvyMentorSessionRecordings.status,
        url: zuvyMentorSessionRecordings.driveLink,
      })
      .from(zuvyMentorSessionRecordings)
      .where(inArray(zuvyMentorSessionRecordings.mentorBookingId, bookingIds))
      .orderBy(desc(zuvyMentorSessionRecordings.createdAt));
    for (const row of rows) {
      const current = best.get(row.bookingId);
      const ready = row.status === 'COMPLETED' && !!row.url;
      if (
        !current ||
        (ready && !(current.status === 'COMPLETED' && current.url))
      ) {
        best.set(row.bookingId, { status: row.status, url: row.url });
      }
    }
    return best;
  }

  /* ==========================================================================
     MENTOR SESSIONS
  ========================================================================== */

  /**
   * The mentor's sessions (Mentor tab, MT1). Each item keeps the fields it
   * always had (booking, studentName, slotStart, slotEnd) and adds what its
   * card shows (see mentor-session-card.ts): displayState, the times cancel
   * and join open or close, `actions` with a reason when a button doesn't
   * work, the card's message, the student's reschedule request, who
   * cancelled, the recording, the student's course and batch, and the
   * student's credits. The response adds counts for every tab, the rule
   * numbers and the server's clock.
   *
   * filter (tabs): all | upcoming (scheduled or live, no request waiting) |
   * action-needed (a student's reschedule request waits; old name
   * "reschedule") | completed | missed | cancelled.
   */
  async getMentorSessions(
    userId: bigint,
    organizationId: number,
    filter = 'all',
    limit = 10,
    offset = 0,
    sort: 'asc' | 'desc' = 'desc',
  ) {
    // See the note in getStudentSessions above — MDA-09.
    const mine = [
      eq(zuvyMentorSlotBooking.mentorUserId, userId),
      eq(zuvyMentorSlotBooking.organizationId, organizationId),
    ];
    const conditions = [...mine];

    if (filter === 'upcoming') {
      conditions.push(
        ne(zuvyMentorSlotBooking.status, 'cancelled'),
        inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
          'SCHEDULED',
          'IN_PROGRESS',
        ]),
      );
    }

    if (filter === 'action-needed' || filter === 'reschedule') {
      conditions.push(
        eq(zuvyMentorSlotBooking.rescheduleStatus, 'pending'),
        ne(zuvyMentorSlotBooking.status, 'cancelled'),
      );
    }

    if (filter === 'completed') {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'COMPLETED'),
      );
    }

    if (filter === 'missed') {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'MISSED'),
      );
    }

    if (filter === 'cancelled') {
      conditions.push(eq(zuvyMentorSlotBooking.status, 'cancelled'));
    }

    const config = await this.mentorshipConfig.get();
    const now = new Date();
    const rows = await this.mentorSessionRows(and(...conditions), sort, {
      limit,
      offset,
    });
    const cards = await this.mentorCards(rows, organizationId, config, now);

    const [counts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        upcoming: sql<number>`COUNT(*) FILTER (WHERE status <> 'cancelled' AND session_lifecycle_state IN ('SCHEDULED', 'IN_PROGRESS'))`,
        actionNeeded: sql<number>`COUNT(*) FILTER (WHERE status <> 'cancelled' AND reschedule_status = 'pending')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'COMPLETED')`,
        missed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'MISSED')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
        // Old name of actionNeeded, kept for existing screens.
        reschedule: sql<number>`COUNT(*) FILTER (WHERE status <> 'cancelled' AND reschedule_status = 'pending')`,
      })
      .from(zuvyMentorSlotBooking)
      .where(and(...mine));

    return {
      data: cards,
      counts,
      rules: {
        noticeHours: config.noticeHours,
        joinOpenMinutes: config.joinOpenMinutes,
      },
      serverTime: now,
    };
  }

  /** The mentor's bookings with what their cards need. */
  private async mentorSessionRows(
    where: any,
    sort: 'asc' | 'desc' = 'desc',
    page?: { limit: number; offset: number },
  ) {
    let query = db
      .select({
        booking: zuvyMentorSlotBooking,
        studentName: users.name,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
        proposedStart: proposedSlot.slotStartDateTime,
        proposedEnd: proposedSlot.slotEndDateTime,
        attendanceOutcome: zuvyMentorSessionAttendance.outcome,
        creditRefunded: zuvyMentorSessionAttendance.creditRefunded,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.studentUserId))
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .leftJoin(
        proposedSlot,
        eq(proposedSlot.id, zuvyMentorSlotBooking.rescheduleProposedSlotId),
      )
      .leftJoin(
        zuvyMentorSessionAttendance,
        eq(
          zuvyMentorSessionAttendance.mentorBookingId,
          zuvyMentorSlotBooking.id,
        ),
      )
      .where(where)
      .orderBy(
        sort === 'asc'
          ? zuvyMentorSlotBooking.bookedAt
          : desc(zuvyMentorSlotBooking.bookedAt),
        desc(zuvyMentorSlotBooking.id),
      )
      .$dynamic();
    if (page) query = query.limit(page.limit).offset(page.offset);
    return query;
  }

  /** Each row as before (mentor view), plus its card, course and credits. */
  private async mentorCards(
    rows: Awaited<ReturnType<SessionService['mentorSessionRows']>>,
    organizationId: number,
    config: MentorshipConfig,
    now: Date,
  ) {
    const recordings = await this.bestRecordings(
      rows.map((row) => row.booking.id),
    );
    const studentIds = [
      ...new Set(rows.map((row) => String(row.booking.studentUserId))),
    ];
    const mentorIds = [
      ...new Set(rows.map((row) => String(row.booking.mentorUserId))),
    ];
    const courses = await this.studentCourses(
      studentIds,
      mentorIds,
      organizationId,
    );
    // Each student's credits ("Credits left 1 of 3 · Sessions used 2 ·
    // Next booking opens 20 Nov").
    const credits = new Map<string, ReturnType<typeof creditData>>();
    await Promise.all(
      studentIds.map(async (id) => {
        credits.set(
          id,
          creditData(
            await this.creditService.getState(BigInt(id), config, db, now),
          ),
        );
      }),
    );

    return rows.map((row) => {
      const b = row.booking;
      const card = row.slotStart
        ? buildMentorSessionCard(
            {
              status: b.status,
              lifecycleState: b.sessionLifecycleState,
              start: new Date(row.slotStart),
              end: new Date(row.slotEnd),
              hasMeeting: !!(
                b.zoomMeetingId ||
                b.meetingLink ||
                b.googleEventId
              ),
              studentName: row.studentName,
              reschedule: {
                status: b.rescheduleStatus,
                proposedStart: row.proposedStart
                  ? new Date(row.proposedStart)
                  : null,
                proposedEnd: row.proposedEnd ? new Date(row.proposedEnd) : null,
                reason: b.rescheduleReason ?? null,
              },
              cancellation: {
                cancelledBy: b.cancelledBy,
                reason: b.cancellationReason,
                at: b.cancelledAt ? new Date(b.cancelledAt) : null,
              },
              attendance:
                row.attendanceOutcome || row.creditRefunded
                  ? {
                      outcome: row.attendanceOutcome,
                      creditRefunded: row.creditRefunded === true,
                    }
                  : null,
              recording: recordings.get(b.id) ?? null,
              feedback: {
                submitted: !!b.mentorFeedbackSubmittedAt,
                locked: b.mentorFeedbackLocked === true,
              },
            },
            config,
            now,
          )
        : null;
      const course = courses.get(String(b.studentUserId)) ?? null;
      return {
        booking: {
          ...b,
          meetingLink: b.zoomStartUrl,
        },
        studentName: row.studentName,
        slotStart: row.slotStart,
        slotEnd: row.slotEnd,
        // NEW (MT1)
        student: {
          userId: b.studentUserId,
          name: row.studentName,
          bootcampName: course?.bootcampName ?? null,
          batchName: course?.batchName ?? null,
        },
        studentCredits: credits.get(String(b.studentUserId)) ?? null,
        ...(card ?? {}),
      };
    });
  }

  /**
   * Each student's course and batch for the card ("React Bootcamp · Batch
   * A"): their enrollment in the bootcamp the mentor mentors for (the
   * mentor's profile in this org), else their latest active enrollment.
   */
  private async studentCourses(
    studentIds: string[],
    mentorIds: string[],
    organizationId: number,
  ) {
    const result = new Map<
      string,
      { bootcampName: string | null; batchName: string | null }
    >();
    if (!studentIds.length) return result;
    const mentorBootcamps = mentorIds.length
      ? (
          await db
            .select({ bootcampId: zuvyMentorSlotManagement.bootcampId })
            .from(zuvyMentorSlotManagement)
            .where(
              and(
                inArray(
                  zuvyMentorSlotManagement.mentorUserId,
                  mentorIds.map((id) => BigInt(id)),
                ),
                eq(zuvyMentorSlotManagement.organizationId, organizationId),
              ),
            )
        )
          .map((row) => row.bootcampId)
          .filter((id): id is number => id != null)
      : [];
    const enrollments = await db
      .select({
        userId: zuvyBatchEnrollments.userId,
        bootcampId: zuvyBatchEnrollments.bootcampId,
        bootcampName: zuvyBootcamps.name,
        batchName: zuvyBatches.name,
        enrollmentId: zuvyBatchEnrollments.id,
      })
      .from(zuvyBatchEnrollments)
      .leftJoin(
        zuvyBootcamps,
        eq(zuvyBootcamps.id, zuvyBatchEnrollments.bootcampId),
      )
      .leftJoin(zuvyBatches, eq(zuvyBatches.id, zuvyBatchEnrollments.batchId))
      .where(
        and(
          inArray(
            zuvyBatchEnrollments.userId,
            studentIds.map((id) => BigInt(id)),
          ),
          eq(zuvyBatchEnrollments.status, 'active'),
          // Only this organization's courses: a mentor in another org must
          // not see the student's courses elsewhere.
          eq(zuvyBootcamps.organizationId, organizationId),
        ),
      )
      .orderBy(desc(zuvyBatchEnrollments.id));
    for (const id of studentIds) {
      const mine = enrollments.filter((e) => String(e.userId) === id);
      const pick =
        mine.find(
          (e) => e.bootcampId != null && mentorBootcamps.includes(e.bootcampId),
        ) ?? mine[0];
      if (pick) {
        result.set(id, {
          bootcampName: pick.bootcampName ?? null,
          batchName: pick.batchName ?? null,
        });
      }
    }
    return result;
  }

  async getStudentFeedback(bookingId: number, userId: bigint) {
    const [booking] = await db
      .select({
        mentorName: users.name,
        mentorFeedback: zuvyMentorSlotBooking.mentorFeedback,
        mentorRating: zuvyMentorSlotBooking.mentorRating,
        mentorFeedbackSubmittedAt:
          zuvyMentorSlotBooking.mentorFeedbackSubmittedAt,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
        studentUserId: zuvyMentorSlotBooking.studentUserId,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.mentorUserId))
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.studentUserId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this feedback.',
      );
    }

    return {
      bookingId,
      mentorName: booking.mentorName,
      mentorFeedback: booking.mentorFeedback,
      mentorRating: booking.mentorRating,
      mentorFeedbackSubmittedAt: booking.mentorFeedbackSubmittedAt,
      sessionStart: booking.slotStart,
      sessionEnd: booking.slotEnd,
    };
  }

  async getMentorFeedback(bookingId: number, userId: bigint) {
    const [booking] = await db
      .select({
        studentName: users.name,
        studentFeedback: zuvyMentorSlotBooking.studentFeedback,
        studentRating: zuvyMentorSlotBooking.studentRating,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
        mentorUserId: zuvyMentorSlotBooking.mentorUserId,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.studentUserId))
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    if (booking.mentorUserId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to access this feedback.',
      );
    }

    return {
      bookingId,
      studentName: booking.studentName,
      studentFeedback: booking.studentFeedback,
      studentRating: booking.studentRating,
      sessionStart: booking.slotStart,
      sessionEnd: booking.slotEnd,
    };
  }

  /* ==========================================================================
     SESSION DETAIL WITH ACCESS CONTROL
  ========================================================================== */

  async getSessionDetail(sessionId: number, userId: bigint) {
    const [session] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, sessionId))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    if (session.studentUserId !== userId && session.mentorUserId !== userId) {
      throw new ForbiddenException(
        'You are not allowed to access this session',
      );
    }

    // Shared by the student and mentor routes: only the mentor (the host)
    // may receive the host-only Zoom fields.
    const isMentor = session.mentorUserId === userId;

    const detail = {
      ...(isMentor ? session : withoutHostZoomFields(session)),
      meetingLink: this.mapMeetingLink(session, userId),
    };
    if (isMentor) {
      // The mentor's view adds the same card fields as their Sessions list.
      const config = await this.mentorshipConfig.get();
      const now = new Date();
      const rows = await this.mentorSessionRows(
        eq(zuvyMentorSlotBooking.id, sessionId),
      );
      const [card] = await this.mentorCards(
        rows,
        session.organizationId,
        config,
        now,
      );
      const { booking: _b, ...cardFields } = card ?? ({} as any);
      void _b;
      return { ...detail, ...cardFields, serverTime: now };
    }

    // The student's view adds the same card fields as My Sessions.
    const config = await this.mentorshipConfig.get();
    const now = new Date();
    const rows = await this.studentSessionRows(
      eq(zuvyMentorSlotBooking.id, sessionId),
    );
    const credits = await this.creditService.getState(userId, config, db, now);
    const [card] = await this.studentCards(rows, config, now, credits);
    const { booking: _booking, ...cardFields } = card ?? ({} as any);
    void _booking;
    return { ...detail, ...cardFields, serverTime: now };
  }
}
