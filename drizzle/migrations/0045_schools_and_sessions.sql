-- School, state and city at Student ID sign-up, the school list behind the
-- sign-up dropdowns, and a session ID for every login.
-- Run after 0044_student_id_from_name.sql. Safe to run more than once.

-- School list (UDISE). Loaded once from the UDISE "Basic Details of Schools"
-- file with scripts/import-schools.ts; single schools can be added with a
-- CSV upload (POST /schools/admin/upload). State and district keep the
-- file's spelling, e.g. "Andaman and Nicobar Islands".
CREATE TABLE IF NOT EXISTS "zuvy_schools" (
  "id" serial PRIMARY KEY NOT NULL,
  "udise_code" varchar(11) NOT NULL,
  "school_name" varchar(255) NOT NULL,
  "state" varchar(100) NOT NULL,
  "district" varchar(100) NOT NULL,
  "block" varchar(100),
  "village" varchar(100),
  "pincode" varchar(6),
  "management" varchar(100),
  "class_from" smallint,
  "class_to" smallint,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zuvy_schools_udise_code_unique" UNIQUE ("udise_code")
);

-- For a database where an earlier draft of this file already ran.
ALTER TABLE "zuvy_schools" ADD COLUMN IF NOT EXISTS "village" varchar(100);
ALTER TABLE "zuvy_schools" ADD COLUMN IF NOT EXISTS "management" varchar(100);
ALTER TABLE "zuvy_schools" ADD COLUMN IF NOT EXISTS "class_from" smallint;
ALTER TABLE "zuvy_schools" ADD COLUMN IF NOT EXISTS "class_to" smallint;
DROP INDEX IF EXISTS "zuvy_schools_state_district_idx";

-- Serves the city (district) list of a state, and a city's schools sorted
-- by name.
CREATE INDEX IF NOT EXISTS "zuvy_schools_state_district_name_idx"
  ON "zuvy_schools" ("state", "district", "school_name");

-- What each Student ID student chose at sign-up (a copy of the school row,
-- so the record keeps it even if the list changes later). Empty for
-- accounts created before these fields existed.
ALTER TABLE "zuvy_student_credentials" ADD COLUMN IF NOT EXISTS "state" varchar(100);
ALTER TABLE "zuvy_student_credentials" ADD COLUMN IF NOT EXISTS "city" varchar(100);
ALTER TABLE "zuvy_student_credentials" ADD COLUMN IF NOT EXISTS "school_name" varchar(255);
ALTER TABLE "zuvy_student_credentials" ADD COLUMN IF NOT EXISTS "udise_code" varchar(11);

CREATE INDEX IF NOT EXISTS "zuvy_student_credentials_udise_code_idx"
  ON "zuvy_student_credentials" ("udise_code");

-- One row per login. The id is the session ID carried in the JWT ("sid").
CREATE TABLE IF NOT EXISTS "zuvy_user_sessions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" bigint NOT NULL,
  "login_method" varchar(20) NOT NULL,
  "org_id" integer,
  "ip" varchar(64),
  "user_agent" varchar(512),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_refreshed_at" timestamp with time zone,
  "ended_at" timestamp with time zone
);

DO $$ BEGIN
  ALTER TABLE "zuvy_user_sessions"
    ADD CONSTRAINT "zuvy_user_sessions_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "zuvy_user_sessions_user_id_idx"
  ON "zuvy_user_sessions" ("user_id");
