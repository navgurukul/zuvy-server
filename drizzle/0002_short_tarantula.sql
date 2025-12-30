ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "is_passed" boolean;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "percentage" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "coding_question_count" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "mcq_question_count" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "open_ended_question_count" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "attempted_coding_questions" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "attempted_mcq_questions" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "attempted_open_ended_questions" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "coding_score" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "open_ended_score" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "mcq_score" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "required_coding_score" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "required_open_ended_score" integer;--> statement-breakpoint
ALTER TABLE "main"."zuvy_assessment_submission" ADD COLUMN "required_mcq_score" integer;

ALTER TABLE "main"."zuvy_bootcamps" ADD COLUMN "organization_id" integer REFERENCES "organizations"("id") ON DELETE CASCADE NOT NULL;--> statement-breakpoint
UPDATE "main"."zuvy_bootcamps" SET "organization_id" = 1;