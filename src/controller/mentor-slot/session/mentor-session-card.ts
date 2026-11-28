/**
 * What a mentor's session card shows (Mentor tab, MT1): its state, which
 * buttons work and why not, the line of text under it, the student's
 * reschedule request, who cancelled, and the recording. A plain function of
 * the booking and the server's clock, like the student's card
 * (session-card.ts), so every state can be tested at its boundaries.
 *
 * Times come from the mentorship config: a mentor can cancel until
 * `noticeHours` before the session; Join opens `joinOpenMinutes` before it.
 */
import { MentorshipConfig } from '../mentorship-rules/mentorship-config.service';
import {
  CardAction,
  RecordingState,
  formatDay,
  formatDayTime,
  recordingState,
} from './session-card';

const MIN_MS = 60_000;
const SUPPORT_EMAIL = 'team@zuvy.org';

export type MentorSessionDisplayState =
  | 'UPCOMING'
  | 'STARTING_SOON'
  | 'IN_PROGRESS'
  | 'ACTION_NEEDED' // a student's reschedule request waits for the mentor
  | 'COMPLETED'
  | 'MISSED'
  | 'CANCELLED';

/** The tab each state belongs to (besides All). */
export const MENTOR_TAB_OF_STATE: Record<MentorSessionDisplayState, string> = {
  UPCOMING: 'upcoming',
  STARTING_SOON: 'upcoming',
  IN_PROGRESS: 'upcoming',
  ACTION_NEEDED: 'action-needed',
  COMPLETED: 'completed',
  MISSED: 'missed',
  CANCELLED: 'cancelled',
};

export interface MentorCardInput {
  status: string; // 'confirmed' | 'cancelled' | ...
  lifecycleState: string | null;
  start: Date;
  end: Date;
  hasMeeting: boolean; // a Zoom meeting or Google event is set up
  studentName: string | null;
  reschedule: {
    status: string | null; // 'pending' | 'accepted' | 'declined' | 'expired'
    proposedStart: Date | null;
    proposedEnd: Date | null;
    reason: string | null;
  };
  cancellation: {
    cancelledBy: string | null; // 'student' | 'mentor' | 'admin' | 'ops'
    reason: string | null;
    at: Date | null;
  };
  attendance: { outcome: string | null; creditRefunded: boolean } | null;
  recording: { status: string | null; url: string | null } | null;
  /** The mentor's own feedback on the session. */
  feedback: { submitted: boolean; locked: boolean };
  /**
   * Whether credits are counted for this booking (bookingCountsTowardCredits).
   * False for one made before credits_counted_from: it never used the
   * student's credit, so the card doesn't mention one.
   */
  countsTowardCredits: boolean;
}

export interface MentorSessionCard {
  displayState: MentorSessionDisplayState;
  /** The mentor can cancel until this time. */
  changesCloseAt: Date;
  joinOpensAt: Date;
  joinClosesAt: Date;
  actions: {
    /** Get the link from GET …/bookings/:bookingId/join-link when allowed. */
    join: CardAction;
    cancel: CardAction;
    acceptReschedule: CardAction;
    declineReschedule: CardAction;
    viewRecording: CardAction & { url: string | null };
    giveFeedback: CardAction;
  };
  /** The line under the session, as the design words it. */
  message: string;
  reschedule: {
    proposedStart: Date | null;
    proposedEnd: Date | null;
    /** Reply before this, or the request lapses and the session stays. */
    replyBy: Date;
    reason: string | null;
  } | null;
  cancellation: {
    by: 'you' | 'student' | 'ops';
    byName: string | null;
    reason: string | null;
    at: Date | null;
  } | null;
  recording: { state: RecordingState; url: string | null };
}

type Reason =
  | 'TOO_LATE_TO_CHANGE'
  | 'RESCHEDULE_PENDING'
  | 'NO_PENDING_REQUEST'
  | 'REPLY_DEADLINE_PASSED'
  | 'JOIN_NOT_OPEN'
  | 'NO_MEETING_LINK'
  | 'SESSION_ENDED'
  | 'SESSION_NOT_ENDED'
  | 'CANCELLED'
  | 'MISSED'
  | 'RECORDING_PROCESSING'
  | 'NO_RECORDING'
  | 'FEEDBACK_GIVEN'
  | 'FEEDBACK_CLOSED';

