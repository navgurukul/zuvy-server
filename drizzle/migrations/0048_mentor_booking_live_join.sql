-- Admin "Live now" for mentor sessions (MM-07). Adds the part of MM-01 that it needs:
--   bootcamp_id        the course the booking belongs to (null on old bookings;
--                      the API falls back to zuvy_mentor_slot_management.bootcamp_id)
--   mentor_joined_at   when the mentor joined the meeting
--   student_joined_at  when the student joined the meeting
-- The join columns stay null until Zoom join events are stored (MM-03).
-- Safe to run more than once.

ALTER TABLE "zuvy_mentor_slot_booking"
  ADD COLUMN IF NOT EXISTS "bootcamp_id" integer
    REFERENCES "zuvy_bootcamps"("id") ON DELETE SET NULL;

ALTER TABLE "zuvy_mentor_slot_booking"
  ADD COLUMN IF NOT EXISTS "mentor_joined_at" timestamp with time zone;

ALTER TABLE "zuvy_mentor_slot_booking"
  ADD COLUMN IF NOT EXISTS "student_joined_at" timestamp with time zone;

CREATE INDEX IF NOT EXISTS "idx_booking_org"
  ON "zuvy_mentor_slot_booking" ("organization_id");

CREATE INDEX IF NOT EXISTS "idx_booking_bootcamp"
  ON "zuvy_mentor_slot_booking" ("bootcamp_id");

-- To undo:
-- DROP INDEX IF EXISTS "idx_booking_bootcamp";
-- DROP INDEX IF EXISTS "idx_booking_org";
-- ALTER TABLE "zuvy_mentor_slot_booking" DROP COLUMN IF EXISTS "student_joined_at";
-- ALTER TABLE "zuvy_mentor_slot_booking" DROP COLUMN IF EXISTS "mentor_joined_at";
-- ALTER TABLE "zuvy_mentor_slot_booking" DROP COLUMN IF EXISTS "bootcamp_id";
