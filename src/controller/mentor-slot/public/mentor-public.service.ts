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
  zuvyMentorSkills,
  zuvySkills,
} from '../../../../drizzle/schema';

import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { MentorshipConfigService } from '../mentorship-rules/mentorship-config.service';
import { earliestBookableStart } from '../mentorship-rules/mentorship-rules';
import { MentorSkillsService } from '../skills/mentor-skills.service';
import { splitSkillList } from '../skills/skill-key';

/** An ILIKE pattern that matches `text` anywhere, with % and _ taken literally. */
function likePattern(text: string) {
  return `%${String(text).replace(/[\\%_]/g, '\\$&')}%`;
}

@Injectable()
export class MentorPublicService {
  constructor(
    private readonly mentorshipConfig: MentorshipConfigService = new MentorshipConfigService(),
    private readonly mentorSkills: MentorSkillsService = new MentorSkillsService(),
  ) {}

  /** Slots starting before this can't be booked (notice_hours, server clock). */
  private async earliestBookableStart() {
    return earliestBookableStart(new Date(), await this.mentorshipConfig.get());
  }

  /* =========================================================
     GET ALL MENTORS (RBAC BASED)
  ========================================================= */

  /**
   * The mentors students can browse: one row per mentor (a mentor in two
   * orgs appears once), mentors with open slots first.
   *
   * - `expertise`: skills, comma separated ("react,node-js"), any spelling
   *   the skill list knows. Returns mentors with ANY of them. If none of
   *   them is a known skill, the list is empty (not an error).
   * - `search`: name, email, title, or a skill's name.
   * - `available`: true = only mentors with a slot students can book now.
   * Paging (limit/offset) applies after every filter.
   */
  async getAllMentors(
    limit = 10,
    offset = 0,
    role?: string,
    expertise?: string,
    title?: string,
    search?: string,
    organizationId?: number,
    available?: boolean,
  ) {
    limit = Number(limit);
    offset = Number(offset);
    void role; // Only instructors are mentors; kept for the old signature.

    const requested =
      expertise && expertise !== 'all' ? splitSkillList(expertise) : [];
    const { skills, unknown } = requested.length
      ? await this.mentorSkills.resolve(requested)
      : { skills: [], unknown: [] };
    const filterInfo = {
      skills,
      unknownSkills: unknown,
      search: search || null,
      available: available === true,
    };

    // Skills were asked for but none is on the list: nobody matches.
    if (requested.length && !skills.length) {
      return {
        limit,
        offset,
        total: 0,
        totalAvailable: 0,
        hasMore: false,
        data: [],
        filter: filterInfo,
      };
    }

    const query = {
      organizationId,
      title,
      search,
      available,
      skillIds: skills.map((s) => s.id),
    };
    const bookableFrom = await this.earliestBookableStart();
    const page = await this.mentorRows(query, bookableFrom, { limit, offset });
    const all = await this.mentorRows(query, bookableFrom);
    const total = all.length;
    const totalAvailable = all.filter(
      (m) => Number(m.availableSlots) > 0,
    ).length;

    const skillsByMentor = await this.mentorSkills.skillsForMentors(
      page.map((m) => m.userId),
    );

    const data = page.map((m) => {
      let availabilityStatus = 'Unavailable';
      if (Number(m.availableSlots) > 0) availabilityStatus = 'Available';
      else if (Number(m.fullSlots) > 0) availabilityStatus = 'Slots Full';
      return {
        ...m,
        availableSlots: Number(m.availableSlots),
        fullSlots: Number(m.fullSlots),
        completedSlots: Number(m.completedSlots),
        organizationId: Number(m.organizationId),
        skills: skillsByMentor.get(String(m.userId)) ?? [],
        availabilityStatus,
      };
    });

    return {
      limit,
      offset,
      total,
      totalAvailable,
      hasMore: offset + limit < total,
      data,
      filter: filterInfo,
    };
  }

  /**
   * The skill chips: every active skill, with how many mentors have it among
   * those matching the same search, org and `available` filter (so the
   * numbers follow what the student has typed). Mentors without the skill
   * list yet count for nothing.
   */
  async getSkillChips(
    search?: string,
    organizationId?: number,
    available?: boolean,
    // Only skills at least one matching mentor has (the filter dropdown).
    inUse = false,
  ) {
    const bookableFrom = await this.earliestBookableStart();
    const mentors = await this.mentorRows(
      { organizationId, search, available, skillIds: [] },
      bookableFrom,
    );
    const skills = await this.mentorSkills.activeSkills();
    const counts = new Map<number, number>();
    if (mentors.length) {
      const rows = await db
        .select({
          skillId: zuvyMentorSkills.skillId,
          mentors: sql<number>`count(distinct ${zuvyMentorSkills.mentorUserId})::int`,
        })
        .from(zuvyMentorSkills)
        .where(
          inArray(
            zuvyMentorSkills.mentorUserId,
            mentors.map((m) => BigInt(m.userId)),
          ),
        )
        .groupBy(zuvyMentorSkills.skillId);
      rows.forEach((r) => counts.set(r.skillId, Number(r.mentors)));
    }
    const withCounts = skills.map((skill) => ({
      ...skill,
      mentorCount: counts.get(skill.id) ?? 0,
    }));
    return {
      skills: inUse
        ? withCounts.filter((skill) => skill.mentorCount > 0)
        : withCounts,
      totalMentors: mentors.length,
    };
  }

