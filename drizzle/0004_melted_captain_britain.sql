CREATE TABLE IF NOT EXISTS "main"."meraki_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_name" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"partner_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."sub_stage" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer,
	"stage_id" integer,
	"stage_name" varchar(255),
	"sub_stages" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_assessment_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_outsourse_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"marks" integer,
	"started_at" timestamp with time zone DEFAULT now(),
	"copy_paste" integer,
	"embedded_google_search" integer,
	"tab_change" integer,
	"submited_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_chapter_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"chapter_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"completed_at" timestamp with time zone,
	"answer_Details" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_coding_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"difficulty" "difficulty",
	"tag_id" integer,
	"constraints" text,
	"author_id" integer NOT NULL,
	"input_base64" text,
	"examples" jsonb,
	"test_cases" jsonb,
	"expected_output" jsonb,
	"solution" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"usage" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_coding_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"question_solved" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"assessment_submission_id" integer,
	"assessment_outsourse_id" integer,
	"question_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_course_modules" (
	"id" serial PRIMARY KEY NOT NULL,
	"type_id" integer,
	"is_lock" boolean DEFAULT false,
	"bootcamp_id" integer,
	"name" varchar,
	"description" text,
	"project_id" integer,
	"order" integer,
	"time_alloted" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_course_projects" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"instruction" jsonb,
	"is_lock" boolean DEFAULT false,
	"completed_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_form_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer,
	"question_id" integer,
	"chapter_id" integer,
	"status" varchar(255),
	"assessment_submission_id" integer,
	"chosen_options" integer,
	"answer" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_assessment" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"description" text
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
	"article_content" jsonb,
	"quiz_questions" jsonb,
	"coding_questions" integer,
	"assessment_id" integer,
	"completion_date" timestamp with time zone,
	"order" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_form" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"description" text,
	"question" text,
	"options" jsonb,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"tag_id" integer,
	"usage" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_quiz" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text,
	"options" jsonb,
	"correct_option" integer,
	"marks" integer,
	"difficulty" "difficulty",
	"tag_id" integer,
	"usage" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_open_ended_question_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"assessment_submission_id" integer,
	"user_id" integer NOT NULL,
	"answer" text,
	"marks" integer,
	"feedback" text,
	"submit_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_openEnded_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text NOT NULL,
	"difficulty" "difficulty",
	"tag_id" integer,
	"usage" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_outsourse_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"assessment_id" integer NOT NULL,
	"bootcamp_id" integer,
	"module_id" integer,
	"chapter_id" integer,
	"tab_change" boolean,
	"web_camera" boolean,
	"pass_percentage" integer,
	"screen_record" boolean,
	"embedded_google_search" boolean,
	"deadline" text,
	"time_limit" bigint,
	"marks" integer,
	"copy_paste" boolean,
	"order" integer,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_outsourse_coding_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"coding_question_id" integer,
	"assessment_outsourse_id" integer NOT NULL,
	"bootcamp_id" integer NOT NULL,
	"chapter_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_outsourse_openEnded_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"open_ended_question_id" integer,
	"assessment_outsourse_id" integer NOT NULL,
	"bootcamp_id" integer NOT NULL,
	"module_id" integer,
	"chapter_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_outsourse_quizzes" (
	"id" serial PRIMARY KEY NOT NULL,
	"quiz_id" integer,
	"assessment_outsourse_id" integer NOT NULL,
	"bootcamp_id" integer NOT NULL,
	"chapter_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_project_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"project_id" integer,
	"module_id" integer,
	"bootcamp_id" integer,
	"project_link" varchar,
	"is_checked" boolean DEFAULT false,
	"grades" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_question_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_type" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_recent_bootcamp" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"bootcamp_id" integer NOT NULL,
	"module_id" integer NOT NULL,
	"chapter_id" integer,
	"progress" integer,
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" text NOT NULL,
	"hangout_link" text NOT NULL,
	"creator" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"batch_id" integer NOT NULL,
	"bootcamp_id" integer NOT NULL,
	"title" text NOT NULL,
	"s3link" text,
	"recurring_id" integer,
	"status" text DEFAULT 'upcoming'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_name" varchar
);
--> statement-breakpoint
DROP TABLE "main"."zuvy_article_tracking";--> statement-breakpoint
DROP TABLE "main"."zuvy_classes_google_meet_link";--> statement-breakpoint
DROP TABLE "main"."coding_questions";--> statement-breakpoint
DROP TABLE "main"."coding_submission";--> statement-breakpoint
DROP TABLE "main"."meet_attendance";--> statement-breakpoint
DROP TABLE "main"."meet_attendance_tracker";--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" RENAME COLUMN "chossen_option" TO "chosen_option";--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" RENAME COLUMN "meetingId" TO "meeting_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" RENAME COLUMN "batchId" TO "batch_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_batch_enrollments" DROP CONSTRAINT "zuvy_batch_enrollments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" ALTER COLUMN "module_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" ALTER COLUMN "mcq_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" ALTER COLUMN "attempt_count" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" ALTER COLUMN "chosen_option" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "email" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "email" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" ALTER COLUMN "attendance" SET DATA TYPE jsonb;--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" ALTER COLUMN "meeting_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" ALTER COLUMN "meeting_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" ALTER COLUMN "batch_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" ALTER COLUMN "batch_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assignment_submission" ADD COLUMN "chapter_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_batch_enrollments" ADD COLUMN "attendance" integer;--> statement-breakpoint
ALTER TABLE "main"."questions" ADD COLUMN "school_test" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."questions" ADD COLUMN "schoolId" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" ADD COLUMN "chapter_id" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" ADD COLUMN "assessment_submission_id" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" ADD COLUMN "question_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "user_name" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "password" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "pass_iv" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" ADD COLUMN "bootcamp_id" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_quiz_tracking" ADD CONSTRAINT "zuvy_quiz_tracking_assessment_submission_id_zuvy_assessment_submission_id_fk" FOREIGN KEY ("assessment_submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_quiz_tracking" ADD CONSTRAINT "zuvy_quiz_tracking_question_id_zuvy_outsourse_quizzes_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."zuvy_outsourse_quizzes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_student_attendance" ADD CONSTRAINT "zuvy_student_attendance_batch_id_zuvy_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_student_attendance" ADD CONSTRAINT "zuvy_student_attendance_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "main"."zuvy_assignment_submission" DROP COLUMN IF EXISTS "assignment_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_quiz_tracking" DROP COLUMN IF EXISTS "quiz_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_student_attendance" DROP COLUMN IF EXISTS "email";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."meraki_students" ADD CONSTRAINT "meraki_students_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."sub_stage" ADD CONSTRAINT "sub_stage_stage_id_school_stage_id_fk" FOREIGN KEY ("stage_id") REFERENCES "main"."school_stage"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_assessment_submission" ADD CONSTRAINT "zuvy_assessment_submission_assessment_outsourse_id_zuvy_outsourse_assessments_id_fk" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_assessment_submission" ADD CONSTRAINT "zuvy_assessment_submission_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_chapter_tracking" ADD CONSTRAINT "zuvy_chapter_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_chapter_tracking" ADD CONSTRAINT "zuvy_chapter_tracking_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_chapter_tracking" ADD CONSTRAINT "zuvy_chapter_tracking_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_coding_questions" ADD CONSTRAINT "zuvy_coding_questions_tag_id_zuvy_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "main"."zuvy_tags"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_coding_submission" ADD CONSTRAINT "zuvy_coding_submission_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_coding_submission" ADD CONSTRAINT "zuvy_coding_submission_assessment_submission_id_zuvy_assessment_submission_id_fk" FOREIGN KEY ("assessment_submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_coding_submission" ADD CONSTRAINT "zuvy_coding_submission_assessment_outsourse_id_zuvy_outsourse_assessments_id_fk" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_coding_submission" ADD CONSTRAINT "zuvy_coding_submission_question_id_zuvy_outsourse_coding_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."zuvy_outsourse_coding_questions"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_course_modules" ADD CONSTRAINT "zuvy_course_modules_project_id_zuvy_course_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "main"."zuvy_course_projects"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_form_tracking" ADD CONSTRAINT "zuvy_form_tracking_assessment_submission_id_zuvy_assessment_submission_id_fk" FOREIGN KEY ("assessment_submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."zuvy_module_chapter" ADD CONSTRAINT "zuvy_module_chapter_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_form" ADD CONSTRAINT "zuvy_module_form_tag_id_zuvy_question_type_id_fk" FOREIGN KEY ("tag_id") REFERENCES "main"."zuvy_question_type"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_quiz" ADD CONSTRAINT "zuvy_module_quiz_tag_id_zuvy_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "main"."zuvy_tags"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_open_ended_question_submission" ADD CONSTRAINT "zuvy_open_ended_question_submission_question_id_zuvy_outsourse_openEnded_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."zuvy_outsourse_openEnded_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_open_ended_question_submission" ADD CONSTRAINT "zuvy_open_ended_question_submission_assessment_submission_id_zuvy_assessment_submission_id_fk" FOREIGN KEY ("assessment_submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_open_ended_question_submission" ADD CONSTRAINT "zuvy_open_ended_question_submission_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_openEnded_questions" ADD CONSTRAINT "zuvy_openEnded_questions_tag_id_zuvy_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "main"."zuvy_tags"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_assessments" ADD CONSTRAINT "zuvy_outsourse_assessments_assessment_id_zuvy_module_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "main"."zuvy_module_assessment"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_assessments" ADD CONSTRAINT "zuvy_outsourse_assessments_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_assessments" ADD CONSTRAINT "zuvy_outsourse_assessments_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_assessments" ADD CONSTRAINT "zuvy_outsourse_assessments_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_coding_question_id_zuvy_coding_questions_id_fk" FOREIGN KEY ("coding_question_id") REFERENCES "main"."zuvy_coding_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_assessment_outsourse_id_zuvy_outsourse_assessments_id_fk" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_open_ended_question_id_zuvy_openEnded_questions_id_fk" FOREIGN KEY ("open_ended_question_id") REFERENCES "main"."zuvy_openEnded_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_assessment_outsourse_id_zuvy_outsourse_assessments_id_fk" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_quizzes" ADD CONSTRAINT "zuvy_outsourse_quizzes_quiz_id_zuvy_module_quiz_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "main"."zuvy_module_quiz"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_quizzes" ADD CONSTRAINT "zuvy_outsourse_quizzes_assessment_outsourse_id_zuvy_outsourse_assessments_id_fk" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_quizzes" ADD CONSTRAINT "zuvy_outsourse_quizzes_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_quizzes" ADD CONSTRAINT "zuvy_outsourse_quizzes_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_project_tracking" ADD CONSTRAINT "zuvy_project_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_project_tracking" ADD CONSTRAINT "zuvy_project_tracking_project_id_zuvy_course_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "main"."zuvy_course_projects"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_project_tracking" ADD CONSTRAINT "zuvy_project_tracking_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_project_tracking" ADD CONSTRAINT "zuvy_project_tracking_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_recent_bootcamp" ADD CONSTRAINT "zuvy_recent_bootcamp_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_recent_bootcamp" ADD CONSTRAINT "zuvy_recent_bootcamp_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_recent_bootcamp" ADD CONSTRAINT "zuvy_recent_bootcamp_module_id_zuvy_course_modules_id_fk" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_recent_bootcamp" ADD CONSTRAINT "zuvy_recent_bootcamp_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_sessions" ADD CONSTRAINT "zuvy_sessions_batch_id_zuvy_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_sessions" ADD CONSTRAINT "zuvy_sessions_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
ALTER TABLE "main"."users" ADD CONSTRAINT "main_users_user_name_unique" UNIQUE("user_name");