-- Mentor session attendance, taken from Zoom's participant report after each
-- mentor session ends (MentorAttendanceJob). One row per booking.
--   status:  PENDING (report not available yet, the job retries)
--            RECORDED
--            UNAVAILABLE (the job gave up; the booking is left as it was)
--   outcome: BOTH_JOINED | STUDENT_NO_SHOW | MENTOR_NO_SHOW | NOBODY_JOINED
--   credit_refunded: the booking no longer uses one of the student's credits
--            (mentor no-show or nobody joined); the credit/cooldown recount
--            skips it.
-- A separate table, not new columns on zuvy_mentor_slot_booking, so reading
-- bookings doesn't depend on this migration.
-- Must be applied BEFORE deploying the code that uses it: cancelling a
-- booking (credit recount) and completing a session both read this table.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "zuvy_mentor_session_attendance" (
  "id" serial PRIMARY KEY NOT NULL,
  "mentor_booking_id" integer NOT NULL
    REFERENCES "zuvy_mentor_slot_booking" ("id") ON DELETE CASCADE,
  "status" varchar(20) DEFAULT 'PENDING' NOT NULL,
  "outcome" varchar(30),
  "mentor_attended_seconds" integer,
  "student_attended_seconds" integer,
  "credit_refunded" boolean DEFAULT false NOT NULL,
  "attempts" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  -- Also serves as the index the credit recount uses to look up a booking.
  CONSTRAINT "uniq_mentor_session_attendance_booking" UNIQUE ("mentor_booking_id")
);
