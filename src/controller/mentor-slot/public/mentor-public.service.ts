import { Injectable } from '@nestjs/common';
import { db } from '../../../db';
import {
  zuvyMentorSlotManagement,
  zuvyMentorSlotAvailability,
} from '../../../../drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class MentorPublicService {
  async getAllMentors() {
    return db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.status, 'active'));
  }

  async getMentorProfile(mentorId: number) {
    return db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.id, mentorId))
      .limit(1);
  }

  async getAvailableSlots(mentorId: number) {
    return db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          eq(zuvyMentorSlotAvailability.mentorSlotManagementId, mentorId),
          eq(zuvyMentorSlotAvailability.status, 'available'),
          eq(zuvyMentorSlotAvailability.isPublic, true),
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()`,
          sql`${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}`,
        ),
      );
  }
}
