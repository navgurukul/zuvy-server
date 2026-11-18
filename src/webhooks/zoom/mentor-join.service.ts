import { Injectable, Logger } from '@nestjs/common';
import { alias } from 'drizzle-orm/pg-core';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { users, zuvyMentorSlotBooking } from '../../../drizzle/schema';

export type JoinRole = 'mentor' | 'student' | null;

export interface ZoomParticipant {
  id?: string; // Zoom user id (empty for guests)
  user_id?: string; // per-meeting participant id
  user_name?: string;
  email?: string;
  join_time?: string;
}

const norm = (v?: string | null) => (v || '').trim().toLowerCase();

/**
 * Who a Zoom participant is in a mentor booking.
 * - mentor: email matches the mentor, or they are the meeting host
 *   (only the mentor gets the host start link).
 * - student: email matches the student; if Zoom sends no email
 *   (guest not signed in), the display name must match the student's name.
 * - anyone else (an admin, a guest): null, never counted.
 */
export function classifyParticipant(
  participant: ZoomParticipant,
  hostId: string | undefined,
  booking: {
    mentorEmail?: string | null;
    studentEmail?: string | null;
    studentName?: string | null;
  },
): JoinRole {
  const email = norm(participant.email);

  if (email && email === norm(booking.mentorEmail)) return 'mentor';
  if (hostId && participant.id && participant.id === hostId) return 'mentor';

  if (email) {
    return email === norm(booking.studentEmail) ? 'student' : null;
  }
  if (
    norm(booking.studentName) &&
    norm(participant.user_name) === norm(booking.studentName)
  ) {
    return 'student';
  }
  return null;
}

@Injectable()
export class MentorJoinService {
  private readonly logger = new Logger(MentorJoinService.name);

  /**
   * Handles meeting.participant_joined. Stores the first join time of the
   * mentor or student on the mentor booking for this meeting. Returns false
   * when the meeting isn't a mentor booking.
   */
  async recordParticipantJoined(payload: any): Promise<boolean> {
    const meeting = payload?.object || {};
    const meetingId = meeting.id?.toString();
    const participant: ZoomParticipant = meeting.participant || {};
    if (!meetingId) return false;

    const cleanId = meetingId.replace(/\D/g, '');
    const mentorUser = alias(users, 'mentor_user');
    const studentUser = alias(users, 'student_user');

    const [booking] = await db
      .select({
        id: zuvyMentorSlotBooking.id,
        mentorEmail: mentorUser.email,
        studentEmail: studentUser.email,
        studentName: studentUser.name,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(
        mentorUser,
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUser.id),
      )
      .leftJoin(
        studentUser,
        eq(zuvyMentorSlotBooking.studentUserId, studentUser.id),
      )
      .where(
        or(
          eq(zuvyMentorSlotBooking.zoomMeetingId, meetingId),
          sql`REPLACE(${zuvyMentorSlotBooking.zoomMeetingId}, ' ', '') = ${cleanId}`,
        ),
      )
      .limit(1);

    if (!booking) return false;

    const role = classifyParticipant(participant, meeting.host_id, booking);
    if (!role) {
      this.logger.log(
        `Zoom join on booking ${booking.id} by someone who is not the mentor or student (${participant.user_name || 'unknown'}); ignored`,
      );
      return true;
    }

    const parsed = participant.join_time
      ? new Date(participant.join_time)
      : null;
    const joinedAt = parsed && !isNaN(parsed.getTime()) ? parsed : new Date();

    // Keep the first join only; rejoins and replays change nothing.
    const column =
      role === 'mentor'
        ? zuvyMentorSlotBooking.mentorJoinedAt
        : zuvyMentorSlotBooking.studentJoinedAt;
    await db
      .update(zuvyMentorSlotBooking)
      .set({
        [role === 'mentor' ? 'mentorJoinedAt' : 'studentJoinedAt']:
          sql`COALESCE(${column}, ${joinedAt.toISOString()}::timestamptz)`,
        updatedAt: new Date(),
      } as any)
      .where(eq(zuvyMentorSlotBooking.id, booking.id));

    this.logger.log(
      `Booking ${booking.id}: ${role} joined at ${joinedAt.toISOString()}`,
    );
    return true;
  }
}
