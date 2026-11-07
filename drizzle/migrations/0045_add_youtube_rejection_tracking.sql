-- ============================================
-- Distinguishes "YouTube rejected the video's content" (copyright/policy/
-- legal — retrying with the identical file is pointless) from every other
-- failure category, which all reuse the existing status enum without
-- needing a new value (avoids repeating the chk_recording_status
-- whack-a-mole from migrations 0043/0044). Purely additive.
-- ============================================

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS youtube_rejection_reason TEXT;

ALTER TABLE zuvy_mentor_session_recordings
ADD COLUMN IF NOT EXISTS youtube_rejection_reason TEXT;
