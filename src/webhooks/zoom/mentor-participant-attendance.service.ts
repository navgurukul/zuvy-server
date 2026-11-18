import { Injectable, Logger } from '@nestjs/common';
import {
  and,
  desc,
  eq,
  isNotNull,
  isNull,
  lte,
  gte,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '../../db';
import {
  users,
  zuvyMentorSessionAttendance,
  zuvyMentorSessionAttendanceIntervals,
  zuvyMentorSlotBooking,
} from '../../../drizzle/schema';
import {
  getParticipantKey,
  resolveParticipantRole,
} from '../../controller/mentor-slot/attendance/mentor-session-attendance';

export const PARTICIPANT_JOINED_EVENT = 'meeting.participant_joined';
export const PARTICIPANT_LEFT_EVENT = 'meeting.participant_left';

const mentorUser = alias(users, 'mentor_user');
const studentUser = alias(users, 'student_user');

/**
 * Records mentor-booking participant join/leave intervals from Zoom
 * meeting.participant_joined / meeting.participant_left webhooks.
 *
 * Idempotent: a repeated join is a no-op (unique booking + instance +
 * participant + joined_at), a repeated leave finds its interval already
 * closed. A leave that arrives before its join (Zoom retries can reorder
 * deliveries) is stored with joined_at NULL and completed by the join.
 * Meetings that are not a mentor booking (e.g. class sessions) are ignored.
 */
@Injectable()
export class MentorParticipantAttendanceService {
  private readonly logger = new Logger(MentorParticipantAttendanceService.name);

  /** Returns 'IGNORED' when the event does not belong to a mentor booking. */
  async handleParticipantEvent(
    event: string,
    payload: any,
  ): Promise<'PROCESSED' | 'IGNORED'> {
    const object = payload?.object || {};
    const participant = object.participant || {};
    const meetingId = object.id?.toString();
    const meetingUuid: string | undefined = object.uuid;
    const participantKey = getParticipantKey(participant);

    if (!meetingId || !meetingUuid || !participantKey) return 'IGNORED';

    // Same booking ↔ Zoom meeting mapping used by recording.completed.
    const cleanId = meetingId.replace(/\D/g, '');
    const [booking] = await db
      .select({
        id: zuvyMentorSlotBooking.id,
        mentorUserId: zuvyMentorSlotBooking.mentorUserId,
        studentUserId: zuvyMentorSlotBooking.studentUserId,
        mentorEmail: mentorUser.email,
        studentEmail: studentUser.email,
      })
      .from(zuvyMentorSlotBooking)
      .leftJoin(
        mentorUser,
        eq(mentorUser.id, zuvyMentorSlotBooking.mentorUserId),
      )
      .leftJoin(
        studentUser,
        eq(studentUser.id, zuvyMentorSlotBooking.studentUserId),
      )
      .where(
        or(
          eq(zuvyMentorSlotBooking.zoomMeetingId, meetingId),
          sql`REPLACE(${zuvyMentorSlotBooking.zoomMeetingId}, ' ', '') = ${cleanId}`,
        ),
      )
      .limit(1);

    if (!booking) return 'IGNORED';

    const role = resolveParticipantRole(
      participant,
      object.host_id,
      booking.mentorEmail,
      booking.studentEmail,
    );
    if (role === 'UNMATCHED') {
      this.logger.warn(
        `Unmatched participant in mentor booking ${booking.id} (meeting ${meetingId})`,
      );
    }

    const identity = {
      participantRole: role,
      userId:
        role === 'MENTOR'
          ? booking.mentorUserId
          : role === 'STUDENT'
            ? booking.studentUserId
            : null,
      zoomParticipantUserId:
        participant.participant_user_id || participant.id || null,
      participantEmail: participant.email || null,
      participantName: participant.user_name || null,
    };

    const sameParticipant = and(
      eq(zuvyMentorSessionAttendanceIntervals.bookingId, booking.id),
      eq(
        zuvyMentorSessionAttendanceIntervals.zoomParticipantKey,
        participantKey,
      ),
    );

    if (event === PARTICIPANT_JOINED_EVENT) {
      const joinedAt = new Date(participant.join_time);
      if (Number.isNaN(joinedAt.getTime())) return 'IGNORED';

      // Leave delivered first → complete that interval.
      const [orphanLeave] = await db
        .select({ id: zuvyMentorSessionAttendanceIntervals.id })
        .from(zuvyMentorSessionAttendanceIntervals)
        .where(
          and(
            sameParticipant,
            isNull(zuvyMentorSessionAttendanceIntervals.joinedAt),
            gte(zuvyMentorSessionAttendanceIntervals.leftAt, joinedAt),
          ),
        )
        .orderBy(zuvyMentorSessionAttendanceIntervals.leftAt)
        .limit(1);

      if (orphanLeave) {
        await db
          .update(zuvyMentorSessionAttendanceIntervals)
          .set({ joinedAt, updatedAt: new Date() } as any)
          .where(eq(zuvyMentorSessionAttendanceIntervals.id, orphanLeave.id));
        return 'PROCESSED';
      }

      await db
        .insert(zuvyMentorSessionAttendanceIntervals)
        .values({
          bookingId: booking.id,
          zoomMeetingId: meetingId,
          zoomMeetingUuid: meetingUuid,
          zoomParticipantKey: participantKey,
          joinedAt,
          ...identity,
        } as any)
        .onConflictDoNothing();
      return 'PROCESSED';
    }

    if (event === PARTICIPANT_LEFT_EVENT) {
      const leftAt = new Date(participant.leave_time);
      if (Number.isNaN(leftAt.getTime())) return 'IGNORED';
      const leaveReason = participant.leave_reason || null;

      const [open] = await db
        .select({ id: zuvyMentorSessionAttendanceIntervals.id })
        .from(zuvyMentorSessionAttendanceIntervals)
        .where(
          and(
            sameParticipant,
            isNotNull(zuvyMentorSessionAttendanceIntervals.joinedAt),
            isNull(zuvyMentorSessionAttendanceIntervals.leftAt),
            lte(zuvyMentorSessionAttendanceIntervals.joinedAt, leftAt),
          ),
        )
        .orderBy(desc(zuvyMentorSessionAttendanceIntervals.joinedAt))
        .limit(1);

      if (open) {
        await db
          .update(zuvyMentorSessionAttendanceIntervals)
          .set({ leftAt, leaveReason, updatedAt: new Date() } as any)
          .where(eq(zuvyMentorSessionAttendanceIntervals.id, open.id));
        return 'PROCESSED';
      }

      // Duplicate delivery of a leave already recorded → nothing to do.
      const [already] = await db
        .select({ id: zuvyMentorSessionAttendanceIntervals.id })
        .from(zuvyMentorSessionAttendanceIntervals)
        .where(
          and(
            sameParticipant,
            eq(zuvyMentorSessionAttendanceIntervals.leftAt, leftAt),
          ),
        )
        .limit(1);
      if (already) return 'PROCESSED';

      await db.insert(zuvyMentorSessionAttendanceIntervals).values({
        bookingId: booking.id,
        zoomMeetingId: meetingId,
        zoomMeetingUuid: meetingUuid,
        zoomParticipantKey: participantKey,
        joinedAt: null,
        leftAt,
        leaveReason,
        ...identity,
      } as any);
      return 'PROCESSED';
    }

    return 'IGNORED';
  }
}
