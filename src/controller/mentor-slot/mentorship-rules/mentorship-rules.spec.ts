import {
  DEFAULT_MENTORSHIP_CONFIG,
  MentorshipConfig,
  MentorshipConfigService,
  parseMentorshipConfig,
} from './mentorship-config.service';
import { MentorshipError } from './mentorship-error';
import {
  assertCanChangeSession,
  assertCreditsAllowBooking,
  assertSlotHasNotice,
  assertSlotLeadTime,
  istWeekRange,
  computeCreditState,
  earliestBookableStart,
  formatIstDateTime,
  gapPhrase,
  goodToKnow,
} from './mentorship-rules';

const config: MentorshipConfig = { ...DEFAULT_MENTORSHIP_CONFIG };
const MIN = 60_000;
const HOUR = 60 * MIN;
// India time, as the R1 examples are written.
const ist = (isoLocal: string) => new Date(`${isoLocal}+05:30`);

function refusal(run: () => void): MentorshipError | null {
  try {
    run();
    return null;
  } catch (error) {
    if (error instanceof MentorshipError) return error;
    throw error;
  }
}

describe('notice before a slot (notice_hours from config)', () => {
  const now = ist('2026-11-20T10:00:00');

  it('refuses a slot starting 1 minute short of the notice', () => {
    const error = refusal(() =>
      assertSlotHasNotice(
        new Date(now.getTime() + 72 * HOUR - MIN),
        now,
        config,
      ),
    );
    expect(error?.code).toBe('SLOT_TOO_SOON');
    expect(error?.getStatus()).toBe(400);
    expect(error?.message).toBe(
      "This slot starts in under 72 hours, so it can't be booked. Pick a later slot.",
    );
  });

  it('accepts a slot starting exactly at the notice, or later', () => {
    expect(
      refusal(() =>
        assertSlotHasNotice(new Date(now.getTime() + 72 * HOUR), now, config),
      ),
    ).toBeNull();
    expect(
      refusal(() =>
        assertSlotHasNotice(new Date(now.getTime() + 100 * HOUR), now, config),
      ),
    ).toBeNull();
  });

  it('follows the configured notice, not a fixed number', () => {
    const in24 = { ...config, noticeHours: 24 };
    const slot = new Date(now.getTime() + 30 * HOUR);
    expect(refusal(() => assertSlotHasNotice(slot, now, in24))).toBeNull();
    expect(refusal(() => assertSlotHasNotice(slot, now, config))?.code).toBe(
      'SLOT_TOO_SOON',
    );
    expect(earliestBookableStart(now, in24)).toEqual(
      new Date(now.getTime() + 24 * HOUR),
    );
  });
});

describe('credits', () => {
  const now = ist('2026-11-20T10:00:00');

  it('a student with no bookings has every credit and can book', () => {
    const state = computeCreditState(
      { creditsUsed: 0, latestSessionStart: null },
      config,
      now,
    );
    expect(state).toEqual({
      creditsAssigned: 3,
      creditsUsed: 0,
      creditsLeft: 3,
      nextEligibleDate: null,
      canBook: true,
      blockReason: null,
    });
  });

  it('0 credits left: refused, with the R1 message', () => {
    const state = computeCreditState(
      { creditsUsed: 3, latestSessionStart: ist('2026-08-01T10:00:00') },
      config,
      now,
    );
    expect(state.creditsLeft).toBe(0);
    expect(state.blockReason).toBe('NO_CREDITS');
    expect(state.nextEligibleDate).toBeNull();
    const error = refusal(() => assertCreditsAllowBooking(state, config));
    expect(error?.code).toBe('NO_CREDITS');
    expect(error?.getStatus()).toBe(403);
    expect(error?.message).toBe(
      "You've used all 3 of your mentorship credits.",
    );
    expect((error?.getResponse() as any).data.creditsLeft).toBe(0);
  });

  it('no credits wins over an active gap', () => {
    const state = computeCreditState(
      { creditsUsed: 3, latestSessionStart: now },
      config,
      now,
    );
    expect(state.blockReason).toBe('NO_CREDITS');
  });

  it('never shows more credits left than assigned, or fewer than 0', () => {
    const lowered = { ...config, totalCredits: 2 };
    const over = computeCreditState(
      { creditsUsed: 5, latestSessionStart: null },
      lowered,
      now,
    );
    expect(over.creditsLeft).toBe(0);
    expect(over.creditsUsed).toBe(5);
  });
});

