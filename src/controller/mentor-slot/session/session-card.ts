/**
 * What a student's session card shows (My Sessions, ST3/ST4): its state,
 * which buttons work and why not, the line of text under it, the reschedule
 * request, who cancelled, and the recording. A plain function of the
 * booking and the server's clock, so every state in the design can be
 * tested a minute either side of its boundary.
 *
 * The times come from the mentorship config: changes close `noticeHours`
 * before the start, the join button opens `joinOpenMinutes` before it.
 */
import { MentorshipConfig } from '../mentorship-rules/mentorship-config.service';

const MIN_MS = 60_000;
const SUPPORT_EMAIL = 'team@zuvy.org';

export type SessionDisplayState =
  | 'UPCOMING'
  | 'STARTING_SOON'
  | 'IN_PROGRESS'
  | 'RESCHEDULE_REQUESTED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'MISSED';

/** Why a button doesn't work (the screen can show its own text for each). */
export type ActionBlockReason =
  | 'TOO_LATE_TO_CHANGE'
  | 'RESCHEDULE_PENDING'
  | 'RESCHEDULE_LIMIT'
  | 'JOIN_NOT_OPEN'
  | 'SESSION_ENDED'
  | 'SESSION_NOT_ENDED'
  | 'CANCELLED'
  | 'MISSED'
  | 'NO_MEETING_LINK'
  | 'RECORDING_PROCESSING'
  | 'NO_RECORDING'
  | 'FEEDBACK_GIVEN'
  | 'FEEDBACK_CLOSED';

export interface CardAction {
  allowed: boolean;
  reason: ActionBlockReason | null;
}

export type RecordingState =
  | 'NOT_YET' // the session hasn't ended
  | 'PROCESSING' // Zoom or our upload is still working on it
  | 'READY'
  | 'NONE' // the session took place but no recording was saved
  | 'NOT_HELD'; // cancelled or missed: there is nothing to record

export interface SessionCardInput {
  bookingId: number;
  status: string; // 'confirmed' | 'cancelled' | ...
  lifecycleState: string | null; // SCHEDULED, IN_PROGRESS, COMPLETED, MISSED, RESCHEDULE_PENDING, CANCELLED
  start: Date;
  end: Date;
  meetingLink: string | null;
  mentorName: string | null;
  reschedule: {
    // 'pending' | 'accepted' | 'declined' | 'expired' (kept after the answer)
    status: string | null;
    proposedStart: Date | null;
    proposedEnd: Date | null;
    /** Reschedules the mentor has accepted for this booking. */
    acceptedCount: number;
  };
  cancellation: {
    cancelledBy: string | null; // 'student' | 'mentor' | 'admin' | 'ops'
    reason: string | null;
    at: Date | null;
  };
  attendance: { outcome: string | null; creditRefunded: boolean } | null;
  recording: {
    // Best recording for the booking, if any row exists.
    status: string | null;
    url: string | null;
  } | null;
  feedback: { submitted: boolean; locked: boolean };
  /**
   * Whether credits are counted for this booking (bookingCountsTowardCredits).
   * False for one made before credits_counted_from: it never used a credit,
   * so the card doesn't say it did, or that one comes back.
   */
  countsTowardCredits: boolean;
}

/** The student's credits, for the missed-session line. */
export interface CardCredits {
  canBook: boolean;
  nextEligibleDate: Date | null;
}

export interface SessionCard {
  displayState: SessionDisplayState;
  /** Reschedule and cancel close at this time. */
  changesCloseAt: Date;
  /** The join button opens at this time. */
  joinOpensAt: Date;
  joinClosesAt: Date;
  actions: {
    join: CardAction & { url: string | null };
    reschedule: CardAction;
    cancel: CardAction;
    viewRecording: CardAction & { url: string | null };
    giveFeedback: CardAction;
  };
  /** The line under the session, as the design words it. */
  message: string;
  reschedule: {
    proposedStart: Date | null;
    proposedEnd: Date | null;
    /** When the mentor must reply by; after it the request lapses. */
    replyBy: Date;
  } | null;
  cancellation: {
    by: 'you' | 'mentor' | 'ops';
    byName: string | null;
    reason: string | null;
    at: Date | null;
    creditReturned: boolean;
  } | null;
  recording: { state: RecordingState; url: string | null };
  /** Whether this session uses one of the student's credits. */
  usesCredit: boolean;
  /**
   * How the student's last reschedule request ended, for the note on an
   * upcoming session ("Arjun accepted. Your session moved to …"). Null when
   * there was none, or once the session is over or cancelled.
   */
  rescheduleOutcome: {
    status: 'accepted' | 'declined' | 'expired';
    message: string;
  } | null;
}

