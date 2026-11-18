import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
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
import { NotificationEmailService } from 'src/notification/email/email.service';
import { MentorSlotService } from '../mentor-slot.service';

/** A session shows from this many minutes before it starts... */
export const LIVE_WINDOW_BEFORE_START_MIN = 10;
/** ...until this many minutes after it ends. */
export const LIVE_WINDOW_AFTER_END_MIN = 15;
/** A missing mentor or student counts as "needs attention" this many minutes after start. */
export const ATTENTION_AFTER_START_MIN = 5;

/** An admin cancel needs a reason at least this long (after trimming). */
export const ADMIN_CANCEL_REASON_MIN_LENGTH = 10;

const MINUTE = 60 * 1000;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatSessionTime = (start: Date, end: Date) => {
  const tz = 'Asia/Kolkata';
  const date = start.toLocaleDateString('en-IN', {
    timeZone: tz,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = (d: Date) =>
    d.toLocaleTimeString('en-IN', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  return `${date}, ${time(start)} - ${time(end)} IST`;
};

export type LivePhase = 'starting_soon' | 'in_progress' | 'ended';

export interface RequestUser {
  id: number | string;
  roles?: string[];
  orgId?: number | string | null;
}

@Injectable()
export class AdminMentorSessionService {
  private readonly logger = new Logger(AdminMentorSessionService.name);

  constructor(
    private readonly mentorSlotService: MentorSlotService,
    private readonly emailService: NotificationEmailService,
  ) {}

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

  /**
   * Ops cancels a session for the student and mentor. Allowed any time before
   * the session ends (upcoming, under 24 hours, or live). The student gets the
   * credit back, the booking gap is recalculated, and both people are told
   * with the reason.
   */
  async cancelSession(user: RequestUser, bookingId: number, rawReason: string) {
    this.assertIsAdmin(user, 'cancel mentor sessions');

    const reason = (rawReason ?? '').trim();
    if (reason.length < ADMIN_CANCEL_REASON_MIN_LENGTH) {
      throw new BadRequestException(
        `Cancellation reason must be at least ${ADMIN_CANCEL_REASON_MIN_LENGTH} characters.`,
      );
    }

    const mentorUser = alias(users, 'mentor_user');
    const studentUser = alias(users, 'student_user');
    const courseId = sql<
      number | null
    >`COALESCE(${zuvyMentorSlotBooking.bootcampId}, ${zuvyMentorSlotManagement.bootcampId})`;

    const [session] = await db
      .select({
        organizationId: zuvyMentorSlotBooking.organizationId,
        bootcampId: courseId,
        slotId: zuvyMentorSlotAvailability.id,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
        mentorName: mentorUser.name,
        mentorEmail: mentorUser.email,
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
      .leftJoin(
        mentorUser,
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUser.id),
      )
      .leftJoin(
        studentUser,
        eq(zuvyMentorSlotBooking.studentUserId, studentUser.id),
      )
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!session) {
      throw new NotFoundException('Booking not found.');
    }

    this.assertCanActOnOrg(
      user,
      session.organizationId,
      'You can only cancel mentor sessions of your own organisation.',
    );

    // Older bookings with no course on the booking or mentor profile have no
    // course to check, so they are allowed.
    if (session.bootcampId) {
      await this.assertCourseHasMentorship(
        session.organizationId,
        Number(session.bootcampId),
      );
    }

    const slotStart = new Date(session.slotStart);
    const slotEnd = new Date(session.slotEnd);
    const sessionTime = formatSessionTime(slotStart, slotEnd);

    await this.mentorSlotService.applyCancellation(bookingId, reason, 'admin', {
      // Admins may cancel a live session; assertCancellableAt below still
      // rejects one that has ended or been completed.
      allowStarted: true,
      // Re-checked on the locked row so a reschedule or completion that lands
      // between the lookup above and this cancel cannot slip through.
      beforeCancel: (booking) => {
        if (booking.slotAvailabilityId !== session.slotId) {
          throw new ConflictException(
            'This session was rescheduled just now. Reload and try again.',
          );
        }
        this.assertCancellableAt(
          { slotEnd, completedAt: booking.completedAt },
          new Date(),
        );
      },
      studentMessage: `The Zuvy team cancelled your mentorship session on ${sessionTime}. Reason: ${reason}. Your session credit has been returned, so you can book again.`,
      mentorMessage: `The Zuvy team cancelled your mentorship session on ${sessionTime}. Reason: ${reason}.`,
    });

    this.logger.log(
      `Admin ${user.id} cancelled mentor booking ${bookingId} (org ${session.organizationId})`,
    );

    this.emailCancellation(
      session.studentEmail,
      session.studentName,
      sessionTime,
      reason,
      'Your session credit has been returned, so you can book another session.',
    );
    this.emailCancellation(
      session.mentorEmail,
      session.mentorName,
      sessionTime,
      reason,
      'The slot is free again.',
    );

    return {
      message: 'Session cancelled. The student and mentor have been told.',
      bookingId,
      cancelledBy: 'admin',
      reason,
      creditReturned: true,
    };
  }

  /**
   * Visible for tests: an admin can cancel any time before the session ends.
   * A session the mentor already marked complete counts as ended.
   */
  assertCancellableAt(
    session: { slotEnd: Date; completedAt?: Date | null },
    now: Date,
  ) {
    if (session.completedAt || now.getTime() >= session.slotEnd.getTime()) {
      throw new BadRequestException(
        'This session has already ended and can no longer be cancelled.',
      );
    }
  }

  private emailCancellation(
    to: string | null | undefined,
    name: string | null | undefined,
    sessionTime: string,
    reason: string,
    footer: string,
  ) {
    if (!to) return;
    this.emailService
      .sendEmail(
        to,
        'Your mentorship session was cancelled',
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <p>Hi {{name}},</p>
          <p>The Zuvy team cancelled your mentorship session on <strong>{{sessionTime}}</strong>.</p>
          <p><strong>Reason:</strong> {{reason}}</p>
          <p>{{footer}}</p>
          <p>If you have questions, write to team@zuvy.org.</p>
          <p style="color: #9CA3AF; font-size: 12px;">© Zuvy by NavGurukul</p>
        </div>`,
        {
          name: escapeHtml(name || 'there'),
          sessionTime: escapeHtml(sessionTime),
          reason: escapeHtml(reason),
          footer: escapeHtml(footer),
        },
      )
      .catch((err) =>
        this.logger.error(`Cancellation email failed: ${err.message}`),
      );
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
    this.assertIsAdmin(user, 'view live mentor sessions');
    this.assertCanActOnOrg(
      user,
      orgId,
      'You can only view live mentor sessions of your own organisation.',
    );
  }

  private assertIsAdmin(user: RequestUser, action: string) {
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    if (roles.includes('super_admin') || roles.includes('admin')) return;
    throw new ForbiddenException(`Only admins can ${action}.`);
  }

  /** Call after assertIsAdmin. Super admins pass for any org. */
  private assertCanActOnOrg(user: RequestUser, orgId: number, message: string) {
    if (user.roles?.includes('super_admin')) return;
    if (user.orgId == null || Number(user.orgId) !== Number(orgId)) {
      throw new ForbiddenException(message);
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
