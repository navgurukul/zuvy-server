import { Injectable } from '@nestjs/common';
import { db } from '../../../db';

import {
  users,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  zuvyMentorSlotManagement,
  zuvyMentorSlotAvailability,
} from '../../../../drizzle/schema';

import { and, eq, sql } from 'drizzle-orm';

@Injectable()
export class MentorPublicService {
  /* =========================================================
     GET ALL MENTORS (RBAC BASED)
  ========================================================= */

  async getAllMentors() {
    return db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: zuvyUserRoles.name,
        bio: zuvyMentorSlotManagement.bio,
        expertise: zuvyMentorSlotManagement.expertise,
        title: zuvyMentorSlotManagement.title,
      })
      .from(zuvyUserRolesAssigned)
      .innerJoin(users, eq(users.id, zuvyUserRolesAssigned.userId))
      .innerJoin(
        zuvyUserRoles,
        eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
      )
      .leftJoin(
        zuvyMentorSlotManagement,
        eq(zuvyMentorSlotManagement.mentorUserId, zuvyUserRolesAssigned.userId),
      );
  }

  /* =========================================================
     GET MENTOR PROFILE
  ========================================================= */

  async getMentorProfile(mentorUserId: number) {
    return db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, BigInt(mentorUserId)))
      .limit(1);
  }

  /* =========================================================
     GET AVAILABLE SLOTS
  ========================================================= */

  async getAvailableSlots(userId: number) {
    const [profile] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId)))
      .limit(1);

    if (!profile) {
      return [];
    }

    return db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          eq(zuvyMentorSlotAvailability.mentorSlotManagementId, profile.id),
          eq(zuvyMentorSlotAvailability.status, 'available'),
          eq(zuvyMentorSlotAvailability.isPublic, true),
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()`,
          sql`${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}`,
        ),
      );
  }
}
