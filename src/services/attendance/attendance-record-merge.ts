export interface InvitedStudent {
  userId: number;
  email?: string;
  name?: string;
}

export interface RawAttendanceRecord {
  id: number;
  userId: number;
  attendanceDate: string | null;
  version: string | null;
  createdAt: string | null;
}

export interface StudentAttendanceStatusEntry {
  status: string;
  duration: number;
}

export interface StudentAttendanceRecord {
  id: number | null;
  userId: number;
  batchId: number;
  bootcampId: number;
  sessionId: number;
  attendanceDate: string | null;
  status: string;
  version: string | null;
  duration: number;
  createdAt: string | null;
  email: string | null;
  name: string | null;
}

/**
 * Merges the invited-student roster with computed attendance status/duration
 * and (where one exists) the raw zuvy_student_attendance_records row, into
 * one complete record per invited student.
 *
 * Always covers every invited student — unlike the analytics endpoint,
 * which silently omits students the pipeline never processed — defaulting
 * to `absent`/`0` and `null` for the DB-row-only fields (id/version/
 * createdAt) when no real record exists for that student.
 *
 * `batchId`/`bootcampId`/`sessionId` come from `session`, not from the raw
 * record, and are never null: they're `.notNull()` columns on the session
 * itself, known regardless of whether any individual student has a real
 * attendance row yet.
 *
 * Pure and DB-free by design so this merge is unit-testable without a live
 * database — see attendance-record-merge.spec.ts.
 */
export function buildStudentAttendanceRecords(
  invitedStudents: InvitedStudent[],
  perUserStatus: Map<number, StudentAttendanceStatusEntry>,
  rawRecordByUserId: Map<number, RawAttendanceRecord>,
  session: {
    id: number;
    batchId: number;
    bootcampId: number;
    startTime: string | null;
  },
): StudentAttendanceRecord[] {
  const sessionDateFallback = session.startTime
    ? new Date(session.startTime).toISOString().split('T')[0]
    : null;

  return invitedStudents.map((student) => {
    const userId = Number(student.userId);
    const entry = perUserStatus.get(userId);
    const rawRecord = rawRecordByUserId.get(userId);

    return {
      id: rawRecord?.id ?? null,
      userId,
      batchId: session.batchId,
      bootcampId: session.bootcampId,
      sessionId: session.id,
      attendanceDate: rawRecord?.attendanceDate ?? sessionDateFallback,
      status: entry?.status ?? 'absent',
      version: rawRecord?.version ?? null,
      duration: entry?.duration ?? 0,
      createdAt: rawRecord?.createdAt ?? null,
      email: student.email || null,
      name: student.name || null,
    };
  });
}
