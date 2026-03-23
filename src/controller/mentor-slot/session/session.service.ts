import {
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../../../db';
import { users, zuvyMentorSlotBooking } from '../../../../drizzle/schema';

import { eq } from 'drizzle-orm';

@Injectable()
export class SessionService {
  /* ==========================================================================
     STUDENT SESSIONS
  ========================================================================== */

  async getStudentSessions(userId: bigint) {
    return db
      .select({
        booking: zuvyMentorSlotBooking,
        mentorName: users.name,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.mentorUserId))
      .where(eq(zuvyMentorSlotBooking.studentUserId, userId));
  }

  /* ==========================================================================
     MENTOR SESSIONS
  ========================================================================== */

  async getMentorSessions(userId: bigint) {
    return db
      .select({
        booking: zuvyMentorSlotBooking,
        studentName: users.name,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(users, eq(users.id, zuvyMentorSlotBooking.studentUserId))
      .where(eq(zuvyMentorSlotBooking.mentorUserId, userId));
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
