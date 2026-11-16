import { mergeIntervalsToDurationSeconds } from '../../../services/attendance/attendance-duration-merge';

/* ==========================================================================
   Participant-wise attendance for mentor bookings.
   Pure and DB-free so the rules are unit-testable — see
   mentor-session-attendance.spec.ts.
========================================================================== */

export type ParticipantRole = 'MENTOR' | 'STUDENT' | 'UNMATCHED';

export type ParticipantAttendanceStatus =
  | 'ATTENDED'
  | 'ABSENT'
  | 'PENDING'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

export type SessionAttendanceStatus =
  | 'BOTH_ATTENDED'
  | 'STUDENT_ONLY'
  | 'MENTOR_ONLY'
  | 'NONE_ATTENDED'
  | 'PENDING'
  | 'UNKNOWN'
  | 'NOT_APPLICABLE';

/** Subset of Zoom's payload.object.participant used for identity. */
export interface ZoomParticipant {
  user_id?: string | number | null;
  participant_uuid?: string | null;
  participant_user_id?: string | null;
  id?: string | null;
  email?: string | null;
}

/**
 * Stable key for one participant connection within a meeting instance:
 * participant_uuid when Zoom sends it, else the meeting-scoped user_id.
 */
export function getParticipantKey(participant: ZoomParticipant): string | null {
  const key = participant?.participant_uuid || participant?.user_id;
  return key === undefined || key === null || key === '' ? null : String(key);
}

const normalizeEmail = (email?: string | null) =>
  (email || '').trim().toLowerCase();

/**
 * Matches a Zoom participant to the booking's mentor or student using only
 * identity Zoom has verified:
 *  - MENTOR: the participant's Zoom user id equals the meeting host_id (the
 *    meeting is created under the mentor's own Zoom account), or the
 *    signed-in Zoom email equals the mentor's email.
 *  - STUDENT: the signed-in Zoom email equals the student's email.
 * Zoom only sends email for participants signed in to Zoom; display names
 * are never trusted. Anything else is UNMATCHED and never counted.
 */
export function resolveParticipantRole(
  participant: ZoomParticipant,
  hostId: string | null | undefined,
  mentorEmail: string | null | undefined,
  studentEmail: string | null | undefined,
): ParticipantRole {
  const zoomUserId = participant?.participant_user_id || participant?.id || '';
  const email = normalizeEmail(participant?.email);
  const mentor = normalizeEmail(mentorEmail);
  const student = normalizeEmail(studentEmail);

  if (
    (zoomUserId && hostId && zoomUserId === hostId) ||
    (email && email === mentor)
  ) {
    return 'MENTOR';
  }
  if (email && email === student) {
    return 'STUDENT';
  }
  return 'UNMATCHED';
}

export interface AttendanceInterval {
  participantRole: string;
  joinedAt: Date | null;
  leftAt: Date | null;
}

export interface ParticipantAttendance {
  status: ParticipantAttendanceStatus;
  joinedAt: Date | null;
  leftAt: Date | null;
  durationAttended: number | null; // minutes
  /** Whole minutes between the scheduled start and the first join; 0 if on time or early, null if never joined. */
  lateByMinutes: number | null;
}

/**
 * No product threshold exists for "late", so a join counts as late once it
 * is at least one whole minute after the scheduled start (lateByMinutes > 0).
 * The SQL attendance filter uses the same value.
 */
export const LATE_JOIN_THRESHOLD_MINUTES = 1;

export function computeLateByMinutes(
  joinedAt: Date | null,
  scheduledStart: Date | null,
): number | null {
  if (!joinedAt || !scheduledStart) return null;
  return Math.max(
    0,
    Math.floor((joinedAt.getTime() - scheduledStart.getTime()) / 60000),
  );
}

export interface BookingAttendanceContext {
  /** False for non-Zoom bookings or bookings without a Zoom meeting. */
  hasZoomMeeting: boolean;
  isCancelled: boolean;
  /** Latest verified meeting.ended for this booking's meeting, if any. */
  meetingEndedAt: Date | null;
  now: Date;
  /** Booking's scheduled slot start, used for lateByMinutes. */
  scheduledStart: Date | null;
}

/**
 * The meeting counts as ended only on a verified meeting.ended webhook that
 * is not older than the latest join (a meeting restarted after ending is
 * running again). No time-based guess is ever used.
 */
