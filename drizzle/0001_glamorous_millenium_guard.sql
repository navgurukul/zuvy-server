DO $$ BEGIN
 CREATE TYPE "questionType" AS ENUM('Multiple Choice', 'Checkboxes', 'Long Text Answer', 'Date', 'Time');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_form_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer,
	"chapter_id" integer,
	"question_id" integer,
	"chosen_options" integer[],
	"answer" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"status" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_form" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer NOT NULL,
	"question" text,
	"options" jsonb,
	"type_id" integer,
	"is_required" boolean NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"usage" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_question_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_type" varchar
);
--> statement-breakpoint
ALTER TABLE "main"."zuvy_batch_enrollments" DROP CONSTRAINT "zuvy_batch_enrollments_batch_id_zuvy_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_module_chapter" ADD COLUMN "form_questions" jsonb;--> statement-breakpoint
ALTER TABLE "main"."zuvy_practice_code" ADD COLUMN "submission_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_batch_id_zuvy_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id") ON DELETE set null ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_practice_code" ADD CONSTRAINT "zuvy_practice_code_submission_id_zuvy_assessment_submission_id_fk" FOREIGN KEY ("submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_form_tracking" ADD CONSTRAINT "zuvy_form_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_form" ADD CONSTRAINT "zuvy_module_form_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_form" ADD CONSTRAINT "zuvy_module_form_type_id_zuvy_question_type_id_fk" FOREIGN KEY ("type_id") REFERENCES "main"."zuvy_question_type"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
