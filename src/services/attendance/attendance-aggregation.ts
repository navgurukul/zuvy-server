export interface CompletedSessionRow {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  s3link: string | null;
  moduleId: number;
  chapterId: number;
  meetingId: string;
  isZoomMeet: boolean;
  batchName: string | null;
}

export interface AttendanceStatusEntry {
  status: string;
  duration: number;
}

export interface AttendanceAggregate {
  totalClasses: number;
  presentCount: number;
  absentCount: number;
  attendancePercentage: number;
}

/**
 * Pure aggregation, no DB access. Both the live per-student report and the
 * cached batch-list percentage job call this on the same
 * (sessions, attendanceMap) shape, so they can only ever disagree due to
 * cache staleness — never due to divergent calculation logic. Kept
 * DB-import-free so it can be unit tested without a live database.
 */
export function aggregateForUser(
  sessions: CompletedSessionRow[],
  attendanceMap: Map<number, Map<number, AttendanceStatusEntry>>,
  userId: number,
): AttendanceAggregate {
  let presentCount = 0;
  let absentCount = 0;

  // Map.get() uses strict equality — a userId that arrives as a string (e.g.
  // straight from a JWT's `sub` claim, which is always a string) would never
  // match the numeric keys the map is built with, silently returning
  // "absent" for every session. Normalize once, here, so no caller can
  // reintroduce this by passing a string/bigint/etc.
  const uid = Number(userId);

  for (const session of sessions) {
    const status = attendanceMap.get(session.id)?.get(uid)?.status ?? 'absent';
    if (status === 'present') presentCount++;
    else absentCount++;
  }

  const totalClasses = sessions.length;
  const attendancePercentage =
    totalClasses > 0
      ? Number(((presentCount / totalClasses) * 100).toFixed(2))
      : 0;

  return { totalClasses, presentCount, absentCount, attendancePercentage };
}
