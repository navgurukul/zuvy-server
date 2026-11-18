import {
  MIN_ATTENDED_SECONDS,
  NO_INSTANCE_GRACE_MS,
  attendedSecondsByRole,
  classifyAttendance,
  decideAttendance,
  lifecycleStateFor,
  noShowCreditRulesEnabled,
  outcomeRefundsCredit,
  runsInSessionWindow,
} from './mentor-attendance.util';

const MENTOR = 'Mentor@Example.org';
const T0 = new Date('2026-11-10T10:00:00.000Z').getTime();
const at = (sec: number) => new Date(T0 + sec * 1000).toISOString();
const row = (
  email: string | undefined,
  fromSec: number,
  toSec: number,
  name = 'x',
) =>
  ({
    id: '',
    name,
    user_email: email,
    join_time: at(fromSec),
    leave_time: at(toSec),
    duration: toSec - fromSec,
  }) as any;

const SLOT_END = new Date('2026-11-10T11:00:00.000Z');

describe('attendedSecondsByRole', () => {
  it('matches the mentor by email, case-insensitively', () => {
    const r = attendedSecondsByRole(
      [row('mentor@example.org', 0, 300)],
      MENTOR,
    );
    expect(r).toEqual({ mentorSeconds: 300, studentSeconds: 0 });
  });

  it('counts a guest with no email as the student', () => {
    const r = attendedSecondsByRole(
      [row(MENTOR, 0, 600), row(undefined, 30, 500, 'Guest')],
      MENTOR,
    );
    expect(r).toEqual({ mentorSeconds: 600, studentSeconds: 470 });
  });

  it('merges overlapping connections instead of double-counting', () => {
    const r = attendedSecondsByRole(
      [row('s@x.org', 0, 300), row('s@x.org', 100, 400)],
      MENTOR,
    );
    expect(r.studentSeconds).toBe(400);
  });

  it('ignores rows without join or leave times', () => {
    const r = attendedSecondsByRole(
      [{ ...row('s@x.org', 0, 300), leave_time: undefined }],
      MENTOR,
    );
    expect(r).toEqual({ mentorSeconds: 0, studentSeconds: 0 });
  });
});

describe('classifyAttendance', () => {
  it.each([
    [120, 120, 'BOTH_JOINED'],
    [120, 0, 'STUDENT_NO_SHOW'],
    [0, 120, 'MENTOR_NO_SHOW'],
    [0, 0, 'NOBODY_JOINED'],
  ])('mentor %ds, student %ds -> %s', (m, s, expected) => {
    expect(classifyAttendance(m, s)).toBe(expected);
  });

  it('needs at least MIN_ATTENDED_SECONDS to count as joined', () => {
    expect(
      classifyAttendance(MIN_ATTENDED_SECONDS, MIN_ATTENDED_SECONDS - 1),
    ).toBe('STUDENT_NO_SHOW');
    expect(classifyAttendance(MIN_ATTENDED_SECONDS, MIN_ATTENDED_SECONDS)).toBe(
      'BOTH_JOINED',
    );
  });
});