const allowed = (): CardAction => ({ allowed: true, reason: null });
const blocked = (reason: Reason): CardAction =>
  ({ allowed: false, reason }) as CardAction;

export function buildMentorSessionCard(
  input: MentorCardInput,
  config: MentorshipConfig,
  now: Date,
): MentorSessionCard {
  const t = now.getTime();
  const start = input.start.getTime();
  const end = input.end.getTime();
  const changesCloseAt = new Date(start - config.noticeHours * 60 * MIN_MS);
  const joinOpensAt = new Date(start - config.joinOpenMinutes * MIN_MS);
  const student = input.studentName ?? 'The student';
  const base = {
    changesCloseAt,
    joinOpensAt,
    joinClosesAt: input.end,
    reschedule: null,
    cancellation: null,
  };
  const notHeld = { state: 'NOT_HELD' as RecordingState, url: null };
  const noRequest = blocked('NO_PENDING_REQUEST');
  const closed = (reason: Reason) => ({
    join: blocked(reason),
    cancel: blocked(reason),
    acceptReschedule: blocked(reason),
    declineReschedule: blocked(reason),
    viewRecording: { ...blocked(reason), url: null },
    giveFeedback: blocked(reason),
  });

  /* Cancelled */
  if (input.status === 'cancelled' || input.lifecycleState === 'CANCELLED') {
    const raw = input.cancellation.cancelledBy;
    const by: 'you' | 'student' | 'ops' =
      raw === 'mentor' ? 'you' : raw === 'student' ? 'student' : 'ops';
    const byName =
      by === 'student'
        ? input.studentName
        : by === 'ops'
          ? 'the Zuvy team'
          : null;
    const when = formatDay(input.cancellation.at ?? now);
    const why = input.cancellation.reason
      ? `: "${input.cancellation.reason}"`
      : '';
    const message =
      by === 'you'
        ? `You cancelled on ${when}${why}.${input.countsTowardCredits ? ` ${student} got the credit back.` : ''}`
        : `Cancelled by ${byName ?? 'the student'} on ${when}${why}.`;
    return {
      ...base,
      displayState: 'CANCELLED',
      actions: closed('CANCELLED'),
      message,
      cancellation: {
        by,
        byName,
        reason: input.cancellation.reason,
        at: input.cancellation.at,
      },
      recording: notHeld,
    };
  }

  /* Missed */
  if (input.lifecycleState === 'MISSED') {
    const outcome = input.attendance?.outcome;
    // Made before credits_counted_from: no credit was used or returned.
    const counted = input.countsTowardCredits;
    const message =
      outcome === 'STUDENT_NO_SHOW'
        ? `${student} didn't join.${counted ? ' The session used their credit.' : ''}`
        : outcome === 'MENTOR_NO_SHOW'
          ? counted
            ? `You didn't join, so ${student}'s credit was returned.`
            : "You didn't join this session."
          : counted && input.attendance?.creditRefunded
            ? `Nobody joined, so ${student}'s credit was returned.`
            : 'Nobody joined this session.';
    return {
      ...base,
      displayState: 'MISSED',
      actions: closed('MISSED'),
      message,
      recording: notHeld,
    };
  }

  /* Completed (or past its end while the lifecycle job catches up) */
  if (input.lifecycleState === 'COMPLETED' || t >= end) {
    const recording = recordingState(
      { recording: input.recording, end: input.end } as any,
      now,
    );
    return {
      ...base,
      displayState: 'COMPLETED',
      actions: {
        join: blocked('SESSION_ENDED'),
        cancel: blocked('SESSION_ENDED'),
        acceptReschedule: blocked('SESSION_ENDED'),
        declineReschedule: blocked('SESSION_ENDED'),
        viewRecording:
          recording.state === 'READY'
            ? { ...allowed(), url: recording.url }
            : {
                ...blocked(
                  recording.state === 'PROCESSING'
                    ? 'RECORDING_PROCESSING'
                    : 'NO_RECORDING',
                ),
                url: null,
              },
        giveFeedback: input.feedback.submitted
          ? blocked('FEEDBACK_GIVEN')
          : input.feedback.locked
            ? blocked('FEEDBACK_CLOSED')
            : allowed(),
      },
      message:
        recording.state === 'READY'
          ? 'The recording is ready.'
          : recording.state === 'PROCESSING'
            ? 'Recording is being processed. Check back later.'
            : `No recording is available for this session. Email ${SUPPORT_EMAIL} if you need it.`,
      recording,
    };
  }

  const joinOpen = t >= joinOpensAt.getTime();
  const join = !joinOpen
    ? blocked('JOIN_NOT_OPEN')
    : input.hasMeeting
      ? allowed()
      : blocked('NO_MEETING_LINK');
  const notEnded = { ...blocked('SESSION_NOT_ENDED'), url: null };
  const notYet = { state: 'NOT_YET' as RecordingState, url: null };
  const changesOpen = t <= changesCloseAt.getTime();
  const pending = input.reschedule.status === 'pending';

  /* Live */
  if (input.lifecycleState === 'IN_PROGRESS' || t >= start) {
    return {
      ...base,
      displayState: 'IN_PROGRESS',
      actions: {
        join,
        cancel: blocked('TOO_LATE_TO_CHANGE'),
        acceptReschedule: pending
          ? blocked('REPLY_DEADLINE_PASSED')
          : noRequest,
        declineReschedule: pending
          ? blocked('REPLY_DEADLINE_PASSED')
          : noRequest,
        viewRecording: notEnded,
        giveFeedback: blocked('SESSION_NOT_ENDED'),
      },
      message: 'The session has started.',
      recording: notYet,
    };
  }

  /* Action needed: a student's reschedule request waits for the mentor */
  if (pending) {
    // Reply before the earlier of the original and proposed start; the
    // request lapses then (expireRescheduleRequests).
    const proposedStart = input.reschedule.proposedStart;
    const replyBy =
      proposedStart && proposedStart.getTime() < start
        ? proposedStart
        : input.start;
    const canReply = t < replyBy.getTime();
    const why = input.reschedule.reason
      ? ` ("${input.reschedule.reason}")`
      : '';
    return {
      ...base,
      displayState: 'ACTION_NEEDED',
      actions: {
        join,
        cancel: blocked('RESCHEDULE_PENDING'),
        acceptReschedule: canReply
          ? allowed()
          : blocked('REPLY_DEADLINE_PASSED'),
        declineReschedule: canReply
          ? allowed()
          : blocked('REPLY_DEADLINE_PASSED'),
        viewRecording: notEnded,
        giveFeedback: blocked('SESSION_NOT_ENDED'),
      },
      message: `${student} asked to move this session to ${proposedStart ? formatDayTime(proposedStart) : 'another time'}${why}. Reply by ${formatDayTime(replyBy)}, or the session stays as booked.`,
      reschedule: {
        proposedStart,
        proposedEnd: input.reschedule.proposedEnd,
        replyBy,
        reason: input.reschedule.reason,
      },
      recording: notYet,
    };
  }

  const cancel = changesOpen ? allowed() : blocked('TOO_LATE_TO_CHANGE');
  const tooLate = `This session starts in under ${config.noticeHours} hours. Email ${SUPPORT_EMAIL} to cancel it.`;

  /* Starting soon: the join window is open */
  if (joinOpen) {
    const minutes = Math.max(1, Math.ceil((start - t) / MIN_MS));
    return {
      ...base,
      displayState: 'STARTING_SOON',
      actions: {
        join,
        cancel,
        acceptReschedule: noRequest,
        declineReschedule: noRequest,
        viewRecording: notEnded,
        giveFeedback: blocked('SESSION_NOT_ENDED'),
      },
      message: `Starts in ${minutes} min.`,
      recording: notYet,
    };
  }

  /* Upcoming */
  return {
    ...base,
    displayState: 'UPCOMING',
    actions: {
      join,
      cancel,
      acceptReschedule: noRequest,
      declineReschedule: noRequest,
      viewRecording: notEnded,
      giveFeedback: blocked('SESSION_NOT_ENDED'),
    },
    message: changesOpen
      ? `You can cancel until ${formatDayTime(changesCloseAt)}, ${config.noticeHours} hours before the session.${input.countsTowardCredits ? ' The student gets the credit back.' : ''}`
      : tooLate,
    recording: notYet,
  };
}
