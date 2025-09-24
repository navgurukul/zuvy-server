CREATE SEQUENCE "main"."c4ca_students_projectDetail_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "main"."zuvy_openEnded_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "main"."zuvy_outsourse_openEnded_questions_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
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
--> rbac tables
CREATE TABLE "main"."zuvy_user_roles" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(50) NOT NULL UNIQUE,
    "description" TEXT
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_resources" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "description" TEXT
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_permissions" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "resource_id" INTEGER NOT NULL REFERENCES "main"."zuvy_resources"("id"),
    "description" TEXT
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_scopes" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "description" TEXT
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_user_roles_assigned" (
    "id" SERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL REFERENCES "main"."users"("id"),
    "role_id" INTEGER NOT NULL REFERENCES "main"."zuvy_user_roles"("id"),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "zuvy_user_roles_assigned_user_id_role_id_pk"
        UNIQUE ("user_id", "role_id")
);
--> statement-breakpoint
CREATE TABLE "main"."zuvy_user_permissions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL REFERENCES "main"."users"("id"),
    "permission_id" INTEGER NOT NULL REFERENCES "main"."zuvy_permissions"("id"),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "main"."zuvy_resources_granted_permissions" (
    "id" SERIAL PRIMARY KEY,
    "resource_id" INTEGER NOT NULL REFERENCES "main"."zuvy_resources"("id"),
    "permission_id" INTEGER NOT NULL REFERENCES "main"."zuvy_permissions"("id"),
    "granted_permission" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

--> statement-breakpoint
ALTER TABLE "main"."zuvy_role_permissions" ADD CONSTRAINT "zuvy_role_permissions_role_id_zuvy_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "main"."zuvy_user_roles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_role_permissions" ADD CONSTRAINT "zuvy_role_permissions_permission_id_zuvy_permissions_id_fk" FOREIGN KEY ("permission_id") REFERENCES "main"."zuvy_permissions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_user_roles_assigned" ADD CONSTRAINT "zuvy_user_roles_assigned_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "main"."zuvy_user_roles_assigned" ADD CONSTRAINT "zuvy_user_roles_assigned_role_id_zuvy_user_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "main"."zuvy_user_roles"("id") ON DELETE no action ON UPDATE no action;
