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
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
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
CREATE TABLE IF NOT EXISTS "main"."coding_questions" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"title" varchar(255) NOT NULL,
	"description" text NOT NULL,
	"difficulty" "difficulty",
	"tags" text,
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
CREATE TABLE IF NOT EXISTS "main"."coding_submission" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"question_solved" jsonb NOT NULL,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone
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
CREATE TABLE IF NOT EXISTS "main"."scratch_sample" (
	"id" serial PRIMARY KEY NOT NULL,
	"project_id" varchar(255) NOT NULL,
	"url" varchar(255) NOT NULL,
	"project_name" varchar(255),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "main"."zuvy_student_attendance" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"batchId" varchar NOT NULL,
	"attendance" varchar,
	"meetingId" varchar NOT NULL
);
--> statement-breakpoint
DROP TABLE "main"."english_ai_content";--> statement-breakpoint
DROP TABLE "main"."english_ai_history";--> statement-breakpoint
DROP TABLE "main"."hackathon_answers";--> statement-breakpoint
DROP TABLE "main"."hackathon_courses";--> statement-breakpoint
DROP TABLE "main"."hackathon_login";--> statement-breakpoint
DROP TABLE "main"."hackathon_questions";--> statement-breakpoint
DROP TABLE "main"."learning_progress";--> statement-breakpoint
DROP TABLE "main"."learning_resources";--> statement-breakpoint
ALTER TABLE "main"."assessment" DROP CONSTRAINT "assessment_course_id_courses_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."assessment_outcome" DROP CONSTRAINT "assessment_outcome_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."assessment_result" DROP CONSTRAINT "assessment_result_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_roles" DROP CONSTRAINT "c4ca_roles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_students" DROP CONSTRAINT "c4ca_students_teacher_id_c4ca_teachers_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_students_projectDetail" DROP CONSTRAINT "c4ca_students_projectDetail_teacher_id_c4ca_teachers_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_teachers" DROP CONSTRAINT "c4ca_teachers_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_team_projectsubmit_solution" DROP CONSTRAINT "c4ca_team_projectsubmit_solution_team_id_c4ca_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_team_projecttopic" DROP CONSTRAINT "c4ca_team_projecttopic_team_id_c4ca_teams_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_teams" DROP CONSTRAINT "c4ca_teams_teacher_id_c4ca_teachers_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c_users" DROP CONSTRAINT "c_users_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."campus_school" DROP CONSTRAINT "campus_school_campus_id_campus_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."chanakya_access" DROP CONSTRAINT "chanakya_access_user_role_id_chanakya_user_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."chanakya_partner_relationship" DROP CONSTRAINT "chanakya_partner_relationship_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."chanakya_user_roles" DROP CONSTRAINT "chanakya_user_roles_roles_chanakya_roles_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."class_registrations" DROP CONSTRAINT "class_registrations_class_id_classes_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."classes" DROP CONSTRAINT "classes_category_id_category_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."classes_mail" DROP CONSTRAINT "classes_mail_class_id_classes_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."classes_to_courses" DROP CONSTRAINT "classes_to_courses_class_id_classes_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_categories" DROP CONSTRAINT "course_categories_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_completion" DROP CONSTRAINT "course_completion_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_completion_v2" DROP CONSTRAINT "course_completion_v2_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_completion_v3" DROP CONSTRAINT "course_completion_v3_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_editor_status" DROP CONSTRAINT "course_editor_status_course_id_courses_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_enrolments" DROP CONSTRAINT "course_enrolments_student_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_production_versions" DROP CONSTRAINT "course_production_versions_course_id_courses_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."course_relation" DROP CONSTRAINT "course_relation_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."dashboard_flags" DROP CONSTRAINT "dashboard_flags_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."email_report" DROP CONSTRAINT "email_report_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."enrolment_keys" DROP CONSTRAINT "enrolment_keys_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."events" DROP CONSTRAINT "events_view_page_id_view_page_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."exercise_completion" DROP CONSTRAINT "exercise_completion_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."exercise_completion_v2" DROP CONSTRAINT "exercise_completion_v2_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."exercises" DROP CONSTRAINT "exercises_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."exercises_v2" DROP CONSTRAINT "exercises_v2_course_id_courses_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."facilitators" DROP CONSTRAINT "facilitators_c4ca_partner_id_c4ca_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."feedbacks" DROP CONSTRAINT "feedbacks_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."incoming_calls" DROP CONSTRAINT "incoming_calls_contact_id_contacts_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."interview_owners" DROP CONSTRAINT "interview_owners_user_id_c_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."interview_slot" DROP CONSTRAINT "interview_slot_owner_id_interview_owners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."learning_track_status" DROP CONSTRAINT "learning_track_status_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."learning_track_status_outcome" DROP CONSTRAINT "learning_track_status_outcome_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."mentor_tree" DROP CONSTRAINT "mentor_tree_mentor_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."mentors" DROP CONSTRAINT "mentors_mentor_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."meraki_certificate" DROP CONSTRAINT "meraki_certificate_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."merakihackthon" DROP CONSTRAINT "merakihackthon_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."merged_classes" DROP CONSTRAINT "merged_classes_class_id_classes_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."module_completion_v2" DROP CONSTRAINT "module_completion_v2_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."partner_group_relationship" DROP CONSTRAINT "partner_group_relationship_partner_group_id_partner_group_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."partner_group_user" DROP CONSTRAINT "partner_group_user_partner_group_id_partner_group_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."partner_relationship" DROP CONSTRAINT "partner_relationship_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."partner_space" DROP CONSTRAINT "partner_space_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."partner_specific_batches" DROP CONSTRAINT "partner_specific_batches_class_id_classes_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."partner_user" DROP CONSTRAINT "partner_user_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_completion" DROP CONSTRAINT "pathway_completion_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_completion_v2" DROP CONSTRAINT "pathway_completion_v2_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_courses" DROP CONSTRAINT "pathway_courses_course_id_courses_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_courses_v2" DROP CONSTRAINT "pathway_courses_v2_course_id_courses_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_milestones" DROP CONSTRAINT "pathway_milestones_pathway_id_pathways_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_partner_group" DROP CONSTRAINT "pathway_partner_group_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_tracking_form_structure" DROP CONSTRAINT "pathway_tracking_form_structure_pathway_id_pathways_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_tracking_request" DROP CONSTRAINT "pathway_tracking_request_pathway_id_pathways_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_tracking_request_details" DROP CONSTRAINT "pathway_tracking_request_details_pathway_id_pathways_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_tracking_request_parameter_details" DROP CONSTRAINT "pathway_tracking_request_parameter_details_parameter_id_progress_parameters_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathway_tracking_request_question_details" DROP CONSTRAINT "pathway_tracking_request_question_details_question_id_progress_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathways_ongoing_topic" DROP CONSTRAINT "pathways_ongoing_topic_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."pathways_ongoing_topic_outcome" DROP CONSTRAINT "pathways_ongoing_topic_outcome_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."question_bucket_choices" DROP CONSTRAINT "question_bucket_choices_bucket_id_question_buckets_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."question_options" DROP CONSTRAINT "question_options_question_id_questions_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."question_sets" DROP CONSTRAINT "question_sets_version_id_test_versions_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."record_versions_of_post_delete_exercisedetails" DROP CONSTRAINT "record_versions_of_post_delete_exercisedetails_course_id_courses_v2_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."registration_form_data" DROP CONSTRAINT "registration_form_data_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."registration_form_structure" DROP CONSTRAINT "registration_form_structure_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."sansaar_user_roles" DROP CONSTRAINT "sansaar_user_roles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."school_stage" DROP CONSTRAINT "school_stage_school_id_school_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."session" DROP CONSTRAINT "session_user_id_user_hack_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."slot_booked" DROP CONSTRAINT "slot_booked_interview_slot_id_interview_slot_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."space_group" DROP CONSTRAINT "space_group_space_id_partner_space_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."stage_transitions" DROP CONSTRAINT "stage_transitions_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."student_campus" DROP CONSTRAINT "student_campus_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."student_documents" DROP CONSTRAINT "student_documents_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."student_donor" DROP CONSTRAINT "student_donor_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."student_job_details" DROP CONSTRAINT "student_job_details_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."student_pathways" DROP CONSTRAINT "student_pathways_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."students" DROP CONSTRAINT "students_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."students_school" DROP CONSTRAINT "students_school_school_id_school_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."students_stages" DROP CONSTRAINT "students_stages_student_id_students_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."teacher_capacity_building" DROP CONSTRAINT "teacher_capacity_building_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."user_roles" DROP CONSTRAINT "user_roles_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."user_tokens" DROP CONSTRAINT "user_tokens_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."users" DROP CONSTRAINT "users_partner_id_partners_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."view_page" DROP CONSTRAINT "view_page_user_id_user_hack_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."volunteer" DROP CONSTRAINT "volunteer_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "main"."c4ca_team_projectsubmit_solution" ADD COLUMN "project_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."c4ca_team_projecttopic" ADD COLUMN "projectTopic_file_name" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."classes_to_courses" ADD COLUMN "slug_id" integer;--> statement-breakpoint
ALTER TABLE "main"."exercise_completion_v2" ADD COLUMN "slug_id" integer;--> statement-breakpoint
ALTER TABLE "main"."exercise_completion_v2" ADD COLUMN "course_id" integer;--> statement-breakpoint
ALTER TABLE "main"."exercise_completion_v2" ADD COLUMN "lang" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."exercise_completion_v2" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."exercises" ADD COLUMN "review_type" "exercises_review_type" DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "main"."exercises" ADD COLUMN "submission_type" "exercises_submission_type";--> statement-breakpoint
ALTER TABLE "main"."feedbacks" ADD COLUMN "notification_sent_at" text;--> statement-breakpoint
ALTER TABLE "main"."feedbacks" ADD COLUMN "notification_status" text;--> statement-breakpoint
ALTER TABLE "main"."pathways_ongoing_topic_outcome" ADD COLUMN "slug_id" integer;--> statement-breakpoint
ALTER TABLE "main"."pathways_ongoing_topic_outcome" ADD COLUMN "type" varchar(255);--> statement-breakpoint
ALTER TABLE "main"."pathways_ongoing_topic_outcome" ADD COLUMN "created_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."pathways_ongoing_topic_outcome" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "main"."user_roles" ADD COLUMN "roles" "user_roles_roles" DEFAULT 'student';--> statement-breakpoint
ALTER TABLE "main"."user_roles" ADD COLUMN "center" "user_roles_center";--> statement-breakpoint
ALTER TABLE "main"."users" ADD COLUMN "center" "users_center";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."assessment" ADD CONSTRAINT "assessment_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."assessment_result" ADD CONSTRAINT "assessment_result_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."c4ca_students_projectDetail" ADD CONSTRAINT "c4ca_students_projectDetail_teacher_id_c4ca_teachers_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "main"."c4ca_teachers"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."chanakya_user_roles" ADD CONSTRAINT "chanakya_user_roles_roles_chanakya_roles_id_fk" FOREIGN KEY ("roles") REFERENCES "main"."chanakya_roles"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."classes" ADD CONSTRAINT "classes_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "main"."category"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."course_categories" ADD CONSTRAINT "course_categories_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."course_completion_v2" ADD CONSTRAINT "course_completion_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."course_editor_status" ADD CONSTRAINT "course_editor_status_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."enrolment_keys" ADD CONSTRAINT "enrolment_keys_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."exercise_completion" ADD CONSTRAINT "exercise_completion_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."exercises" ADD CONSTRAINT "exercises_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."learning_track_status" ADD CONSTRAINT "learning_track_status_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."mentor_tree" ADD CONSTRAINT "mentor_tree_mentor_id_users_id_fk" FOREIGN KEY ("mentor_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."meraki_certificate" ADD CONSTRAINT "meraki_certificate_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."merakihackthon" ADD CONSTRAINT "merakihackthon_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."module_completion_v2" ADD CONSTRAINT "module_completion_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."pathway_completion_v2" ADD CONSTRAINT "pathway_completion_v2_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."pathway_courses_v2" ADD CONSTRAINT "pathway_courses_v2_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."pathway_tracking_form_structure" ADD CONSTRAINT "pathway_tracking_form_structure_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."pathway_tracking_request_details" ADD CONSTRAINT "pathway_tracking_request_details_pathway_id_pathways_id_fk" FOREIGN KEY ("pathway_id") REFERENCES "main"."pathways"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."record_versions_of_post_delete_exercisedetails" ADD CONSTRAINT "record_versions_of_post_delete_exercisedetails_course_id_courses_v2_id_fk" FOREIGN KEY ("course_id") REFERENCES "main"."courses_v2"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."students" ADD CONSTRAINT "students_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."students_stages" ADD CONSTRAINT "students_stages_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "main"."students"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."users" ADD CONSTRAINT "users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "main"."partners"("id") ON DELETE no action ON UPDATE no action;
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
ALTER TABLE "main"."exercises" DROP COLUMN IF EXISTS "main.exercises_review_type";--> statement-breakpoint
ALTER TABLE "main"."exercises" DROP COLUMN IF EXISTS "main.exercises_submission_type";--> statement-breakpoint
ALTER TABLE "main"."user_roles" DROP COLUMN IF EXISTS "main.user_roles_roles";--> statement-breakpoint
ALTER TABLE "main"."user_roles" DROP COLUMN IF EXISTS "main.user_roles_center";--> statement-breakpoint
ALTER TABLE "main"."users" DROP COLUMN IF EXISTS "main.users_center";--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."zuvy_article_tracking" ADD CONSTRAINT "zuvy_article_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."coding_submission" ADD CONSTRAINT "coding_submission_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_quiz_tracking" ADD CONSTRAINT "zuvy_quiz_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
