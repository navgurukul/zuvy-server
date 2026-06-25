BEGIN;

-- Manual rollback for the recording-merge schema experiments.
--
-- This is intentionally NOT in drizzle/migrations because it is a manual
-- rollback script. It removes schema objects introduced for multi-part
-- recording merge work and restores the original one parent recording row per
-- session_id + zoom_meeting_id shape from 0036_fix_session_recordings_current_flow.sql.
--
-- Covers:
-- - 0037_allow_multiple_session_recording_parts.sql
-- - revert_0037_allow_multiple_session_recording_parts.sql
-- - 0038_add_session_recording_parts.sql
-- - 0039_recover_session_recording_upload_jobs.sql

-- 0037 added these helper indexes when it temporarily removed parent
-- uniqueness. Drop them if they exist.
DROP INDEX IF EXISTS idx_session_recordings_session_meeting;
DROP INDEX IF EXISTS idx_session_recordings_final_merge;

-- 0038/0039 added the child parts table and indexes. Drop the table to remove
-- all related schema objects in one step.
DROP TABLE IF EXISTS zuvy_session_recording_parts;

-- Recreate the parent uniqueness from 0036 safely. If any duplicate parent
-- rows exist from a previous partial run, keep the best available row first.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, zoom_meeting_id
      ORDER BY
        CASE
          WHEN status = 'COMPLETED' THEN 0
          WHEN drive_file_id IS NOT NULL THEN 1
          WHEN is_final_merged = TRUE THEN 2
          WHEN merged_file_path IS NOT NULL THEN 3
          ELSE 4
        END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM zuvy_session_recordings
)
DELETE FROM zuvy_session_recordings r
USING ranked d
WHERE r.id = d.id
  AND d.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_meeting
ON zuvy_session_recordings (session_id, zoom_meeting_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_uuid_not_null
ON zuvy_session_recordings (session_id, zoom_meeting_uuid)
WHERE zoom_meeting_uuid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_session_recordings_status_retry
ON zuvy_session_recordings (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id
ON zuvy_session_recordings (session_id);

CREATE INDEX IF NOT EXISTS idx_session_recordings_zoom_meeting_id
ON zuvy_session_recordings (zoom_meeting_id);

-- Return any rows left in transient worker states back to retryable state.
-- This is data-state cleanup, not schema, but it prevents the old one-row flow
-- from staying stuck after the rollback.
UPDATE zuvy_session_recordings
SET
  status = 'DISCOVERED',
  retry_count = 0,
  next_retry_at = NOW(),
  last_error = NULL,
  updated_at = NOW()
WHERE status IN (
  'PROCESSING_METADATA',
  'PROCESSING_DOWNLOAD',
  'MERGING',
  'PROCESSING_UPLOAD'
);

COMMIT;
