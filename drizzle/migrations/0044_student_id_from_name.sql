-- Student IDs are now built from the student's name: first name + last name
-- in lowercase, "ct" and a number, e.g. aruneshdharct1, aruneshdharct2,
-- aruneshct1. Run after 0043_create_zuvy_student_credentials.sql.
-- Safe to run more than once.

-- Name-based IDs can be longer than the old 8-character random IDs.
ALTER TABLE "zuvy_student_credentials"
  ALTER COLUMN "student_id" TYPE varchar(40);

-- All IDs are stored lowercase and looked up in lowercase. Existing random
-- IDs (e.g. ZVM8GYBD) become lowercase; students can still type them in
-- any case. Old IDs were all uppercase, so this cannot create duplicates.
UPDATE "zuvy_student_credentials"
  SET "student_id" = lower("student_id")
  WHERE "student_id" <> lower("student_id");

-- The last number given out for each name. The backend increments it with a
-- single atomic upsert, so two students with the same name signing up at the
-- same moment always get different numbers.
CREATE TABLE IF NOT EXISTS "zuvy_student_id_counters" (
  "base" varchar(40) PRIMARY KEY NOT NULL,
  "last_number" integer NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Start each counter after any name-based IDs that already exist.
INSERT INTO "zuvy_student_id_counters" ("base", "last_number")
SELECT
  regexp_replace("student_id", 'ct[0-9]+$', '') AS "base",
  max(substring("student_id" from 'ct([0-9]+)$')::int) AS "last_number"
FROM "zuvy_student_credentials"
WHERE "student_id" ~ '^[a-z]+ct[0-9]+$'
GROUP BY 1
ON CONFLICT ("base") DO UPDATE
  SET "last_number" = GREATEST(
    "zuvy_student_id_counters"."last_number",
    EXCLUDED."last_number"
  );
