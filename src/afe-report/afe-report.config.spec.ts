import {
  DEFAULT_RECIPIENT,
  RETRY_AFTER_MS,
  RunSummary,
  afeReportConfig,
  configProblem,
  lastWeeklyBoundary,
  planReport,
} from './afe-report.config';

// India wall-clock time, e.g. ist('2026-11-23 09:05').
const ist = (s: string) => new Date(`${s.replace(' ', 'T')}:00+05:30`);

describe('afeReportConfig', () => {
  it('is off with nothing set, with safe defaults', () => {
    expect(afeReportConfig({})).toEqual({
      enabled: false,
      orgId: null,
      recipients: [DEFAULT_RECIPIENT],
      start: null,
      startInvalid: false,
    });
    expect(DEFAULT_RECIPIENT).toBe('join-zuvy@navgurukul.org');
  });

  it('reads the settings', () => {
    expect(
      afeReportConfig({
        AFE_REPORT_ENABLED: 'true',
        AFE_REPORT_ORG_ID: '7',
        AFE_REPORT_TO: ' a@x.org, b@y.org ,',
        AFE_REPORT_START: '2026-11-20T15:00:00+05:30',
      }),
    ).toEqual({
      enabled: true,
      orgId: 7,
      recipients: ['a@x.org', 'b@y.org'],
      start: new Date('2026-11-20T09:30:00.000Z'),
      startInvalid: false,
    });
  });

  it('only "true" turns it on; bad values are rejected', () => {
    const c = afeReportConfig({
      AFE_REPORT_ENABLED: 'TRUE',
      AFE_REPORT_ORG_ID: 'seven',
      AFE_REPORT_START: '2026-11-20 15:00', // no time zone: ambiguous
    });
    expect(c.enabled).toBe(false);
    expect(c.orgId).toBeNull();
    expect(c.start).toBeNull();
    expect(c.startInvalid).toBe(true);
    expect(configProblem({ ...c, orgId: 7 })).toMatch(/AFE_REPORT_START/);
  });
});

describe('lastWeeklyBoundary (Monday 9 AM India time)', () => {
  it.each([
    ['2026-11-23 09:00', '2026-11-23 09:00'], // Monday, exactly 9 AM
    ['2026-11-23 09:05', '2026-11-23 09:00'],
    ['2026-11-23 08:59', '2026-11-16 09:00'], // Monday before 9: last week's
    ['2026-11-20 15:00', '2026-11-16 09:00'], // Friday
    ['2026-11-22 23:59', '2026-11-16 09:00'], // Sunday night
    ['2026-11-24 00:30', '2026-11-23 09:00'], // Tuesday just after midnight IST
    ['2027-01-01 10:00', '2026-12-28 09:00'], // across a year
  ])('at %s IST it is %s IST', (now, boundary) => {
    expect(lastWeeklyBoundary(ist(now)).toISOString()).toBe(
      ist(boundary).toISOString(),
    );
  });
});

describe('planReport', () => {
  const sent = (windowEnd: Date): RunSummary => ({
    status: 'sent',
    windowEnd,
    createdAt: windowEnd,
  });

  it('first report without a start: everything up to the last Monday 9 AM', () => {
    expect(planReport(ist('2026-11-20 15:00'), null, null, null)).toEqual({
      due: true,
      from: new Date(0),
      to: ist('2026-11-16 09:00'),
    });
  });

  it('carries on from a report sent by hand (AFE_REPORT_START)', () => {
    const start = ist('2026-11-20 15:00');
    expect(planReport(ist('2026-11-22 10:00'), null, null, start).due).toBe(
      false,
    );
    expect(planReport(ist('2026-11-23 08:05'), null, null, start).due).toBe(
      false,
    );
    expect(planReport(ist('2026-11-23 09:05'), null, null, start)).toEqual({
      due: true,
      from: start,
      to: ist('2026-11-23 09:00'),
    });
  });

  it('then exactly Monday 9 AM to Monday 9 AM', () => {
    const last = sent(ist('2026-11-23 09:00'));
    expect(planReport(ist('2026-11-23 10:05'), last, last, null).due).toBe(
      false,
    );
    expect(planReport(ist('2026-11-30 08:05'), last, last, null).due).toBe(
      false,
    );
    expect(planReport(ist('2026-11-30 09:05'), last, last, null)).toEqual({
      due: true,
      from: ist('2026-11-23 09:00'),
      to: ist('2026-11-30 09:00'),
    });
    // The start setting only matters before the first sent report.
    expect(
      planReport(ist('2026-11-30 09:05'), last, last, ist('2026-01-01 00:00')),
    ).toMatchObject({
      from: ist('2026-11-23 09:00'),
    });
  });

  it('a server down on Monday sends the missed week on Tuesday, still ending Monday 9 AM', () => {
    const last = sent(ist('2026-11-23 09:00'));
    expect(planReport(ist('2026-12-01 11:05'), last, last, null)).toEqual({
      due: true,
      from: ist('2026-11-23 09:00'),
      to: ist('2026-11-30 09:00'),
    });
  });

  it('after a failure, waits 3 hours before retrying the same week', () => {
    const last = sent(ist('2026-11-23 09:00'));
    const failedAt = ist('2026-11-30 09:05');
    const failed: RunSummary = {
      status: 'failed',
      windowEnd: ist('2026-11-30 09:00'),
      createdAt: failedAt,
    };
    expect(planReport(ist('2026-11-30 10:05'), last, failed, null)).toEqual({
      due: false,
      reason: 'waiting to retry after a failure',
    });
    expect(
      planReport(
        new Date(failedAt.getTime() + RETRY_AFTER_MS),
        last,
        failed,
        null,
      ).due,
    ).toBe(true);
  });
});
