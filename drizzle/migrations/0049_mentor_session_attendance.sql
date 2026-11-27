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

-- Databases that ran an earlier version of this migration have the table as
-- zuvy_mentor_booking_attendance: rename it (keeping its rows) instead of
-- creating an empty one.
DO $$
BEGIN
  IF to_regclass('zuvy_mentor_booking_attendance') IS NOT NULL
     AND to_regclass('zuvy_mentor_session_attendance') IS NULL THEN
    ALTER TABLE "zuvy_mentor_booking_attendance"
      RENAME TO "zuvy_mentor_session_attendance";
    ALTER TABLE "zuvy_mentor_session_attendance"
      RENAME CONSTRAINT "uniq_mentor_booking_attendance_booking"
      TO "uniq_mentor_session_attendance_booking";
  END IF;
END $$;

-- Postgres keeps the old names on the primary key, foreign key and id
-- sequence after a table rename; give them the new names too.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'zuvy_mentor_booking_attendance_pkey') THEN
    ALTER TABLE "zuvy_mentor_session_attendance"
      RENAME CONSTRAINT "zuvy_mentor_booking_attendance_pkey"
      TO "zuvy_mentor_session_attendance_pkey";
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'zuvy_mentor_booking_attendance_mentor_booking_id_fkey') THEN
    ALTER TABLE "zuvy_mentor_session_attendance"
      RENAME CONSTRAINT "zuvy_mentor_booking_attendance_mentor_booking_id_fkey"
      TO "zuvy_mentor_session_attendance_mentor_booking_id_fkey";
  END IF;
  IF to_regclass('zuvy_mentor_booking_attendance_id_seq') IS NOT NULL THEN
    ALTER SEQUENCE "zuvy_mentor_booking_attendance_id_seq"
      RENAME TO "zuvy_mentor_session_attendance_id_seq";
  END IF;
END $$;

 