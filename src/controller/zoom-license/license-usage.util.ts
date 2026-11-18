/**
 * Licence pool counting.
 *
 * A Zoom licence is in use from an assignment's start until its end plus the
 * cooldown. The pool is full at a moment when as many assignments are live as
 * there are licences. So what matters for a requested window is the PEAK
 * number live at any single moment inside it — not how many assignments touch
 * the window somewhere (three 20-minute sessions back to back between 10:00
 * and 11:00 never use more than one licence at once).
 *
 * One host's back-to-back assignments (the next one starts at or after the
 * previous one ends, within the cooldown) run on the same licence, so they are
 * joined into one before counting. A host's assignments that really overlap
 * still count separately.
 */

export interface LicenseInterval {
  /** Who hosts the meeting, e.g. the instructor's lower-cased email. */
  hostKey: string;
  start: Date;
  end: Date;
}

interface Span {
  start: number;
  /** End of the meeting itself (without cooldown). */
  end: number;
}

/**
 * Joins each host's intervals that only touch (gap between 0 and the
 * cooldown) into one span. Returns the spans of every host together.
 */
export function joinBackToBackByHost(
  intervals: LicenseInterval[],
  cooldownMs: number,
): Span[] {
  const byHost = new Map<string, Span[]>();

  for (const interval of intervals) {
    const key = interval.hostKey.trim().toLowerCase();
    const list = byHost.get(key) ?? [];
    list.push({
      start: interval.start.getTime(),
      end: interval.end.getTime(),
    });
    byHost.set(key, list);
  }

  const joined: Span[] = [];

  for (const spans of byHost.values()) {
    spans.sort((a, b) => a.start - b.start || a.end - b.end);
    // Each chain is one licence for this host. A span joins the chain that
    // ended most recently at or before its start, if the gap is within the
    // cooldown; otherwise it starts a new chain.
    const chains: Span[] = [];

    for (const span of spans) {
      let best: Span | null = null;
      for (const chain of chains) {
        const gap = span.start - chain.end;
        if (gap >= 0 && gap <= cooldownMs && (!best || chain.end > best.end)) {
          best = chain;
        }
      }

      if (best) {
        best.end = Math.max(best.end, span.end);
      } else {
        chains.push({ ...span });
      }
    }

    joined.push(...chains);
  }

  return joined;
}

/**
 * Highest number of licences live at the same moment inside
 * [window.start, window.end). A span is live from its start until its end plus
 * the cooldown.
 */
export function peakConcurrentLicenses(
  intervals: LicenseInterval[],
  window: { start: Date; end: Date },
  cooldownMs: number,
): number {
  const windowStart = window.start.getTime();
  const windowEnd = window.end.getTime();
  if (windowEnd <= windowStart) return 0;

  const spans = joinBackToBackByHost(intervals, cooldownMs)
    .map((span) => ({ start: span.start, until: span.end + cooldownMs }))
    .filter((span) => span.start < windowEnd && span.until > windowStart);

  if (spans.length === 0) return 0;

  // The count only goes up at a span's start, so the peak is reached at the
  // window start or at some span's start inside the window.
  const instants = [
    windowStart,
    ...spans
      .map((span) => span.start)
      .filter((start) => start > windowStart && start < windowEnd),
  ];

  let peak = 0;
  for (const instant of instants) {
    const live = spans.filter(
      (span) => span.start <= instant && span.until > instant,
    ).length;
    if (live > peak) peak = live;
  }

  return peak;
}

/**
 * Whether a new interval fits in a pool of `poolSize` licences, given the
 * assignments already there. The new interval is counted with its host's
 * other assignments, so it can share a licence with that host's back-to-back
 * sessions. Checked until the end of the new interval's own cooldown: its
 * licence stays busy until then, so a session starting in that tail counts.
 */
export function fitsInPool(
  existing: LicenseInterval[],
  requested: LicenseInterval,
  poolSize: number,
  cooldownMs: number,
): boolean {
  if (poolSize <= 0) return false;
  const peak = peakConcurrentLicenses(
    [...existing, requested],
    {
      start: requested.start,
      end: new Date(requested.end.getTime() + cooldownMs),
    },
    cooldownMs,
  );
  return peak <= poolSize;
}
