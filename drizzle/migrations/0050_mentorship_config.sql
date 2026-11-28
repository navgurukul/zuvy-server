-- Mentorship rules that Ops can change without a release. One row per key;
-- the app reads them through MentorshipConfigService (cached for 60 s, so a
-- change takes effect within a minute on every server).
--
--   total_credits            Mentorship sessions a student can book, across
--                            all their courses.
--   gap_days                 Days between a student's sessions, counted from
--                            the start of their latest session.
--   notice_hours             A slot can be booked, cancelled or rescheduled
--                            only this many hours or more before it starts.
--                            Slots starting sooner are not shown to students.
--   join_open_minutes        The join button opens this many minutes before
--                            the start.
--   max_accepted_reschedules Accepted reschedules allowed per booking.
--   credits_counted_from     Only bookings made from this moment use a credit.
--                            Moving it forward gives every student their full
--                            credits again (there is no automatic reset).
--
-- A missing row falls back to the default in MentorshipConfigService (the
-- values seeded here). Seeding never overwrites a value Ops has changed.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "zuvy_mentorship_config" (
  "key" varchar(64) PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "description" text,
  "updated_by" bigint REFERENCES "users" ("id") ON DELETE SET NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

INSERT INTO "zuvy_mentorship_config" ("key", "value", "description") VALUES
  ('total_credits', '3',
   'Mentorship sessions a student can book, across all their courses.'),
  ('gap_days', '14',
   'Days between a student''s sessions, from the start of their latest session.'),
  ('notice_hours', '72',
   'Book, cancel or reschedule only this many hours or more before the session.'),
  ('join_open_minutes', '10',
   'The join button opens this many minutes before the session starts.'),
  ('max_accepted_reschedules', '1',
   'Accepted reschedules allowed per booking.'),
  ('credits_counted_from', '"2026-04-15T00:00:00.000Z"',
   'Only bookings made from this moment use a credit. Move it forward to give every student fresh credits.')
ON CONFLICT ("key") DO NOTHING;
