import { Injectable } from '@nestjs/common';
import { db } from '../../../db';

import {
  users,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  zuvyMentorProfile,
  zuvyMentorSlotManagement,
  zuvyMentorSlotAvailability,
  zuvyOrganizations,
} from '../../../../drizzle/schema';

import { and, eq, inArray, sql } from 'drizzle-orm';

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
    organizationId?: number,
  ) {
    limit = Number(limit);
    offset = Number(offset);

    const filters = [];

    // Always filter for instructors only
    filters.push(eq(zuvyUserRoles.name, 'instructor'));

    if (organizationId !== undefined) {
      filters.push(eq(zuvyMentorSlotManagement.organizationId, organizationId));
    }

    if (expertise && expertise !== 'all') {
      filters.push(
        sql`CAST(${zuvyMentorProfile.expertise} AS TEXT) ILIKE ${'%' + expertise + '%'}`,
      );
    }

    if (title && title !== 'all') {
      filters.push(sql`${zuvyMentorProfile.title} ILIKE ${'%' + title + '%'}`);
    }

    if (search) {
      filters.push(
        sql`(
        ${users.name} ILIKE ${'%' + search + '%'}
        OR ${users.email} ILIKE ${'%' + search + '%'}
        OR ${zuvyMentorProfile.title} ILIKE ${'%' + search + '%'}
        OR CAST(${zuvyMentorProfile.expertise} AS TEXT) ILIKE ${'%' + search + '%'}
      )`,
      );
    }

    const mentors = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: zuvyUserRoles.name,
        organizationId: zuvyMentorSlotManagement.organizationId,
        orgName: zuvyOrganizations.displayName,
        bio: zuvyMentorProfile.bio,
        expertise: zuvyMentorProfile.expertise,
        title: zuvyMentorProfile.title,

        availableSlots: sql<number>`
          COUNT(DISTINCT ${zuvyMentorSlotAvailability.id}) FILTER (
          WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()
          AND ${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}
          )
        `,

        fullSlots: sql<number>`
          COUNT(DISTINCT ${zuvyMentorSlotAvailability.id}) FILTER (
          WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()
          AND ${zuvyMentorSlotAvailability.currentBookedCount} >= ${zuvyMentorSlotAvailability.maxCapacity}
          )
      `,

        completedSlots: sql<number>`
        COUNT(DISTINCT ${zuvyMentorSlotAvailability.id}) FILTER (
        WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} <= NOW()
        AND ${zuvyMentorSlotAvailability.currentBookedCount} > 0
          )
      `,
      })
      .from(users)

      // mentor profile
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(zuvyMentorSlotManagement.mentorUserId, users.id),
      )
      .innerJoin(
        zuvyMentorProfile,
        eq(zuvyMentorProfile.mentorUserId, users.id),
      )

      .innerJoin(
        zuvyOrganizations,
        eq(zuvyOrganizations.id, zuvyMentorSlotManagement.organizationId),
      )

      // slots
      .leftJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.mentorSlotManagementId,
          zuvyMentorSlotManagement.id,
        ),
      )

      // roles
      .leftJoin(
        zuvyUserRolesAssigned,
        and(
          eq(zuvyUserRolesAssigned.userId, users.id),
          eq(
            zuvyUserRolesAssigned.organizationId,
            zuvyMentorSlotManagement.organizationId,
          ),
        ),
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
        zuvyMentorSlotManagement.organizationId,
        zuvyOrganizations.displayName,
        zuvyMentorProfile.bio,
        zuvyMentorProfile.expertise,
        zuvyMentorProfile.title,
      )

      .limit(limit)
      .offset(offset);

    /*
    ==========================================
    DETERMINE AVAILABILITY STATUS
    ==========================================
    */

    const mentorsWithStatus = mentors.map((m) => {
      let availabilityStatus = 'Unavailable';

      if (Number(m.availableSlots) > 0) {
        availabilityStatus = 'Available';
      } else if (Number(m.fullSlots) > 0) {
        availabilityStatus = 'Slots Full';
      }

      return {
        ...m,
        availabilityStatus,
      };
    });

    /*
    ==========================================
    TOTAL COUNT
    ==========================================
    */

    const totalCount = await db
      .select({
        count: sql<number>`count(distinct ${zuvyMentorSlotManagement.id})`,
      })
      .from(users)
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(zuvyMentorSlotManagement.mentorUserId, users.id),
      )
      .innerJoin(
        zuvyMentorProfile,
        eq(zuvyMentorProfile.mentorUserId, users.id),
      )
      .innerJoin(
        zuvyOrganizations,
        eq(zuvyOrganizations.id, zuvyMentorSlotManagement.organizationId),
      )
      .leftJoin(
        zuvyUserRolesAssigned,
        and(
          eq(zuvyUserRolesAssigned.userId, users.id),
          eq(
            zuvyUserRolesAssigned.organizationId,
            zuvyMentorSlotManagement.organizationId,
          ),
        ),
      )
      .leftJoin(
        zuvyUserRoles,
        eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
      )
      .where(filters.length ? and(...filters) : undefined);

    const total = Number(totalCount[0].count);

    return {
      limit,
      offset,
      total,
      hasMore: offset + limit < total,
      data: mentorsWithStatus,
    };
  }

  /* =========================================================
     GET MENTOR PROFILE
  ========================================================= */

  async getMentorProfile(mentorUserId: number, organizationId?: number) {
    const filters = [eq(users.id, BigInt(mentorUserId))];

    if (organizationId !== undefined) {
      filters.push(eq(zuvyMentorSlotManagement.organizationId, organizationId));
    }

    const result = await db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: zuvyUserRoles.name,
        orgName: zuvyOrganizations.displayName,

        mentorProfileId: zuvyMentorSlotManagement.id,
        organizationId: zuvyMentorSlotManagement.organizationId,
        mentorType: zuvyMentorSlotManagement.mentorType,
        timezone: zuvyMentorSlotManagement.timezone,

        bio: zuvyMentorProfile.bio,
        expertise: zuvyMentorProfile.expertise,
        title: zuvyMentorProfile.title,
        pastExperiences: zuvyMentorProfile.pastExperiences,

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
      .innerJoin(
        zuvyMentorProfile,
        eq(zuvyMentorProfile.mentorUserId, users.id),
      )
      .innerJoin(
        zuvyOrganizations,
        eq(zuvyOrganizations.id, zuvyMentorSlotManagement.organizationId),
      )

      .leftJoin(
        zuvyUserRolesAssigned,
        eq(zuvyUserRolesAssigned.userId, users.id),
      )

      .leftJoin(
        zuvyUserRoles,
        eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
      )

      .where(and(...filters))
      .limit(1);

    return result[0] ?? null;
  }

  /* =========================================================
     GET AVAILABLE SLOTS
  ========================================================= */

  async getAvailableSlots(userId: number, organizationId?: number) {
    const filters = [eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId))];

    if (organizationId !== undefined) {
      filters.push(eq(zuvyMentorSlotManagement.organizationId, organizationId));
    }

    const profiles = await db
      .select({
        id: zuvyMentorSlotManagement.id,
        organizationId: zuvyMentorSlotManagement.organizationId,
        orgName: zuvyOrganizations.displayName,
      })
      .from(zuvyMentorSlotManagement)
      .innerJoin(
        zuvyOrganizations,
        eq(zuvyOrganizations.id, zuvyMentorSlotManagement.organizationId),
      )
      .where(and(...filters))
      .limit(50);

    if (!profiles.length) {
      return [];
    }

    const profileIds = profiles.map((profile) => profile.id);
    const orgMetaByProfileId = new Map(
      profiles.map((profile) => [
        profile.id,
        {
          organizationId: profile.organizationId,
          orgName: profile.orgName,
        },
      ]),
    );

    const slots = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          inArray(
            zuvyMentorSlotAvailability.mentorSlotManagementId,
            profileIds,
          ),
          eq(zuvyMentorSlotAvailability.status, 'available'),
          eq(zuvyMentorSlotAvailability.isPublic, true),
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()`,
          sql`${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}`,
        ),
      );

    return slots.map((slot) => ({
      ...slot,
      ...orgMetaByProfileId.get(slot.mentorSlotManagementId),
    }));
  }
}
