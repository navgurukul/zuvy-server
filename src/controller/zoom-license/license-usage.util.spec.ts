import {
  LicenseInterval,
  fitsInPool,
  joinBackToBackByHost,
  peakConcurrentLicenses,
} from './license-usage.util';

const COOLDOWN = 2 * 60 * 1000;
const day = '2026-11-20T';
const t = (hhmm: string) => new Date(`${day}${hhmm}:00.000Z`);
const iv = (host: string, from: string, to: string): LicenseInterval => ({
  hostKey: host,
  start: t(from),
  end: t(to),
});
const window = (from: string, to: string) => ({ start: t(from), end: t(to) });

describe('peakConcurrentLicenses', () => {
  it('counts sessions that never run at the same moment as one licence', () => {
    // Three hosts, back to back with 5-minute gaps (longer than the cooldown).
    const existing = [
      iv('a@x.org', '10:00', '10:15'),
      iv('b@x.org', '10:20', '10:35'),
      iv('c@x.org', '10:40', '10:55'),
    ];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:00'), COOLDOWN),
    ).toBe(1);
  });

  it('counts sessions that run at the same moment separately', () => {
    const existing = [
      iv('a@x.org', '10:00', '11:00'),
      iv('b@x.org', '10:30', '11:30'),
      iv('c@x.org', '10:45', '11:15'),
    ];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '12:00'), COOLDOWN),
    ).toBe(3);
  });

  it("counts the cooldown after a different host's session", () => {
    // b starts 1 minute after a ends: a's licence is still cooling down.
    const existing = [
      iv('a@x.org', '10:00', '10:30'),
      iv('b@x.org', '10:31', '11:00'),
    ];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:00'), COOLDOWN),
    ).toBe(2);
  });

  it("treats one host's back-to-back sessions as one licence", () => {
    const existing = [
      iv('mentor@x.org', '10:00', '10:30'),
      iv('mentor@x.org', '10:30', '11:00'),
      iv('Mentor@X.org', '11:01', '11:30'),
    ];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:30'), COOLDOWN),
    ).toBe(1);
  });

  it("still counts one host's really overlapping sessions separately", () => {
    const existing = [
      iv('teacher@x.org', '10:00', '11:00'),
      iv('teacher@x.org', '10:30', '11:30'),
    ];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:30'), COOLDOWN),
    ).toBe(2);
  });

  it('ignores sessions whose cooldown ended before the window', () => {
    const existing = [iv('a@x.org', '09:00', '09:57')];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:00'), COOLDOWN),
    ).toBe(0);
  });

  it('counts a session still in its cooldown at the window start', () => {
    const existing = [iv('a@x.org', '09:00', '09:59')];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:00'), COOLDOWN),
    ).toBe(1);
  });

  it('ignores sessions that start at or after the window end', () => {
    const existing = [iv('a@x.org', '11:00', '12:00')];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:00'), COOLDOWN),
    ).toBe(0);
  });

  it('returns 0 for an empty or invalid window', () => {
    expect(peakConcurrentLicenses([], window('10:00', '11:00'), COOLDOWN)).toBe(
      0,
    );
    expect(
      peakConcurrentLicenses(
        [iv('a@x.org', '10:00', '11:00')],
        window('11:00', '10:00'),
        COOLDOWN,
      ),
    ).toBe(0);
  });
});

describe('joinBackToBackByHost', () => {
  it('joins a host chain only across gaps within the cooldown', () => {
    const spans = joinBackToBackByHost(
      [
        iv('m@x.org', '10:00', '10:30'),
        iv('m@x.org', '10:32', '11:00'),
        iv('m@x.org', '11:10', '11:30'),
      ],
      COOLDOWN,
    );
    expect(spans).toHaveLength(2);
  });

  it('never joins different hosts', () => {
    const spans = joinBackToBackByHost(
      [iv('a@x.org', '10:00', '10:30'), iv('b@x.org', '10:30', '11:00')],
      COOLDOWN,
    );
    expect(spans).toHaveLength(2);
  });
});

describe('fitsInPool', () => {
  it('fits a class next to back-to-back sessions that the old count rejected', () => {
    // Pool of 2. Old count: 3 assignments touch 10:00-11:00 -> rejected.
    // Real peak with the new class: 2.
    const existing = [
      iv('a@x.org', '10:00', '10:15'),
      iv('b@x.org', '10:20', '10:35'),
      iv('c@x.org', '10:40', '10:55'),
    ];
    expect(
      fitsInPool(existing, iv('teacher@x.org', '10:00', '11:00'), 2, COOLDOWN),
    ).toBe(true);
  });

  it('rejects when the pool is full at some moment', () => {
    const existing = [
      iv('a@x.org', '10:00', '11:00'),
      iv('b@x.org', '10:30', '11:30'),
    ];
    expect(
      fitsInPool(existing, iv('teacher@x.org', '10:45', '11:15'), 2, COOLDOWN),
    ).toBe(false);
  });

  it("lets a mentor's next slot share the licence of their previous one", () => {
    // Pool of 1, already used by the mentor's 10:00-10:30 slot.
    const existing = [iv('mentor@x.org', '10:00', '10:30')];
    expect(
      fitsInPool(existing, iv('mentor@x.org', '10:30', '11:00'), 1, COOLDOWN),
    ).toBe(true);
    expect(
      fitsInPool(existing, iv('other@x.org', '10:30', '11:00'), 1, COOLDOWN),
    ).toBe(false);
  });

  it('never fits in an empty pool', () => {
    expect(fitsInPool([], iv('a@x.org', '10:00', '11:00'), 0, COOLDOWN)).toBe(
      false,
    );
  });
});

