CREATE TABLE IF NOT EXISTS "main"."zuvy_tracking_logs" (
  "id" serial PRIMARY KEY NOT NULL,
  "org_id" integer DEFAULT NULL,
  "bootcamp_id" integer DEFAULT NULL REFERENCES "main"."zuvy_bootcamps"("id"),
  "actor_user_id" bigint NOT NULL REFERENCES "main"."users"("id"),
  "permission_id" integer DEFAULT NULL REFERENCES "main"."zuvy_permissions"("id"),
  "resource_id" integer DEFAULT NULL REFERENCES "main"."zuvy_resources"("id"),
  "action" varchar(100) NOT NULL,
  "resource_type" varchar(100) NOT NULL,
  "description" text NOT NULL,
  "status" varchar(50) NOT NULL DEFAULT 'success',
  "created_at" timestamp with time zone DEFAULT now()
);
