import { DEFAULT_MENTORSHIP_CONFIG } from '../mentorship-rules/mentorship-config.service';
import {
  SessionCardInput,
  buildSessionCard,
  formatDay,
  formatDayTime,
} from './session-card';

const config = { ...DEFAULT_MENTORSHIP_CONFIG }; // 72 h notice, join 10 min before
const MIN = 60_000;
const HOUR = 60 * MIN;
const ist = (isoLocal: string) => new Date(`${isoLocal}+05:30`);

// A session on Fri, 6 Nov 2026, 6:00-6:45 PM with mentor Arjun.
const START = ist('2026-11-06T18:00:00');
const END = ist('2026-11-06T18:45:00');
const canBook = { canBook: true, nextEligibleDate: null };

function session(over: Partial<SessionCardInput> = {}): SessionCardInput {
  return {
    bookingId: 4901,
    status: 'confirmed',
    lifecycleState: 'SCHEDULED',
    start: START,
    end: END,
    meetingLink: 'https://zoom.invalid/j/1',
    mentorName: 'Arjun Mehta',
    reschedule: {
      status: null,
      proposedStart: null,
      proposedEnd: null,
      acceptedCount: 0,
    },
    cancellation: { cancelledBy: null, reason: null, at: null },
    attendance: null,
    recording: null,
    feedback: { submitted: false, locked: false },
    countsTowardCredits: true,
    ...over,
  };
}
const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);
const card = (input: SessionCardInput, now: Date, credits = canBook) =>
  buildSessionCard(input, config, now, credits);

