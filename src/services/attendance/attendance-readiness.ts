export type AttendanceReadinessState =
  | 'ready'
  | 'not_started'
  | 'not_ended'
  | 'processing'
  | 'failed';

export interface AttendanceReadiness {
  ready: boolean;
  state: AttendanceReadinessState;
  reason: string | null;
}

export interface AttendanceJobSnapshot {
  status: string;
  lastError?: string | null;
}

/**
 * Decides whether attendance is safe to show for a Zoom session, using the
 * Zoom-webhook job queue (zuvy_session_attendance_jobs) as the ONLY
 * readiness gate — deliberately not `zuvy_sessions.status`.
 *
 * `zuvy_sessions.status` is not kept in sync proactively: it's only
 * refreshed as a side effect of ClassesService.updatingStatusOfClass(),
 * which itself is only called from a handful of unrelated endpoints
 * (loading a course's live-class list, a student's upcoming classes, etc).
 * A session can sit at 'ongoing' in the DB long after the class — and its
 * attendance computation — has actually finished, simply because nothing
 * happened to trigger that refresh. Gating on it reintroduces exactly the
 * kind of accidental coupling this endpoint exists to avoid (previously to
 * the recording pipeline; here to an unrelated status-refresh side effect).
 *
 * The job row's existence is itself proof the meeting ended (it's only
 * created once Zoom reports the meeting over), so it's used both to gate
 * readiness and, when no job exists yet, together with `now`/`endTime` to
 * give a more specific "hasn't ended yet" vs "ended, not processed yet"
 * reason — purely for a better message, never for the ready/not-ready gate
 * itself.
 *
 * Pure and DB-free by design so this decision logic is unit-testable
 * without a live database — see attendance-readiness.spec.ts.
 */
export function resolveZoomAttendanceReadiness(
  now: Date,
  sessionEndTime: Date,
  latestJob: AttendanceJobSnapshot | null,
  hasExistingRecords: boolean,
): AttendanceReadiness {
  // The job queue only reflects sessions processed by the webhook-driven
  // pipeline. Older sessions (predating that system), or ones populated by
  // the daily backfill cron or the manual reclassify tool, get real
  // zuvy_student_attendance_records rows without ever having a job row at
  // all. Checking this first, before the job, means those sessions don't
  // get permanently stuck reporting "not started" despite already having
  // correct data.
  if (hasExistingRecords) {
    return { ready: true, state: 'ready', reason: null };
  }

  if (!latestJob) {
    if (now < sessionEndTime) {
      return {
        ready: false,
        state: 'not_ended',
        reason: 'This class has not finished yet.',
      };
    }
    return {
      ready: false,
      state: 'not_started',
      reason: 'Attendance has not started processing for this class yet.',
    };
  }

  switch (latestJob.status) {
    case 'COMPLETED':
      return { ready: true, state: 'ready', reason: null };
    case 'PERMANENT_FAILED':
      return {
        ready: false,
        state: 'failed',
        reason:
          latestJob.lastError ||
          'Attendance computation failed and will not be retried automatically.',
      };
    case 'DISCOVERED':
    case 'PROCESSING':
    case 'FAILED':
    default:
      return {
        ready: false,
        state: 'processing',
        reason:
          'Attendance is still being processed. Please check back shortly.',
      };
  }
}

/**
 * Decides readiness for a non-Zoom (Google Meet) session. That pipeline has
 * no job-queue table to consult, so "has any attendance data been recorded
 * at all" is the best available readiness signal — same principle as
 * above: not gated on `zuvy_sessions.status`.
 */
export function resolveGoogleMeetAttendanceReadiness(
  now: Date,
  sessionEndTime: Date,
  hasAnyAttendanceData: boolean,
): AttendanceReadiness {
  if (hasAnyAttendanceData) {
    return { ready: true, state: 'ready', reason: null };
  }

  if (now < sessionEndTime) {
    return {
      ready: false,
      state: 'not_ended',
      reason: 'This class has not finished yet.',
    };
  }

  return {
    ready: false,
    state: 'not_started',
    reason: 'Attendance has not been fetched for this class yet.',
  };
}
