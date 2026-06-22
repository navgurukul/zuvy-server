BEGIN;

-- Recording worker/webhook schema for the current Zoom -> YouTube flow.
-- This file intentionally avoids debug SELECTs and hard-coded data updates.

CREATE TABLE IF NOT EXISTS zuvy_session_recordings (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL REFERENCES zuvy_sessions(id) ON DELETE CASCADE,
  zoom_meeting_id TEXT NOT NULL,
  zoom_meeting_uuid TEXT DEFAULT NULL,
  zoom_recording_id TEXT,
  status VARCHAR(32) NOT NULL DEFAULT 'DISCOVERED',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  drive_file_id TEXT,
  drive_link TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE zuvy_session_recordings
  ADD COLUMN IF NOT EXISTS zoom_meeting_uuid TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS zoom_recording_id TEXT,
  ADD COLUMN IF NOT EXISTS zoom_recording_manifest JSONB,
  ADD COLUMN IF NOT EXISTS local_segment_paths JSONB,
  ADD COLUMN IF NOT EXISTS merged_file_path TEXT,
  ADD COLUMN IF NOT EXISTS metadata_verified BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS segments_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS live_checked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_start TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_end TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_final_merged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_error TEXT,
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS drive_link TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE zuvy_sessions
  ADD COLUMN IF NOT EXISTS youtube_video_id TEXT,
  ADD COLUMN IF NOT EXISTS final_video_path TEXT,
  ADD COLUMN IF NOT EXISTS final_uploaded BOOLEAN DEFAULT FALSE;

UPDATE zuvy_session_recordings
SET retry_count = 0
WHERE retry_count IS NULL;

UPDATE zuvy_session_recordings
SET segments_count = 0
WHERE segments_count IS NULL;

UPDATE zuvy_session_recordings
SET metadata_verified = FALSE
WHERE metadata_verified IS NULL;

UPDATE zuvy_session_recordings
SET is_final_merged = FALSE
WHERE is_final_merged IS NULL;

UPDATE zuvy_sessions
SET final_uploaded = FALSE
WHERE final_uploaded IS NULL;

-- Remove duplicate rows before adding uniqueness. Prefer completed/uploaded rows,
-- then the most recently updated row.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, zoom_meeting_uuid
      ORDER BY
        CASE
          WHEN status = 'COMPLETED' THEN 0
          WHEN drive_file_id IS NOT NULL THEN 1
          ELSE 2
        END,
        updated_at DESC NULLS LAST,
        created_at DESC NULLS LAST,
        id DESC
    ) AS rn
  FROM zuvy_session_recordings
  WHERE zoom_meeting_uuid IS NOT NULL
)
DELETE FROM zuvy_session_recordings r
USING ranked d
WHERE r.id = d.id
  AND d.rn > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY session_id, zoom_meeting_id
      ORDER BY
        CASE
          WHEN status = 'COMPLETED' THEN 0
          WHEN drive_file_id IS NOT NULL THEN 1
          ELSE 2
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

ALTER TABLE zuvy_session_recordings
  ALTER COLUMN status SET DEFAULT 'DISCOVERED',
  ALTER COLUMN status SET NOT NULL,
  ALTER COLUMN retry_count SET DEFAULT 0,
  ALTER COLUMN segments_count SET DEFAULT 0,
  ALTER COLUMN metadata_verified SET DEFAULT FALSE,
  ALTER COLUMN is_final_merged SET DEFAULT FALSE;

ALTER TABLE zuvy_session_recordings
  DROP CONSTRAINT IF EXISTS chk_recording_status;

ALTER TABLE zuvy_session_recordings
  ADD CONSTRAINT chk_recording_status
  CHECK (
    status IN (
      'DISCOVERED',
      'PROCESSING_METADATA',
      'METADATA_READY',
      'PROCESSING_DOWNLOAD',
      'DOWNLOADING',
      'DOWNLOADED',
      'MERGING',
      'MERGED',
      'PROCESSING_UPLOAD',
      'COMPLETED',
      'FAILED',
      'PERMANENT_FAILED'
    )
  );

ALTER TABLE zuvy_session_recordings
  DROP CONSTRAINT IF EXISTS uniq_session_recording;

ALTER TABLE zuvy_session_recordings
  DROP CONSTRAINT IF EXISTS uniq_session_uuid;

DROP INDEX IF EXISTS uniq_session_uuid;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_uuid_not_null
ON zuvy_session_recordings (session_id, zoom_meeting_uuid)
WHERE zoom_meeting_uuid IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_session_recording_meeting
ON zuvy_session_recordings (session_id, zoom_meeting_id);

CREATE INDEX IF NOT EXISTS idx_session_recordings_status_retry
ON zuvy_session_recordings (status, next_retry_at, created_at);

CREATE INDEX IF NOT EXISTS idx_session_recordings_session_id
ON zuvy_session_recordings (session_id);

CREATE INDEX IF NOT EXISTS idx_session_recordings_zoom_meeting_id
ON zuvy_session_recordings (zoom_meeting_id);

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_meeting_id
ON zuvy_zoom_webhook_events (meeting_id);

COMMIT;