  /**
   * One row per mentor matching the filters, mentors with open slots first.
   * `page` limits it; without it, every match (for totals and chip counts).
   */
  private async mentorRows(
    filter: {
      organizationId?: number;
      title?: string;
      search?: string;
      available?: boolean;
      skillIds: number[];
    },
    bookableFrom: Date,
    page?: { limit: number; offset: number },
  ) {
    const conditions = [eq(zuvyUserRoles.name, 'instructor')];

    if (filter.organizationId !== undefined) {
      conditions.push(
        eq(zuvyMentorSlotManagement.organizationId, filter.organizationId),
      );
    }

    if (filter.title && filter.title !== 'all') {
      conditions.push(
        sql`${zuvyMentorProfile.title} ILIKE ${likePattern(filter.title)}`,
      );
    }

    if (filter.search) {
      const pattern = likePattern(filter.search);
      conditions.push(
        sql`(
          ${users.name} ILIKE ${pattern}
          OR ${users.email} ILIKE ${pattern}
          OR ${zuvyMentorProfile.title} ILIKE ${pattern}
          OR CAST(${zuvyMentorProfile.expertise} AS TEXT) ILIKE ${pattern}
          OR EXISTS (
            SELECT 1 FROM ${zuvyMentorSkills}
            JOIN ${zuvySkills} ON ${zuvySkills.id} = ${zuvyMentorSkills.skillId}
            WHERE ${zuvyMentorSkills.mentorUserId} = ${users.id}
              AND ${zuvySkills.isActive}
              AND ${zuvySkills.name} ILIKE ${pattern}
          )
        )`,
      );
    }

    if (filter.skillIds.length) {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM ${zuvyMentorSkills}
          WHERE ${zuvyMentorSkills.mentorUserId} = ${users.id}
            AND ${inArray(zuvyMentorSkills.skillId, filter.skillIds)}
        )`,
      );
    }

    // Open slots a student can book now: at least notice_hours away, so the
    // count matches what the availability list shows. Also the sort key, so
    // mentors with open slots come first on page 1.
    const availableSlotsExpr = sql<number>`
      COUNT(DISTINCT ${zuvyMentorSlotAvailability.id}) FILTER (
        WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} >= ${bookableFrom.toISOString()}::timestamptz
        AND ${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}
      )`;

    let query = db
      .select({
        userId: users.id,
        name: users.name,
        email: users.email,
        role: sql<string>`max(${zuvyUserRoles.name})`,
        // A mentor in several orgs: the first org here (as before, one org
        // per row), all of them in `organizations`.
        organizationId: sql<number>`min(${zuvyMentorSlotManagement.organizationId})`,
        orgName: sql<string>`(array_agg(${zuvyOrganizations.displayName} ORDER BY ${zuvyMentorSlotManagement.organizationId}))[1]`,
        organizations: sql<
          Array<{ organizationId: number; orgName: string }>
        >`json_agg(DISTINCT jsonb_build_object('organizationId', ${zuvyMentorSlotManagement.organizationId}, 'orgName', ${zuvyOrganizations.displayName}))`,
        bio: zuvyMentorProfile.bio,
        expertise: zuvyMentorProfile.expertise,
        title: zuvyMentorProfile.title,
        availableSlots: availableSlotsExpr,
        fullSlots: sql<number>`
          COUNT(DISTINCT ${zuvyMentorSlotAvailability.id}) FILTER (
            WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()
            AND ${zuvyMentorSlotAvailability.currentBookedCount} >= ${zuvyMentorSlotAvailability.maxCapacity}
          )`,
        completedSlots: sql<number>`
          COUNT(DISTINCT ${zuvyMentorSlotAvailability.id}) FILTER (
            WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} <= NOW()
            AND ${zuvyMentorSlotAvailability.currentBookedCount} > 0
          )`,
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
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.mentorSlotManagementId,
          zuvyMentorSlotManagement.id,
        ),
      )
      // Instructor in that org (the role is per org).
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
      .where(and(...conditions))
      // One row per mentor (the profile is one per mentor).
      .groupBy(users.id, zuvyMentorProfile.id)
      .$dynamic();

    if (filter.available) {
      query = query.having(sql`${availableSlotsExpr} > 0`);
    }
    query = query.orderBy(
      desc(availableSlotsExpr),
      asc(users.name),
      asc(users.id),
    );
    if (page) query = query.limit(page.limit).offset(page.offset);
    return query;
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

    if (!result[0]) return null;
    const skills = await this.mentorSkills.skillsForMentors([result[0].userId]);
    return { ...result[0], skills: skills.get(String(result[0].userId)) ?? [] };
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
          // Only slots a student can book now: at least notice_hours away.
          gte(
            zuvyMentorSlotAvailability.slotStartDateTime,
            await this.earliestBookableStart(),
          ),
          sql`${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}`,
        ),
      );

    return slots.map((slot) => ({
      ...slot,
      ...orgMetaByProfileId.get(slot.mentorSlotManagementId),
    }));
  }
}
