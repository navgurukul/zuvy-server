-- ============================================
-- Adds tracking for the nightly YouTube health-check + Glacier-restore job.
-- Purely additive — no existing columns, constraints, or rows are touched.
-- This job only ever acts on rows already status = 'COMPLETED' (a recording
-- that published successfully and later broke on YouTube's side); it never
-- affects the primary Zoom -> S3 -> YouTube upload pipeline.
-- ============================================

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS restore_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS restore_tier VARCHAR(20),
ADD COLUMN IF NOT EXISTS restore_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS restore_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS youtube_lost_detected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS youtube_last_checked_at TIMESTAMPTZ;

ALTER TABLE zuvy_mentor_session_recordings
ADD COLUMN IF NOT EXISTS restore_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS restore_tier VARCHAR(20),
ADD COLUMN IF NOT EXISTS restore_requested_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS restore_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS youtube_lost_detected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS youtube_last_checked_at TIMESTAMPTZ;
