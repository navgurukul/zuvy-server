-- ============================================
-- Follow-up to 0043: that migration added S3_UPLOADED, PROCESSING_YOUTUBE_UPLOAD,
-- and YOUTUBE_PROCESSING to chk_recording_status, but missed a fourth new status
-- value: PROCESSING_S3_UPLOAD. pickJob() sets this transiently when moving a
-- MERGED row forward (see recording-worker.service.ts pickJob()'s CASE
-- expression: `WHEN status = 'MERGED' THEN 'PROCESSING_S3_UPLOAD'`), so this
-- crashed every single job the moment it finished merging (confirmed live:
-- session 2218 / job 2097, 2026-09-21 11:19:48 — "Merge completed and
-- verified" immediately followed by the same chk_recording_status violation
-- 0043 was meant to fix). Purely additive, no data touched.
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
    'PROCESSING_S3_UPLOAD',
    'S3_UPLOADED',
    'PROCESSING_YOUTUBE_UPLOAD',
    'YOUTUBE_PROCESSING',
    'COMPLETED',
    'FAILED',
    'PERMANENT_FAILED'
  )
);
