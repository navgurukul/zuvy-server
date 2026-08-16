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
  "ai_assessment_id" INTEGER NOT NULL 
    REFERENCES "main"."ai_assessment"("id") ON DELETE CASCADE,
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
  "correct_option_id" INTEGER NOT NULL REFERENCES "mcq_question_options"("id") ON DELETE CASCADE
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
  CONSTRAINT "uniq_student_assessment_level" UNIQUE ("student_id", "ai_assessment_id")
);

CREATE TABLE IF NOT EXISTS "question_evaluation" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "ai_assessment_id" INTEGER NOT NULL REFERENCES "main"."ai_assessment"("id"),
  "question_id" INTEGER NOT NULL REFERENCES "questions_by_llm"("id"),
  "question" TEXT NOT NULL,
  "topic" VARCHAR(255),
  "difficulty" VARCHAR(50),
  "options" JSONB NOT NULL,
--   "correct_option" INTEGER NOT NULL,
  "selected_answer_by_student" INTEGER NOT NULL,
  "language" VARCHAR(50),
  "status" VARCHAR(50) DEFAULT NULL,
  "explanation" TEXT,
  "summary" TEXT,
  "recommendations" TEXT,
  "student_id" INTEGER NOT NULL REFERENCES "users"("id"),
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE "ai_assessment" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "bootcamp_id" INTEGER NOT NULL,
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "topics" JSONB NOT NULL,
  "audience" JSONB DEFAULT NULL,
  "total_number_of_questions" INTEGER NOT NULL,
  "total_questions_with_buffer" INTEGER NOT NULL,
  "start_datetime" TIMESTAMPTZ,
  "end_datetime" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT "ai_assessment_bootcamp_id_fkey" 
    FOREIGN KEY ("bootcamp_id") REFERENCES "zuvy_bootcamps"("id")
);
CREATE TABLE "student_assessment" (
  "id" SERIAL PRIMARY KEY NOT NULL,
  "student_id" INTEGER NOT NULL,
  "ai_assessment_id" INTEGER NOT NULL,
  "status" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT "student_assessment_student_id_fkey" 
    FOREIGN KEY ("student_id") REFERENCES "users"("id"),
  CONSTRAINT "student_assessment_ai_assessment_id_fkey" 
    FOREIGN KEY ("ai_assessment_id") REFERENCES "ai_assessment"("id") ON DELETE CASCADE,
  
  CONSTRAINT "uniq_student_assessment" 
    UNIQUE ("student_id", "ai_assessment_id")
);



-- orgnization: zuvy
CREATE TABLE "zuvy_organizations" (
    "id" SERIAL PRIMARY KEY NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "display_name" VARCHAR(255) NOT NULL,
    "is_managed_by_zuvy" BOOLEAN NOT NULL DEFAULT false,
    "logo_url" VARCHAR(500),
    "poc_name" VARCHAR(255),
    "poc_email" VARCHAR(255),
    "zuvy_poc_name" VARCHAR(255),
    "zuvy_poc_email" VARCHAR(255),
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ DEFAULT NOW(),
    "version" VARCHAR(10)
);

-- Create indexes
CREATE INDEX "zuvy_organizations_title_idx" ON "zuvy_organizations" ("title");
CREATE INDEX "zuvy_organizations_is_verified_idx" ON "zuvy_organizations" ("is_verified");
CREATE INDEX "zuvy_organizations_created_at_idx" ON "zuvy_organizations" ("created_at");
ALTER TABLE "zuvy_organizations" ADD CONSTRAINT "zuvy_organizations_title_unique" UNIQUE("title");

-- Create user_organizations table
CREATE TABLE "zuvy_user_organizations" (
    "id" SERIAL PRIMARY KEY,
    
    "user_id" BIGINT NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "user_email" VARCHAR(255) NOT NULL,
    
    "access_token" TEXT,
    "refresh_token" TEXT,
    
    "joined_at" TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT "zuvy_user_organizations_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id"),

    CONSTRAINT "zuvy_user_organizations_organization_id_fkey"
        FOREIGN KEY ("organization_id")
        REFERENCES "zuvy_organizations"("id")
        ON DELETE CASCADE,

    CONSTRAINT "zuvy_user_organizations_uniq_user_organization"
        UNIQUE ("user_id", "organization_id")
);


CREATE INDEX "zuvy_user_organizations_user_id_idx"
    ON "zuvy_user_organizations" ("user_id");

CREATE INDEX "zuvy_user_organizations_organization_id_idx"
    ON "zuvy_user_organizations" ("organization_id");

CREATE INDEX "zuvy_user_organizations_joined_at_idx"
    ON "zuvy_user_organizations" ("joined_at");