const allowed = (): CardAction => ({ allowed: true, reason: null });
const blocked = (reason: ActionBlockReason): CardAction => ({
  allowed: false,
  reason,
});

// Recording statuses the upload worker has finished with for good.
const RECORDING_FAILED = new Set(['PERMANENT_FAILED']);
// How long after the end a session with no recording row yet still counts
// as "processing": Zoom can take a while to hand the recording over (the
// licence stays with the host for an hour for that reason).
const RECORDING_GRACE_MS = 24 * 60 * MIN_MS;

export function buildSessionCard(
  input: SessionCardInput,
  config: MentorshipConfig,
  now: Date,
  credits: CardCredits,
): SessionCard {
  const t = now.getTime();
  const start = input.start.getTime();
  const end = input.end.getTime();
  const counted = input.countsTowardCredits;
  const changesCloseAt = new Date(start - config.noticeHours * 60 * MIN_MS);
  const joinOpensAt = new Date(start - config.joinOpenMinutes * MIN_MS);
  const base = {
    changesCloseAt,
    joinOpensAt,
    joinClosesAt: input.end,
    reschedule: null,
    cancellation: null,
    rescheduleOutcome: null,
  };
  const noRecording = { state: 'NOT_HELD' as RecordingState, url: null };
  const closed = (reason: ActionBlockReason) => ({
    join: { ...blocked(reason), url: null },
    reschedule: blocked(reason),
    cancel: blocked(reason),
    viewRecording: { ...blocked(reason), url: null },
    giveFeedback: blocked(reason),
  });

  /* Cancelled */
  if (input.status === 'cancelled' || input.lifecycleState === 'CANCELLED') {
    const by = cancelledBy(input.cancellation.cancelledBy);
    const byName =
      by === 'mentor'
        ? input.mentorName
        : by === 'ops'
          ? 'the Zuvy team'
          : null;
    const returned = counted
      ? ` Your credit was returned${by !== 'you' && credits.canBook ? ', so you can book again now' : ''}.`
      : '';
    const message =
      by === 'you'
        ? `Cancelled by you on ${formatDay(input.cancellation.at ?? now)}.${returned}`
        : `Cancelled by ${byName ?? 'your mentor'}${input.cancellation.reason ? `: "${input.cancellation.reason}"` : ''}.${returned}`;
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
        creditReturned: counted,
      },
      recording: noRecording,
      usesCredit: false,
    };
  }

  const refunded = input.attendance?.creditRefunded === true;

  /* Missed */
  if (input.lifecycleState === 'MISSED') {
    let message: string;
    if (!counted) {
      // Made before credits_counted_from: no credit was used or returned.
      message =
        input.attendance?.outcome === 'MENTOR_NO_SHOW'
          ? `${input.mentorName ?? 'Your mentor'} didn't join this session.`
          : input.attendance?.outcome === 'NOBODY_JOINED'
            ? 'Nobody joined this session.'
            : "You didn't join this session.";
    } else if (refunded) {
      message =
        input.attendance?.outcome === 'MENTOR_NO_SHOW'
          ? `${input.mentorName ?? 'Your mentor'} didn't join, so your credit was returned.`
          : 'Nobody joined, so your credit was returned.';
    } else {
      message = "You didn't join, so this session used 1 credit.";
      if (credits.nextEligibleDate && !credits.canBook) {
        message += ` Your next booking opens on ${formatDay(credits.nextEligibleDate)}.`;
      }
    }
    return {
      ...base,
      displayState: 'MISSED',
      actions: closed('MISSED'),
      message,
      recording: noRecording,
      usesCredit: counted && !refunded,
    };
  }

  /* Completed (or past its end while the lifecycle job catches up) */
  if (input.lifecycleState === 'COMPLETED' || t >= end) {
    const recording = recordingState(input, now);
    const feedback = input.feedback.submitted
      ? blocked('FEEDBACK_GIVEN')
      : input.feedback.locked
        ? blocked('FEEDBACK_CLOSED')
        : allowed();
    const message =
      recording.state === 'READY'
        ? 'The recording is ready.'
        : recording.state === 'PROCESSING'
          ? 'Recording is being processed. Check back later.'
          : `No recording is available for this session. Email ${SUPPORT_EMAIL} if you need it.`;
    return {
      ...base,
      displayState: 'COMPLETED',
      actions: {
        join: { ...blocked('SESSION_ENDED'), url: null },
        reschedule: blocked('SESSION_ENDED'),
        cancel: blocked('SESSION_ENDED'),
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
        giveFeedback: feedback,
      },
      message,
      recording,
      usesCredit: counted && !refunded,
    };
  }

  /* Live */
  const joinOpen = t >= joinOpensAt.getTime();
  const join = joinOpen
    ? input.meetingLink
      ? { ...allowed(), url: input.meetingLink }
      : { ...blocked('NO_MEETING_LINK'), url: null }
    : { ...blocked('JOIN_NOT_OPEN'), url: null };
  const notEnded = { ...blocked('SESSION_NOT_ENDED'), url: null };

  if (input.lifecycleState === 'IN_PROGRESS' || t >= start) {
    return {
      ...base,
      displayState: 'IN_PROGRESS',
      actions: {
        join,
        reschedule: blocked('TOO_LATE_TO_CHANGE'),
        cancel: blocked('TOO_LATE_TO_CHANGE'),
        viewRecording: notEnded,
        giveFeedback: blocked('SESSION_NOT_ENDED'),
      },
      message: `The session has started. If you can't attend, email ${SUPPORT_EMAIL}.`,
      recording: { state: 'NOT_YET', url: null },
      usesCredit: counted,
    };
  }

  // Open until exactly `noticeHours` before, like booking (exactly the
  // notice is allowed).
  const changesOpen = t <= changesCloseAt.getTime();

  /* Reschedule waiting for the mentor */
  if (input.reschedule.status === 'pending') {
    // The request lapses at the earlier of the original start and the
    // proposed start (after either it can't be accepted), so that is the
    // mentor's reply deadline.
    const replyBy =
      input.reschedule.proposedStart &&
      input.reschedule.proposedStart.getTime() < input.start.getTime()
        ? input.reschedule.proposedStart
        : input.start;
    const proposed = input.reschedule.proposedStart
      ? formatDayTime(input.reschedule.proposedStart)
      : 'another time';
    return {
      ...base,
      displayState: 'RESCHEDULE_REQUESTED',
      actions: {
        join,
        reschedule: blocked('RESCHEDULE_PENDING'),
        // Student and mentor can't cancel while a request waits (decision,
        // 17 Nov 2026); Ops can.
        cancel: blocked('RESCHEDULE_PENDING'),
        viewRecording: notEnded,
        giveFeedback: blocked('SESSION_NOT_ENDED'),
      },
      message: `You asked to move this to ${proposed}. If ${input.mentorName ?? 'your mentor'} doesn't reply by ${formatDayTime(replyBy)}, your session stays as it is.`,
      reschedule: {
        proposedStart: input.reschedule.proposedStart,
        proposedEnd: input.reschedule.proposedEnd,
        replyBy,
      },
      recording: { state: 'NOT_YET', url: null },
      usesCredit: counted,
    };
  }

  const outcome = rescheduleOutcome(
    input,
    changesOpen,
    changesCloseAt,
    credits,
  );
  const rescheduleAction = !changesOpen
    ? blocked('TOO_LATE_TO_CHANGE')
    : input.reschedule.acceptedCount >= config.maxAcceptedReschedules
      ? blocked('RESCHEDULE_LIMIT')
      : allowed();

  /* Starting soon: the join window is open */
  if (joinOpen) {
    const minutes = Math.max(1, Math.ceil((start - t) / MIN_MS));
    return {
      ...base,
      displayState: 'STARTING_SOON',
      actions: {
        join,
        reschedule: blocked('TOO_LATE_TO_CHANGE'),
        cancel: blocked('TOO_LATE_TO_CHANGE'),
        viewRecording: notEnded,
        giveFeedback: blocked('SESSION_NOT_ENDED'),
      },
      message: `Starts in ${minutes} min. If you can't attend, email ${SUPPORT_EMAIL}.`,
      recording: { state: 'NOT_YET', url: null },
      usesCredit: counted,
      rescheduleOutcome: outcome,
    };
  }

  /* Upcoming */
  return {
    ...base,
    displayState: 'UPCOMING',
    actions: {
      join,
      reschedule: rescheduleAction,
      cancel: changesOpen ? allowed() : blocked('TOO_LATE_TO_CHANGE'),
      viewRecording: notEnded,
      giveFeedback: blocked('SESSION_NOT_ENDED'),
    },
    message: changesOpen
      ? `Reschedule or cancel until ${formatDayTime(changesCloseAt)}. Join opens ${config.joinOpenMinutes} min before start.`
      : `Rescheduling and cancelling close ${config.noticeHours} hours before the session. If you can't attend, email ${SUPPORT_EMAIL}.${counted ? ' If you miss it, you lose the credit.' : ''}`,
    recording: { state: 'NOT_YET', url: null },
    usesCredit: counted,
    rescheduleOutcome: outcome,
  };
}