function isMeetingEnded(
  intervals: AttendanceInterval[],
  meetingEndedAt: Date | null,
): boolean {
  if (!meetingEndedAt) return false;
  const latestJoin = intervals.reduce<number>(
    (max, i) => (i.joinedAt ? Math.max(max, i.joinedAt.getTime()) : max),
    -Infinity,
  );
  return meetingEndedAt.getTime() >= latestJoin;
}

function summarizeRole(
  intervals: AttendanceInterval[],
  ended: boolean,
  ctx: BookingAttendanceContext,
): Omit<ParticipantAttendance, 'status' | 'lateByMinutes'> {
  // An interval still open is counted up to the meeting end, or up to now
  // while the meeting is running.
  const openEnd = ended && ctx.meetingEndedAt ? ctx.meetingEndedAt : ctx.now;

  const joins = intervals
    .filter((i) => i.joinedAt)
    .map((i) => i.joinedAt!.getTime());
  const hasOpen = intervals.some((i) => i.joinedAt && !i.leftAt);
  const leaves = intervals
    .filter((i) => i.leftAt)
    .map((i) => i.leftAt!.getTime());
  if (hasOpen) leaves.push(openEnd.getTime());

  const seconds = mergeIntervalsToDurationSeconds(
    intervals
      .filter((i) => i.joinedAt)
      .map((i) => ({
        joinTime: i.joinedAt!.toISOString(),
        leaveTime: (i.leftAt ?? openEnd).toISOString(),
      })),
  );

  return {
    joinedAt: joins.length ? new Date(Math.min(...joins)) : null,
    // Still in the meeting → no leave time yet.
    leftAt:
      (hasOpen && !ended) || !leaves.length
        ? null
        : new Date(Math.max(...leaves)),
    durationAttended: Math.floor(seconds / 60),
  };
}

const EMPTY = {
  joinedAt: null,
  leftAt: null,
  durationAttended: null,
  lateByMinutes: null,
};

export function summarizeBookingAttendance(
  intervals: AttendanceInterval[],
  ctx: BookingAttendanceContext,
): {
  attendanceStatus: SessionAttendanceStatus;
  studentAttendance: ParticipantAttendance;
  mentorAttendance: ParticipantAttendance;
} {
  const ended = isMeetingEnded(intervals, ctx.meetingEndedAt);

  const forRole = (role: ParticipantRole): ParticipantAttendance => {
    const own = intervals.filter((i) => i.participantRole === role);
    if (own.length) {
      const summary = summarizeRole(own, ended, ctx);
      return {
        status: 'ATTENDED',
        ...summary,
        lateByMinutes: computeLateByMinutes(
          summary.joinedAt,
          ctx.scheduledStart,
        ),
      };
    }
    if (!ctx.hasZoomMeeting) return { status: 'NOT_APPLICABLE', ...EMPTY };
    if (!ended) {
      const cancelledUnused = ctx.isCancelled && !intervals.length;
      return {
        status: cancelledUnused ? 'NOT_APPLICABLE' : 'PENDING',
        ...EMPTY,
      };
    }
    // A meeting Zoom reports as ended had at least one participant. If none
    // was captured at all, participant data is missing (e.g. a session from
    // before tracking existed) — never report that as ABSENT.
    if (!intervals.length) return { status: 'UNKNOWN', ...EMPTY };
    return { status: 'ABSENT', ...EMPTY, durationAttended: 0 };
  };

  const studentAttendance = forRole('STUDENT');
  const mentorAttendance = forRole('MENTOR');

  return {
    attendanceStatus: combineStatus(
      studentAttendance.status,
      mentorAttendance.status,
    ),
    studentAttendance,
    mentorAttendance,
  };
}

function combineStatus(
  student: ParticipantAttendanceStatus,
  mentor: ParticipantAttendanceStatus,
): SessionAttendanceStatus {
  if (student === 'ATTENDED' && mentor === 'ATTENDED') return 'BOTH_ATTENDED';
  if (student === 'ATTENDED' && mentor === 'ABSENT') return 'STUDENT_ONLY';
  if (mentor === 'ATTENDED' && student === 'ABSENT') return 'MENTOR_ONLY';
  if (student === 'ABSENT' && mentor === 'ABSENT') return 'NONE_ATTENDED';
  if (student === 'PENDING' || mentor === 'PENDING') return 'PENDING';
  if (student === 'UNKNOWN' || mentor === 'UNKNOWN') return 'UNKNOWN';
  return 'NOT_APPLICABLE';
}