ALTER TABLE "zuvy_permissions_roles" 
ADD COLUMN IF NOT EXISTS "org_id" INTEGER NOT NULL 
REFERENCES "zuvy_organizations"("id") DEFAULT 1;

-- mapping orgid in questions bank tables
-- For MCQ
ALTER TABLE "zuvy_module_quiz"
ADD COLUMN "org_id" INTEGER;

UPDATE "zuvy_module_quiz"
SET "org_id" = 1;

ALTER TABLE "zuvy_module_quiz"
ALTER COLUMN "org_id" SET NOT NULL;

ALTER TABLE "zuvy_module_quiz"
ADD CONSTRAINT "fk_module_quiz_org"
FOREIGN KEY ("org_id")
REFERENCES "zuvy_organizations"("id")
ON UPDATE CASCADE
ON DELETE CASCADE;

-- For Open Ended Questions
ALTER TABLE "zuvy_openEnded_questions"
ADD COLUMN "org_id" INTEGER;

UPDATE "zuvy_openEnded_questions"
SET "org_id" = 1;

ALTER TABLE "zuvy_openEnded_questions"
ALTER COLUMN "org_id" SET NOT NULL;

ALTER TABLE "zuvy_openEnded_questions"
ADD CONSTRAINT "fk_openended_org"
FOREIGN KEY ("org_id")
REFERENCES "zuvy_organizations"("id")
ON UPDATE CASCADE
ON DELETE CASCADE;

-- For Coding Questions
ALTER TABLE "zuvy_coding_questions"
ADD COLUMN "org_id" INTEGER;

UPDATE "zuvy_coding_questions"
SET "org_id" = 1;

ALTER TABLE "zuvy_coding_questions"
ALTER COLUMN "org_id" SET NOT NULL;

ALTER TABLE "zuvy_coding_questions"
ADD CONSTRAINT "fk_coding_questions_org"
FOREIGN KEY ("org_id")
REFERENCES "zuvy_organizations"("id")
ON UPDATE CASCADE
ON DELETE CASCADE;