/** What the student sees after the mentor answers (or doesn't). */
function rescheduleOutcome(
  input: SessionCardInput,
  changesOpen: boolean,
  changesCloseAt: Date,
  credits: CardCredits,
): SessionCard['rescheduleOutcome'] {
  const mentor = input.mentorName ?? 'Your mentor';
  const when = formatDayTime(input.start);
  switch (input.reschedule.status) {
    case 'accepted':
      return {
        status: 'accepted',
        message: `${mentor} accepted. Your session moved to ${when}.${credits.nextEligibleDate ? ` Your next booking opens on ${formatDay(credits.nextEligibleDate)}.` : ''}`,
      };
    case 'declined':
      return {
        status: 'declined',
        message: `${mentor} can't make that time. Your session stays on ${when}.${changesOpen ? ` You can still cancel until ${formatDayTime(changesCloseAt)}${input.countsTowardCredits ? ', and your credit comes back' : ''}.` : ''}`,
      };
    case 'expired':
      return {
        status: 'expired',
        message: `${mentor} didn't reply in time, so your request has expired. Your session stays on ${when}.`,
      };
    default:
      return null;
  }
}

function cancelledBy(value: string | null): 'you' | 'mentor' | 'ops' {
  if (value === 'student') return 'you';
  if (value === 'mentor') return 'mentor';
  return 'ops';
}

export function recordingState(
  input: SessionCardInput,
  now: Date,
): { state: RecordingState; url: string | null } {
  const rec = input.recording;
  if (rec?.status === 'COMPLETED' && rec.url) {
    return { state: 'READY', url: rec.url };
  }
  if (rec && !RECORDING_FAILED.has(String(rec.status))) {
    return { state: 'PROCESSING', url: null };
  }
  if (!rec && now.getTime() - input.end.getTime() < RECORDING_GRACE_MS) {
    return { state: 'PROCESSING', url: null };
  }
  return { state: 'NONE', url: null };
}

/** "Thu, 5 Nov at 6:00 PM", India time. */
export function formatDayTime(date: Date): string {
  const day = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date
    .toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
    .toUpperCase();
  return `${day} at ${time}`;
}

/** "26 Oct", India time. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
  });
}
