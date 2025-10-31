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


CREATE TABLE "main"."zuvy_resources" (
    "id" SERIAL PRIMARY KEY,
    "key" VARCHAR(64) NOT NULL UNIQUE,
    "display_name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE "main"."zuvy_permissions" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL,
    "resource_id" INTEGER NOT NULL REFERENCES "main"."zuvy_resources"("id"),
    "description" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT now(),
    "updated_at" TIMESTAMPTZ DEFAULT now()
);


CREATE TABLE "main"."zuvy_scopes" (
    "id" SERIAL PRIMARY KEY,
    "name" VARCHAR(100) NOT NULL UNIQUE,
    "description" TEXT
);


CREATE TABLE "main"."zuvy_user_roles_assigned" (
    "id" SERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL REFERENCES "main"."users"("id"),
    "role_id" INTEGER NOT NULL REFERENCES "main"."zuvy_user_roles"("id"),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "zuvy_user_roles_assigned_user_id_role_id_pk"
        UNIQUE ("user_id", "role_id")
);


CREATE TABLE "main"."zuvy_role_permissions" (
    "id" SERIAL PRIMARY KEY,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    "role_id" INTEGER NOT NULL REFERENCES "main"."zuvy_user_roles"("id"),
    "permission_id" INTEGER NOT NULL REFERENCES "main"."zuvy_permissions"("id"),
    CONSTRAINT "zuvy_role_permissions_role_id_permission_id_pk"
        UNIQUE ("role_id", "permission_id")
);


CREATE TABLE "main"."zuvy_permissions_scope" (
    "id" SERIAL PRIMARY KEY,
    "permission_id" INTEGER NOT NULL REFERENCES "main"."zuvy_permissions"("id"),
    "scope_id" INTEGER NOT NULL REFERENCES "main"."zuvy_scopes"("id"),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT "zuvy_permissions_scope_permission_id_scope_id_pk"
        UNIQUE ("permission_id", "scope_id")
);


CREATE TABLE "main"."zuvy_audit_logs" (
    "id" SERIAL PRIMARY KEY,
    "actor_user_id" BIGINT REFERENCES "main"."users"("id"),
    "target_user_id" BIGINT REFERENCES "main"."users"("id"),
    "action" VARCHAR(100) NOT NULL,
    "role_id" INTEGER REFERENCES "main"."zuvy_user_roles"("id"),
    "permission_id" INTEGER REFERENCES "main"."zuvy_permissions"("id"),
    "scope_id" INTEGER REFERENCES "main"."zuvy_scopes"("id"),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
	"updated_at" TIMESTAMPTZ DEFAULT NOW()
);


CREATE TABLE "main"."zuvy_extra_permissions" (
    "id" SERIAL PRIMARY KEY,
    "user_id" BIGINT NOT NULL REFERENCES "main"."users"("id"),
    "granted_by" BIGINT NOT NULL REFERENCES "main"."users"("id"),
    "permission_id" INTEGER NOT NULL REFERENCES "main"."zuvy_permissions"("id"),
    "resource_id" INTEGER NOT NULL REFERENCES "main"."zuvy_resources"("id"),
    "course_name" VARCHAR(255),
    "action" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);
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

CREATE TABLE "main"."zuvy_permissions_roles" (
    "id" SERIAL PRIMARY KEY,
    "permission_id" INTEGER NOT NULL REFERENCES "main"."zuvy_permissions"("id"),
    "role_id" INTEGER NOT NULL REFERENCES "main"."zuvy_user_roles"("id"),
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE main.zuvy_permissions_roles ADD CONSTRAINT uniq_role_permission UNIQUE (role_id, permission_id);

--> questions by llm table.
CREATE TABLE "questions_by_llm" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "ai_assessment_id" INTEGER NOT NULL REFERENCES "main"."ai_assessment"("id"),
  "topic" VARCHAR(100),
  "difficulty" VARCHAR(50),
  "bootcamp_id" INTEGER,
  "question" TEXT NOT NULL,
  "language" VARCHAR(255),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "mcq_question_options" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "question_id" INTEGER NOT NULL REFERENCES "questions_by_llm"("id") ON DELETE CASCADE,
  "option_text" TEXT NOT NULL,
  "option_number" INTEGER NOT NULL
);

CREATE TABLE "correct_answers" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "question_id" INTEGER NOT NULL REFERENCES "questions_by_llm"("id") ON DELETE CASCADE,
  "correct_option_id" INTEGER NOT NULL REFERENCES "question_options"("id") ON DELETE CASCADE
);

CREATE TABLE "levels" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "grade" VARCHAR(5) NOT NULL,
  "score_range" VARCHAR(50) NOT NULL,
  "score_min" INTEGER,
  "score_max" INTEGER,
  "hardship" VARCHAR(20),
  "meaning" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "uniq_level_grade" UNIQUE ("grade")
);

CREATE TABLE "question_level_relation" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "level_id" INTEGER NOT NULL REFERENCES "main"."levels"("id"),
  "question_id" INTEGER NOT NULL REFERENCES "main"."questions_by_llm"("id"),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "uniq_student_question" UNIQUE ("level_id", "question_id")
);

CREATE TABLE "question_student_answer_relation" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "student_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "question_id" INTEGER NOT NULL REFERENCES "questions_by_llm"("id"),
  "answer" INTEGER NOT NULL,
  "status" INTEGER NOT NULL DEFAULT 0, -- 1 = correct, 0 = wrong
  "answered_at" TIMESTAMPTZ DEFAULT NOW(),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "uniq_student_question_answer" UNIQUE ("student_id", "question_id")
);

CREATE TABLE "student_level_relation" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "student_id" INTEGER NOT NULL REFERENCES "main"."users"("id"),
  "level_id" INTEGER NOT NULL REFERENCES "main"."levels"("id"),
  "ai_assessment_id" INTEGER NOT NULL REFERENCES "main"."ai_assessment"("id"),
  "assigned_at" TIMESTAMPTZ DEFAULT NOW(),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "uniq_student_level" UNIQUE ("student_id", "level_id")
);

CREATE TABLE IF NOT EXISTS "question_evaluation" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "ai_assessment_id" INTEGER NOT NULL REFERENCES "main"."ai_assessment"("id"),
  "question" TEXT NOT NULL,
  "topic" VARCHAR(255),
  "difficulty" VARCHAR(50),
  "options" JSONB NOT NULL,
  "correct_option" INTEGER NOT NULL,
  "selected_answer_by_student" INTEGER NOT NULL,
  "language" VARCHAR(50),
  "status" VARCHAR(50),
  "explanation" TEXT,
  "summary" TEXT,
  "recommendations" TEXT,
  "student_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "ai_assessment" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "bootcamp_id" INTEGER NOT NULL REFERENCES "zuvy_bootcamps"("id"),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "difficulty" VARCHAR(50),
  "topics" JSONB NOT NULL,
  "audience" JSONB,
  "total_number_of_questions" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

