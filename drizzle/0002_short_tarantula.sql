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