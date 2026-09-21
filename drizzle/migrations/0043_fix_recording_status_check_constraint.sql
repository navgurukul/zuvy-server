-- ============================================
-- Fixes a real production bug found while testing the zuvy-prod S3 pipeline
-- (session 2217 / job 2096, 2026-09-21): the S3 feature (migration 0041)
-- introduced three new `status` values in recording-worker.service.ts
-- (S3_UPLOADED, PROCESSING_YOUTUBE_UPLOAD, YOUTUBE_PROCESSING) but never
-- updated the `chk_recording_status` CHECK constraint that was defined
-- before this feature existed — so every attempt to write one of these new
-- values fails with:
--   "new row for relation "zuvy_session_recordings" violates check
--    constraint "chk_recording_status""
-- This is purely additive to the allowed-values list — no existing rows or
-- other constraints are touched. Only `main.zuvy_session_recordings` needs
-- this (confirmed via `SHOW search_path` = 'main'); the separate
-- `stage_template.zuvy_session_recordings` schema is not on this app's
-- search_path and is left alone. `zuvy_mentor_session_recordings` has no
-- equivalent CHECK constraint at all, so it isn't affected by this bug.
-- ============================================

ALTER TABLE zuvy_session_recordings DROP CONSTRAINT IF EXISTS chk_recording_status;

ALTER TABLE zuvy_session_recordings ADD CONSTRAINT chk_recording_status CHECK (
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
    'S3_UPLOADED',
    'PROCESSING_YOUTUBE_UPLOAD',
    'YOUTUBE_PROCESSING',
    'COMPLETED',
    'FAILED',
    'PERMANENT_FAILED'
  )
);
