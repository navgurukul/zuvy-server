CREATE TABLE IF NOT EXISTS "main"."ghar_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL
);
--> statement-breakpoint
DROP TABLE "main"."zuvy_cq_template";--> statement-breakpoint
ALTER TABLE "main"."zuvy_practice_code" ADD COLUMN "source_code" text;--> statement-breakpoint
ALTER TABLE "main"."zuvy_test_cases_submission" ADD COLUMN "language_id" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_test_cases_submission" ADD COLUMN "stdout" text;--> statement-breakpoint
ALTER TABLE "main"."zuvy_test_cases_submission" ADD COLUMN "memory" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_test_cases_submission" ADD COLUMN "time" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_test_cases_submission" ADD COLUMN "stderr" text;--> statement-breakpoint
ALTER TABLE "main"."zuvy_test_cases_submission" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_test_cases_submission" ADD CONSTRAINT "zuvy_test_cases_submission_language_id_zuvy_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "main"."zuvy_languages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
