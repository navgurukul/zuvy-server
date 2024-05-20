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
	"recurring_id" integer
);
--> statement-breakpoint
DROP TABLE "main"."events";--> statement-breakpoint
DROP TABLE "main"."session";--> statement-breakpoint
DROP TABLE "main"."user_hack";--> statement-breakpoint
DROP TABLE "main"."view_page";--> statement-breakpoint
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
