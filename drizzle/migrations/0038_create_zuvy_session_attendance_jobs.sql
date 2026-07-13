-- ============================================
-- Zoom Session Attendance Job Queue
-- Webhook-driven attendance computation, mirrors zuvy_session_recordings
-- ============================================

CREATE TABLE IF NOT EXISTS zuvy_session_attendance_jobs (
  id SERIAL PRIMARY KEY,

  session_id INTEGER NOT NULL REFERENCES zuvy_sessions(id) ON DELETE CASCADE,

  zoom_meeting_id TEXT NOT NULL,
  zoom_meeting_uuid TEXT DEFAULT NULL,

  batch_id INTEGER,
  bootcamp_id INTEGER,

  status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED',

  retry_count INTEGER DEFAULT 0,
  next_retry_at TIMESTAMPTZ,
  last_error TEXT,

  attendance_computed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uniq_session_attendance_uuid'
  ) THEN
    ALTER TABLE zuvy_session_attendance_jobs
    ADD CONSTRAINT uniq_session_attendance_uuid
    UNIQUE (session_id, zoom_meeting_uuid);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_session_attendance_job_status
ON zuvy_session_attendance_jobs(status);

CREATE INDEX IF NOT EXISTS idx_session_attendance_job_meeting_id
ON zuvy_session_attendance_jobs(zoom_meeting_id);

ALTER TABLE zuvy_session_attendance_jobs
DROP CONSTRAINT IF EXISTS chk_attendance_job_status;

ALTER TABLE zuvy_session_attendance_jobs
ADD CONSTRAINT chk_attendance_job_status
CHECK (
  status IN (
    'DISCOVERED',
    'PROCESSING',
    'COMPLETED',
    'FAILED',
    'PERMANENT_FAILED'
  )
);
