

CREATE TABLE IF NOT EXISTS "zuvy_mentor_profile" (
  "id" serial PRIMARY KEY NOT NULL,
  "mentor_user_id" bigint NOT NULL,
  "email" varchar(255),
  "title" varchar(255),
  "bio" text,
  "expertise" jsonb,
  "past_experiences" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "zuvy_mentor_profile_mentor_user_id_users_id_fk"
    FOREIGN KEY ("mentor_user_id") REFERENCES "public"."users"("id") ON DELETE cascade
);

ALTER TABLE "zuvy_mentor_profile"
DROP CONSTRAINT IF EXISTS "zuvy_mentor_profile_mentor_user_id_users_id_fk";

CREATE UNIQUE INDEX IF NOT EXISTS "idx_mentor_profile_user"
  ON "zuvy_mentor_profile" USING btree ("mentor_user_id");

INSERT INTO "zuvy_mentor_profile" (
  "mentor_user_id",
  "email",
  "title",
  "bio",
  "expertise",
  "past_experiences",
  "created_at",
  "updated_at"
)
SELECT DISTINCT ON (m."mentor_user_id")
  m."mentor_user_id",
  u."email",
  m."title",
  m."bio",
  m."expertise",
  m."past_experiences",
  COALESCE(m."created_at", now()),
  COALESCE(m."updated_at", now())
FROM "zuvy_mentor_slot_management" m
INNER JOIN "users" u ON u."id" = m."mentor_user_id"
ORDER BY m."mentor_user_id", m."updated_at" DESC NULLS LAST, m."id" DESC
ON CONFLICT ("mentor_user_id") DO UPDATE
SET
  "email" = EXCLUDED."email",
  "title" = EXCLUDED."title",
  "bio" = EXCLUDED."bio",
  "expertise" = EXCLUDED."expertise",
  "past_experiences" = EXCLUDED."past_experiences",
  "updated_at" = EXCLUDED."updated_at"

  

SELECT m."mentor_user_id", COUNT(*) AS cnt
FROM "zuvy_mentor_slot_management" m
LEFT JOIN "users" u ON u."id" = m."mentor_user_id"
WHERE u."id" IS NULL
GROUP BY m."mentor_user_id"
ORDER BY cnt DESC;

UPDATE main.zuvy_mentor_slot_management m
SET
  title = p.title,
  bio = p.bio,
  expertise = p.expertise,
  past_experiences = p.past_experiences,
  updated_at = now()
FROM main.zuvy_mentor_profile p
WHERE p.mentor_user_id = m.mentor_user_id;

SELECT mentor_user_id, email, title, bio, expertise, past_experiences
FROM main.zuvy_mentor_profile
LIMIT 20;

SELECT mentor_user_id, organization_id, bootcamp_id, is_verified, timezone
FROM main.zuvy_mentor_slot_management
ORDER BY mentor_user_id, organization_id;

SELECT m.mentor_user_id, m.organization_id
FROM main.zuvy_mentor_slot_management m
LEFT JOIN main.zuvy_mentor_profile p
  ON p.mentor_user_id = m.mentor_user_id
WHERE p.id IS NULL;