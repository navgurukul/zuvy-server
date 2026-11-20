-- Reschedule rules (ST4). New columns on zuvy_mentor_slot_booking:
--
--   reschedule_reason          Why the student asked to move the session
--                              (it was checked, then thrown away).
--   accepted_reschedule_count  Reschedules the mentor has accepted for this
--                              booking; a student can move a booking only
--                              max_accepted_reschedules times (config, 1).
--   reschedule_seat_held       The pending request holds a seat (and the
--                              Zoom licence) on the proposed slot, so nobody
--                              else can book it while the mentor decides.
--                              Accept keeps the seat; decline, expiry and
--                              cancel give it back. False on requests made
--                              before this change, which hold nothing.
--
-- reschedule_status also takes the values 'accepted' and 'expired' now, and
-- keeps the answer after the mentor replies ('accepted' | 'declined' |
-- 'expired'), so the student's screen can say what happened.
-- Safe to run more than once.

ALTER TABLE "zuvy_mentor_slot_booking"
  ADD COLUMN IF NOT EXISTS "reschedule_reason" text;

ALTER TABLE "zuvy_mentor_slot_booking"
  ADD COLUMN IF NOT EXISTS "accepted_reschedule_count" integer DEFAULT 0 NOT NULL;

ALTER TABLE "zuvy_mentor_slot_booking"
  ADD COLUMN IF NOT EXISTS "reschedule_seat_held" boolean DEFAULT false NOT NULL;

-- The expiry job looks up pending requests every minute.
CREATE INDEX IF NOT EXISTS "idx_booking_reschedule_pending"
  ON "zuvy_mentor_slot_booking" ("reschedule_status")
  WHERE "reschedule_status" = 'pending';
