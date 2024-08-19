CREATE TABLE IF NOT EXISTS "main"."zuvy_cq_template" (
	"id" serial PRIMARY KEY NOT NULL,
	"language_id" integer,
	"template" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_languages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"language_id" varchar(50) NOT NULL,
	"default_coding_template" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer,
	"inputs" jsonb NOT NULL,
	"expected_output" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ALTER COLUMN "difficulty" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ALTER COLUMN "usage" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "constraints";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "author_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "input_base64";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "examples";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "test_cases";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "expected_output";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "solution";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_test_cases" ADD CONSTRAINT "zuvy_test_cases_question_id_zuvy_coding_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."zuvy_coding_questions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
