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

  it("checks the new session's own cooldown tail", () => {
    // Pool of 2. A runs 10:00-11:30. B starts 11:01, while a 10:00-11:00
    // session for C is still in its 2-minute cooldown: A, B and C at once.
    const existing = [
      iv('a@x.org', '10:00', '11:30'),
      iv('b@x.org', '11:01', '12:00'),
    ];
    expect(
      fitsInPool(existing, iv('c@x.org', '10:00', '11:00'), 2, COOLDOWN),
    ).toBe(false);
    // B starting once C's cooldown is over is fine.
    const later = [
      iv('a@x.org', '10:00', '11:30'),
      iv('b@x.org', '11:02', '12:00'),
    ];
    expect(
      fitsInPool(later, iv('c@x.org', '10:00', '11:00'), 2, COOLDOWN),
    ).toBe(true);
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

describe('peakConcurrentLicenses: skipping far-away hosts changes nothing', () => {
  // The same count, done the plain way over every interval.
  const reference = (
    intervals: LicenseInterval[],
    w: { start: Date; end: Date },
    cooldownMs: number,
  ) => {
    const ws = w.start.getTime();
    const we = w.end.getTime();
    if (we <= ws) return 0;
    const spans = joinBackToBackByHost(intervals, cooldownMs)
      .map((s) => ({ start: s.start, until: s.end + cooldownMs }))
      .filter((s) => s.start < we && s.until > ws);
    const instants = [
      ws,
      ...spans.map((s) => s.start).filter((x) => x > ws && x < we),
    ];
    return Math.max(
      0,
      ...instants.map(
        (i) => spans.filter((s) => s.start <= i && s.until > i).length,
      ),
    );
  };

  // Deterministic pseudo-random data: several hosts, back-to-back chains,
  // overlaps and gaps around the cooldown length.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const base = t('08:00').getTime();
  const MIN = 60_000;

  it('matches the plain count on 300 random cases', () => {
    for (let run = 0; run < 300; run++) {
      const intervals: LicenseInterval[] = [];
      const hosts = 1 + Math.floor(rand() * 6);
      for (let h = 0; h < hosts; h++) {
        let cursor = base + Math.floor(rand() * 240) * MIN;
        const count = 1 + Math.floor(rand() * 6);
        for (let i = 0; i < count; i++) {
          const length = (10 + Math.floor(rand() * 60)) * MIN;
          intervals.push({
            hostKey: `h${h}@x.org`,
            start: new Date(cursor),
            end: new Date(cursor + length),
          });
          // Next one: overlapping, back to back, within the cooldown, or later.
          const gap = [-15, 0, 1, 2, 3, 30][Math.floor(rand() * 6)] * MIN;
          cursor += length + gap;
        }
      }
      const ws = base + Math.floor(rand() * 600) * MIN;
      const w = {
        start: new Date(ws),
        end: new Date(ws + (5 + Math.floor(rand() * 120)) * MIN),
      };
      expect(peakConcurrentLicenses(intervals, w, COOLDOWN)).toBe(
        reference(intervals, w, COOLDOWN),
      );
    }
  });
});