describe('edge cases', () => {
  const ms = (hhmm: string, plusMs: number) =>
    new Date(t(hhmm).getTime() + plusMs);

  it('joins a host gap of exactly the cooldown, not one millisecond more', () => {
    const exact = joinBackToBackByHost(
      [
        iv('m@x.org', '10:00', '10:30'),
        { hostKey: 'm@x.org', start: ms('10:30', COOLDOWN), end: t('11:00') },
      ],
      COOLDOWN,
    );
    expect(exact).toHaveLength(1);
    const over = joinBackToBackByHost(
      [
        iv('m@x.org', '10:00', '10:30'),
        {
          hostKey: 'm@x.org',
          start: ms('10:30', COOLDOWN + 1),
          end: t('11:00'),
        },
      ],
      COOLDOWN,
    );
    expect(over).toHaveLength(2);
  });

  it('frees a licence exactly when the cooldown ends', () => {
    const existing = [iv('a@x.org', '10:00', '10:30')];
    const atEnd = { start: ms('10:30', COOLDOWN), end: t('11:00') };
    const justBefore = { start: ms('10:30', COOLDOWN - 1), end: t('11:00') };
    expect(peakConcurrentLicenses(existing, atEnd, COOLDOWN)).toBe(0);
    expect(peakConcurrentLicenses(existing, justBefore, COOLDOWN)).toBe(1);
  });

  it('matches host emails ignoring case and spaces', () => {
    const spans = joinBackToBackByHost(
      [
        iv(' Mentor@X.org ', '10:00', '10:30'),
        iv('mentor@x.org', '10:30', '11:00'),
      ],
      COOLDOWN,
    );
    expect(spans).toHaveLength(1);
  });

  it('keeps one host with two parallel chains at two licences', () => {
    // Two overlapping sessions, each followed back to back by another.
    const existing = [
      iv('t@x.org', '10:00', '10:30'),
      iv('t@x.org', '10:15', '10:45'),
      iv('t@x.org', '10:30', '11:00'),
      iv('t@x.org', '10:45', '11:15'),
    ];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:15'), COOLDOWN),
    ).toBe(2);
  });

  it('handles input in any order', () => {
    const ordered = [
      iv('a@x.org', '10:00', '11:00'),
      iv('b@x.org', '10:30', '11:30'),
      iv('m@x.org', '09:00', '10:00'),
      iv('m@x.org', '10:00', '10:30'),
    ];
    const reversed = [...ordered].reverse();
    const w = window('09:00', '12:00');
    expect(peakConcurrentLicenses(reversed, w, COOLDOWN)).toBe(
      peakConcurrentLicenses(ordered, w, COOLDOWN),
    );
  });

  it('counts a zero-length session in its cooldown', () => {
    const existing = [iv('a@x.org', '10:00', '10:00')];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '10:30'), COOLDOWN),
    ).toBe(1);
  });

  it('works with no cooldown at all', () => {
    const existing = [
      iv('a@x.org', '10:00', '10:30'),
      iv('b@x.org', '10:30', '11:00'),
    ];
    expect(peakConcurrentLicenses(existing, window('10:00', '11:00'), 0)).toBe(
      1,
    );
  });

  it('counts the peak only inside the window', () => {
    // Three at once at 12:00, but the window ends at 11:00.
    const existing = [
      iv('a@x.org', '10:00', '12:30'),
      iv('b@x.org', '11:30', '12:30'),
      iv('c@x.org', '11:45', '12:30'),
    ];
    expect(
      peakConcurrentLicenses(existing, window('10:00', '11:00'), COOLDOWN),
    ).toBe(1);
  });

  it('fits the last licence exactly, and not one more', () => {
    const existing = [
      iv('a@x.org', '10:00', '11:00'),
      iv('b@x.org', '10:00', '11:00'),
    ];
    expect(
      fitsInPool(existing, iv('c@x.org', '10:00', '11:00'), 3, COOLDOWN),
    ).toBe(true);
    expect(
      fitsInPool(existing, iv('c@x.org', '10:00', '11:00'), 2, COOLDOWN),
    ).toBe(false);
  });

  it('does not let a host share a licence with a session it overlaps', () => {
    const existing = [iv('m@x.org', '10:00', '10:30')];
    expect(
      fitsInPool(existing, iv('m@x.org', '10:15', '10:45'), 1, COOLDOWN),
    ).toBe(false);
  });
});
