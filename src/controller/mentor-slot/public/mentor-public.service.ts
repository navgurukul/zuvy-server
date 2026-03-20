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

  async getAllMentors(
    limit = 10,
    offset = 0,
    role?: string,
    expertise?: string,
    title?: string,
    search?: string,
  ) {
    const filters = [];

    if (role && role !== 'all') {
      filters.push(eq(zuvyUserRoles.name, role));
    }

    if (expertise && expertise !== 'all') {
      filters.push(
        sql`CAST(${zuvyMentorSlotManagement.expertise} AS TEXT) ILIKE ${'%' + expertise + '%'}`,
      );
    }

    if (title && title !== 'all') {
      filters.push(
        sql`${zuvyMentorSlotManagement.title} ILIKE ${'%' + title + '%'}`,
      );
    }

    if (search) {
      filters.push(
        sql`(
        ${users.name} ILIKE ${'%' + search + '%'}
        OR ${users.email} ILIKE ${'%' + search + '%'}
        OR ${zuvyMentorSlotManagement.title} ILIKE ${'%' + search + '%'}
        OR CAST(${zuvyMentorSlotManagement.expertise} AS TEXT) ILIKE ${'%' + search + '%'}
      )`,
      );
    }

    const mentors = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: zuvyUserRoles.name,
        bio: zuvyMentorSlotManagement.bio,
        expertise: zuvyMentorSlotManagement.expertise,
        title: zuvyMentorSlotManagement.title,
      })
      .from(users)

      // Only mentors with mentor profile
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(zuvyMentorSlotManagement.mentorUserId, users.id),
      )

      // Roles
      .leftJoin(
        zuvyUserRolesAssigned,
        eq(zuvyUserRolesAssigned.userId, users.id),
      )

      .leftJoin(
        zuvyUserRoles,
        eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
      )

      .where(filters.length ? and(...filters) : undefined)

      .groupBy(
        users.id,
        users.name,
        users.email,
        zuvyUserRoles.name,
        zuvyMentorSlotManagement.bio,
        zuvyMentorSlotManagement.expertise,
        zuvyMentorSlotManagement.title,
      )

      .limit(limit)
      .offset(offset);

    const totalCount = await db
      .select({
        count: sql<number>`count(distinct ${users.id})`,
      })
      .from(users)
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(zuvyMentorSlotManagement.mentorUserId, users.id),
      );

    const total = Number(totalCount[0].count);

    return {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
      data: mentors,
    };
  }

  /* =========================================================
     GET MENTOR PROFILE
  ========================================================= */

  async getMentorProfile(mentorUserId: number) {
    const result = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: zuvyUserRoles.name,

        mentorProfileId: zuvyMentorSlotManagement.id,
        organizationId: zuvyMentorSlotManagement.organizationId,
        mentorType: zuvyMentorSlotManagement.mentorType,
        timezone: zuvyMentorSlotManagement.timezone,

        bio: zuvyMentorSlotManagement.bio,
        expertise: zuvyMentorSlotManagement.expertise,
        title: zuvyMentorSlotManagement.title,

        status: zuvyMentorSlotManagement.status,
        isVerified: zuvyMentorSlotManagement.isVerified,
        acceptsNewMentees: zuvyMentorSlotManagement.acceptsNewMentees,

        createdAt: zuvyMentorSlotManagement.createdAt,
        updatedAt: zuvyMentorSlotManagement.updatedAt,
      })
      .from(users)

      .innerJoin(
        zuvyMentorSlotManagement,
        eq(zuvyMentorSlotManagement.mentorUserId, users.id),
      )

      .leftJoin(
        zuvyUserRolesAssigned,
        eq(zuvyUserRolesAssigned.userId, users.id),
      )

      .leftJoin(
        zuvyUserRoles,
        eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
      )

      .where(eq(users.id, BigInt(mentorUserId)))
      .limit(1);

    return result[0] ?? null;
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
