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
    await db.execute(sql`
    UPDATE zuvy_mentor_slot_booking b
    SET session_lifecycle_state = 'COMPLETED'
    FROM zuvy_mentor_slot_availability s
    WHERE b.slot_availability_id = s.id
      AND b.session_lifecycle_state = 'SCHEDULED'
      AND s.slot_end_date_time < NOW()
  `);
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

    return { data, counts };
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
        reschedule: sql<number>`COUNT(*) FILTER (WHERE reschedule_status = 'pending')`,
      })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.mentorUserId, userId),
          eq(zuvyMentorSlotBooking.organizationId, organizationId),
        ),
      );

    return { data, counts };
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

    return session;
  }
}
