-- ============================================
-- Fixes a real cross-machine race discovered while testing the S3/YouTube
-- pipeline (2026-09-21): download/merge/upload steps read and write LOCAL
-- disk files under temp-recordings/, but pickJob()'s `FOR UPDATE SKIP
-- LOCKED` job queue has no concept of which physical worker instance is
-- running it -- it happily lets a different dev machine (or the deployed
-- container) pick up the NEXT step of a job that another instance already
-- downloaded/merged locally. Confirmed live: the same job's
-- merged_file_path pointed at three different filesystems across its own
-- history (two different developer machines' absolute Windows paths, and
-- the container's /app/temp-recordings), and the step that ran on whichever
-- instance didn't have that file failed with "Merged file not found" /
-- "Recording segment missing for merge".
--
-- worker_instance_id pins a job to the instance that first touches it.
-- pickJob() (see recording-worker.service.ts) only lets a different
-- instance take over once the row has gone stale (no update in 30 minutes),
-- so a crashed/closed instance doesn't permanently strand the job.
-- Purely additive -- no existing columns, constraints, or rows are touched.
-- ============================================

ALTER TABLE zuvy_session_recordings
ADD COLUMN IF NOT EXISTS worker_instance_id TEXT;

ALTER TABLE zuvy_mentor_session_recordings
ADD COLUMN IF NOT EXISTS worker_instance_id TEXT;
