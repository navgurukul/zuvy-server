-- ============================================
-- Support merging multiple Zoom recording instances (same zoom_meeting_id,
-- different zoom_meeting_uuid) into a single video per session/booking.
-- Purely additive — no existing columns, constraints, or rows are touched.
-- ============================================

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS ingested_meeting_uuids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS previous_drive_file_id TEXT;

ALTER TABLE zuvy_mentor_session_recordings
ADD COLUMN IF NOT EXISTS ingested_meeting_uuids JSONB DEFAULT '[]'::jsonb;

ALTER TABLE zuvy_mentor_session_recordings
ADD COLUMN IF NOT EXISTS previous_drive_file_id TEXT;
