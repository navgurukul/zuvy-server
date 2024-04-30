CREATE TABLE IF NOT EXISTS "main"."zuvy_module_chapter" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"description" text,
	"topic_id" integer,
	"module_id" integer,
	"file" "bytea",
	"links" jsonb,
	"article_content" jsonb,
	"quiz_questions" jsonb,
	"coding_questions" jsonb,
	"completion_date" timestamp with time zone,
	"order" integer
);
--> statement-breakpoint
ALTER TABLE "main"."sub_stage" DROP CONSTRAINT "main_sub_stage_stage_id_foreign";
--> statement-breakpoint
ALTER TABLE "main"."vb_sentences" ALTER COLUMN "h_translation" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."vb_words" ALTER COLUMN "e_meaning" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."vb_words" ALTER COLUMN "h_meaning" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."vb_words" ALTER COLUMN "word_type" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "email" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."exercises" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."exercises" ALTER COLUMN "slug" SET DEFAULT '';--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."sub_stage" ADD CONSTRAINT "sub_stage_stage_id_school_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "main"."school_stage"("id") ON DELETE no action ON UPDATE no action;
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
