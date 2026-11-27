import { DEFAULT_MENTORSHIP_CONFIG } from '../mentorship-rules/mentorship-config.service';
import { MentorCardInput, buildMentorSessionCard } from './mentor-session-card';

const config = { ...DEFAULT_MENTORSHIP_CONFIG }; // 72 h notice, join 10 min before
const MIN = 60_000;
const HOUR = 60 * MIN;
const ist = (isoLocal: string) => new Date(`${isoLocal}+05:30`);

// Riya Sharma's session with this mentor: Fri, 6 Nov 2026, 6:00-6:45 PM.
const START = ist('2026-11-06T18:00:00');
const END = ist('2026-11-06T18:45:00');
const at = (offsetMs: number) => new Date(START.getTime() + offsetMs);

function session(over: Partial<MentorCardInput> = {}): MentorCardInput {
  return {
    status: 'confirmed',
    lifecycleState: 'SCHEDULED',
    start: START,
    end: END,
    hasMeeting: true,
    studentName: 'Riya Sharma',
    reschedule: {
      status: null,
      proposedStart: null,
      proposedEnd: null,
      reason: null,
    },
    cancellation: { cancelledBy: null, reason: null, at: null },
    attendance: null,
    recording: null,
    feedback: { submitted: false, locked: false },
    countsTowardCredits: true,
    ...over,
  };
}
const card = (input: MentorCardInput, now: Date) =>
  buildMentorSessionCard(input, config, now);

describe('mentor session card (MT1)', () => {
  it('72+ hours before: Upcoming, cancel on, join not yet', () => {
    const c = card(session(), at(-72 * HOUR));
    expect(c.displayState).toBe('UPCOMING');
    expect(c.actions.cancel).toEqual({ allowed: true, reason: null });
    expect(c.actions.join).toEqual({ allowed: false, reason: 'JOIN_NOT_OPEN' });
    expect(c.actions.acceptReschedule.reason).toBe('NO_PENDING_REQUEST');
    expect(c.message).toBe(
      'You can cancel until Tue, 3 Nov at 6:00 PM, 72 hours before the session. The student gets the credit back.',
    );
  });

  it('a minute inside 72 hours: no cancel, the email-Ops message', () => {
    const c = card(session(), at(-72 * HOUR + MIN));
    expect(c.actions.cancel).toEqual({
      allowed: false,
      reason: 'TOO_LATE_TO_CHANGE',
    });
    expect(c.message).toBe(
      'This session starts in under 72 hours. Email team@zuvy.org to cancel it.',
    );
  });

  it('join opens exactly 10 minutes before and stays open until the end', () => {
    expect(card(session(), at(-10 * MIN - 1)).actions.join.allowed).toBe(false);
    const soon = card(session(), at(-10 * MIN));
    expect(soon.displayState).toBe('STARTING_SOON');
    expect(soon.actions.join.allowed).toBe(true);
    expect(soon.message).toBe('Starts in 10 min.');
    const live = card(session({ lifecycleState: 'IN_PROGRESS' }), at(30 * MIN));
    expect(live.displayState).toBe('IN_PROGRESS');
    expect(live.actions.join.allowed).toBe(true);
    expect(live.actions.cancel.allowed).toBe(false);
  });

  it('no meeting set up: join says so', () => {
    const c = card(session({ hasMeeting: false }), at(-5 * MIN));
    expect(c.actions.join).toEqual({
      allowed: false,
      reason: 'NO_MEETING_LINK',
    });
  });

  it('after the end: Completed, no actions that change it', () => {
    const c = card(session(), END);
    expect(c.displayState).toBe('COMPLETED');
    expect(c.actions.join.reason).toBe('SESSION_ENDED');
    expect(c.actions.cancel.reason).toBe('SESSION_ENDED');
    expect(c.actions.giveFeedback.allowed).toBe(true);
  });

  it('Action needed: the request, its reason and the reply deadline', () => {
    const proposedStart = ist('2026-11-11T17:00:00');
    const c = card(
      session({
        lifecycleState: 'RESCHEDULE_PENDING',
        reschedule: {
          status: 'pending',
          proposedStart,
          proposedEnd: ist('2026-11-11T17:45:00'),
          reason: 'Exam that day',
        },
      }),
      at(-100 * HOUR),
    );
    expect(c.displayState).toBe('ACTION_NEEDED');
    expect(c.actions.acceptReschedule.allowed).toBe(true);
    expect(c.actions.declineReschedule.allowed).toBe(true);
    expect(c.actions.cancel.reason).toBe('RESCHEDULE_PENDING');
    expect(c.reschedule).toEqual({
      proposedStart,
      proposedEnd: ist('2026-11-11T17:45:00'),
      replyBy: START,
      reason: 'Exam that day',
    });
    expect(c.message).toBe(
      'Riya Sharma asked to move this session to Wed, 11 Nov at 5:00 PM ("Exam that day"). Reply by Fri, 6 Nov at 6:00 PM, or the session stays as booked.',
    );
  });

  it('Action needed with an earlier proposed time: reply before that one', () => {
    const proposedStart = ist('2026-11-04T17:00:00');
    const c = card(
      session({
        reschedule: {
          status: 'pending',
          proposedStart,
          proposedEnd: null,
          reason: null,
        },
      }),
      ist('2026-11-04T17:00:00'),
    );
    expect(c.reschedule?.replyBy).toEqual(proposedStart);
    expect(c.actions.acceptReschedule.reason).toBe('REPLY_DEADLINE_PASSED');
  });

  it('cancelled by the mentor, by the student, by Ops', () => {
    const you = card(
      session({
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'mentor',
          reason: 'Unwell today',
          at: ist('2026-10-26T10:00:00'),
        },
      }),
      at(-200 * HOUR),
    );
    expect(you.displayState).toBe('CANCELLED');
    expect(you.message).toBe(
      'You cancelled on 26 Oct: "Unwell today". Riya Sharma got the credit back.',
    );
    expect(Object.values(you.actions).every((a) => !a.allowed)).toBe(true);

    const student = card(
      session({
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'student',
          reason: 'Clash',
          at: ist('2026-10-26T10:00:00'),
        },
      }),
      at(-200 * HOUR),
    );
    expect(student.cancellation?.by).toBe('student');
    expect(student.message).toBe(
      'Cancelled by Riya Sharma on 26 Oct: "Clash".',
    );

    const ops = card(
      session({
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'admin',
          reason: null,
          at: ist('2026-10-26T10:00:00'),
        },
      }),
      at(-200 * HOUR),
    );
    expect(ops.cancellation?.by).toBe('ops');
  });

  it('missed: who did not join', () => {
    const studentNoShow = card(
      session({
        lifecycleState: 'MISSED',
        attendance: { outcome: 'STUDENT_NO_SHOW', creditRefunded: false },
      }),
      at(2 * HOUR),
    );
    expect(studentNoShow.displayState).toBe('MISSED');
    expect(studentNoShow.message).toBe(
      "Riya Sharma didn't join. The session used their credit.",
    );
    const mentorNoShow = card(
      session({
        lifecycleState: 'MISSED',
        attendance: { outcome: 'MENTOR_NO_SHOW', creditRefunded: true },
      }),
      at(2 * HOUR),
    );
    expect(mentorNoShow.message).toBe(
      "You didn't join, so Riya Sharma's credit was returned.",
    );
  });

  it('feedback already given or closed', () => {
    expect(
      card(
        session({
          lifecycleState: 'COMPLETED',
          feedback: { submitted: true, locked: false },
        }),
        END,
      ).actions.giveFeedback.reason,
    ).toBe('FEEDBACK_GIVEN');
    expect(
      card(
        session({
          lifecycleState: 'COMPLETED',
          feedback: { submitted: false, locked: true },
        }),
        END,
      ).actions.giveFeedback.reason,
    ).toBe('FEEDBACK_CLOSED');
  });
});

