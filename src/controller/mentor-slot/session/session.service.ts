import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../../../db';
import {
  users,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
} from '../../../../drizzle/schema';

import { and, eq, desc, sql } from 'drizzle-orm';

@Injectable()
export class SessionService {
  /* ==========================================================================
     BACKGROUND JOB TO AUTO-CLOSE EXPIRED SESSIONS
  ========================================================================== */
  async autoCloseExpiredSessions() {
    await db
      .update(zuvyMentorSlotBooking)
      .set({ sessionLifecycleState: 'COMPLETED' } as Partial<
        typeof zuvyMentorSlotBooking.$inferInsert
      >)
      .where(
        sql`${zuvyMentorSlotBooking.slotAvailabilityId} IN (
      SELECT ${zuvyMentorSlotAvailability.id}
      FROM ${zuvyMentorSlotAvailability}
      WHERE ${zuvyMentorSlotAvailability.slotEndDateTime} < NOW()
    )
    AND ${zuvyMentorSlotBooking.sessionLifecycleState} = 'SCHEDULED'`,
      );
  }

  private mapMeetingLink(booking: any, userId: bigint) {
    if (booking.mentorUserId === userId) {
      return booking.zoomStartUrl; // mentor
    }
    return booking.meetingLink; // student
  }

  /* ==========================================================================
     STUDENT SESSIONS
  ========================================================================== */

  async getStudentSessions(
    userId: bigint,
    filter = 'all',
    limit = 10,
    offset = 0,
    sort: 'asc' | 'desc' = 'desc',
  ) {
    await this.autoCloseExpiredSessions(); // Ensure expired sessions are closed before fetching

    const conditions = [eq(zuvyMentorSlotBooking.studentUserId, userId)];

    if (filter === 'upcoming') {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
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

    const data = await db
      .select({
        booking: zuvyMentorSlotBooking,
        mentorName: users.name,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
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

      .where(and(...conditions))
      .orderBy(desc(zuvyMentorSlotBooking.bookedAt))
      .limit(limit)
      .offset(offset);

    const [counts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        upcoming: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'SCHEDULED')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'COMPLETED')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
      })
      .from(zuvyMentorSlotBooking)
      .where(and(eq(zuvyMentorSlotBooking.studentUserId, userId)));

    const mappedData = data.map((item) => ({
      ...item,
      booking: {
        ...item.booking,
        meetingLink: item.booking.meetingLink,
      },
    }));

    return { data: mappedData, counts };
  }

  /* ==========================================================================
     MENTOR SESSIONS
  ========================================================================== */

  async getMentorSessions(
    userId: bigint,
    organizationId: number,
    filter = 'all',
    limit = 10,
    offset = 0,
    sort: 'asc' | 'desc' = 'desc',
  ) {
    await this.autoCloseExpiredSessions(); // Ensure expired sessions are closed before fetching

    const conditions = [
      eq(zuvyMentorSlotBooking.mentorUserId, userId),
      eq(zuvyMentorSlotBooking.organizationId, organizationId),
    ];

    if (filter === 'upcoming') {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
      );
    }

    if (filter === 'completed') {
      conditions.push(
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'COMPLETED'),
      );
    }

    if (filter === 'reschedule') {
      conditions.push(eq(zuvyMentorSlotBooking.rescheduleStatus, 'pending'));
    }

    if (filter === 'cancelled') {
      conditions.push(eq(zuvyMentorSlotBooking.status, 'cancelled'));
    }

    const data = await db
      .select({
        booking: zuvyMentorSlotBooking,
        studentName: users.name,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
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

      .where(and(...conditions))
      .orderBy(
        sort === 'asc'
          ? zuvyMentorSlotBooking.bookedAt
          : desc(zuvyMentorSlotBooking.bookedAt),
      )
      .limit(limit)
      .offset(offset);

    const [counts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        upcoming: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'SCHEDULED')`,
        completed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'COMPLETED')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE status = 'cancelled')`,
        reschedule: sql<number>`COUNT(*) FILTER (WHERE reschedule_status = 'pending')`,
      })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.mentorUserId, userId),
          eq(zuvyMentorSlotBooking.organizationId, organizationId),
        ),
      );

    const mappedData = data.map((item) => ({
      ...item,
      booking: {
        ...item.booking,
        meetingLink: item.booking.zoomStartUrl,
      },
    }));

    return { data: mappedData, counts };
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

    return {
      ...session,
      meetingLink: this.mapMeetingLink(session, userId),
    };
  }
}
