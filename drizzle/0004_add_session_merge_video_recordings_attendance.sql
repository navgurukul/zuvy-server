-- Migration 0004: add session merge, video recordings, attendance records, and merge-related columns
-- Safety: use IF NOT EXISTS / add columns idempotently

BEGIN;

-- 1. Columns added to zuvy_sessions
ALTER TABLE "main"."zuvy_sessions" ADD COLUMN IF NOT EXISTS "has_been_merged" boolean NOT NULL DEFAULT false;
ALTER TABLE "main"."zuvy_sessions" ADD COLUMN IF NOT EXISTS "is_parent_session" boolean NOT NULL DEFAULT false;
ALTER TABLE "main"."zuvy_sessions" ADD COLUMN IF NOT EXISTS "is_child_session" boolean NOT NULL DEFAULT false;
ALTER TABLE "main"."zuvy_sessions" ADD COLUMN IF NOT EXISTS "invited_students" jsonb NOT NULL DEFAULT '[]';
-- second_batch_id handled in prior migration (0003); ensure present (noop if already)
ALTER TABLE "main"."zuvy_sessions" ADD COLUMN IF NOT EXISTS "second_batch_id" integer;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_sessions" ADD CONSTRAINT "zuvy_sessions_second_batch_id_zuvy_batches_id_fk" FOREIGN KEY ("second_batch_id") REFERENCES "main"."zuvy_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. zuvy_session_merge table
CREATE TABLE IF NOT EXISTS "main"."zuvy_session_merge" (
  "id" serial PRIMARY KEY,
  "child_session_id" integer NOT NULL,
  "parent_session_id" integer NOT NULL,
  "redirect_meeting_url" text,
  "merged_justification" text,
  "is_active" boolean DEFAULT true,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_session_merge" ADD CONSTRAINT "zuvy_session_merge_child_session_id_fkey" FOREIGN KEY ("child_session_id") REFERENCES "main"."zuvy_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_session_merge" ADD CONSTRAINT "zuvy_session_merge_parent_session_id_fkey" FOREIGN KEY ("parent_session_id") REFERENCES "main"."zuvy_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. zuvy_session_video_recordings table
CREATE TABLE IF NOT EXISTS "main"."zuvy_session_video_recordings" (
  "id" serial PRIMARY KEY,
  "recording_url" text NOT NULL,
  "recording_size" integer NOT NULL,
  "recording_duration" integer NOT NULL,
  "session_id" integer NOT NULL,
  "batch_id" integer,
  "bootcamp_id" integer,
  "user_id" integer,
  "created_at" timestamptz DEFAULT now(),
  "updated_at" timestamptz DEFAULT now()
);
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_session_video_recordings" ADD CONSTRAINT "zuvy_session_video_recordings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "main"."zuvy_sessions"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_session_video_recordings" ADD CONSTRAINT "zuvy_session_video_recordings_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_session_video_recordings" ADD CONSTRAINT "zuvy_session_video_recordings_bootcamp_id_fkey" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_session_video_recordings" ADD CONSTRAINT "zuvy_session_video_recordings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON UPDATE NO ACTION ON DELETE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. zuvy_student_attendance_records table & enum status via CHECK (enum not native in drizzle sql out)
CREATE TABLE IF NOT EXISTS "main"."zuvy_student_attendance_records" (
  "id" serial PRIMARY KEY,
  "user_id" integer NOT NULL,
  "batch_id" integer NOT NULL,
  "bootcamp_id" integer NOT NULL,
  "session_id" integer NOT NULL,
  "attendance_date" date NOT NULL,
  "status" varchar(10) NOT NULL DEFAULT 'absent',
  "version" varchar(10)
);
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_student_attendance_records" ADD CONSTRAINT "zuvy_student_attendance_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_student_attendance_records" ADD CONSTRAINT "zuvy_student_attendance_records_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_student_attendance_records" ADD CONSTRAINT "zuvy_student_attendance_records_bootcamp_id_fkey" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "main"."zuvy_student_attendance_records" ADD CONSTRAINT "zuvy_student_attendance_records_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "main"."zuvy_sessions"("id");
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMIT;
