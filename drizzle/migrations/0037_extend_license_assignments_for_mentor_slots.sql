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
