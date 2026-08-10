import {
  aggregateForUser,
  CompletedSessionRow,
  AttendanceStatusEntry,
} from './attendance-aggregation';

function makeSession(
  id: number,
  overrides: Partial<CompletedSessionRow> = {},
): CompletedSessionRow {
  return {
    id,
    title: `Session ${id}`,
    startTime: '2026-01-01T00:00:00Z',
    endTime: '2026-01-01T01:00:00Z',
    s3link: null,
    moduleId: 1,
    chapterId: 1,
    meetingId: `meeting-${id}`,
    isZoomMeet: true,
    batchName: 'Batch 1',
    ...overrides,
  };
}

describe('aggregateForUser', () => {
  const userId = 42;

  it('computes present/absent counts and percentage from the full session set', () => {
    const sessions = [
      makeSession(1),
      makeSession(2),
      makeSession(3),
      makeSession(4),
    ];
    const map = new Map<number, Map<number, AttendanceStatusEntry>>([
      [1, new Map([[userId, { status: 'present', duration: 60 }]])],
      [2, new Map([[userId, { status: 'present', duration: 60 }]])],
      [3, new Map([[userId, { status: 'absent', duration: 0 }]])],
      // session 4 has no attendance record at all for this user
    ]);

    const result = aggregateForUser(sessions, map, userId);

    expect(result.totalClasses).toBe(4);
    expect(result.presentCount).toBe(2);
    expect(result.absentCount).toBe(2);
    expect(result.attendancePercentage).toBe(50);
  });

  it('defaults a session with no attendance record to absent (not dropped from the denominator)', () => {
    const sessions = [makeSession(1)];
    const map = new Map<number, Map<number, AttendanceStatusEntry>>();

    const result = aggregateForUser(sessions, map, userId);

    expect(result.totalClasses).toBe(1);
    expect(result.presentCount).toBe(0);
    expect(result.absentCount).toBe(1);
    expect(result.attendancePercentage).toBe(0);
  });

  it('returns 100% when every completed session was attended', () => {
    const sessions = [makeSession(1), makeSession(2)];
    const map = new Map<number, Map<number, AttendanceStatusEntry>>([
      [1, new Map([[userId, { status: 'present', duration: 60 }]])],
      [2, new Map([[userId, { status: 'present', duration: 60 }]])],
    ]);

    const result = aggregateForUser(sessions, map, userId);

    expect(result.attendancePercentage).toBe(100);
  });

  it('does not count non-completed sessions toward the denominator (regression for the OR/AND precedence bug)', () => {
    // Represents what getCompletedSessionsForBatch must already have filtered out:
    // a session where this batch is only the *primary* batch and status != 'completed'
    // must never reach aggregateForUser at all. Simulates the fixed behavior by
    // passing only the genuinely-completed sessions in.
    const completedSessions = [makeSession(1), makeSession(2)];
    const map = new Map<number, Map<number, AttendanceStatusEntry>>([
      [1, new Map([[userId, { status: 'present', duration: 60 }]])],
      [2, new Map([[userId, { status: 'present', duration: 60 }]])],
    ]);

    const result = aggregateForUser(completedSessions, map, userId);

    expect(result.totalClasses).toBe(2);
    expect(result.attendancePercentage).toBe(100);
  });

  it('matches correctly when userId arrives as a string (e.g. straight from a JWT sub claim)', () => {
    // JWT `sub` claims are always strings (auth.service.ts does `sub: user.id.toString()`),
    // so a caller resolving userId from the token — not from an admin-supplied numeric
    // query param — will pass a string here. Map.get() uses strict equality, so if this
    // isn't normalized, a string userId silently matches nothing and every session comes
    // back "absent" regardless of actual attendance.
    const sessions = [makeSession(1), makeSession(2)];
    const map = new Map<number, Map<number, AttendanceStatusEntry>>([
      [1, new Map([[userId, { status: 'present', duration: 60 }]])],
      [2, new Map([[userId, { status: 'present', duration: 60 }]])],
    ]);

    const resultFromString = aggregateForUser(
      sessions,
      map,
      String(userId) as unknown as number,
    );
    const resultFromNumber = aggregateForUser(sessions, map, userId);

    expect(resultFromString).toEqual(resultFromNumber);
    expect(resultFromString.attendancePercentage).toBe(100);
  });

  it('is invariant to the caller: a cache-job-style bulk map and a live single-user map agree for the same underlying data', () => {
    const sessions = [makeSession(1), makeSession(2), makeSession(3)];

    // Simulates getUnifiedAttendanceMap({ batchId }) resolving multiple users at once
    const bulkMap = new Map<number, Map<number, AttendanceStatusEntry>>([
      [
        1,
        new Map([
          [userId, { status: 'present', duration: 60 }],
          [99, { status: 'absent', duration: 0 }],
        ]),
      ],
      [
        2,
        new Map([
          [userId, { status: 'absent', duration: 0 }],
          [99, { status: 'present', duration: 60 }],
        ]),
      ],
      [3, new Map([[userId, { status: 'present', duration: 60 }]])],
    ]);

    // Simulates getUnifiedAttendanceMap({ userId, userEmail }) resolving just this user
    const singleUserMap = new Map<number, Map<number, AttendanceStatusEntry>>([
      [1, new Map([[userId, { status: 'present', duration: 60 }]])],
      [2, new Map([[userId, { status: 'absent', duration: 0 }]])],
      [3, new Map([[userId, { status: 'present', duration: 60 }]])],
    ]);

    expect(aggregateForUser(sessions, bulkMap, userId)).toEqual(
      aggregateForUser(sessions, singleUserMap, userId),
    );
  });
});
