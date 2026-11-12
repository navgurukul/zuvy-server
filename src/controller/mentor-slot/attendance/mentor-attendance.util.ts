import { computeMergedDurationsByKey } from '../../../services/attendance/attendance-duration-merge';
import type { ZoomParticipant } from '../../../services/zoom/zoom.service';
import { FLAGS } from '../../../constants/flags';
import type { GlobalConstants } from '../../../constants/global.constants.example';

export type AttendanceOutcome =
  | 'BOTH_JOINED'
  | 'STUDENT_NO_SHOW'
  | 'MENTOR_NO_SHOW'
  | 'NOBODY_JOINED';

// Being in the meeting for less than this doesn't count as having joined
// (e.g. clicking the link by mistake and leaving straight away).
export const MIN_ATTENDED_SECONDS = 60;

// Zoom lists a meeting under its past instances only once it has ended, and
// the participant report can lag behind that. A meeting with no past
// instance this long after its slot ended never ran.
export const NO_INSTANCE_GRACE_MS = 60 * 60 * 1000;

// A meeting's past runs include any time the host started it, such as
// testing the link the day before. Only runs that started around the
// session's own time count: from an hour before the slot to 15 minutes after
// it ends.
export const RUN_WINDOW_BEFORE_MS = 60 * 60 * 1000;
export const RUN_WINDOW_AFTER_MS = 15 * 60 * 1000;

export function runsInSessionWindow<T extends { startTime: string | null }>(
  runs: T[],
  slotStart: Date,
  slotEnd: Date,
): T[] {
  const from = slotStart.getTime() - RUN_WINDOW_BEFORE_MS;
  const to = slotEnd.getTime() + RUN_WINDOW_AFTER_MS;
  return runs.filter((run) => {
    const startedAt = run.startTime ? new Date(run.startTime).getTime() : NaN;
    // A run whose start time can't be read is kept: dropping the session's
    // real run could turn it into a NOBODY_JOINED refund.
    if (Number.isNaN(startedAt)) return true;
    return startedAt >= from && startedAt <= to;
  });
}

// What Zoom says about the meeting itself, checked only when it has no past
// instance. 'unknown' covers any error — including "Meeting does not exist"
// and a host whose licence has since moved to another mentor — because then
// Zoom can't confirm the meeting never ran.
export type MeetingState =
  | { kind: 'live' }
  | { kind: 'not_running' }
  | { kind: 'unknown'; error: string };

export type AttendanceDecision =
  | {
      kind: 'record';
      outcome: AttendanceOutcome;
      mentorSeconds: number;
      studentSeconds: number;
    }
  | { kind: 'retry'; reason: string };

/**
 * Seconds each side spent in the meeting. The mentor is the participant whose
 * Zoom email matches the mentor's account (they start the meeting signed in as
 * the host). A mentor session is one-to-one, so anyone else is the student —
 * students often join as guests with no email, so their email isn't required
 * to match. Overlapping connections (rejoining, a second device) are merged so
 * they aren't counted twice.
 */
export function attendedSecondsByRole(
  participants: ZoomParticipant[],
  mentorEmail: string,
): { mentorSeconds: number; studentSeconds: number } {
  const mentor = mentorEmail.trim().toLowerCase();
  const connections = participants
    .filter((p) => p.join_time && p.leave_time)
    .map((p) => ({
      key:
        (p.user_email ?? '').trim().toLowerCase() === mentor
          ? 'mentor'
          : 'student',
      joinTime: p.join_time,
      leaveTime: p.leave_time,
    }));

  const merged = computeMergedDurationsByKey(connections, null);
  return {
    mentorSeconds: merged.get('mentor') ?? 0,
    studentSeconds: merged.get('student') ?? 0,
  };
}

export function classifyAttendance(
  mentorSeconds: number,
  studentSeconds: number,
): AttendanceOutcome {
  const mentorJoined = mentorSeconds >= MIN_ATTENDED_SECONDS;
  const studentJoined = studentSeconds >= MIN_ATTENDED_SECONDS;
  if (mentorJoined && studentJoined) return 'BOTH_JOINED';
  if (mentorJoined) return 'STUDENT_NO_SHOW';
  if (studentJoined) return 'MENTOR_NO_SHOW';
  return 'NOBODY_JOINED';
}

/**
 * Turns what Zoom returned into either an outcome to record or "try again
 * later". Anything ambiguous is a retry, never a no-show: a no-show can refund
 * a credit, so it is only recorded when Zoom positively shows it.
 */
export function decideAttendance(input: {
  instanceCount: number;
  participants: ZoomParticipant[];
  mentorEmail: string | null | undefined;
  // Only consulted when instanceCount is 0.
  meetingState: MeetingState;
  slotEnd: Date;
  now: Date;
}): AttendanceDecision {
  if (!input.mentorEmail) {
    return {
      kind: 'retry',
      reason: 'Mentor has no email to match against the Zoom report.',
    };
  }

  if (input.instanceCount === 0) {
    if (input.meetingState.kind === 'live') {
      return { kind: 'retry', reason: 'The meeting is still running.' };
    }
    if (input.meetingState.kind === 'unknown') {
      return {
        kind: 'retry',
        reason: `Zoom could not confirm the meeting never ran: ${input.meetingState.error}`,
      };
    }
    const sinceEnd = input.now.getTime() - input.slotEnd.getTime();
    if (sinceEnd < NO_INSTANCE_GRACE_MS) {
      return {
        kind: 'retry',
        reason: 'No past meeting instance yet; Zoom may not have listed it.',
      };
    }
    return {
      kind: 'record',
      outcome: 'NOBODY_JOINED',
      mentorSeconds: 0,
      studentSeconds: 0,
    };
  }

  // The meeting ran, so at least the person who started it is in the report;
  // an empty report means it isn't ready yet.
  if (input.participants.length === 0) {
    return {
      kind: 'retry',
      reason: 'The participant report is empty; it is not ready yet.',
    };
  }

  const { mentorSeconds, studentSeconds } = attendedSecondsByRole(
    input.participants,
    input.mentorEmail,
  );
  return {
    kind: 'record',
    outcome: classifyAttendance(mentorSeconds, studentSeconds),
    mentorSeconds,
    studentSeconds,
  };
}

export function lifecycleStateFor(outcome: AttendanceOutcome) {
  return outcome === 'BOTH_JOINED' ? 'COMPLETED' : 'MISSED';
}

// Per the credits ticket: a mentor no-show, or nobody joining, gives the
// credit back and lifts the booking cooldown (currently 21 days, see
// recomputeStudentBookingMetrics); a student no-show keeps it used.
export function outcomeRefundsCredit(outcome: AttendanceOutcome): boolean {
  return outcome === 'MENTOR_NO_SHOW' || outcome === 'NOBODY_JOINED';
}

// On/off switch in src/constants/global.constants.ts. When off, nothing is
// refunded, but attendance and COMPLETED/MISSED are still recorded.
export function noShowCreditRulesEnabled(
  flags: Pick<GlobalConstants, 'MENTOR_NO_SHOW_CREDIT_RULES'> = FLAGS,
): boolean {
  return flags.MENTOR_NO_SHOW_CREDIT_RULES === true;
}
