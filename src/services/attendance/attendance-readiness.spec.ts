import {
  resolveZoomAttendanceReadiness,
  resolveGoogleMeetAttendanceReadiness,
} from './attendance-readiness';

const endTime = new Date('2026-07-27T07:06:00.000Z');
const beforeEnd = new Date('2026-07-27T07:00:00.000Z');
const afterEnd = new Date('2026-07-27T07:20:00.000Z');

describe('resolveZoomAttendanceReadiness', () => {
  it('is not ready and "not_ended" when the class has not reached its end time and no job exists', () => {
    const result = resolveZoomAttendanceReadiness(beforeEnd, endTime, null);
    expect(result).toEqual({
      ready: false,
      state: 'not_ended',
      reason: expect.any(String),
    });
  });

  it('is not ready and "not_started" once past end time but no job has been created yet', () => {
    const result = resolveZoomAttendanceReadiness(afterEnd, endTime, null);
    expect(result.ready).toBe(false);
    expect(result.state).toBe('not_started');
  });

  it('is ready as soon as the job is COMPLETED — regardless of the class end time or "now"', () => {
    // Deliberately using `beforeEnd` here: this is the exact regression case
    // reported — zuvy_sessions.status can lag behind reality (it's only
    // refreshed as a side effect of unrelated endpoints), so readiness must
    // never depend on "now vs end time" once a job actually exists.
    const result = resolveZoomAttendanceReadiness(beforeEnd, endTime, {
      status: 'COMPLETED',
    });
    expect(result).toEqual({ ready: true, state: 'ready', reason: null });
  });

  it.each(['DISCOVERED', 'PROCESSING', 'FAILED'])(
    'is "processing" (not ready) while job status is %s',
    (status) => {
      const result = resolveZoomAttendanceReadiness(afterEnd, endTime, {
        status,
      });
      expect(result.ready).toBe(false);
      expect(result.state).toBe('processing');
    },
  );

  it('is "failed" (not ready) once retries are exhausted, surfacing the last error', () => {
    const result = resolveZoomAttendanceReadiness(afterEnd, endTime, {
      status: 'PERMANENT_FAILED',
      lastError: 'Zoom API returned 429',
    });
    expect(result.ready).toBe(false);
    expect(result.state).toBe('failed');
    expect(result.reason).toBe('Zoom API returned 429');
  });
});

describe('resolveGoogleMeetAttendanceReadiness', () => {
  it('is not ready and "not_ended" before end time when no data exists', () => {
    const result = resolveGoogleMeetAttendanceReadiness(
      beforeEnd,
      endTime,
      false,
    );
    expect(result.ready).toBe(false);
    expect(result.state).toBe('not_ended');
  });

  it('is not ready and "not_started" after end time when no data exists yet', () => {
    const result = resolveGoogleMeetAttendanceReadiness(
      afterEnd,
      endTime,
      false,
    );
    expect(result.ready).toBe(false);
    expect(result.state).toBe('not_started');
  });

  it('is ready as soon as attendance data exists, regardless of end time', () => {
    const result = resolveGoogleMeetAttendanceReadiness(
      beforeEnd,
      endTime,
      true,
    );
    expect(result).toEqual({ ready: true, state: 'ready', reason: null });
  });
});
