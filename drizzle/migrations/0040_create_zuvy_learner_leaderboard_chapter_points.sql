CREATE TABLE IF NOT EXISTS "zuvy_learner_leaderboard_chapter_points" (
  "id" serial PRIMARY KEY NOT NULL,
  "learner_id" integer NOT NULL,
  "bootcamp_id" integer NOT NULL,
  "chapter_id" integer NOT NULL,
  "topic_id" integer,
  "points" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "uniq_zuvy_leaderboard_chapter_points_learner_bootcamp_chapter"
    UNIQUE ("learner_id", "bootcamp_id", "chapter_id")
);

ALTER TABLE "zuvy_learner_leaderboard_chapter_points"
  ADD CONSTRAINT "zuvy_leaderboard_chapter_points_learner_id_users_id_fk"
  FOREIGN KEY ("learner_id") REFERENCES "users"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "zuvy_learner_leaderboard_chapter_points"
  ADD CONSTRAINT "zuvy_leaderboard_chapter_points_bootcamp_id_bootcamps_id_fk"
  FOREIGN KEY ("bootcamp_id") REFERENCES "zuvy_bootcamps"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "zuvy_learner_leaderboard_chapter_points"
  ADD CONSTRAINT "zuvy_leaderboard_chapter_points_chapter_id_chapter_id_fk"
  FOREIGN KEY ("chapter_id") REFERENCES "zuvy_module_chapter"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "zuvy_learner_leaderboard_chapter_points"
  ADD CONSTRAINT "zuvy_leaderboard_chapter_points_topic_id_topics_id_fk"
  FOREIGN KEY ("topic_id") REFERENCES "zuvy_module_topics"("id")
  ON DELETE set null ON UPDATE no action;

CREATE INDEX IF NOT EXISTS "idx_zuvy_leaderboard_chapter_points_learner_bootcamp"
  ON "zuvy_learner_leaderboard_chapter_points" ("learner_id", "bootcamp_id");

CREATE INDEX IF NOT EXISTS "idx_zuvy_leaderboard_chapter_points_chapter_id"
  ON "zuvy_learner_leaderboard_chapter_points" ("chapter_id");