describe('session card: the states in the My Sessions design', () => {
  it('72+ hours before: Upcoming, reschedule and cancel open, join not yet', () => {
    const c = card(session(), at(-72 * HOUR));
    expect(c.displayState).toBe('UPCOMING');
    expect(c.actions.reschedule.allowed).toBe(true);
    expect(c.actions.cancel.allowed).toBe(true);
    expect(c.actions.join).toEqual({
      allowed: false,
      reason: 'JOIN_NOT_OPEN',
      url: null,
    });
    expect(c.changesCloseAt).toEqual(at(-72 * HOUR));
    expect(c.joinOpensAt).toEqual(at(-10 * MIN));
    expect(c.message).toBe(
      'Reschedule or cancel until Tue, 3 Nov at 6:00 PM. Join opens 10 min before start.',
    );
  });

  it('under 72 hours before: changes closed, with the R1 message', () => {
    const c = card(session(), at(-72 * HOUR + MIN));
    expect(c.displayState).toBe('UPCOMING');
    expect(c.actions.reschedule).toEqual({
      allowed: false,
      reason: 'TOO_LATE_TO_CHANGE',
    });
    expect(c.actions.cancel).toEqual({
      allowed: false,
      reason: 'TOO_LATE_TO_CHANGE',
    });
    expect(c.message).toBe(
      "Rescheduling and cancelling close 72 hours before the session. If you can't attend, email team@zuvy.org. If you miss it, you lose the credit.",
    );
  });

  it('join window (10 min before): Starting soon, join works', () => {
    expect(card(session(), at(-10 * MIN - 1)).displayState).toBe('UPCOMING');
    const c = card(session(), at(-8 * MIN));
    expect(c.displayState).toBe('STARTING_SOON');
    expect(c.actions.join).toEqual({
      allowed: true,
      reason: null,
      url: 'https://zoom.invalid/j/1',
    });
    expect(c.message).toBe(
      "Starts in 8 min. If you can't attend, email team@zuvy.org.",
    );
  });

  it('after the start: in progress, join still works until the end', () => {
    const c = card(session({ lifecycleState: 'IN_PROGRESS' }), at(5 * MIN));
    expect(c.displayState).toBe('IN_PROGRESS');
    expect(c.actions.join.allowed).toBe(true);
    expect(c.actions.cancel.allowed).toBe(false);
  });

  it('reschedule waiting for the mentor: reply deadline is the original start', () => {
    const proposedStart = ist('2026-11-11T17:00:00');
    const c = card(
      session({
        lifecycleState: 'RESCHEDULE_PENDING',
        reschedule: {
          status: 'pending',
          proposedStart,
          proposedEnd: ist('2026-11-11T17:45:00'),
          acceptedCount: 0,
        },
      }),
      at(-100 * HOUR),
    );
    expect(c.displayState).toBe('RESCHEDULE_REQUESTED');
    expect(c.actions.reschedule).toEqual({
      allowed: false,
      reason: 'RESCHEDULE_PENDING',
    });
    expect(c.actions.cancel).toEqual({
      allowed: false,
      reason: 'RESCHEDULE_PENDING',
    });
    expect(c.reschedule?.replyBy).toEqual(START);
    expect(c.reschedule?.proposedStart).toEqual(proposedStart);
    expect(c.message).toBe(
      "You asked to move this to Wed, 11 Nov at 5:00 PM. If Arjun Mehta doesn't reply by Fri, 6 Nov at 6:00 PM, your session stays as it is.",
    );
  });

  it('completed, recording ready: view recording and give feedback', () => {
    const c = card(
      session({
        lifecycleState: 'COMPLETED',
        recording: { status: 'COMPLETED', url: 'https://youtu.be/x' },
      }),
      at(2 * HOUR),
    );
    expect(c.displayState).toBe('COMPLETED');
    expect(c.recording).toEqual({ state: 'READY', url: 'https://youtu.be/x' });
    expect(c.actions.viewRecording).toEqual({
      allowed: true,
      reason: null,
      url: 'https://youtu.be/x',
    });
    expect(c.actions.giveFeedback.allowed).toBe(true);
  });

  it('completed, recording processing', () => {
    const uploading = card(
      session({
        lifecycleState: 'COMPLETED',
        recording: { status: 'DOWNLOADING', url: null },
      }),
      at(2 * HOUR),
    );
    expect(uploading.recording.state).toBe('PROCESSING');
    expect(uploading.actions.viewRecording.reason).toBe('RECORDING_PROCESSING');
    expect(uploading.message).toBe(
      'Recording is being processed. Check back later.',
    );
    // No recording row yet, shortly after the end: Zoom may still be on it.
    expect(
      card(session({ lifecycleState: 'COMPLETED' }), at(3 * HOUR)).recording
        .state,
    ).toBe('PROCESSING');
  });

  it('completed, no recording saved', () => {
    const late = card(session({ lifecycleState: 'COMPLETED' }), at(48 * HOUR));
    expect(late.recording.state).toBe('NONE');
    expect(late.message).toBe(
      'No recording is available for this session. Email team@zuvy.org if you need it.',
    );
    const failed = card(
      session({
        lifecycleState: 'COMPLETED',
        recording: { status: 'PERMANENT_FAILED', url: null },
      }),
      at(2 * HOUR),
    );
    expect(failed.recording.state).toBe('NONE');
  });

  it('feedback already given, or closed', () => {
    const given = card(
      session({
        lifecycleState: 'COMPLETED',
        feedback: { submitted: true, locked: false },
      }),
      at(2 * HOUR),
    );
    expect(given.actions.giveFeedback).toEqual({
      allowed: false,
      reason: 'FEEDBACK_GIVEN',
    });
    const closed = card(
      session({
        lifecycleState: 'COMPLETED',
        feedback: { submitted: false, locked: true },
      }),
      at(2 * HOUR),
    );
    expect(closed.actions.giveFeedback).toEqual({
      allowed: false,
      reason: 'FEEDBACK_CLOSED',
    });
  });

  it('you cancelled: credit returned, no recording', () => {
    const c = card(
      session({
        status: 'cancelled',
        lifecycleState: 'CANCELLED',
        cancellation: {
          cancelledBy: 'student',
          reason: 'Exam clash',
          at: ist('2026-10-26T10:00:00'),
        },
      }),
      at(-200 * HOUR),
    );
    expect(c.displayState).toBe('CANCELLED');
    expect(c.message).toBe(
      'Cancelled by you on 26 Oct. Your credit was returned.',
    );
    expect(c.cancellation).toMatchObject({ by: 'you', creditReturned: true });
    expect(c.recording.state).toBe('NOT_HELD');
    expect(c.usesCredit).toBe(false);
    expect(Object.values(c.actions).every((a) => !a.allowed)).toBe(true);
  });

  it('mentor or Ops cancelled: shows who and why', () => {
    const byMentor = card(
      session({
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'mentor',
          reason: 'Unwell today',
          at: START,
        },
      }),
      at(-1 * HOUR),
    );
    expect(byMentor.message).toBe(
      'Cancelled by Arjun Mehta: "Unwell today". Your credit was returned, so you can book again now.',
    );
    expect(byMentor.cancellation).toMatchObject({
      by: 'mentor',
      byName: 'Arjun Mehta',
      reason: 'Unwell today',
    });

    const byOps = card(
      session({
        status: 'cancelled',
        cancellation: { cancelledBy: 'admin', reason: null, at: START },
      }),
      at(-1 * HOUR),
      { canBook: false, nextEligibleDate: null },
    );
    expect(byOps.cancellation?.by).toBe('ops');
    expect(byOps.message).toBe(
      'Cancelled by the Zuvy team. Your credit was returned.',
    );
  });

  it('you missed the session: the credit is used, next booking date', () => {
    const c = card(session({ lifecycleState: 'MISSED' }), at(2 * HOUR), {
      canBook: false,
      nextEligibleDate: ist('2026-10-29T18:00:00'),
    });
    expect(c.displayState).toBe('MISSED');
    expect(c.usesCredit).toBe(true);
    expect(c.message).toBe(
      "You didn't join, so this session used 1 credit. Your next booking opens on 29 Oct.",
    );
    expect(c.recording.state).toBe('NOT_HELD');
  });

  it('mentor no-show: the credit comes back', () => {
    const c = card(
      session({
        lifecycleState: 'MISSED',
        attendance: { outcome: 'MENTOR_NO_SHOW', creditRefunded: true },
      }),
      at(2 * HOUR),
    );
    expect(c.usesCredit).toBe(false);
    expect(c.message).toBe(
      "Arjun Mehta didn't join, so your credit was returned.",
    );
  });

  it('follows the configured notice and join window', () => {
    const c = buildSessionCard(
      session(),
      { ...config, noticeHours: 24, joinOpenMinutes: 15 },
      at(-30 * HOUR),
      canBook,
    );
    expect(c.actions.cancel.allowed).toBe(true);
    expect(c.joinOpensAt).toEqual(at(-15 * MIN));
    expect(card(session(), at(-30 * HOUR)).actions.cancel.allowed).toBe(false);
  });
});

