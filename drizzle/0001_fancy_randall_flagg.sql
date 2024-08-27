CREATE TABLE IF NOT EXISTS "main"."meraki_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_name" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"partner_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."new_students_temp" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"name" varchar(300),
	"gender" integer,
	"dob" timestamp with time zone,
	"email" varchar(150),
	"state" varchar(2),
	"city" varchar(45),
	"gps_lat" varchar(45),
	"gps_long" varchar(45),
	"pin_code" varchar(10),
	"qualification" integer,
	"current_status" integer,
	"school_medium" integer,
	"religon" integer,
	"caste" integer,
	"percentage_in10th" varchar(255),
	"math_marks_in10th" integer,
	"percentage_in12th" varchar(255),
	"math_marks_in12th" integer,
	"stage" varchar(45) NOT NULL,
	"tag" varchar(255),
	"partner_id" integer,
	"created_at" timestamp with time zone NOT NULL,
	"last_updated" timestamp with time zone,
	"district" varchar(255),
	"current_owner_id" integer,
	"partner_refer" varchar(255),
	"evaluation" varchar(255),
	"redflag" varchar(255),
	"image_url" text,
	"other_activities" varchar(255),
	"campus_status" varchar(255),
	"school_stage_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."view_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"durations" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"page_url" varchar(255),
	"page_title" varchar(255),
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_assessment_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"marks" integer,
	"started_at" timestamp with time zone DEFAULT now(),
	"submited_at" timestamp with time zone,
	"assessment_outsourse_id" integer NOT NULL,
	"copy_paste" integer,
	"embedded_google_search" integer,
	"tab_change" integer,
	"coding_question_count" integer,
	"mcq_question_count" integer,
	"open_ended_question_count" integer,
	"attempted_coding_questions" integer,
	"attempted_mcq_questions" integer,
	"attempted_open_ended_questions" integer,
	"is_passed" boolean,
	"coding_score" integer,
	"open_ended_score" integer,
	"mcq_score" integer,
	"required_coding_score" integer,
	"required_open_ended_score" integer,
	"required_mcq_score" integer,
	"type_of_submission" varchar(255),
	"percentage" numeric
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_assignment_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer NOT NULL,
	"bootcamp_id" integer,
	"chapter_id" integer NOT NULL,
	"time_limit" timestamp with time zone NOT NULL,
	"project_url" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_bootcamp_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"progress" integer DEFAULT 0,
	"bootcamp_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
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
	"chapter_id" integer,
	"question_id" integer,
	"chosen_options" integer[],
	"answer" text,
	"updated_at" timestamp with time zone DEFAULT now(),
	"status" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_languages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"language_id" varchar(50) NOT NULL,
	"default_coding_template" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_assessment" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar,
	"description" text,
	"pass_percentage" integer,
	"time_limit" bigint,
	"copy_paste" boolean,
	"embedded_google_search" boolean,
	"tab_change" boolean,
	"screen_record" boolean,
	"web_camera" boolean
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
	"order" integer,
	"form_questions" jsonb
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
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_quiz" (
	"id" serial PRIMARY KEY NOT NULL,
	"question" text,
	"options" jsonb,
	"correct_option" integer,
	"marks" integer,
	"difficulty" "main"."difficulty",
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
	"answer" text,
	"marks" integer,
	"submit_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"feedback" text,
	"assessment_submission_id" integer,
	"user_id" integer NOT NULL,
	"question_id" integer NOT NULL
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
	"time_limit" bigint,
	"marks" integer,
	"copy_paste" boolean,
	"order" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"deadline" text
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
	"marks" integer,
	"assessment_outsourse_id" integer NOT NULL,
	"bootcamp_id" integer NOT NULL,
	"module_id" integer,
	"chapter_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_outsourse_quizzes" (
	"quiz_id" integer,
	"marks" integer,
	"assessment_outsourse_id" integer NOT NULL,
	"bootcamp_id" integer NOT NULL,
	"chapter_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"id" serial PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_practice_code" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"status" varchar(255) NOT NULL,
	"action" "main"."action" NOT NULL,
	"question_id" integer,
	"coding_outsourse_id" integer,
	"submission_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"sourse_code" text,
	"source_code" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_project_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"project_id" integer,
	"module_id" integer,
	"bootcamp_id" integer,
	"project_link" varchar,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"is_checked" boolean DEFAULT false,
	"grades" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_quiz_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer,
	"mcq_id" integer,
	"attempt_count" integer DEFAULT 0,
	"chapter_id" integer,
	"status" varchar(255),
	"chossen_option" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	"assessment_submission_id" integer,
	"chosen_option" integer,
	"question_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_test_cases" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer,
	"inputs" jsonb NOT NULL,
	"expected_output" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_test_cases_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"testcast_id" integer,
	"status" varchar(255),
	"token" varchar(255),
	"action" varchar(255),
	"submission_id" integer,
	"language_id" integer,
	"stdout" text,
	"memory" integer,
	"stderr" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"time" numeric
);
--> statement-breakpoint
DROP TABLE "main"."meet_attendance";--> statement-breakpoint
DROP TABLE "main"."meet_attendance_tracker";--> statement-breakpoint
DROP TABLE "main"."news_app";--> statement-breakpoint
ALTER TABLE "main"."partner_specific_batches_v2" DROP CONSTRAINT "partner_specific_batches_v2_space_id_partner_space_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."partner_specific_batches_v2" DROP CONSTRAINT "partner_specific_batches_v2_group_id_space_group_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_students" DROP CONSTRAINT "c4ca_students_team_id_c4ca_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_batch_enrollments" DROP CONSTRAINT "zuvy_batch_enrollments_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_batch_enrollments" DROP CONSTRAINT "zuvy_batch_enrollments_bootcamp_id_zuvy_bootcamps_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_batch_enrollments" DROP CONSTRAINT "zuvy_batch_enrollments_batch_id_zuvy_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP CONSTRAINT "zuvy_coding_questions_tag_id_zuvy_tags_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."scratch_sample" ALTER COLUMN "created_at" SET DATA TYPE timestamp with time zone;--> statement-breakpoint
ALTER TABLE "main"."scratch_sample" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "email" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ALTER COLUMN "difficulty" SET DATA TYPE varchar(50);--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ALTER COLUMN "id" SET DATA TYPE serial;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ALTER COLUMN "user_id" SET DATA TYPE bigserial;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ALTER COLUMN "updated_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "user_name" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "password" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "pass_iv" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "auth_tag" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."teacher_capacity_building" ADD COLUMN "employee_type" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."teacher_capacity_building" ADD COLUMN "created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "main"."questions" ADD COLUMN "schoolId" integer;--> statement-breakpoint
ALTER TABLE "main"."questions" ADD COLUMN "school_test" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ADD COLUMN "content" jsonb;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" ADD COLUMN "usage" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ADD COLUMN "assessment_submission_id" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ADD COLUMN "assessment_outsourse_id" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ADD COLUMN "question_id" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_submission" ADD COLUMN "status" varchar(255);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."meraki_students" ADD CONSTRAINT "meraki_students_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_assessment_submission" ADD CONSTRAINT "zuvy_assessment_submission_assessment_outsourse_id_zuvy_outsour" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."zuvy_assignment_submission" ADD CONSTRAINT "zuvy_assignment_submission_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_assignment_submission" ADD CONSTRAINT "zuvy_assignment_submission_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_bootcamp_tracking" ADD CONSTRAINT "zuvy_bootcamp_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_bootcamp_tracking" ADD CONSTRAINT "zuvy_bootcamp_tracking_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_form_tracking" ADD CONSTRAINT "zuvy_form_tracking_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_module_chapter" ADD CONSTRAINT "zuvy_module_chapter_topic_id_zuvy_module_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "main"."zuvy_module_topics"("id") ON DELETE no action ON UPDATE no action;
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
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_quiz" ADD CONSTRAINT "zuvy_module_quiz_tag_id_zuvy_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "main"."zuvy_tags"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_open_ended_question_submission" ADD CONSTRAINT "zuvy_open_ended_question_submission_question_id_zuvy_outsourse_" FOREIGN KEY ("question_id") REFERENCES "main"."zuvy_outsourse_openEnded_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_open_ended_question_submission" ADD CONSTRAINT "zuvy_open_ended_question_submission_assessment_submission_id_zu" FOREIGN KEY ("assessment_submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."zuvy_outsourse_assessments" ADD CONSTRAINT "zuvy_outsourse_assessments_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_assessments" ADD CONSTRAINT "zuvy_outsourse_assessments_assessment_id_zuvy_module_assessment" FOREIGN KEY ("assessment_id") REFERENCES "main"."zuvy_module_assessment"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_assessment_outsourse_id_zuvy_ou" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_coding_question_id_zuvy_coding_questions" FOREIGN KEY ("coding_question_id") REFERENCES "main"."zuvy_coding_questions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_bootcamp_id_zuvy_bootcamps_id_f" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_coding_questions" ADD CONSTRAINT "zuvy_outsourse_coding_questions_chapter_id_zuvy_module_chapter_" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_open_ended_question_id_zuvy_" FOREIGN KEY ("open_ended_question_id") REFERENCES "main"."zuvy_openEnded_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_assessment_outsourse_id_zuvy" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_bootcamp_id_zuvy_bootcamps_i" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_module_id_zuvy_course_module" FOREIGN KEY ("module_id") REFERENCES "main"."zuvy_course_modules"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_outsourse_openEnded_questions" ADD CONSTRAINT "zuvy_outsourse_openEnded_questions_chapter_id_zuvy_module_chapt" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."zuvy_outsourse_quizzes" ADD CONSTRAINT "zuvy_outsourse_quizzes_assessment_outsourse_id_zuvy_outsourse_a" FOREIGN KEY ("assessment_outsourse_id") REFERENCES "main"."zuvy_outsourse_assessments"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_practice_code" ADD CONSTRAINT "zuvy_practice_code_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_practice_code" ADD CONSTRAINT "zuvy_practice_code_question_id_zuvy_coding_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."zuvy_coding_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_practice_code" ADD CONSTRAINT "zuvy_practice_code_coding_outsourse_id_zuvy_outsourse_coding_qu" FOREIGN KEY ("coding_outsourse_id") REFERENCES "main"."zuvy_outsourse_coding_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_practice_code" ADD CONSTRAINT "zuvy_practice_code_submission_id_zuvy_assessment_submission_id_" FOREIGN KEY ("submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_quiz_tracking" ADD CONSTRAINT "zuvy_quiz_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_quiz_tracking" ADD CONSTRAINT "zuvy_quiz_tracking_assessment_submission_id_zuvy_assessment_sub" FOREIGN KEY ("assessment_submission_id") REFERENCES "main"."zuvy_assessment_submission"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."zuvy_test_cases" ADD CONSTRAINT "zuvy_test_cases_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "main"."zuvy_coding_questions"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_test_cases_submission" ADD CONSTRAINT "zuvy_test_cases_submission_testcast_id_zuvy_test_cases_id_fk" FOREIGN KEY ("testcast_id") REFERENCES "main"."zuvy_test_cases"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_test_cases_submission" ADD CONSTRAINT "zuvy_test_cases_submission_submission_id_zuvy_practice_code_id_" FOREIGN KEY ("submission_id") REFERENCES "main"."zuvy_practice_code"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_test_cases_submission" ADD CONSTRAINT "zuvy_test_cases_submission_language_id_zuvy_languages_id_fk" FOREIGN KEY ("language_id") REFERENCES "main"."zuvy_languages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_space_id_partner_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "main"."partner_space"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_group_id_space_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "main"."space_group"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."meraki_certificate" ADD CONSTRAINT "meraki_certificate_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_students" ADD CONSTRAINT "c4ca_students_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_batch_id_zuvy_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_coding_questions" ADD CONSTRAINT "zuvy_coding_questions_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "main"."zuvy_tags"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_sessions" ADD CONSTRAINT "zuvy_sessions_batch_id_zuvy_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."zuvy_chapter_tracking" ADD CONSTRAINT "zuvy_chapter_tracking_chapter_id_zuvy_module_chapter_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "main"."zuvy_module_chapter"("id") ON DELETE cascade ON UPDATE cascade;
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
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "author_id";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "input_base64";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "examples";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "test_cases";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "expected_output";--> statement-breakpoint
ALTER TABLE "main"."zuvy_coding_questions" DROP COLUMN IF EXISTS "solution";--> statement-breakpoint
ALTER TABLE "main"."users" ADD CONSTRAINT "main_users_user_name_unique" UNIQUE("user_name");