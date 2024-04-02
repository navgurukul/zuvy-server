ALTER TABLE "main"."exercises" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."exercises" ALTER COLUMN "slug" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."exercises" ALTER COLUMN "review_type" SET DATA TYPE exercises_review_type;--> statement-breakpoint
ALTER TABLE "main"."exercises" ALTER COLUMN "submission_type" SET DATA TYPE exercises_submission_type;--> statement-breakpoint
ALTER TABLE "main"."vb_sentences" ALTER COLUMN "h_translation" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."vb_words" ALTER COLUMN "e_meaning" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."vb_words" ALTER COLUMN "h_meaning" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."vb_words" ALTER COLUMN "word_type" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "email" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "name" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "main"."users" ALTER COLUMN "center" SET DATA TYPE users_center;--> statement-breakpoint
ALTER TABLE "main"."user_roles" ALTER COLUMN "roles" SET DATA TYPE user_roles_roles;--> statement-breakpoint
ALTER TABLE "main"."user_roles" ALTER COLUMN "center" SET DATA TYPE user_roles_center;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "main"."ongoing_topics" ADD CONSTRAINT "ongoing_topics_project_solution_id_c4ca_team_projectsubmit_solution_id_fk" FOREIGN KEY ("project_solution_id") REFERENCES "main"."c4ca_team_projectsubmit_solution"("id") ON DELETE cascade ON UPDATE cascade;
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
 ALTER TABLE "main"."chanakya_partner_relationship" ADD CONSTRAINT "chanakya_partner_relationship_partner_group_id_chanakya_partner_group_id_fk" FOREIGN KEY ("partner_group_id") REFERENCES "main"."chanakya_partner_group"("id") ON DELETE no action ON UPDATE no action;
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
 ALTER TABLE "main"."zuvy_quiz_tracking" ADD CONSTRAINT "zuvy_quiz_tracking_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "main"."users"("id") ON DELETE no action ON UPDATE no action;
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
ALTER TABLE "main"."zuvy_bootcamps" DROP COLUMN IF EXISTS "cap_enrollment";