CREATE TABLE "zuvy_user_licenses" (
    "id" SERIAL PRIMARY KEY NOT NULL,
    "zoom_email" VARCHAR(255) NOT NULL,
    "zoom_user_id" VARCHAR(128),
    "user_name" VARCHAR(255),
    "license_type" INTEGER NOT NULL DEFAULT 2,
    "status" VARCHAR(30) NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX "zoom_user_licenses_email_pool_key"
ON "zuvy_user_licenses" ("zoom_email");

ALTER TABLE zuvy_learner_education_branch_details
ADD COLUMN degree_id INTEGER;

ALTER TABLE zuvy_learner_education_branch_details
ADD CONSTRAINT zuvy_learner_education_branch_details_degree_id_fk
FOREIGN KEY (degree_id)
REFERENCES zuvy_learners_degree_details(id)
ON DELETE CASCADE;

DROP INDEX IF EXISTS zuvy_learner_education_branch_details_name_unique;



INSERT INTO zuvy_learner_education_branch_details (name, degree_id)
VALUES
('Computer Science Engineering', 1),
('Information Technology', 1),
('Electronics and Communication', 1),
('Electrical Engineering', 1),
('Mechanical Engineering', 1),
('Civil Engineering', 1),
('Chemical Engineering', 1),
('AI and Data Science', 1),

('Computer Engineering', 2),
('Mechanical Engineering', 2),
('Civil Engineering', 2),
('Electronics Engineering', 2),

('Physics', 3),
('Chemistry', 3),
('Mathematics', 3),
('Computer Science', 3),
('Biotechnology', 3),
('Microbiology', 3),

('Computer Applications', 4),
('Software Development', 4),
('Data Science Basics', 4),

('Marketing', 5),
('Finance', 5),
('Human Resource Management', 5),
('International Business', 5),

('General Commerce', 6),
('Accounting and Finance', 6),
('Banking and Insurance', 6),

('English', 7),
('History', 7),
('Political Science', 7),
('Sociology', 7),
('Psychology', 7),

('Architecture Design', 8),

('Fashion Design', 9),
('Interior Design', 9),
('Product Design', 9),

('Pharmacy', 10),

('Education', 11),

('Law', 12),

('Medicine', 13),

('Dental Surgery', 14),

('Hotel Management', 15),

('Physiotherapy', 16),

('Computer Science Engineering', 17),
('Mechanical Engineering', 17),
('Civil Engineering', 17),

('Engineering', 18),

('Physics', 19),
('Chemistry', 19),
('Mathematics', 19),
('Computer Science', 19),

('Computer Applications', 20),

('Marketing', 21),
('Finance', 21),
('Human Resource', 21),
('Operations', 21),

('English', 22),
('History', 22),
('Political Science', 22),

('Commerce', 23),

('Pharmacy', 24),

('Education', 25),

('Law', 26),

('Medicine Specialization', 27),

('Surgery', 28),

('Research', 29),

('Engineering Diploma', 30),
('Pharmacy Diploma', 30),

('Advanced Technical Studies', 31),

('Management', 32),
('Computer Applications', 32),

('Engineering Diploma', 33),

('IT Certification', 34),
('Skill Development', 34),

('Other Specialization', 35);



ALTER TABLE main.zuvy_learners_complete_profile
  DROP COLUMN IF EXISTS other_college_name;


DROP TABLE IF EXISTS zuvy_leaderboard_settings



SELECT column_name
FROM information_schema.columns
WHERE table_name = 'zuvy_bootcamp_type';


ALTER TABLE zuvy_bootcamp_type
ADD COLUMN leaderboard_enabled BOOLEAN DEFAULT FALSE;



SELECT id, name
FROM zuvy_bootcamps
WHERE id IN (1046, 1047);




ALTER TABLE zuvy_learner_leaderboard
ADD CONSTRAINT unique_learner_bootcamp
UNIQUE (learner_id, bootcamp_id);





SELECT learner_id, bootcamp_id, total_points
FROM zuvy_learner_leaderboard;



SELECT bootcamp_id, COUNT(*)
FROM zuvy_learner_leaderboard
GROUP BY bootcamp_id;


SELECT user_id
FROM zuvy_batch_enrollments
WHERE bootcamp_id = 1047;



SELECT learner_id
FROM zuvy_learner_leaderboard
WHERE bootcamp_id = 1047;



SELECT *
FROM zuvy_student_attendance_records
WHERE user_id = 58083;



SELECT *
FROM zuvy_chapter_tracking
WHERE user_id = 58083;



SELECT *
FROM zuvy_batch_enrollments
WHERE user_id = 58083;




SELECT *
FROM zuvy_learner_leaderboard ll
WHERE NOT EXISTS (
  SELECT 1
  FROM zuvy_batch_enrollments be
  WHERE be.user_id = ll.learner_id
    AND be.bootcamp_id = ll.bootcamp_id
);

CREATE TABLE "zuvy_user_feature_flags" (
    "id" SERIAL PRIMARY KEY NOT NULL,
    "user_id" BIGINT NOT NULL,
    "login_tooltip" BOOLEAN NOT NULL DEFAULT FALSE,
    "shown_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "zuvy_user_feature_flags_user_id_unique" UNIQUE ("user_id"),

    CONSTRAINT "zuvy_user_feature_flags_user_id_fkey"
        FOREIGN KEY ("user_id")
        REFERENCES "users"("id")
        ON DELETE CASCADE
);

CREATE INDEX "zuvy_user_feature_flags_user_id_idx"
ON "zuvy_user_feature_flags" ("user_id");



ALTER TABLE zuvy_learner_leaderboard
ADD COLUMN article_points INTEGER DEFAULT 0,
ADD COLUMN video_points INTEGER DEFAULT 0;



DELETE FROM "main"."zuvy_batch_enrollments" a
USING "main"."zuvy_batch_enrollments" b
WHERE a.id < b.id
  AND a.user_id = b.user_id
  AND a.bootcamp_id = b.bootcamp_id;

ALTER TABLE "main"."zuvy_batch_enrollments" ADD CONSTRAINT "zuvy_batch_enrollments_user_id_bootcamp_id_uniq" UNIQUE ("user_id", "bootcamp_id");



SELECT learner_id, bootcamp_id, chapter_id, points, COUNT(*)
FROM zuvy_learner_leaderboard_chapter_points
GROUP BY learner_id, bootcamp_id, chapter_id, points
ORDER BY learner_id, chapter_id;



SELECT
  learner_id,
  bootcamp_id,
  chapter_id,
  topic_id,
  points
FROM zuvy_learner_leaderboard_chapter_points
WHERE learner_id = 63619
  AND bootcamp_id = 1047
  AND chapter_id = 8050;




  SELECT
  learner_id,
  bootcamp_id,
  video_points,
  total_points
FROM zuvy_learner_leaderboard
WHERE learner_id = 63619
  AND bootcamp_id = 1047;



  SELECT learner_id, bootcamp_id, chapter_id, topic_id, points
FROM zuvy_learner_leaderboard_chapter_points
WHERE learner_id = 63619
  AND bootcamp_id = 1047
  AND chapter_id IN (8051, 8052);




  SELECT *
FROM zuvy_learner_leaderboard_chapter_points
WHERE learner_id = 63619
  AND bootcamp_id = 1047
  AND chapter_id = 8083;
