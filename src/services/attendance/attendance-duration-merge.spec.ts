import {
  mergeIntervalsToDurationSeconds,
  capToMeetingDuration,
  computeMergedDurationsByKey,
} from './attendance-duration-merge';

describe('mergeIntervalsToDurationSeconds', () => {
  it('returns 0 for no intervals', () => {
    expect(mergeIntervalsToDurationSeconds([])).toBe(0);
  });

  it('sums non-overlapping sequential intervals as-is', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-01-01T10:00:00Z', leaveTime: '2026-01-01T10:05:00Z' },
      { joinTime: '2026-01-01T10:10:00Z', leaveTime: '2026-01-01T10:20:00Z' },
    ]);
    // 5 min + 10 min = 15 min, with a 5 min gap that doesn't count
    expect(result).toBe(15 * 60);
  });

  it('merges back-to-back intervals with no gap into one continuous span', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-01-01T10:00:00Z', leaveTime: '2026-01-01T10:04:00Z' },
      { joinTime: '2026-01-01T10:04:00Z', leaveTime: '2026-01-01T11:00:00Z' },
    ]);
    expect(result).toBe(60 * 60);
  });

  it('does not double-count a fully nested overlapping interval', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-01-01T10:00:00Z', leaveTime: '2026-01-01T11:00:00Z' },
      { joinTime: '2026-01-01T10:10:00Z', leaveTime: '2026-01-01T10:30:00Z' },
    ]);
    // The second interval is entirely inside the first — contributes nothing extra
    expect(result).toBe(60 * 60);
  });

  it('merges partially overlapping intervals to their union, not their sum', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-01-01T10:00:00Z', leaveTime: '2026-01-01T10:30:00Z' },
      { joinTime: '2026-01-01T10:20:00Z', leaveTime: '2026-01-01T10:50:00Z' },
    ]);
    // Union is 10:00-10:50 = 50 min, not the naive sum of 30+30=60 min
    expect(result).toBe(50 * 60);
  });

  it('is order-independent — unsorted input merges the same as sorted input', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-01-01T10:10:00Z', leaveTime: '2026-01-01T10:30:00Z' },
      { joinTime: '2026-01-01T10:00:00Z', leaveTime: '2026-01-01T10:05:00Z' },
    ]);
    expect(result).toBe(5 * 60 + 20 * 60);
  });

  it('ignores a malformed interval (leave before join) instead of producing a negative duration', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-01-01T10:00:00Z', leaveTime: '2026-01-01T09:00:00Z' },
      { joinTime: '2026-01-01T10:00:00Z', leaveTime: '2026-01-01T10:10:00Z' },
    ]);
    expect(result).toBe(10 * 60);
  });

  // Regression: session 2191 (S13 - 31/07/2026 - Group 3), host Akhil Sharma.
  // Zoom's participant report logged three connections for the host:
  //   08:00:46 PM - 08:04:42 PM   (4 min)
  //   08:04:42 PM - 10:00:38 PM   (116 min)
  //   08:06:40 PM - 09:32:52 PM   (87 min — fully nested inside the row above)
  // Naive summation gave 4+116+87 = 207 min for a meeting that only ran
  // ~120 minutes (08:00:46 PM to 10:00:38 PM), which is impossible for a
  // single participant and was the root cause of this session's 75%
  // threshold being unreachable for the whole class.
  it('regression: session 2191 host duration merges to the real ~120 min span, not the naive 207 min', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-07-31T20:00:46Z', leaveTime: '2026-07-31T20:04:42Z' },
      { joinTime: '2026-07-31T20:04:42Z', leaveTime: '2026-07-31T22:00:38Z' },
      { joinTime: '2026-07-31T20:06:40Z', leaveTime: '2026-07-31T21:32:52Z' },
    ]);
    // 08:00:46 PM to 10:00:38 PM = 1h59m52s = 7192s
    expect(result).toBe(7192);
    expect(result).toBeLessThan(207 * 60); // must not reproduce the naive-sum bug
  });

  // Regression: session 86902509781 (S14 - 1/08/2026 - Group 3), same host.
  // Four logged connections, three sequential/adjacent plus one nested
  // overlap — same overlap pattern as session 2191, different session.
  it('regression: session S14 host duration merges correctly with a nested overlap', () => {
    const result = mergeIntervalsToDurationSeconds([
      { joinTime: '2026-08-01T20:02:15Z', leaveTime: '2026-08-01T20:04:18Z' },
      { joinTime: '2026-08-01T20:04:18Z', leaveTime: '2026-08-01T20:04:28Z' },
      { joinTime: '2026-08-01T20:04:28Z', leaveTime: '2026-08-01T21:55:36Z' },
      { joinTime: '2026-08-01T20:04:41Z', leaveTime: '2026-08-01T21:09:05Z' },
    ]);
    // 08:02:15 PM to 09:55:36 PM = 1h53m21s = 6801s
    expect(result).toBe(6801);
  });
});

describe('capToMeetingDuration', () => {
  it('leaves duration unchanged when under the meeting length', () => {
    expect(capToMeetingDuration(100, 200)).toBe(100);
  });

  it('caps duration down to the meeting length when it exceeds it', () => {
    expect(capToMeetingDuration(250, 200)).toBe(200);
  });

  it('is a no-op when meeting duration is missing or invalid', () => {
    expect(capToMeetingDuration(100, null)).toBe(100);
    expect(capToMeetingDuration(100, undefined)).toBe(100);
    expect(capToMeetingDuration(100, 0)).toBe(100);
  });
});

describe('computeMergedDurationsByKey', () => {
  it('computes independent merged durations per participant', () => {
    const result = computeMergedDurationsByKey(
      [
        {
          key: 'a@x.com',
          joinTime: '2026-01-01T10:00:00Z',
          leaveTime: '2026-01-01T10:30:00Z',
        },
        {
          key: 'b@x.com',
          joinTime: '2026-01-01T10:00:00Z',
          leaveTime: '2026-01-01T10:10:00Z',
        },
      ],
      null,
    );
    expect(result.get('a@x.com')).toBe(30 * 60);
    expect(result.get('b@x.com')).toBe(10 * 60);
  });

  it('applies the meeting-duration cap per key', () => {
    const result = computeMergedDurationsByKey(
      [
        {
          key: 'a@x.com',
          joinTime: '2026-01-01T10:00:00Z',
          leaveTime: '2026-01-01T11:00:00Z',
        },
      ],
      30 * 60,
    );
    expect(result.get('a@x.com')).toBe(30 * 60);
  });

  it('skips connections with no key', () => {
    const result = computeMergedDurationsByKey(
      [
        {
          key: '',
          joinTime: '2026-01-01T10:00:00Z',
          leaveTime: '2026-01-01T10:30:00Z',
        },
      ],
      null,
    );
    expect(result.size).toBe(0);
  });
});