describe('reschedule to an earlier slot', () => {
  it('the reply deadline is the proposed start when it comes first', () => {
    const proposedStart = ist('2026-11-04T17:00:00'); // before Fri 6 Nov
    const c = card(
      session({
        lifecycleState: 'RESCHEDULE_PENDING',
        reschedule: {
          status: 'pending',
          proposedStart,
          proposedEnd: ist('2026-11-04T17:45:00'),
          acceptedCount: 0,
        },
      }),
      at(-100 * HOUR),
    );
    expect(c.reschedule?.replyBy).toEqual(proposedStart);
    expect(c.message).toBe(
      "You asked to move this to Wed, 4 Nov at 5:00 PM. If Arjun Mehta doesn't reply by Wed, 4 Nov at 5:00 PM, your session stays as it is.",
    );
  });
});

describe('after a reschedule request (ST4)', () => {
  const answered = (status: string, acceptedCount = 0) =>
    session({
      reschedule: {
        status,
        proposedStart: null,
        proposedEnd: null,
        acceptedCount,
      },
    });

  it('accepted: says where it moved, and the booking can not be moved again', () => {
    const c = card(answered('accepted', 1), at(-100 * HOUR), {
      canBook: false,
      nextEligibleDate: ist('2026-11-20T18:00:00'),
    });
    expect(c.rescheduleOutcome).toEqual({
      status: 'accepted',
      message:
        'Arjun Mehta accepted. Your session moved to Fri, 6 Nov at 6:00 PM. Your next booking opens on 20 Nov.',
    });
    expect(c.actions.reschedule).toEqual({
      allowed: false,
      reason: 'RESCHEDULE_LIMIT',
    });
    expect(c.actions.cancel.allowed).toBe(true);
  });

  it('declined: the session stays, cancel is still open', () => {
    const c = card(answered('declined'), at(-100 * HOUR));
    expect(c.rescheduleOutcome?.message).toBe(
      "Arjun Mehta can't make that time. Your session stays on Fri, 6 Nov at 6:00 PM. You can still cancel until Tue, 3 Nov at 6:00 PM, and your credit comes back.",
    );
    expect(c.actions.reschedule.allowed).toBe(true);
  });

  it('no reply: the request expired, the session stays', () => {
    const c = card(answered('expired'), at(-5 * MIN));
    expect(c.rescheduleOutcome?.message).toBe(
      "Arjun Mehta didn't reply in time, so your request has expired. Your session stays on Fri, 6 Nov at 6:00 PM.",
    );
  });

  it('no request: no outcome', () => {
    expect(card(session(), at(-100 * HOUR)).rescheduleOutcome).toBeNull();
  });
});

