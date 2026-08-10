export interface JoinLeaveInterval {
  joinTime: string;
  leaveTime: string;
}

export interface ParticipantConnection {
  key: string;
  joinTime: string;
  leaveTime: string;
}

/**
 * Merges one participant's join/leave intervals into total unique
 * wall-clock seconds present. Zoom's participant report logs one row per
 * connection, not per person — summing each row's own duration
 * double-counts time whenever two connections overlap (most commonly: the
 * same person connected from two devices at once). Sequential/adjacent
 * reconnects (a dropped call, rejoining) are unaffected by merging — they
 * sum to the same total a naive sum would have given. Only genuinely
 * overlapping intervals are corrected, and only downward, so this can
 * never make anyone's attendance look worse than it did before.
 *
 * Pure and DB-free so this is unit-testable without a live database — see
 * attendance-duration-merge.spec.ts, which uses real production join/leave
 * data (including the overlap that originally surfaced this bug) as
 * regression cases.
 */
export function mergeIntervalsToDurationSeconds(
  intervals: JoinLeaveInterval[],
): number {
  const ranges = intervals
    .map((interval) => ({
      start: new Date(interval.joinTime).getTime(),
      end: new Date(interval.leaveTime).getTime(),
    }))
    .filter(
      (range) =>
        Number.isFinite(range.start) &&
        Number.isFinite(range.end) &&
        range.end > range.start,
    )
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return 0;

  let totalMs = 0;
  let currentStart = ranges[0].start;
  let currentEnd = ranges[0].end;

  for (let i = 1; i < ranges.length; i++) {
    const { start, end } = ranges[i];
    if (start <= currentEnd) {
      // Overlapping or back-to-back with the current merged range — extend
      // it instead of counting this range separately.
      if (end > currentEnd) currentEnd = end;
    } else {
      totalMs += currentEnd - currentStart;
      currentStart = start;
      currentEnd = end;
    }
  }
  totalMs += currentEnd - currentStart;

  return Math.round(totalMs / 1000);
}

/**
 * A participant's merged duration can never legitimately exceed the
 * meeting's own total duration — this is a defensive backstop (clock skew,
 * a stray malformed timestamp) layered on top of the interval merge above,
 * not the primary correctness mechanism. `meetingDurationSeconds` should
 * come from that specific occurrence's own reported duration, never a
 * different occurrence's or an aggregate across several.
 */
export function capToMeetingDuration(
  durationSeconds: number,
  meetingDurationSeconds: number | null | undefined,
): number {
  if (!meetingDurationSeconds || meetingDurationSeconds <= 0) {
    return durationSeconds;
  }
  return Math.min(durationSeconds, meetingDurationSeconds);
}

/**
 * Groups raw per-connection rows (one row per join/leave, possibly several
 * per person within the same occurrence) by identity key, merges each
 * person's intervals, and caps the result to that occurrence's own meeting
 * duration.
 */
export function computeMergedDurationsByKey(
  connections: ParticipantConnection[],
  meetingDurationSeconds: number | null | undefined,
): Map<string, number> {
  const intervalsByKey = new Map<string, JoinLeaveInterval[]>();
  for (const connection of connections) {
    if (!connection.key) continue;
    if (!intervalsByKey.has(connection.key)) {
      intervalsByKey.set(connection.key, []);
    }
    intervalsByKey.get(connection.key)!.push({
      joinTime: connection.joinTime,
      leaveTime: connection.leaveTime,
    });
  }

  const result = new Map<string, number>();
  for (const [key, intervals] of intervalsByKey) {
    const merged = mergeIntervalsToDurationSeconds(intervals);
    result.set(key, capToMeetingDuration(merged, meetingDurationSeconds));
  }
  return result;
}
