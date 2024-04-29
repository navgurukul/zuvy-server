CREATE SCHEMA "main";
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "course_enrolments_course_status" AS ENUM('enroll', 'unenroll', 'completed');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "courses_type" AS ENUM('html', 'js', 'python');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "difficulty" AS ENUM('Easy', 'Medium', 'Hard');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "exercises_review_type" AS ENUM('manual', 'peer', 'facilitator', 'automatic');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "exercises_submission_type" AS ENUM('number', 'text', 'text_large', 'attachments', 'url');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "submissions_state" AS ENUM('completed', 'pending', 'rejected');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_roles_center" AS ENUM('dharamshala', 'banagalore', 'all');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "user_roles_roles" AS ENUM('admin', 'alumni', 'student', 'facilitator');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "users_center" AS ENUM('dharamshala', 'bangalore');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_article_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer NOT NULL,
	"article_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."assessment" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"content" text,
	"course_id" integer,
	"exercise_id" integer,
	"updated_at" timestamp with time zone,
	CONSTRAINT "main_assessment_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."assessment_outcome" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"assessment_id" integer NOT NULL,
	"status" varchar(255) NOT NULL,
	"selected_option" integer,
	"attempt_count" integer NOT NULL,
	"multiple_choice" varchar(255),
	"team_id" integer,
	"selected_multiple_option" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."assessment_result" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"assessment_id" integer NOT NULL,
	"status" varchar(255) NOT NULL,
	"selected_option" integer NOT NULL,
	"attempt_count" integer DEFAULT 1 NOT NULL,
	"team_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."assessments_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug_id" integer NOT NULL,
	"selected_option" varchar(255) NOT NULL,
	"status" varchar(255) NOT NULL,
	"attempt_count" integer NOT NULL,
	"course_id" integer NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"lang" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_assignment_submission" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer NOT NULL,
	"bootcamp_id" integer,
	"assignment_id" integer NOT NULL,
	"time_limit" timestamp with time zone NOT NULL,
	"project_url" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_batch_enrollments" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" bigserial NOT NULL,
	"bootcamp_id" integer,
	"batch_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attendance" integer,
	"classes_attended" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bootcamp_id" integer,
	"instructor_id" integer,
	"cap_enrollment" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE IF NOT EXISTS "main"."zuvy_bootcamp_type" (
	"id" serial PRIMARY KEY NOT NULL,
	"bootcamp_id" integer,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_bootcamps" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"cover_image" text,
	"bootcamp_topic" text,
	"start_time" timestamp with time zone,
	"duration" text,
	"language" text,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"point_of_contact" varchar(255),
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(255),
	"status" varchar(255),
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"role" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"class" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"team_id" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_students_projectDetail" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_title" varchar(255),
	"project_summary" varchar(255),
	"project_uploadFile_url" varchar(255) NOT NULL,
	"Started_date" date,
	"teacher_id" integer NOT NULL,
	"team_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_teachers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"school" varchar(255),
	"district" varchar(255),
	"state" varchar(255),
	"phone_number" varchar(255),
	"email" varchar(255) NOT NULL,
	"user_id" integer NOT NULL,
	"profile_url" varchar(255),
	"facilitator_id" integer,
	"profile_link" varchar(255),
	"c4ca_partner_id" integer,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_team_projectsubmit_solution" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_link" varchar(255),
	"project_file_url" varchar(255),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"team_id" integer NOT NULL,
	"team_name" varchar(255) NOT NULL,
	"is_submitted" boolean,
	"unlocked_at" timestamp with time zone,
	"module_id" integer NOT NULL,
	"project_file_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_team_projecttopic" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_title" varchar(255),
	"project_summary" varchar(255),
	"project_topic_url" varchar(255),
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"team_id" integer NOT NULL,
	"team_name" varchar(255) NOT NULL,
	"is_submitted" boolean,
	"unlocked_at" timestamp with time zone,
	"module_id" integer NOT NULL,
	"projectTopic_file_name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c4ca_teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"team_name" varchar(255) NOT NULL,
	"team_size" integer NOT NULL,
	"teacher_id" integer NOT NULL,
	"login_id" varchar(255) NOT NULL,
	"password" varchar(255) NOT NULL,
	"last_login" timestamp with time zone,
	"state" varchar(255),
	"district" varchar(255),
	"school" varchar(255),
	CONSTRAINT "main_c4ca_teams_team_name_unique" UNIQUE("team_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."c_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"mobile" varchar(255),
	"user_name" varchar(255) NOT NULL,
	"mail_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" "bytea",
	"profile_pic" varchar(255),
	"google_user_id" varchar(255),
	"created_at" timestamp with time zone NOT NULL,
	"partner_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."campus" (
	"id" serial PRIMARY KEY NOT NULL,
	"campus" varchar(225),
	"address" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."campus_school" (
	"id" serial PRIMARY KEY NOT NULL,
	"campus_id" integer,
	"school_id" integer,
	"capacityofschool" integer,
	CONSTRAINT "main_campus_school_campus_id_school_id_unique" UNIQUE("campus_id","school_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."category" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_name" varchar(100) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."chanakya_access" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_role_id" integer,
	"access" integer NOT NULL,
	CONSTRAINT "main_chanakya_access_user_role_id_access_unique" UNIQUE("user_role_id","access")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."chanakya_partner_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."chanakya_partner_relationship" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"partner_group_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."chanakya_privilege" (
	"id" serial PRIMARY KEY NOT NULL,
	"privilege" varchar(225) NOT NULL,
	"description" varchar(225) NOT NULL,
	CONSTRAINT "main_chanakya_privilege_privilege_unique" UNIQUE("privilege"),
	CONSTRAINT "main_chanakya_privilege_description_unique" UNIQUE("description")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."chanakya_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"roles" varchar(225) NOT NULL,
	"description" varchar(225) NOT NULL,
	CONSTRAINT "main_chanakya_roles_roles_unique" UNIQUE("roles"),
	CONSTRAINT "main_chanakya_roles_description_unique" UNIQUE("description")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."chanakya_user_email" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	CONSTRAINT "main_chanakya_user_email_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."chanakya_user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"chanakya_user_email_id" integer NOT NULL,
	"roles" integer,
	"privilege" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."class_registrations" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"registered_at" timestamp with time zone NOT NULL,
	"feedback" varchar(1000),
	"feedback_at" timestamp with time zone,
	"google_registration_status" boolean,
	CONSTRAINT "main_class_registrations_user_id_class_id_unique" UNIQUE("class_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"description" varchar(555),
	"facilitator_id" integer,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"category_id" integer NOT NULL,
	"video_id" varchar(45),
	"lang" char(2) DEFAULT 'hi' NOT NULL,
	"type" varchar(255) NOT NULL,
	"meet_link" varchar(255),
	"calendar_event_id" varchar(255),
	"facilitator_name" varchar(80),
	"facilitator_email" varchar(120),
	"material_link" varchar(255),
	"max_enrolment" integer,
	"recurring_id" integer,
	"sub_title" varchar(255),
	"course_version" varchar(255),
	"volunteer_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_classes_google_meet_link" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingid" text NOT NULL,
	"hangout_link" text NOT NULL,
	"creator" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"batch_id" text NOT NULL,
	"bootcamp_id" text NOT NULL,
	"title" text NOT NULL,
	"attendees" text[],
	"s3link" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."classes_mail" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer,
	"facilitator_email" varchar(80) NOT NULL,
	"status" varchar(50),
	"type" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."classes_to_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer,
	"pathway_v1" integer,
	"course_v1" integer,
	"exercise_v1" integer,
	"pathway_v2" integer,
	"course_v2" integer,
	"exercise_v2" integer,
	"pathway_v3" integer,
	"course_v3" integer,
	"exercise_v3" integer,
	"slug_id" integer
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
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_coding_submission" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_solved" jsonb NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"mobile" varchar(10),
	"is_whatsapp" boolean DEFAULT false,
	"contact_type" varchar(255),
	"created_at" timestamp with time zone,
	"alt_mobile" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"category_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_completion" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	CONSTRAINT "main_course_completion_user_id_course_id_unique" UNIQUE("user_id","course_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_completion_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"complete_at" timestamp with time zone,
	CONSTRAINT "main_course_completion_v2_course_id_unique" UNIQUE("course_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_completion_v3" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"course_id" integer NOT NULL,
	"complete_at" timestamp with time zone,
	"team_id" integer,
	"percentage" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_editor_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer,
	"course_states" varchar(255),
	"stateChangedate" timestamp with time zone,
	"content_editors_user_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_enrolments" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"student_id" bigint,
	"course_id" bigint,
	"enrolled_at" timestamp with time zone DEFAULT now(),
	"completed_at" timestamp with time zone,
	CONSTRAINT "main_course_enrolments_student_id_course_id_unique" UNIQUE("student_id","course_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_production_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer,
	"lang" char(2) DEFAULT 'en' NOT NULL,
	"version" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."course_relation" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"course_id" bigint,
	"relies_on" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."courses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(100),
	"logo" varchar(100),
	"notes" varchar(10000),
	"days_to_complete" bigint,
	"short_description" varchar(300),
	"type" text DEFAULT 'html' NOT NULL,
	"course_type" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."courses_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"logo" varchar(255),
	"short_description" varchar(255),
	"lang_available" text[]
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."daily_metrics" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_name" varchar(255),
	"value" integer,
	"date" date,
	"created_at" timestamp with time zone,
	"gender" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."dashboard_flags" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"flag" varchar(255),
	"createdAt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."donor" (
	"id" serial PRIMARY KEY NOT NULL,
	"donor" varchar(225)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."email_report" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"report" varchar(255),
	"status" boolean,
	"emails" text[],
	"repeat" varchar(255),
	CONSTRAINT "main_email_report_partner_id_unique" UNIQUE("partner_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."eng_articles" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"source_url" varchar(255) NOT NULL,
	"image_url" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."eng_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"eng_articles_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."eng_levelwise" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" integer NOT NULL,
	"content" text NOT NULL,
	"article_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."enrolment_keys" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(6),
	"student_id" integer,
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"total_marks" varchar(45),
	"type_of_test" varchar(255),
	"question_set_id" integer,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."events" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_name" varchar(255),
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"durations" integer,
	"view_page_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."exercise_completion" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	CONSTRAINT "main_exercise_completion_user_id_exercise_id_unique" UNIQUE("user_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."exercise_completion_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"complete_at" timestamp with time zone,
	"exercise_id" integer,
	"team_id" integer,
	"slug_id" integer,
	"course_id" integer,
	"lang" varchar(255),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."exercises" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"parent_exercise_id" bigint,
	"course_id" bigint NOT NULL,
	"name" varchar(300) DEFAULT '' NOT NULL,
	"slug" varchar(100) DEFAULT '' NOT NULL,
	"sequence_num" double precision,
	"review_type" "exercises_review_type" DEFAULT 'manual',
	"content" text,
	"submission_type" "exercises_submission_type",
	"github_link" varchar(300),
	"solution" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."exercises_history" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"lang" varchar(255) NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."exercises_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" varchar(255),
	"course_id" integer,
	"content" text,
	"type" varchar(255),
	"sequence_num" double precision,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."facilitators" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"point_of_contact" varchar(255),
	"email" varchar(255) NOT NULL,
	"web_link" varchar(255),
	"phone_number" varchar(255) NOT NULL,
	"c4ca_partner_id" integer,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"user_id" integer,
	"student_stage" varchar(255) NOT NULL,
	"feedback" text,
	"state" varchar(255),
	"who_assign" varchar(255),
	"to_assign" varchar(255),
	"audio_recording" varchar(255),
	"deadline_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"last_updated" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"notification_sent_at" text,
	"notification_status" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."incoming_calls" (
	"id" serial PRIMARY KEY NOT NULL,
	"contact_id" integer,
	"call_type" varchar(15),
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."interview_owners" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"available" boolean,
	"max_limit" integer DEFAULT 10,
	"type" text[],
	"pending_interview_count" integer,
	"gender" integer,
	CONSTRAINT "main_interview_owners_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."interview_slot" (
	"id" serial PRIMARY KEY NOT NULL,
	"owner_id" integer,
	"student_id" integer NOT NULL,
	"student_name" varchar(255),
	"transition_id" integer,
	"topic_name" varchar(255) NOT NULL,
	"start_time" varchar(255) NOT NULL,
	"end_time" varchar(255),
	"end_time_expected" varchar(255) NOT NULL,
	"on_date" timestamp with time zone NOT NULL,
	"duration" varchar(255),
	"status" varchar(255) NOT NULL,
	"is_cancelled" boolean DEFAULT false,
	"cancelltion_reason" varchar(255),
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."k_details" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"parents_name" varchar(255) NOT NULL,
	"address" varchar(255) NOT NULL,
	"city" varchar(255) NOT NULL,
	"state" varchar(255) NOT NULL,
	"pin_code" varchar(255) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"email" varchar(255) NOT NULL,
	"profile_pic" varchar(255) NOT NULL,
	"indemnity_form" varchar(255) NOT NULL,
	"deleted" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."knex_migrations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255),
	"batch" bigint,
	"migration_time" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."knex_migrations_lock" (
	"is_locked" bigint
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."learning_track_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"pathway_id" integer,
	"course_id" integer,
	"exercise_id" integer NOT NULL,
	"team_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."learning_track_status_outcome" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"pathway_id" integer,
	"course_id" integer,
	"exercise_id" integer,
	"team_id" integer,
	"module_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."meet_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"attendies_data" varchar(255),
	"meeting_date" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."meet_attendance_tracker" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_title" varchar(255),
	"attendee_names" varchar(255),
	"attendedDurationInSec" varchar(255),
	"meet_code" varchar(255),
	"meeting_time" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."mentor_tree" (
	"id" serial PRIMARY KEY NOT NULL,
	"mentor_id" integer NOT NULL,
	"mentee_id" integer NOT NULL,
	"pathway_id" integer NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "main_mentor_tree_mentor_id_mentee_id_unique" UNIQUE("mentor_id","mentee_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."mentors" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"mentor" bigint,
	"mentee" bigint,
	"scope" varchar(255),
	"user_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."meraki_certificate" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"url" varchar(255),
	"register_at" varchar(255),
	"created_at" timestamp with time zone,
	"pathway_id" integer,
	"pathway_code" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."merged_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer,
	"merged_class_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."migrations" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"run_on" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."module_completion_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer NOT NULL,
	"complete_at" timestamp with time zone,
	"team_id" integer,
	"percentage" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_module_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer NOT NULL,
	"progress" integer DEFAULT 0,
	"bootcamp_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
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
CREATE TABLE IF NOT EXISTS "main"."news_app" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" text NOT NULL,
	"gender" varchar(255) NOT NULL,
	"country" varchar(255),
	"password" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."ongoing_topics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"team_id" integer,
	"pathway_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"slug_id" integer NOT NULL,
	"type" text NOT NULL,
	"module_id" integer,
	"project_topic_id" integer,
	"project_solution_id" integer,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_assessments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(45) NOT NULL,
	"answer_key_url" varchar(300),
	"assessment_url" varchar(300),
	"question_set_id" varchar(45) NOT NULL,
	"partner_id" integer NOT NULL,
	"created_at" varchar(45) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_group" boolean NOT NULL,
	"created_at" timestamp with time zone,
	"scope" varchar(255),
	CONSTRAINT "main_partner_group_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_group_relationship" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_group_id" integer NOT NULL,
	"member_of" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_group_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"partner_group_id" integer NOT NULL,
	"email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_relationship" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"partner_group_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_space" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer,
	"space_name" varchar(255),
	"point_of_contact_name" varchar(255),
	"email" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_specific_batches" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer,
	"recurring_id" integer,
	"partner_id" integer,
	"space_id" integer,
	"group_id" integer,
	"pathway_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_specific_batches_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"class_id" integer,
	"recurring_id" integer,
	"space_id" integer,
	"group_id" integer,
	"partner_id" integer,
	"pathway_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partner_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer,
	"email" varchar(225),
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "main_partner_user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."partners" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(45),
	"notes" varchar(2000) NOT NULL,
	"slug" varchar(255),
	"created_at" timestamp with time zone,
	"referred_by" varchar(255),
	"email" varchar(255),
	"districts" text[],
	"meraki_link" varchar(255),
	"web_link" varchar(255),
	"state" varchar(255),
	"description" text,
	"logo" text,
	"website_link" text,
	"platform" varchar(255),
	"point_of_contact_name" varchar(255),
	"status" text,
	"updated_at" timestamp with time zone,
	"phone_number" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_completion" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pathway_id" integer NOT NULL,
	CONSTRAINT "main_pathway_completion_user_id_pathway_id_unique" UNIQUE("user_id","pathway_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_completion_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"complete_at" timestamp with time zone,
	"team_id" integer,
	"percentage" integer,
	"pathway_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"pathway_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_courses_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer NOT NULL,
	"pathway_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_milestones" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(45) NOT NULL,
	"description" varchar(5000) NOT NULL,
	"pathway_id" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_partner_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer,
	"pathway_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_tracking_form_structure" (
	"id" serial PRIMARY KEY NOT NULL,
	"pathway_id" integer NOT NULL,
	"parameter_id" integer,
	"question_id" integer,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_tracking_request" (
	"id" serial PRIMARY KEY NOT NULL,
	"pathway_id" integer NOT NULL,
	"mentor_id" integer NOT NULL,
	"mentee_id" integer NOT NULL,
	"status" varchar(255) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_tracking_request_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"pathway_id" integer NOT NULL,
	"mentor_id" integer NOT NULL,
	"mentee_id" integer NOT NULL,
	"request_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_tracking_request_parameter_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"parameter_id" integer NOT NULL,
	"data" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathway_tracking_request_question_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_id" integer NOT NULL,
	"data" varchar(255) NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathways" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(6) NOT NULL,
	"name" varchar(45) NOT NULL,
	"description" varchar(5000) NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"tracking_enabled" boolean DEFAULT false NOT NULL,
	"tracking_frequency" varchar(255),
	"tracking_day_of_week" integer,
	"tracking_days_lock_before_cycle" integer,
	"logo" varchar(255),
	CONSTRAINT "main_pathways_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathways_ongoing_topic" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pathway_id" integer NOT NULL,
	"course_id" integer NOT NULL,
	"exercise_id" integer,
	"assessment_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathways_ongoing_topic_outcome" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"pathway_id" integer,
	"course_id" integer,
	"exercise_id" integer,
	"assessment_id" integer,
	"team_id" integer,
	"module_id" integer,
	"project_topic_id" integer,
	"project_solution_id" integer,
	"slug_id" integer,
	"type" varchar(255),
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."pathways_v2" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(6) NOT NULL,
	"name" varchar(100) NOT NULL,
	"logo" varchar(255),
	"description" varchar(5000) NOT NULL,
	CONSTRAINT "main_pathways_v2_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."production_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_name" varchar(255),
	"lang" char(2) DEFAULT 'en' NOT NULL,
	"version" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."progress_parameters" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(10) NOT NULL,
	"min_range" integer,
	"max_range" integer,
	"created_at" timestamp with time zone,
	"name" varchar(20) NOT NULL,
	"description" varchar(5000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."progress_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" varchar(10) NOT NULL,
	"created_at" timestamp with time zone,
	"name" varchar(20) NOT NULL,
	"description" varchar(5000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."question_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"enrolment_key_id" integer NOT NULL,
	"question_id" integer NOT NULL,
	"selected_option_id" integer,
	"text_answer" varchar(45),
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."question_bucket_choices" (
	"id" serial PRIMARY KEY NOT NULL,
	"bucket_id" integer,
	"question_ids" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."question_buckets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"num_questions" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."question_options" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" varchar(2000) NOT NULL,
	"question_id" integer NOT NULL,
	"correct" boolean NOT NULL,
	"created_at" varchar(45) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."question_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"question_ids" varchar(8000) NOT NULL,
	"version_id" integer NOT NULL,
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"common_text" varchar(2000),
	"en_text" varchar(2000),
	"hi_text" varchar(2000) NOT NULL,
	"difficulty" integer NOT NULL,
	"topic" varchar(45) NOT NULL,
	"type" integer NOT NULL,
	"created_at" varchar(45) NOT NULL,
	"ma_text" varchar(2000)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_quiz_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"module_id" integer NOT NULL,
	"mcq_id" integer NOT NULL,
	"quiz_id" integer,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"status" varchar(255),
	"chossen_option" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."record_versions_of_post_delete_exercisedetails" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_id" integer,
	"exercise_id" integer,
	"version" varchar(255),
	"addedOrRemoved" boolean
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."recurring_classes" (
	"id" serial PRIMARY KEY NOT NULL,
	"frequency" varchar(255) NOT NULL,
	"occurrence" integer,
	"until" date,
	"on_days" varchar(255),
	"calendar_event_id" varchar(255),
	"cohort_room_id" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."registration_form_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"form_data" json,
	CONSTRAINT "main_registration_form_data_partner_id_unique" UNIQUE("partner_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."registration_form_structure" (
	"id" serial PRIMARY KEY NOT NULL,
	"partner_id" integer NOT NULL,
	"form_structure" json,
	CONSTRAINT "main_registration_form_structure_partner_id_unique" UNIQUE("partner_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."sansaar_user_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"role" varchar(255),
	"created_at" timestamp with time zone,
	CONSTRAINT "main_sansaar_user_roles_user_id_role_unique" UNIQUE("user_id","role")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."school" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."school_stage" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer,
	"stageName" varchar(255),
	"stageType" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."scratch" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" varchar(255),
	"url" varchar(255) NOT NULL,
	"userId_scratch" integer,
	"project_name" varchar(255),
	"updated_at" timestamp with time zone,
	"team_id" integer,
	CONSTRAINT "main_scratch_project_id_unique" UNIQUE("project_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."scratch_sample" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"url" varchar(255) NOT NULL,
	"project_name" varchar(255),
	"created_at" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."session" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_name" varchar(255),
	"start_time" timestamp with time zone,
	"end_time" timestamp with time zone,
	"durations" integer,
	"user_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."slot_booked" (
	"id" serial PRIMARY KEY NOT NULL,
	"interview_slot_id" integer,
	"student_id" integer,
	"created_at" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."space_group" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_name" varchar(255),
	"space_id" integer,
	"web_link" varchar(255),
	"android_link" varchar(255),
	"crca_link" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."stage_transitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"from_stage" varchar(255),
	"to_stage" varchar(255),
	"created_at" timestamp with time zone,
	"transition_done_by" varchar(255),
	"school" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."student_campus" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"campus_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."student_documents" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"Resume_link" varchar(255),
	"Id_proof_link" varchar(255),
	"signed_consent_link" varchar(255),
	"marksheet_link" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."student_donor" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"donor_id" text[]
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."student_job_details" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer NOT NULL,
	"job_designation" varchar(255),
	"job_location" varchar(255),
	"salary" varchar(255),
	"job_type" varchar(255),
	"employer" varchar(255),
	"resume" varchar(255),
	"offer_letter_date" timestamp with time zone,
	"video_link" varchar(255),
	"photo_link" varchar(255),
	"write_up" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."student_pathways" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"pathway_id" integer NOT NULL,
	"created_at" timestamp with time zone,
	CONSTRAINT "main_student_pathways_user_id_pathway_id_unique" UNIQUE("user_id","pathway_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."students" (
	"id" serial PRIMARY KEY NOT NULL,
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
CREATE TABLE IF NOT EXISTS "main"."students_school" (
	"id" serial PRIMARY KEY NOT NULL,
	"school_id" integer,
	"student_id" integer,
	CONSTRAINT "main_students_school_student_id_unique" UNIQUE("student_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."students_stages" (
	"id" serial PRIMARY KEY NOT NULL,
	"student_id" integer,
	"from_stage" varchar(255),
	"to_stage" varchar(255),
	"created_at" varchar(255),
	"transition_done_by" varchar(255)
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
CREATE TABLE IF NOT EXISTS "main"."zuvy_tags" (
	"id" serial PRIMARY KEY NOT NULL,
	"tag_name" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."talk_mitra" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" varchar(255) NOT NULL,
	"last_name" text NOT NULL,
	"gender" varchar(255) NOT NULL,
	"country" varchar(255),
	"password" varchar(255) NOT NULL,
	"user_id" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."teacher_capacity_building" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"zone" varchar(255),
	"school_name" varchar(255),
	"teacher_name" varchar(255),
	"school_id" integer,
	"teacher_id" integer,
	"class_of_teacher" varchar(255),
	"email" varchar(255),
	"phone_number" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."test_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(45) NOT NULL,
	"data" text NOT NULL,
	"current" boolean NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."user_hack" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."user_roles" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"roles" "user_roles_roles" DEFAULT 'student',
	"center" "user_roles_center"
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."user_session" (
	"id" varchar(255) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."user_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"access_token" varchar(255) NOT NULL,
	"refresh_token" varchar(255) NOT NULL,
	CONSTRAINT "main_user_tokens_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "main_user_tokens_user_email_unique" UNIQUE("user_email")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."users" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"email" varchar(50) DEFAULT '' NOT NULL,
	"name" varchar(250) DEFAULT '' NOT NULL,
	"profile_picture" varchar(250),
	"google_user_id" varchar(250),
	"center" "users_center",
	"github_link" varchar(145),
	"linkedin_link" varchar(145),
	"medium_link" varchar(145),
	"created_at" timestamp with time zone,
	"chat_id" varchar(255),
	"chat_password" varchar(32),
	"partner_id" integer,
	"lang_1" char(2),
	"lang_2" char(2),
	"mode" varchar(255),
	"contact" varchar(255),
	"last_login_at" timestamp with time zone,
	"space_id" integer,
	"group_id" integer,
	"c4ca_partner_id" integer,
	"c4ca_facilitator_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."users_popular_search" (
	"id" serial PRIMARY KEY NOT NULL,
	"course_name" varchar(255),
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "main_users_popular_search_course_name_unique" UNIQUE("course_name")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."users_search" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"name" varchar(255),
	"created_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."vb_sentences" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"sentence" varchar(255) NOT NULL,
	"h_translation" varchar(255) DEFAULT '' NOT NULL,
	"d_level" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."vb_words" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"word" varchar(250) NOT NULL,
	"e_meaning" varchar(250) DEFAULT '' NOT NULL,
	"h_meaning" varchar(250) DEFAULT '' NOT NULL,
	"word_type" varchar(5) DEFAULT '',
	"d_level" bigint NOT NULL
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
CREATE TABLE IF NOT EXISTS "main"."volunteer" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"hours_per_week" integer,
	"available_on_days" varchar(255),
	"available_on_time" varchar(255),
	"status" varchar(255),
	"manual_status" varchar(255),
	"created_at" timestamp with time zone,
	"pathway_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."youtube_broadcast" (
	"id" serial PRIMARY KEY NOT NULL,
	"video_id" varchar(255) NOT NULL,
	"class_id" integer,
	"recurring_id" integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_meeting_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"meetingid" varchar,
	"batchid" varchar,
	"bootcampid" varchar
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_student_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"meeting_id" text,
	"attendance" jsonb,
	"batch_id" integer,
	"bootcamp_id" integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_80228_users_email_unique" ON "main"."c_users" ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80237_student_idx" ON "main"."contacts" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50433_course_enrolments_ibfk_2_idx" ON "main"."course_enrolments" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50433_course_enrolments_ibfk_1_idx" ON "main"."course_enrolments" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50441_course_relation_ibfk_1" ON "main"."course_relation" ("course_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50441_course_relation_ibfk_2" ON "main"."course_relation" ("relies_on");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_80250_key__unique" ON "main"."enrolment_keys" ("key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80250_student_idx" ON "main"."enrolment_keys" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80250_enrolment_keys_questionsetid_foreign" ON "main"."enrolment_keys" ("question_set_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50457_course_id" ON "main"."exercises" ("course_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_50457_slug__unique" ON "main"."exercises" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80256_feedbacks_studentid_foreign" ON "main"."feedbacks" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80256_feedbacks_userid_foreign" ON "main"."feedbacks" ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80265_contact_idx" ON "main"."incoming_calls" ("contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50487_mentor_ibfk_1_idx" ON "main"."mentors" ("mentor");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50487_mentor_ibfk_2_idx" ON "main"."mentors" ("mentee");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_80292_partner_name" ON "main"."partners" ("name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_80292_partners_slug_unique" ON "main"."partners" ("slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80307_question_bucket_choices_bucketid_foreign" ON "main"."question_bucket_choices" ("bucket_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80322_question_idx" ON "main"."question_options" ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80331_question_sets_versionid_foreign" ON "main"."question_sets" ("version_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80349_stage_transitions_studentid_foreign" ON "main"."stage_transitions" ("student_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_80358_students_partnerid_foreign" ON "main"."students" ("partner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_50519_user_role_ibfk_1_idx" ON "main"."user_roles" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_50526_google_user_id" ON "main"."users" ("google_user_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_article_tracking" ADD CONSTRAINT "zuvy_article_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment" ADD CONSTRAINT "assessment_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment" ADD CONSTRAINT "assessment_exercise_id_exercises_v2_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "main"."exercises_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment_outcome" ADD CONSTRAINT "assessment_outcome_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment_outcome" ADD CONSTRAINT "assessment_outcome_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment_result" ADD CONSTRAINT "assessment_result_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment_result" ADD CONSTRAINT "assessment_result_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "main"."assessment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment_result" ADD CONSTRAINT "assessment_result_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessments_history" ADD CONSTRAINT "assessments_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessments_history" ADD CONSTRAINT "assessments_history_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_assignment_submission" ADD CONSTRAINT "zuvy_assignment_submission_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_batch_id_zuvy_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "main"."zuvy_batches"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batches" ADD CONSTRAINT "zuvy_batches_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_batches" ADD CONSTRAINT "zuvy_batches_instructor_id_users_id_fk" FOREIGN KEY ("instructor_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_bootcamp_type" ADD CONSTRAINT "zuvy_bootcamp_type_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_roles" ADD CONSTRAINT "c4ca_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_students" ADD CONSTRAINT "c4ca_students_teacher_id_c4ca_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "main"."c4ca_teachers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_students" ADD CONSTRAINT "c4ca_students_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_students_projectDetail" ADD CONSTRAINT "c4ca_students_projectDetail_teacher_id_c4ca_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "main"."c4ca_teachers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_students_projectDetail" ADD CONSTRAINT "c4ca_students_projectDetail_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_teachers" ADD CONSTRAINT "c4ca_teachers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_teachers" ADD CONSTRAINT "c4ca_teachers_c4ca_partner_id_c4ca_partners_id_fk" FOREIGN KEY ("c4ca_partner_id") REFERENCES "main"."c4ca_partners"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_team_projectsubmit_solution" ADD CONSTRAINT "c4ca_team_projectsubmit_solution_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_team_projecttopic" ADD CONSTRAINT "c4ca_team_projecttopic_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c4ca_teams" ADD CONSTRAINT "c4ca_teams_teacher_id_c4ca_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "main"."c4ca_teachers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."c_users" ADD CONSTRAINT "c_users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."campus_school" ADD CONSTRAINT "campus_school_campus_id_campus_id_fk" FOREIGN KEY ("campus_id") REFERENCES "main"."campus"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."campus_school" ADD CONSTRAINT "campus_school_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "main"."school"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."chanakya_access" ADD CONSTRAINT "chanakya_access_user_role_id_chanakya_user_roles_id_fk" FOREIGN KEY ("user_role_id") REFERENCES "main"."chanakya_user_roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."chanakya_partner_relationship" ADD CONSTRAINT "chanakya_partner_relationship_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."chanakya_partner_relationship" ADD CONSTRAINT "chanakya_partner_relationship_partner_group_id_chanakya_partner_group_id_fk" FOREIGN KEY ("partner_group_id") REFERENCES "main"."chanakya_partner_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."chanakya_user_roles" ADD CONSTRAINT "chanakya_user_roles_roles_chanakya_roles_id_fk" FOREIGN KEY ("roles") REFERENCES "main"."chanakya_roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."chanakya_user_roles" ADD CONSTRAINT "chanakya_user_roles_privilege_chanakya_privilege_id_fk" FOREIGN KEY ("privilege") REFERENCES "main"."chanakya_privilege"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."class_registrations" ADD CONSTRAINT "class_registrations_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "main"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."class_registrations" ADD CONSTRAINT "class_registrations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes" ADD CONSTRAINT "classes_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "main"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes" ADD CONSTRAINT "classes_recurring_id_recurring_classes_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "main"."recurring_classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes" ADD CONSTRAINT "classes_volunteer_id_volunteer_id_fk" FOREIGN KEY ("volunteer_id") REFERENCES "main"."volunteer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_mail" ADD CONSTRAINT "classes_mail_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "main"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_to_courses" ADD CONSTRAINT "classes_to_courses_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "main"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_to_courses" ADD CONSTRAINT "classes_to_courses_pathway_v1_pathways_id_fk" FOREIGN KEY ("pathway_v1") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_to_courses" ADD CONSTRAINT "classes_to_courses_course_v1_courses_id_fk" FOREIGN KEY ("course_v1") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_to_courses" ADD CONSTRAINT "classes_to_courses_exercise_v1_exercises_id_fk" FOREIGN KEY ("exercise_v1") REFERENCES "main"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_to_courses" ADD CONSTRAINT "classes_to_courses_pathway_v2_pathways_v2_id_fk" FOREIGN KEY ("pathway_v2") REFERENCES "main"."pathways_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_to_courses" ADD CONSTRAINT "classes_to_courses_course_v2_courses_v2_id_fk" FOREIGN KEY ("course_v2") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."classes_to_courses" ADD CONSTRAINT "classes_to_courses_exercise_v2_exercises_v2_id_fk" FOREIGN KEY ("exercise_v2") REFERENCES "main"."exercises_v2"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."course_categories" ADD CONSTRAINT "course_categories_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_categories" ADD CONSTRAINT "course_categories_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "main"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_completion" ADD CONSTRAINT "course_completion_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_completion" ADD CONSTRAINT "course_completion_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_completion_v2" ADD CONSTRAINT "course_completion_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_completion_v2" ADD CONSTRAINT "course_completion_v2_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_completion_v3" ADD CONSTRAINT "course_completion_v3_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_completion_v3" ADD CONSTRAINT "course_completion_v3_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_editor_status" ADD CONSTRAINT "course_editor_status_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_editor_status" ADD CONSTRAINT "course_editor_status_content_editors_user_id_users_id_fk" FOREIGN KEY ("content_editors_user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_enrolments" ADD CONSTRAINT "course_enrolments_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_enrolments" ADD CONSTRAINT "course_enrolments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_production_versions" ADD CONSTRAINT "course_production_versions_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_relation" ADD CONSTRAINT "course_relation_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."course_relation" ADD CONSTRAINT "course_relation_relies_on_courses_id_fk" FOREIGN KEY ("relies_on") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."dashboard_flags" ADD CONSTRAINT "dashboard_flags_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."email_report" ADD CONSTRAINT "email_report_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."eng_history" ADD CONSTRAINT "eng_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."eng_history" ADD CONSTRAINT "eng_history_eng_articles_id_eng_articles_id_fk" FOREIGN KEY ("eng_articles_id") REFERENCES "main"."eng_articles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."eng_levelwise" ADD CONSTRAINT "eng_levelwise_article_id_eng_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "main"."eng_articles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."enrolment_keys" ADD CONSTRAINT "enrolment_keys_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."enrolment_keys" ADD CONSTRAINT "enrolment_keys_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "main"."question_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."events" ADD CONSTRAINT "events_view_page_id_view_page_id_fk" FOREIGN KEY ("view_page_id") REFERENCES "main"."view_page"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."events" ADD CONSTRAINT "events_session_id_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "main"."session"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."events" ADD CONSTRAINT "events_user_id_user_hack_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."user_hack"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercise_completion" ADD CONSTRAINT "exercise_completion_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercise_completion" ADD CONSTRAINT "exercise_completion_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "main"."exercises"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercise_completion_v2" ADD CONSTRAINT "exercise_completion_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercise_completion_v2" ADD CONSTRAINT "exercise_completion_v2_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercises" ADD CONSTRAINT "exercises_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercises_history" ADD CONSTRAINT "exercises_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercises_history" ADD CONSTRAINT "exercises_history_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."exercises_v2" ADD CONSTRAINT "exercises_v2_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."facilitators" ADD CONSTRAINT "facilitators_c4ca_partner_id_c4ca_partners_id_fk" FOREIGN KEY ("c4ca_partner_id") REFERENCES "main"."c4ca_partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."feedbacks" ADD CONSTRAINT "feedbacks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."feedbacks" ADD CONSTRAINT "feedbacks_user_id_c_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."c_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."incoming_calls" ADD CONSTRAINT "incoming_calls_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "main"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."interview_owners" ADD CONSTRAINT "interview_owners_user_id_c_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."c_users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."interview_slot" ADD CONSTRAINT "interview_slot_owner_id_interview_owners_id_fk" FOREIGN KEY ("owner_id") REFERENCES "main"."interview_owners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."interview_slot" ADD CONSTRAINT "interview_slot_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."interview_slot" ADD CONSTRAINT "interview_slot_transition_id_stage_transitions_id_fk" FOREIGN KEY ("transition_id") REFERENCES "main"."stage_transitions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."learning_track_status" ADD CONSTRAINT "learning_track_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."learning_track_status" ADD CONSTRAINT "learning_track_status_exercise_id_exercises_v2_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "main"."exercises_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."learning_track_status" ADD CONSTRAINT "learning_track_status_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."learning_track_status_outcome" ADD CONSTRAINT "learning_track_status_outcome_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."learning_track_status_outcome" ADD CONSTRAINT "learning_track_status_outcome_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."mentor_tree" ADD CONSTRAINT "mentor_tree_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."mentor_tree" ADD CONSTRAINT "mentor_tree_mentee_id_users_id_fk" FOREIGN KEY ("mentee_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."mentor_tree" ADD CONSTRAINT "mentor_tree_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."mentors" ADD CONSTRAINT "mentors_mentor_users_id_fk" FOREIGN KEY ("mentor") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."mentors" ADD CONSTRAINT "mentors_mentee_users_id_fk" FOREIGN KEY ("mentee") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."mentors" ADD CONSTRAINT "mentors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."meraki_certificate" ADD CONSTRAINT "meraki_certificate_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."merged_classes" ADD CONSTRAINT "merged_classes_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "main"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."merged_classes" ADD CONSTRAINT "merged_classes_merged_class_id_classes_id_fk" FOREIGN KEY ("merged_class_id") REFERENCES "main"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."module_completion_v2" ADD CONSTRAINT "module_completion_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."module_completion_v2" ADD CONSTRAINT "module_completion_v2_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_tracking" ADD CONSTRAINT "zuvy_module_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_module_tracking" ADD CONSTRAINT "zuvy_module_tracking_bootcamp_id_zuvy_bootcamps_id_fk" FOREIGN KEY ("bootcamp_id") REFERENCES "main"."zuvy_bootcamps"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."ongoing_topics" ADD CONSTRAINT "ongoing_topics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."ongoing_topics" ADD CONSTRAINT "ongoing_topics_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."ongoing_topics" ADD CONSTRAINT "ongoing_topics_project_topic_id_c4ca_team_projecttopic_id_fk" FOREIGN KEY ("project_topic_id") REFERENCES "main"."c4ca_team_projecttopic"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."ongoing_topics" ADD CONSTRAINT "ongoing_topics_project_solution_id_c4ca_team_projectsubmit_solution_id_fk" FOREIGN KEY ("project_solution_id") REFERENCES "main"."c4ca_team_projectsubmit_solution"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_group_relationship" ADD CONSTRAINT "partner_group_relationship_partner_group_id_partner_group_id_fk" FOREIGN KEY ("partner_group_id") REFERENCES "main"."partner_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_group_user" ADD CONSTRAINT "partner_group_user_partner_group_id_partner_group_id_fk" FOREIGN KEY ("partner_group_id") REFERENCES "main"."partner_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_relationship" ADD CONSTRAINT "partner_relationship_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_relationship" ADD CONSTRAINT "partner_relationship_partner_group_id_partner_group_id_fk" FOREIGN KEY ("partner_group_id") REFERENCES "main"."partner_group"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_space" ADD CONSTRAINT "partner_space_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches" ADD CONSTRAINT "partner_specific_batches_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "main"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches" ADD CONSTRAINT "partner_specific_batches_recurring_id_recurring_classes_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "main"."recurring_classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches" ADD CONSTRAINT "partner_specific_batches_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches" ADD CONSTRAINT "partner_specific_batches_space_id_partner_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "main"."partner_space"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches" ADD CONSTRAINT "partner_specific_batches_group_id_space_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "main"."space_group"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches" ADD CONSTRAINT "partner_specific_batches_pathway_id_pathways_v2_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_class_id_classes_id_fk" FOREIGN KEY ("class_id") REFERENCES "main"."classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_recurring_id_recurring_classes_id_fk" FOREIGN KEY ("recurring_id") REFERENCES "main"."recurring_classes"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_space_id_partner_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "main"."partner_space"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_group_id_space_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "main"."space_group"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_specific_batches_v2" ADD CONSTRAINT "partner_specific_batches_v2_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."partner_user" ADD CONSTRAINT "partner_user_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_completion" ADD CONSTRAINT "pathway_completion_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_completion" ADD CONSTRAINT "pathway_completion_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_completion_v2" ADD CONSTRAINT "pathway_completion_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_completion_v2" ADD CONSTRAINT "pathway_completion_v2_team_id_c4ca_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "main"."c4ca_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_courses" ADD CONSTRAINT "pathway_courses_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_courses" ADD CONSTRAINT "pathway_courses_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_courses_v2" ADD CONSTRAINT "pathway_courses_v2_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_courses_v2" ADD CONSTRAINT "pathway_courses_v2_pathway_id_pathways_v2_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_milestones" ADD CONSTRAINT "pathway_milestones_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_partner_group" ADD CONSTRAINT "pathway_partner_group_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_partner_group" ADD CONSTRAINT "pathway_partner_group_pathway_id_pathways_v2_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_form_structure" ADD CONSTRAINT "pathway_tracking_form_structure_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_form_structure" ADD CONSTRAINT "pathway_tracking_form_structure_parameter_id_progress_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "main"."progress_parameters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_form_structure" ADD CONSTRAINT "pathway_tracking_form_structure_question_id_progress_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."progress_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request" ADD CONSTRAINT "pathway_tracking_request_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request" ADD CONSTRAINT "pathway_tracking_request_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request" ADD CONSTRAINT "pathway_tracking_request_mentee_id_users_id_fk" FOREIGN KEY ("mentee_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request_details" ADD CONSTRAINT "pathway_tracking_request_details_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request_details" ADD CONSTRAINT "pathway_tracking_request_details_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request_details" ADD CONSTRAINT "pathway_tracking_request_details_mentee_id_users_id_fk" FOREIGN KEY ("mentee_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request_details" ADD CONSTRAINT "pathway_tracking_request_details_request_id_pathway_tracking_request_id_fk" FOREIGN KEY ("request_id") REFERENCES "main"."pathway_tracking_request"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request_parameter_details" ADD CONSTRAINT "pathway_tracking_request_parameter_details_parameter_id_progress_parameters_id_fk" FOREIGN KEY ("parameter_id") REFERENCES "main"."progress_parameters"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathway_tracking_request_question_details" ADD CONSTRAINT "pathway_tracking_request_question_details_question_id_progress_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."progress_questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathways_ongoing_topic" ADD CONSTRAINT "pathways_ongoing_topic_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathways_ongoing_topic" ADD CONSTRAINT "pathways_ongoing_topic_pathway_id_pathways_v2_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathways_ongoing_topic" ADD CONSTRAINT "pathways_ongoing_topic_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathways_ongoing_topic" ADD CONSTRAINT "pathways_ongoing_topic_exercise_id_exercises_v2_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "main"."exercises_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathways_ongoing_topic" ADD CONSTRAINT "pathways_ongoing_topic_assessment_id_assessment_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "main"."assessment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."pathways_ongoing_topic_outcome" ADD CONSTRAINT "pathways_ongoing_topic_outcome_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."question_bucket_choices" ADD CONSTRAINT "question_bucket_choices_bucket_id_question_buckets_id_fk" FOREIGN KEY ("bucket_id") REFERENCES "main"."question_buckets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "main"."questions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."question_sets" ADD CONSTRAINT "question_sets_version_id_test_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "main"."test_versions"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."record_versions_of_post_delete_exercisedetails" ADD CONSTRAINT "record_versions_of_post_delete_exercisedetails_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."record_versions_of_post_delete_exercisedetails" ADD CONSTRAINT "record_versions_of_post_delete_exercisedetails_exercise_id_exercises_v2_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "main"."exercises_v2"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."registration_form_data" ADD CONSTRAINT "registration_form_data_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."registration_form_structure" ADD CONSTRAINT "registration_form_structure_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."sansaar_user_roles" ADD CONSTRAINT "sansaar_user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."school_stage" ADD CONSTRAINT "school_stage_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "main"."school"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."session" ADD CONSTRAINT "session_user_id_user_hack_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."user_hack"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."slot_booked" ADD CONSTRAINT "slot_booked_interview_slot_id_interview_slot_id_fk" FOREIGN KEY ("interview_slot_id") REFERENCES "main"."interview_slot"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."slot_booked" ADD CONSTRAINT "slot_booked_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."space_group" ADD CONSTRAINT "space_group_space_id_partner_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "main"."partner_space"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."stage_transitions" ADD CONSTRAINT "stage_transitions_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."student_campus" ADD CONSTRAINT "student_campus_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."student_campus" ADD CONSTRAINT "student_campus_campus_id_campus_id_fk" FOREIGN KEY ("campus_id") REFERENCES "main"."campus"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."student_documents" ADD CONSTRAINT "student_documents_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."student_donor" ADD CONSTRAINT "student_donor_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."student_job_details" ADD CONSTRAINT "student_job_details_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."student_pathways" ADD CONSTRAINT "student_pathways_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."student_pathways" ADD CONSTRAINT "student_pathways_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."students" ADD CONSTRAINT "students_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."students" ADD CONSTRAINT "students_current_owner_id_interview_owners_id_fk" FOREIGN KEY ("current_owner_id") REFERENCES "main"."interview_owners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."students" ADD CONSTRAINT "students_school_stage_id_school_stage_id_fk" FOREIGN KEY ("school_stage_id") REFERENCES "main"."school_stage"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."students_school" ADD CONSTRAINT "students_school_school_id_school_id_fk" FOREIGN KEY ("school_id") REFERENCES "main"."school"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."students_school" ADD CONSTRAINT "students_school_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."students_stages" ADD CONSTRAINT "students_stages_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."teacher_capacity_building" ADD CONSTRAINT "teacher_capacity_building_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."user_tokens" ADD CONSTRAINT "user_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."user_tokens" ADD CONSTRAINT "user_tokens_user_email_users_email_fk" FOREIGN KEY ("user_email") REFERENCES "main"."users"("email") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."users" ADD CONSTRAINT "users_space_id_partner_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "main"."partner_space"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."users" ADD CONSTRAINT "users_group_id_space_group_id_fk" FOREIGN KEY ("group_id") REFERENCES "main"."space_group"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."users" ADD CONSTRAINT "users_c4ca_partner_id_c4ca_partners_id_fk" FOREIGN KEY ("c4ca_partner_id") REFERENCES "main"."c4ca_partners"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."users" ADD CONSTRAINT "users_c4ca_facilitator_id_facilitators_id_fk" FOREIGN KEY ("c4ca_facilitator_id") REFERENCES "main"."facilitators"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."view_page" ADD CONSTRAINT "view_page_user_id_user_hack_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."user_hack"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."volunteer" ADD CONSTRAINT "volunteer_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_student_attendance" ADD CONSTRAINT "zuvy_student_attendance_meeting_id_zuvy_classes_google_meet_link_meetingid_fk" FOREIGN KEY ("meeting_id") REFERENCES "main"."zuvy_classes_google_meet_link"("meetingid") ON DELETE no action ON UPDATE no action;
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
