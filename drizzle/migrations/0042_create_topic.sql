CREATE SEQUENCE IF NOT EXISTS "topic_id_seq";

CREATE TABLE IF NOT EXISTS "topic" (
  "id" integer DEFAULT nextval('"topic_id_seq"'::regclass) NOT NULL,
  "org_id" integer NOT NULL,
  "name" character varying(255) NOT NULL,
  "description" text,
  "subtopic" jsonb,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "topic_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "topic"
  ADD CONSTRAINT "topic_org_id_fkey"
  FOREIGN KEY ("org_id")
  REFERENCES "zuvy_organizations"("id")
  ON DELETE CASCADE;
