-- Career Tours session IDs. A login by a student who has a school gets
--   CT_IN_<YYYYMMDD>_<school UDISE code>_<7-digit number>
-- e.g. CT_IN_20261028_36070700101_0000025 = the 25th login from that school
-- on 28 Oct 2026 (Indian date). Other logins keep a random UUID.
-- Run after 0045_schools_and_sessions.sql. Safe to run more than once.

-- Session IDs are text now (was uuid); existing IDs are kept, as text.
ALTER TABLE "zuvy_user_sessions"
  ALTER COLUMN "id" TYPE varchar(100) USING "id"::text;

-- The school of the student who logged in (empty for other logins).
ALTER TABLE "zuvy_user_sessions" ADD COLUMN IF NOT EXISTS "udise_code" varchar(11);

CREATE INDEX IF NOT EXISTS "zuvy_user_sessions_udise_code_idx"
  ON "zuvy_user_sessions" ("udise_code", "created_at");

-- Last session number given out per school per day. The number restarts
-- at 0000001 for each school each day; one atomic upsert per login, so two
-- logins at the same moment never get the same number.
CREATE TABLE IF NOT EXISTS "zuvy_session_counters" (
  "session_date" varchar(8) NOT NULL,
  "udise_code" varchar(11) NOT NULL,
  "last_number" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zuvy_session_counters_pk" PRIMARY KEY ("session_date", "udise_code")
);
