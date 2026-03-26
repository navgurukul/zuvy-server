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

import { and, eq, desc } from 'drizzle-orm';
import { sl } from 'zod/v4/locales';

@Injectable()
export class SessionService {
  /* ==========================================================================
     STUDENT SESSIONS
  ========================================================================== */

  async getStudentSessions(
    userId: bigint,
    filter = 'all',
    limit = 10,
    offset = 0,
  ) {
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

    return data;
  }

  /* ==========================================================================
     MENTOR SESSIONS
  ========================================================================== */

  async getMentorSessions(
    userId: bigint,
    filter = 'all',
    limit = 10,
    offset = 0,
  ) {
    const conditions = [eq(zuvyMentorSlotBooking.mentorUserId, userId)];

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
      .orderBy(desc(zuvyMentorSlotBooking.bookedAt))
      .limit(limit)
      .offset(offset);

    return data;
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