describe('the gap (exact time: latest session start + gap_days)', () => {
  const lastSession = ist('2026-11-10T18:00:00');
  const usage = { creditsUsed: 1, latestSessionStart: lastSession };

  it('1 minute before the gap ends: refused, naming the exact time', () => {
    const state = computeCreditState(usage, config, ist('2026-11-24T17:59:00'));
    expect(state.blockReason).toBe('GAP_ACTIVE');
    expect(state.nextEligibleDate).toEqual(ist('2026-11-24T18:00:00'));
    const error = refusal(() => assertCreditsAllowBooking(state, config));
    expect(error?.code).toBe('GAP_ACTIVE');
    expect(error?.message).toBe(
      'You can book your next session from 24 Nov 2026, 6:00 pm. Sessions need to be 2 weeks apart.',
    );
    expect((error?.getResponse() as any).data.nextEligibleDate).toEqual(
      ist('2026-11-24T18:00:00'),
    );
  });

  it('exactly when the gap ends: allowed', () => {
    const state = computeCreditState(usage, config, ist('2026-11-24T18:00:00'));
    expect(state.canBook).toBe(true);
    expect(state.nextEligibleDate).toBeNull();
  });

  it('a gap of 0 days means no gap', () => {
    const state = computeCreditState(
      usage,
      { ...config, gapDays: 0 },
      lastSession,
    );
    expect(state.canBook).toBe(true);
  });

  it('says the gap in weeks when it is whole weeks, else in days', () => {
    expect(gapPhrase(14)).toBe('2 weeks');
    expect(gapPhrase(7)).toBe('1 week');
    expect(gapPhrase(10)).toBe('10 days');
    expect(gapPhrase(1)).toBe('1 day');
  });

  it('formats times in India time', () => {
    expect(formatIstDateTime(new Date('2026-11-24T12:30:00Z'))).toBe(
      '24 Nov 2026, 6:00 pm',
    );
  });
});

describe('the R1 example, step by step', () => {
  // Credits and the gap are worked out from bookings every time, so each
  // step is the bookings that use a credit at that moment.
  const nov10Session = ist('2026-11-10T18:00:00');
  const nov28Session = ist('2026-11-28T18:00:00');

  it('1 Nov: books a session on 10 Nov', () => {
    const before = computeCreditState(
      { creditsUsed: 0, latestSessionStart: null },
      config,
      ist('2026-11-01T10:00:00'),
    );
    expect(before.canBook).toBe(true);
    const after = computeCreditState(
      { creditsUsed: 1, latestSessionStart: nov10Session },
      config,
      ist('2026-11-01T10:01:00'),
    );
    expect(after.creditsLeft).toBe(2);
    // The gap runs from the session, not from the booking.
    expect(after.nextEligibleDate).toEqual(ist('2026-11-24T18:00:00'));
  });

  it('11 Nov: blocked until 24 Nov', () => {
    const state = computeCreditState(
      { creditsUsed: 1, latestSessionStart: nov10Session },
      config,
      ist('2026-11-11T10:00:00'),
    );
    expect(state.blockReason).toBe('GAP_ACTIVE');
    expect(state.nextEligibleDate).toEqual(ist('2026-11-24T18:00:00'));
  });

  it('24 Nov (after 6 pm): books again', () => {
    const state = computeCreditState(
      { creditsUsed: 1, latestSessionStart: nov10Session },
      config,
      ist('2026-11-24T18:05:00'),
    );
    expect(state.canBook).toBe(true);
    const after = computeCreditState(
      { creditsUsed: 2, latestSessionStart: nov28Session },
      config,
      ist('2026-11-24T18:06:00'),
    );
    expect(after.creditsLeft).toBe(1);
    expect(after.blockReason).toBe('GAP_ACTIVE');
  });

  it('25 Nov: cancels it, gets the credit back and can book again', () => {
    // The cancelled booking no longer counts: back to the 10 Nov session.
    const state = computeCreditState(
      { creditsUsed: 1, latestSessionStart: nov10Session },
      config,
      ist('2026-11-25T10:00:00'),
    );
    expect(state.creditsLeft).toBe(2);
    expect(state.canBook).toBe(true);
  });
});

describe('cancel and reschedule close at the notice (ST4)', () => {
  const start = ist('2026-11-06T18:00:00');

  it('open until exactly 72 h before, closed a minute later', () => {
    expect(
      refusal(() =>
        assertCanChangeSession(
          'student',
          start,
          new Date(start.getTime() - 72 * HOUR),
          config,
        ),
      ),
    ).toBeNull();
    const error = refusal(() =>
      assertCanChangeSession(
        'student',
        start,
        new Date(start.getTime() - 72 * HOUR + MIN),
        config,
      ),
    );
    expect(error?.code).toBe('TOO_LATE_TO_CHANGE');
    expect(error?.message).toBe(
      "Rescheduling and cancelling close 72 hours before the session. If you can't attend, email team@zuvy.org.",
    );
  });

  it('the mentor gets their own message', () => {
    const error = refusal(() =>
      assertCanChangeSession('mentor', start, start, config),
    );
    expect(error?.message).toBe(
      'This session starts in under 72 hours. Email team@zuvy.org to cancel it.',
    );
  });

  it('good-to-know lines use the configured numbers', () => {
    expect(goodToKnow(config).map((line) => line.text)).toEqual([
      'Cancel up to 72 hours before. Your credit comes back.',
      'Reschedule up to 72 hours before. Your mentor needs to accept.',
      'Join opens 10 minutes before the start.',
      "Inside 72 hours, email team@zuvy.org if you can't attend. If you miss the session, you lose the credit.",
    ]);
  });
});