describe('mentor card: a booking made before credits_counted_from', () => {
  // The student's credit was never used, so the card doesn't mention one.
  const old = (over: Partial<MentorCardInput> = {}) =>
    session({ countsTowardCredits: false, ...over });

  it('upcoming: no "The student gets the credit back"', () => {
    expect(card(old(), at(-100 * HOUR)).message).toBe(
      'You can cancel until Tue, 3 Nov at 6:00 PM, 72 hours before the session.',
    );
  });

  it('cancelled by you: no credit line', () => {
    const c = card(
      old({
        status: 'cancelled',
        cancellation: {
          cancelledBy: 'mentor',
          reason: 'Unwell today',
          at: ist('2026-10-26T10:00:00'),
        },
      }),
      at(-200 * HOUR),
    );
    expect(c.message).toBe('You cancelled on 26 Oct: "Unwell today".');
  });

  it('missed: no credit used or returned', () => {
    const missed = (outcome: string, creditRefunded = false) =>
      card(
        old({
          lifecycleState: 'MISSED',
          attendance: { outcome, creditRefunded },
        }),
        at(2 * HOUR),
      ).message;
    expect(missed('STUDENT_NO_SHOW')).toBe("Riya Sharma didn't join.");
    expect(missed('MENTOR_NO_SHOW', true)).toBe(
      "You didn't join this session.",
    );
    expect(missed('NOBODY_JOINED', true)).toBe('Nobody joined this session.');
  });

  it('a counted booking keeps the credit lines', () => {
    expect(card(session(), at(-100 * HOUR)).message).toBe(
      'You can cancel until Tue, 3 Nov at 6:00 PM, 72 hours before the session. The student gets the credit back.',
    );
    expect(
      card(
        session({
          lifecycleState: 'MISSED',
          attendance: { outcome: 'STUDENT_NO_SHOW', creditRefunded: false },
        }),
        at(2 * HOUR),
      ).message,
    ).toBe("Riya Sharma didn't join. The session used their credit.");
  });
});
