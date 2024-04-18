CREATE TABLE IF NOT EXISTS "main"."zuvy_course_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"bootcamp_id" integer,
	"name" varchar,
	"description" text,
	"coding_problems" jsonb,
	"order" integer,
	"time_alloted" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_assessment" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"description" text,
	"module_id" integer,
	"coding_problems" json,
	"mcq" jsonb,
	"theory_questions" json,
	"time_limit" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_chapter" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"description" text,
	"topic_id" integer,
	"module_id" integer,
	"file" "bytea",
	"links" jsonb,
	"completion_date" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_quiz" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer,
	"name" varchar,
	"question" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar
);
--> statement-breakpoint
DROP TABLE "main"."course_modules";--> statement-breakpoint
DROP TABLE "main"."module_chapter";--> statement-breakpoint
DROP TABLE "main"."module_quiz";--> statement-breakpoint
DROP TABLE "main"."module_topics";--> statement-breakpoint
ALTER TABLE "main"."coding_questions" DROP CONSTRAINT "coding_questions_chapter_id_module_chapter_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."coding_questions" ADD COLUMN "constraints" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."coding_questions" ADD CONSTRAINT "coding_questions_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_course_modules" ADD CONSTRAINT "zuvy_course_modules_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_assessment" ADD CONSTRAINT "zuvy_module_assessment_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_chapter" ADD CONSTRAINT "zuvy_module_chapter_topic_id_zuvy_module_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "main"."zuvy_module_topics"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_chapter" ADD CONSTRAINT "zuvy_module_chapter_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_quiz" ADD CONSTRAINT "zuvy_module_quiz_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
