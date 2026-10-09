-- Student ID + password login for learners who do not have an email address.
-- One row per email-less learner; the learner's identity stays in "users"
-- (email NULL, google_user_id NULL, mode 'student'), this table only holds the
-- login credential. Google-login users never get a row here.

CREATE TABLE IF NOT EXISTS "zuvy_student_credentials" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" bigint NOT NULL,
  "student_id" varchar(16) NOT NULL,
  "password_hash" varchar(255) NOT NULL,
  "failed_attempts" integer DEFAULT 0 NOT NULL,
  "locked_until" timestamp with time zone,
  "password_updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_reset_by" bigint,
  "last_reset_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zuvy_student_credentials_user_id_unique" UNIQUE ("user_id"),
  CONSTRAINT "zuvy_student_credentials_student_id_unique" UNIQUE ("student_id")
);

ALTER TABLE "zuvy_student_credentials"
  ADD CONSTRAINT "zuvy_student_credentials_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "users"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "zuvy_student_credentials"
  ADD CONSTRAINT "zuvy_student_credentials_last_reset_by_users_id_fk"
  FOREIGN KEY ("last_reset_by") REFERENCES "users"("id")
  ON DELETE set null ON UPDATE no action;