describe('decideAttendance', () => {
  const base = {
    mentorEmail: MENTOR,
    meetingState: { kind: 'not_running' } as const,
    slotEnd: SLOT_END,
    now: new Date(SLOT_END.getTime() + 20 * 60 * 1000),
  };

  // Real sessions from the dev database (Zoom report checked on 2026-11-12).
  it('real booking 179: both joined (mentor 182s, student 141s)', () => {
    const d = decideAttendance({
      ...base,
      instanceCount: 1,
      participants: [row(MENTOR, 0, 182), row('student@x.org', 20, 161)],
    });
    expect(d).toEqual({
      kind: 'record',
      outcome: 'BOTH_JOINED',
      mentorSeconds: 182,
      studentSeconds: 141,
    });
  });

  it('real booking 167: only the mentor joined, a student no-show (was recorded as COMPLETED)', () => {
    const d = decideAttendance({
      ...base,
      instanceCount: 1,
      participants: [row(MENTOR, 0, 571)],
    });
    expect(d).toMatchObject({ kind: 'record', outcome: 'STUDENT_NO_SHOW' });
  });

  it('records a mentor no-show when only the student joined', () => {
    const d = decideAttendance({
      ...base,
      instanceCount: 1,
      participants: [row(undefined, 0, 900, 'Student')],
    });
    expect(d).toMatchObject({ kind: 'record', outcome: 'MENTOR_NO_SHOW' });
  });

  it('retries when the meeting ran but the report is still empty', () => {
    const d = decideAttendance({ ...base, instanceCount: 1, participants: [] });
    expect(d.kind).toBe('retry');
  });

  it('retries when there is no past instance yet, within the grace period', () => {
    const d = decideAttendance({
      ...base,
      instanceCount: 0,
      participants: [],
      now: new Date(SLOT_END.getTime() + NO_INSTANCE_GRACE_MS - 1),
    });
    expect(d.kind).toBe('retry');
  });

  it('records nobody joined when the meeting never ran, after the grace period', () => {
    const d = decideAttendance({
      ...base,
      instanceCount: 0,
      participants: [],
      now: new Date(SLOT_END.getTime() + NO_INSTANCE_GRACE_MS),
    });
    expect(d).toEqual({
      kind: 'record',
      outcome: 'NOBODY_JOINED',
      mentorSeconds: 0,
      studentSeconds: 0,
    });
  });

  it('retries while the meeting is still running, even with no past instance', () => {
    const d = decideAttendance({
      ...base,
      instanceCount: 0,
      participants: [],
      meetingState: { kind: 'live' },
      now: new Date(SLOT_END.getTime() + NO_INSTANCE_GRACE_MS * 2),
    });
    expect(d).toEqual({
      kind: 'retry',
      reason: 'The meeting is still running.',
    });
  });

  // Seen live on dev bookings 182/174 ("Meeting does not exist") and 184 (the
  // host's Zoom licence had moved to another mentor): Zoom can't confirm the
  // meeting never ran, so this must not become a NOBODY_JOINED refund.
  it.each([
    'Failed to fetch Zoom meeting: Meeting does not exist: 85076806622.',
    'Failed to fetch Zoom meeting: Your user account is not allowed meeting hosting and scheduling capabilities.',
  ])(
    'retries instead of refunding when Zoom cannot confirm the meeting state (%s)',
    (error) => {
      const d = decideAttendance({
        ...base,
        instanceCount: 0,
        participants: [],
        meetingState: { kind: 'unknown', error },
        now: new Date(SLOT_END.getTime() + NO_INSTANCE_GRACE_MS * 2),
      });
      expect(d.kind).toBe('retry');
      expect((d as any).reason).toContain(error);
    },
  );

  it('retries rather than guessing when the mentor has no email to match', () => {
    const d = decideAttendance({
      ...base,
      mentorEmail: null,
      instanceCount: 1,
      participants: [row('someone@x.org', 0, 600)],
    });
    expect(d.kind).toBe('retry');
  });
});

describe('runsInSessionWindow', () => {
  const slotStart = new Date('2026-11-10T10:00:00.000Z');
  const slotEnd = new Date('2026-11-10T10:30:00.000Z');
  const runAt = (iso: string | null) => ({ startTime: iso, participants: [] });

  it('keeps a run that started at the slot time, or a little early or late', () => {
    const runs = [
      runAt('2026-11-10T10:00:00.000Z'),
      runAt('2026-11-10T09:05:00.000Z'), // 55 min early
      runAt('2026-11-10T10:40:00.000Z'), // 10 min after the slot ended
    ];
    expect(runsInSessionWindow(runs, slotStart, slotEnd)).toHaveLength(3);
  });

  it('drops a run from another day (mentor testing the link)', () => {
    const runs = [
      runAt('2026-11-09T10:00:00.000Z'),
      runAt('2026-11-10T10:02:00.000Z'),
    ];
    expect(runsInSessionWindow(runs, slotStart, slotEnd)).toEqual([runs[1]]);
  });

  it('keeps a run whose start time is missing rather than risk a wrong refund', () => {
    expect(runsInSessionWindow([runAt(null)], slotStart, slotEnd)).toHaveLength(
      1,
    );
  });
});

describe('outcome rules', () => {
  it('only BOTH_JOINED is COMPLETED; every no-show is MISSED', () => {
    expect(lifecycleStateFor('BOTH_JOINED')).toBe('COMPLETED');
    expect(lifecycleStateFor('STUDENT_NO_SHOW')).toBe('MISSED');
    expect(lifecycleStateFor('MENTOR_NO_SHOW')).toBe('MISSED');
    expect(lifecycleStateFor('NOBODY_JOINED')).toBe('MISSED');
  });

  it('refunds the credit for a mentor no-show or nobody joining, not a student no-show', () => {
    expect(outcomeRefundsCredit('MENTOR_NO_SHOW')).toBe(true);
    expect(outcomeRefundsCredit('NOBODY_JOINED')).toBe(true);
    expect(outcomeRefundsCredit('STUDENT_NO_SHOW')).toBe(false);
    expect(outcomeRefundsCredit('BOTH_JOINED')).toBe(false);
  });

  it('follows the MENTOR_NO_SHOW_CREDIT_RULES switch', () => {
    expect(
      noShowCreditRulesEnabled({ MENTOR_NO_SHOW_CREDIT_RULES: true }),
    ).toBe(true);
    expect(
      noShowCreditRulesEnabled({ MENTOR_NO_SHOW_CREDIT_RULES: false }),
    ).toBe(false);
  });

  it('defaults to on (global.constants.example.ts)', () => {
    const {
      GLOBAL_CONSTANTS,
    } = require('../../../constants/global.constants.example');
    expect(GLOBAL_CONSTANTS.MENTOR_NO_SHOW_CREDIT_RULES).toBe(true);
  });
});
