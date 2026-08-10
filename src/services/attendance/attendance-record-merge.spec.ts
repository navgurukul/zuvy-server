import {
  buildStudentAttendanceRecords,
  RawAttendanceRecord,
  StudentAttendanceStatusEntry,
} from './attendance-record-merge';

const session = {
  id: 1958,
  batchId: 707,
  bootcampId: 1082,
  startTime: '2026-07-27T06:36:00.000Z',
};

describe('buildStudentAttendanceRecords', () => {
  it('includes every invited student, even ones with no attendance record at all', () => {
    const invited = [
      { userId: 1, email: 'a@x.com', name: 'A' },
      { userId: 2, email: 'b@x.com', name: 'B' },
    ];
    const perUserStatus = new Map<number, StudentAttendanceStatusEntry>([
      [1, { status: 'present', duration: 100 }],
      // user 2 has no entry at all
    ]);
    const rawRecordByUserId = new Map<number, RawAttendanceRecord>();

    const result = buildStudentAttendanceRecords(
      invited,
      perUserStatus,
      rawRecordByUserId,
      session,
    );

    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({
      userId: 2,
      status: 'absent',
      duration: 0,
      id: null,
      version: null,
      createdAt: null,
    });
  });

  it('fills id/version/createdAt/attendanceDate from the raw record when one exists', () => {
    const invited = [{ userId: 1, email: 'a@x.com', name: 'A' }];
    const perUserStatus = new Map<number, StudentAttendanceStatusEntry>([
      [1, { status: 'present', duration: 500 }],
    ]);
    const rawRecordByUserId = new Map<number, RawAttendanceRecord>([
      [
        1,
        {
          id: 9999,
          userId: 1,
          attendanceDate: '2026-07-27',
          version: 'v1',
          createdAt: '2026-07-27T07:00:00.000Z',
        },
      ],
    ]);

    const [record] = buildStudentAttendanceRecords(
      invited,
      perUserStatus,
      rawRecordByUserId,
      session,
    );

    expect(record).toEqual({
      id: 9999,
      userId: 1,
      batchId: 707,
      bootcampId: 1082,
      sessionId: 1958,
      attendanceDate: '2026-07-27',
      status: 'present',
      version: 'v1',
      duration: 500,
      createdAt: '2026-07-27T07:00:00.000Z',
      email: 'a@x.com',
      name: 'A',
    });
  });

  it('falls back to the session date when no raw record exists for that student', () => {
    const invited = [{ userId: 1, email: 'a@x.com', name: 'A' }];
    const result = buildStudentAttendanceRecords(
      invited,
      new Map(),
      new Map(),
      session,
    );

    expect(result[0].attendanceDate).toBe('2026-07-27');
  });

  it('always populates batchId/bootcampId/sessionId from the session, never null, regardless of record existence', () => {
    const invited = [
      { userId: 1, email: 'a@x.com', name: 'A' },
      { userId: 2, email: 'b@x.com', name: 'B' },
    ];
    const perUserStatus = new Map<number, StudentAttendanceStatusEntry>([
      [1, { status: 'present', duration: 500 }],
    ]);
    const rawRecordByUserId = new Map<number, RawAttendanceRecord>([
      [
        1,
        {
          id: 1,
          userId: 1,
          attendanceDate: null,
          version: null,
          createdAt: null,
        },
      ],
    ]);

    const result = buildStudentAttendanceRecords(
      invited,
      perUserStatus,
      rawRecordByUserId,
      session,
    );

    for (const record of result) {
      expect(record.batchId).toBe(707);
      expect(record.bootcampId).toBe(1082);
      expect(record.sessionId).toBe(1958);
    }
  });

  it('never defaults an empty-string status to "absent" — only missing entries default', () => {
    // Regression guard for the `||` vs `??` distinction: an explicit empty
    // string is not the same as "no entry", even though both are falsy.
    const invited = [{ userId: 1, email: 'a@x.com', name: 'A' }];
    const perUserStatus = new Map<number, StudentAttendanceStatusEntry>([
      [1, { status: '', duration: 0 }],
    ]);

    const [record] = buildStudentAttendanceRecords(
      invited,
      perUserStatus,
      new Map(),
      session,
    );

    expect(record.status).toBe('');
  });
});