describe('date formats on the cards (India time)', () => {
  it('formats like the design', () => {
    expect(formatDayTime(ist('2026-11-05T18:00:00'))).toBe(
      'Thu, 5 Nov at 6:00 PM',
    );
    expect(formatDay(ist('2026-10-26T10:00:00'))).toBe('26 Oct');
  });
});

describe('cancelled by a mentor with no name', () => {
  it('says "your mentor", not "null"', () => {
    const c = card(
      session({
        mentorName: null,
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'mentor',
          reason: 'Unwell today',
          at: START,
        },
      }),
      at(-1 * HOUR),
    );
    expect(c.message).toBe(
      'Cancelled by your mentor: "Unwell today". Your credit was returned, so you can book again now.',
    );
  });
});

describe('a booking made before credits_counted_from', () => {
  // It never used a credit, so the card doesn't say it did or that one
  // comes back (the credit count leaves it out the same way).
  const old = (over: Partial<SessionCardInput> = {}) =>
    session({ countsTowardCredits: false, ...over });

  it('upcoming: uses no credit; inside the notice there is no "lose the credit" line', () => {
    expect(card(old(), at(-100 * HOUR)).usesCredit).toBe(false);
    const c = card(old(), at(-24 * HOUR));
    expect(c.usesCredit).toBe(false);
    expect(c.message).toBe(
      "Rescheduling and cancelling close 72 hours before the session. If you can't attend, email team@zuvy.org.",
    );
  });

  it('live, starting soon and reschedule requested: uses no credit', () => {
    expect(card(old(), at(5 * MIN)).usesCredit).toBe(false);
    expect(card(old(), at(-5 * MIN)).usesCredit).toBe(false);
    expect(
      card(
        old({
          lifecycleState: 'RESCHEDULE_PENDING',
          reschedule: {
            status: 'pending',
            proposedStart: ist('2026-11-11T17:00:00'),
            proposedEnd: ist('2026-11-11T17:45:00'),
            acceptedCount: 0,
          },
        }),
        at(-100 * HOUR),
      ).usesCredit,
    ).toBe(false);
  });

  it('cancelled: no credit was returned', () => {
    const byYou = card(
      old({
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'student',
          reason: 'Exam clash',
          at: ist('2026-10-26T10:00:00'),
        },
      }),
      at(-200 * HOUR),
    );
    expect(byYou.message).toBe('Cancelled by you on 26 Oct.');
    expect(byYou.cancellation?.creditReturned).toBe(false);

    const byMentor = card(
      old({
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'mentor',
          reason: 'Unwell today',
          at: START,
        },
      }),
      at(-1 * HOUR),
    );
    expect(byMentor.message).toBe('Cancelled by Arjun Mehta: "Unwell today".');
  });

  it('missed: no credit used or returned', () => {
    const missed = (outcome: string, creditRefunded = false) =>
      card(
        old({
          lifecycleState: 'MISSED',
          attendance: { outcome, creditRefunded },
        }),
        at(2 * HOUR),
      );
    expect(missed('STUDENT_NO_SHOW').usesCredit).toBe(false);
    expect(missed('STUDENT_NO_SHOW').message).toBe(
      "You didn't join this session.",
    );
    expect(missed('MENTOR_NO_SHOW', true).message).toBe(
      "Arjun Mehta didn't join this session.",
    );
    expect(missed('NOBODY_JOINED', true).message).toBe(
      'Nobody joined this session.',
    );
  });

  it('completed: uses no credit', () => {
    const c = card(old({ lifecycleState: 'COMPLETED' }), at(2 * HOUR));
    expect(c.displayState).toBe('COMPLETED');
    expect(c.usesCredit).toBe(false);
  });

  it('declined reschedule: no "your credit comes back"', () => {
    const c = card(
      old({
        reschedule: {
          status: 'declined',
          proposedStart: null,
          proposedEnd: null,
          acceptedCount: 0,
        },
      }),
      at(-100 * HOUR),
    );
    expect(c.rescheduleOutcome?.message).toBe(
      "Arjun Mehta can't make that time. Your session stays on Fri, 6 Nov at 6:00 PM. You can still cancel until Tue, 3 Nov at 6:00 PM.",
    );
  });
});
