-- ============================================
-- Add durable S3 storage tracking for session recordings, written and
-- checksum-verified before the YouTube upload. Purely additive — no
-- existing columns, constraints, or rows are touched. In particular,
-- zuvy_sessions.s3link keeps holding the YouTube URL exactly as before
-- (see comment on that column in drizzle/schema.ts); the real S3 pointer
-- goes in the new recording_s3_bucket/recording_s3_key columns instead.
-- ============================================

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS s3_bucket TEXT,
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS s3_checksum_sha256 TEXT,
ADD COLUMN IF NOT EXISTS s3_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS s3_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS s3_multipart_upload_id TEXT,
ADD COLUMN IF NOT EXISTS s3_uploaded_parts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS zoom_deleted_at TIMESTAMPTZ;

ALTER TABLE zuvy_mentor_session_recordings
ADD COLUMN IF NOT EXISTS s3_bucket TEXT,
ADD COLUMN IF NOT EXISTS s3_key TEXT,
ADD COLUMN IF NOT EXISTS s3_checksum_sha256 TEXT,
ADD COLUMN IF NOT EXISTS s3_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS s3_verified BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS s3_multipart_upload_id TEXT,
ADD COLUMN IF NOT EXISTS s3_uploaded_parts JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS zoom_deleted_at TIMESTAMPTZ;

ALTER TABLE zuvy_sessions
ADD COLUMN IF NOT EXISTS recording_s3_bucket TEXT,
ADD COLUMN IF NOT EXISTS recording_s3_key TEXT;
