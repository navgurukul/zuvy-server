import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, gte, lte, ne, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '../../../db';
import {
  users,
  zuvyBootcamps,
  zuvyBootcampType,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
} from '../../../../drizzle/schema';

/** A session shows from this many minutes before it starts... */
export const LIVE_WINDOW_BEFORE_START_MIN = 10;
/** ...until this many minutes after it ends. */
export const LIVE_WINDOW_AFTER_END_MIN = 15;
/** A missing mentor or student counts as "needs attention" this many minutes after start. */
export const ATTENTION_AFTER_START_MIN = 5;

const MINUTE = 60 * 1000;

export type LivePhase = 'starting_soon' | 'in_progress' | 'ended';

export interface RequestUser {
  id: number | string;
  roles?: string[];
  orgId?: number | string | null;
}

@Injectable()
export class AdminMentorSessionService {
  /**
   * Live mentor sessions for an organisation (optionally one course), plus how
   * many of them need attention because the mentor or student hasn't joined
   * 5+ minutes after start. A session counts once even if both are missing.
   */
  async getLiveSessions(
    user: RequestUser,
    orgId: number,
    bootcampId?: number,
    summaryOnly = false,
  ) {
    this.assertCanViewOrg(user, orgId);
    if (bootcampId) {
      await this.assertCourseHasMentorship(orgId, bootcampId);
    }

    const now = new Date();
    const windowStartsBy = new Date(
      now.getTime() + LIVE_WINDOW_BEFORE_START_MIN * MINUTE,
    );
    const windowEndsAfter = new Date(
      now.getTime() - LIVE_WINDOW_AFTER_END_MIN * MINUTE,
    );

    const mentorUser = alias(users, 'mentor_user');
    const studentUser = alias(users, 'student_user');

    // Older bookings have no bootcamp_id; use the mentor profile's course.
    const courseId = sql<
      number | null
    >`COALESCE(${zuvyMentorSlotBooking.bootcampId}, ${zuvyMentorSlotManagement.bootcampId})`;

    const conditions = [
      eq(zuvyMentorSlotBooking.organizationId, orgId),
      ne(zuvyMentorSlotBooking.status, 'cancelled'),
      ne(zuvyMentorSlotBooking.sessionLifecycleState, 'CANCELLED'),
      // start - 10 min <= now  <=>  start <= now + 10 min
      lte(zuvyMentorSlotAvailability.slotStartDateTime, windowStartsBy),
      // now <= end + 15 min  <=>  end >= now - 15 min
      gte(zuvyMentorSlotAvailability.slotEndDateTime, windowEndsAfter),
    ];
    if (bootcampId) {
      conditions.push(sql`${courseId} = ${bootcampId}`);
    }

    const rows = await db
      .select({
        bookingId: zuvyMentorSlotBooking.id,
        bootcampId: courseId,
        bootcampName: zuvyBootcamps.name,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
        topic: zuvyMentorSlotAvailability.topic,
        lifecycleState: zuvyMentorSlotBooking.sessionLifecycleState,
        meetingLink: zuvyMentorSlotBooking.meetingLink,
        mentorJoinedAt: zuvyMentorSlotBooking.mentorJoinedAt,
        studentJoinedAt: zuvyMentorSlotBooking.studentJoinedAt,
        mentorId: zuvyMentorSlotBooking.mentorUserId,
        mentorName: mentorUser.name,
        mentorEmail: mentorUser.email,
        studentId: zuvyMentorSlotBooking.studentUserId,
        studentName: studentUser.name,
        studentEmail: studentUser.email,
      })
      .from(zuvyMentorSlotBooking)
      .innerJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotBooking.slotAvailabilityId,
          zuvyMentorSlotAvailability.id,
        ),
      )
      .innerJoin(
        zuvyMentorSlotManagement,
        eq(
          zuvyMentorSlotAvailability.mentorSlotManagementId,
          zuvyMentorSlotManagement.id,
        ),
      )
      .leftJoin(zuvyBootcamps, sql`${zuvyBootcamps.id} = ${courseId}`)
      .leftJoin(
        mentorUser,
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUser.id),
      )
      .leftJoin(
        studentUser,
        eq(zuvyMentorSlotBooking.studentUserId, studentUser.id),
      )
      .where(and(...conditions));

    const sessions = rows
      .map((r) => this.toLiveSession(r, now))
      .sort(
        (a, b) =>
          Number(b.needsAttention) - Number(a.needsAttention) ||
          new Date(a.slotStart).getTime() - new Date(b.slotStart).getTime(),
      );

    const needsAttentionCount = sessions.filter((s) => s.needsAttention).length;

    if (summaryOnly) {
      return {
        serverTime: now.toISOString(),
        needsAttentionCount,
        hasMentorshipCourses: await this.orgHasMentorshipCourses(orgId),
      };
    }

    return {
      serverTime: now.toISOString(),
      total: sessions.length,
      needsAttentionCount,
      sessions,
    };
  }

  /** Visible for tests: works out phase and attention for one session at `now`. */
  toLiveSession(r: any, now: Date) {
    const start = new Date(r.slotStart).getTime();
    const end = new Date(r.slotEnd).getTime();
    const t = now.getTime();

    const phase: LivePhase =
      t < start ? 'starting_soon' : t < end ? 'in_progress' : 'ended';

    const mentorJoined = Boolean(r.mentorJoinedAt);
    const studentJoined = Boolean(r.studentJoinedAt);

    // Only while the session is running, and only once 5 min have passed.
    const attentionWindowOpen =
      t >= start + ATTENTION_AFTER_START_MIN * MINUTE && t < end;
    const notJoined: Array<'mentor' | 'student'> = [];
    if (attentionWindowOpen) {
      if (!mentorJoined) notJoined.push('mentor');
      if (!studentJoined) notJoined.push('student');
    }

    return {
      bookingId: r.bookingId,
      bootcampId: r.bootcampId ?? null,
      bootcampName: r.bootcampName ?? null,
      topic: r.topic ?? null,
      slotStart: new Date(r.slotStart).toISOString(),
      slotEnd: new Date(r.slotEnd).toISOString(),
      phase,
      lifecycleState: r.lifecycleState,
      meetingLink: r.meetingLink ?? null,
      mentor: {
        id: r.mentorId?.toString(),
        name: r.mentorName ?? null,
        email: r.mentorEmail ?? null,
        joinedAt: r.mentorJoinedAt
          ? new Date(r.mentorJoinedAt).toISOString()
          : null,
      },
      student: {
        id: r.studentId?.toString(),
        name: r.studentName ?? null,
        email: r.studentEmail ?? null,
        joinedAt: r.studentJoinedAt
          ? new Date(r.studentJoinedAt).toISOString()
          : null,
      },
      needsAttention: notJoined.length > 0,
      notJoined,
    };
  }

  /**
   * Super admins can view any organisation. Org admins only their own:
   * their roles come from the org on their token, so any other orgId is 403.
   */
  assertCanViewOrg(user: RequestUser, orgId: number) {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (roles.includes('super_admin')) return;

    if (!roles.includes('admin')) {
      throw new ForbiddenException(
        'Only admins can view live mentor sessions.',
      );
    }
    if (user.orgId == null || Number(user.orgId) !== orgId) {
      throw new ForbiddenException(
        'You can only view live mentor sessions of your own organisation.',
      );
    }
  }

  private async assertCourseHasMentorship(orgId: number, bootcampId: number) {
    const [course] = await db
      .select({ id: zuvyBootcamps.id })
      .from(zuvyBootcamps)
      .where(
        and(
          eq(zuvyBootcamps.id, bootcampId),
          eq(zuvyBootcamps.organizationId, orgId),
        ),
      )
      .limit(1);
    if (!course) {
      throw new NotFoundException('Course not found in this organisation.');
    }

    const [enabled] = await db
      .select({ id: zuvyBootcampType.id })
      .from(zuvyBootcampType)
      .where(
        and(
          eq(zuvyBootcampType.bootcampId, bootcampId),
          eq(zuvyBootcampType.mentorshipEnabled, true),
        ),
      )
      .limit(1);
    if (!enabled) {
      throw new ForbiddenException(
        'Mentorship is not enabled for this course.',
      );
    }
  }

  private async orgHasMentorshipCourses(orgId: number) {
    const [row] = await db
      .select({ id: zuvyBootcampType.id })
      .from(zuvyBootcampType)
      .innerJoin(
        zuvyBootcamps,
        eq(zuvyBootcampType.bootcampId, zuvyBootcamps.id),
      )
      .where(
        and(
          eq(zuvyBootcamps.organizationId, orgId),
          eq(zuvyBootcampType.mentorshipEnabled, true),
        ),
      )
      .limit(1);
    return Boolean(row);
  }
}