describe('new mentor slots: at least slot_min_lead_days ahead (MT2)', () => {
  const now = ist('2026-11-04T18:00:00');

  it('refuses a slot a minute short of 4 days, accepts exactly 4 days', () => {
    const tooSoon = refusal(() =>
      assertSlotLeadTime(
        new Date(now.getTime() + 4 * 24 * HOUR - MIN),
        now,
        config,
      ),
    );
    expect(tooSoon?.code).toBe('SLOT_LEAD_TOO_SHORT');
    expect(tooSoon?.message).toBe(
      'Slots need to start at least 4 days from now. Pick a time from 8 Nov 2026, 6:00 pm on.',
    );
    expect(
      refusal(() =>
        assertSlotLeadTime(
          new Date(now.getTime() + 4 * 24 * HOUR),
          now,
          config,
        ),
      ),
    ).toBeNull();
  });

  it('0 days turns the rule off', () => {
    expect(
      refusal(() =>
        assertSlotLeadTime(new Date(now.getTime() + MIN), now, {
          ...config,
          minSlotLeadDays: 0,
        }),
      ),
    ).toBeNull();
  });
});

describe('the availability week is Monday-Sunday in India time', () => {
  it('a Monday 3:00 am IST belongs to that week, not the one before', () => {
    // Mon 9 Nov 2026, 03:00 IST = Sun 8 Nov 21:30 UTC.
    const { start, end } = istWeekRange(ist('2026-11-09T03:00:00'));
    expect(start).toEqual(ist('2026-11-09T00:00:00'));
    expect(end).toEqual(ist('2026-11-16T00:00:00'));
  });

  it('Sunday night stays in its week; the offset moves whole weeks', () => {
    const { start } = istWeekRange(ist('2026-11-15T23:30:00'));
    expect(start).toEqual(ist('2026-11-09T00:00:00'));
    expect(istWeekRange(ist('2026-11-15T23:30:00'), 1).start).toEqual(
      ist('2026-11-16T00:00:00'),
    );
  });
});

describe('config from the table', () => {
  it('uses the defaults for missing keys', () => {
    const { config: parsed, problems } = parseMentorshipConfig([]);
    expect(parsed).toEqual(DEFAULT_MENTORSHIP_CONFIG);
    expect(problems).toEqual([]);
  });

  it('reads every key (jsonb numbers, numeric strings, a date)', () => {
    const { config: parsed, problems } = parseMentorshipConfig([
      { key: 'total_credits', value: 5 },
      { key: 'gap_days', value: '7' },
      { key: 'notice_hours', value: 24 },
      { key: 'join_open_minutes', value: 15 },
      { key: 'max_accepted_reschedules', value: 2 },
      { key: 'credits_counted_from', value: '2026-12-01T00:00:00.000Z' },
    ]);
    expect(problems).toEqual([]);
    expect(parsed).toEqual({
      totalCredits: 5,
      gapDays: 7,
      noticeHours: 24,
      joinOpenMinutes: 15,
      maxAcceptedReschedules: 2,
      minSlotLeadDays: 4,
      creditsCountedFrom: new Date('2026-12-01T00:00:00.000Z'),
    });
  });

  it('keeps the default for a bad value and reports it', () => {
    const { config: parsed, problems } = parseMentorshipConfig([
      { key: 'total_credits', value: -1 },
      { key: 'gap_days', value: 2.5 },
      { key: 'notice_hours', value: 'soon' },
      { key: 'credits_counted_from', value: 'not a date' },
    ]);
    expect(parsed).toEqual(DEFAULT_MENTORSHIP_CONFIG);
    expect(problems).toHaveLength(4);
  });

  it('caches for a minute and applies test overrides on top', async () => {
    const service = new MentorshipConfigService();
    const load = jest
      .spyOn(service as any, 'load')
      .mockImplementation(async () => {
        (service as any).cached = { config, loadedAt: Date.now() };
        return config;
      });
    await service.get();
    await service.get();
    expect(load).toHaveBeenCalledTimes(1);

    service.setOverridesForTesting({ totalCredits: 99 });
    expect((await service.get()).totalCredits).toBe(99);
    service.setOverridesForTesting(null);
    expect((await service.get()).totalCredits).toBe(3);

    service.invalidate();
    await service.get();
    expect(load).toHaveBeenCalledTimes(2);
  });
});
