import { Injectable } from '@nestjs/common';
import { db } from '../../../db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
} from '../../../../drizzle/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class SessionService {
  async getStudentSessions(userId: number) {
    return db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, BigInt(userId)));
  }

  async getMentorSessions(userId: number) {
    return db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.mentorUserId, BigInt(userId)));
  }

  async getSessionDetail(sessionId: number) {
    return db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, sessionId))
      .limit(1);
  }
}
