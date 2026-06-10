BEGIN;

-- ============================================
-- 1. FIX WRONG UNIQUE CONSTRAINT
-- ============================================

ALTER TABLE zuvy_session_recordings
DROP CONSTRAINT IF EXISTS uniq_session_recording;

-- ============================================
-- 2. ENSURE CORRECT UNIQUE CONSTRAINT
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'uniq_session_uuid'
  ) THEN
    ALTER TABLE zuvy_session_recordings
    ADD CONSTRAINT uniq_session_uuid
    UNIQUE (session_id, zoom_meeting_uuid);
  END IF;
END $$;

-- ============================================
-- 3. ADD NEW COLUMNS (SAFE / IF NOT EXISTS)
-- ============================================

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS zoom_recording_manifest JSONB;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS local_segment_paths JSONB;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS merged_file_path TEXT;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS metadata_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS segments_count INTEGER DEFAULT 0;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS live_checked_at TIMESTAMPTZ;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS recording_start TIMESTAMPTZ;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS recording_end TIMESTAMPTZ;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS is_final_merged BOOLEAN DEFAULT FALSE;

-- ============================================
-- 4. ADD INDEX FOR WEBHOOK PERFORMANCE
-- ============================================

CREATE INDEX IF NOT EXISTS idx_zoom_webhook_meeting_id
ON zuvy_zoom_webhook_events(meeting_id);

-- ============================================
-- 5. OPTIONAL: CLEAN INVALID DUPLICATES (SAFE)
-- ============================================

-- (Only runs if duplicates somehow exist)
DELETE FROM zuvy_session_recordings a
USING zuvy_session_recordings b
WHERE a.id < b.id
AND a.session_id = b.session_id
AND a.zoom_meeting_uuid = b.zoom_meeting_uuid;

SELECT conname, pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'zuvy_session_recordings';

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS zoom_recording_manifest JSONB,
ADD COLUMN IF NOT EXISTS local_segment_paths JSONB,
ADD COLUMN IF NOT EXISTS merged_file_path TEXT,
ADD COLUMN IF NOT EXISTS metadata_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS segments_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS live_checked_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recording_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS recording_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS is_final_merged BOOLEAN DEFAULT false;

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'zuvy_session_recordings';

SELECT
id,
status,
segments_count,
zoom_recording_manifest
FROM zuvy_session_recordings
ORDER BY created_at DESC;

-- -----------------------------------
-- 1 Remove WRONG constraint
-- -----------------------------------
ALTER TABLE main.zuvy_session_recordings
DROP CONSTRAINT IF EXISTS uniq_session_recording;

ALTER TABLE stage_template.zuvy_session_recordings
DROP CONSTRAINT IF EXISTS uniq_session_recording;
-- -----------------------------------
-- 2 Update status constraint
-- -----------------------------------
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
    'DOWNLOADED',
    'MERGING',
    'MERGED',
    'PROCESSING_UPLOAD',
    'COMPLETED',
    'FAILED',
    'PERMANENT_FAILED'
  )
);

ALTER TABLE stage_template.zuvy_session_recordings
DROP CONSTRAINT IF EXISTS fk_session_recordings_session;

SELECT
conname,
pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 'zuvy_session_recordings';

UPDATE zuvy_session_recordings
SET status = 'DISCOVERED'
WHERE id = 642;

SELECT current_database();
SELECT current_schema();

-- dev and main

SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name = 'zuvy_session_recordings';

SELECT column_name
FROM information_schema.columns
WHERE table_name='zuvy_session_recordings';


SHOW search_path;

SELECT
    conname,
    pg_get_constraintdef(c.oid),
    n.nspname AS schema_name
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE t.relname = 'zuvy_session_recordings';



SELECT
id,
segments_count,
zoom_recording_manifest
FROM main.zuvy_session_recordings
ORDER BY created_at DESC
LIMIT 1;

INSERT INTO main.zuvy_session_recordings (
  session_id,
  zoom_meeting_id,
  zoom_meeting_uuid,
  status,
  retry_count
)
VALUES (
  1433,
  'test-meeting',
  'uuid-test',
  'DISCOVERED',
  0
)
ON CONFLICT (session_id, zoom_meeting_uuid)
DO NOTHING;

SELECT
session_id,
zoom_meeting_uuid,
status
FROM zuvy_session_recordings
ORDER BY created_at DESC;