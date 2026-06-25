ALTER TABLE "main"."license_assignments"
  ADD COLUMN IF NOT EXISTS "mentor_slot_availability_id" integer,
  ADD COLUMN IF NOT EXISTS "source_type" varchar(50) NOT NULL DEFAULT 'class_session';

ALTER TABLE "main"."license_assignments"
  ALTER COLUMN "session_id" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'license_assignments_mentor_slot_availability_id_fkey'
  ) THEN
    ALTER TABLE "main"."license_assignments"
      ADD CONSTRAINT "license_assignments_mentor_slot_availability_id_fkey"
      FOREIGN KEY ("mentor_slot_availability_id")
      REFERENCES "main"."zuvy_mentor_slot_availability"("id")
      ON DELETE CASCADE;
  END IF;
END $$;

UPDATE "main"."license_assignments"
SET "source_type" = 'class_session'
WHERE "source_type" IS NULL;

CREATE INDEX IF NOT EXISTS "idx_license_assignments_mentor_slot"
  ON "main"."license_assignments" ("mentor_slot_availability_id");

CREATE INDEX IF NOT EXISTS "idx_license_assignments_source_type"
  ON "main"."license_assignments" ("source_type");

CREATE INDEX IF NOT EXISTS "idx_license_assignments_time_window"
  ON "main"."license_assignments" ("start_time", "end_time");

ALTER TABLE "main"."zuvy_mentor_session_recordings"
  ADD COLUMN IF NOT EXISTS "zoom_recording_manifest" jsonb,
  ADD COLUMN IF NOT EXISTS "local_segment_paths" jsonb,
  ADD COLUMN IF NOT EXISTS "merged_file_path" text,
  ADD COLUMN IF NOT EXISTS "metadata_verified" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "segments_count" integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "live_checked_at" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "recording_start" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "recording_end" timestamp with time zone,
  ADD COLUMN IF NOT EXISTS "is_final_merged" boolean DEFAULT false;

UPDATE "main"."zuvy_mentor_session_recordings"
SET
  "status" = 'DISCOVERED',
  "retry_count" = 0,
  "next_retry_at" = NULL,
  "last_error" = NULL,
  "updated_at" = NOW()
WHERE "status" = 'PERMANENT_FAILED'
  AND (
    "last_error" ILIKE '%merged_file_path%'
    OR "last_error" ILIKE '%zoom_recording_manifest%'
    OR "last_error" ILIKE '%local_segment_paths%'
    OR "last_error" ILIKE '%metadata_verified%'
    OR "last_error" ILIKE '%segments_count%'
    OR "last_error" ILIKE '%recording_start%'
    OR "last_error" ILIKE '%recording_end%'
    OR "last_error" ILIKE '%is_final_merged%'
  );