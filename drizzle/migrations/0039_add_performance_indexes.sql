-- ============================================
-- Performance indexes for student-side APIs
-- Adds secondary indexes to hot-path tracking/enrollment/quiz/content
-- tables that previously had only a primary key. Matches the index()
-- definitions added to drizzle/schema.ts for the same tables.
--
-- IMPORTANT — DO NOT run this file through `npm run migrate`
-- (src/db/migrate.ts / drizzle-orm's migrator). That runner wraps every
-- pending migration in a single transaction (see
-- drizzle-orm/pg-core/dialect.js: `session.transaction(...)`), and Postgres
-- does not allow CREATE INDEX CONCURRENTLY inside a transaction block — it
-- would throw and abort the whole migration batch.
--
-- Several of the tables below (zuvy_batch_enrollments, zuvy_chapter_tracking,
-- zuvy_quiz_tracking, etc.) are hot tables under active read/write traffic in
-- production. A plain CREATE INDEX takes a lock that blocks writes for the
-- duration of the index build. CONCURRENTLY avoids that lock, at the cost of
-- needing to run outside a transaction.
--
-- Apply this file manually against the database instead, e.g.:
--   psql "$DATABASE_URL" -f drizzle/migrations/0039_add_performance_indexes.sql
-- (or paste it into a DB console/admin tool). Each statement below commits
-- independently, so it's safe to re-run if interrupted partway through —
-- already-built indexes are skipped via IF NOT EXISTS.
-- ============================================

-- zuvy_batch_enrollments
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_batch_enrollments_user_id_idx
  ON zuvy_batch_enrollments (user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_batch_enrollments_bootcamp_id_idx
  ON zuvy_batch_enrollments (bootcamp_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_batch_enrollments_batch_id_idx
  ON zuvy_batch_enrollments (batch_id);

-- zuvy_module_quiz
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_module_quiz_org_id_idx
  ON zuvy_module_quiz (org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_module_quiz_tag_id_idx
  ON zuvy_module_quiz (tag_id);

-- zuvy_module_quiz_variants
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_module_quiz_variants_quiz_id_idx
  ON zuvy_module_quiz_variants (quiz_id);

-- zuvy_course_modules
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_course_modules_bootcamp_id_idx
  ON zuvy_course_modules (bootcamp_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_course_modules_bootcamp_id_order_idx
  ON zuvy_course_modules (bootcamp_id, "order");

-- zuvy_assignment_submission
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_assignment_submission_user_id_chapter_id_idx
  ON zuvy_assignment_submission (user_id, chapter_id);

-- zuvy_project_tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_project_tracking_user_id_module_id_idx
  ON zuvy_project_tracking (user_id, module_id);

-- zuvy_bootcamp_tracking
-- Step 1: collapse any existing duplicates down to one row per
-- (user_id, bootcamp_id), keeping the most recently updated row (ties
-- broken by highest id) — the same "latest wins" tie-break used by the
-- leaderboard query's max(updated_at) aggregate.
DELETE FROM zuvy_bootcamp_tracking t
USING (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, bootcamp_id
      ORDER BY updated_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM zuvy_bootcamp_tracking
  WHERE user_id IS NOT NULL AND bootcamp_id IS NOT NULL
) ranked
WHERE t.id = ranked.id
  AND ranked.rn > 1;

-- Step 2: enforce it going forward. Must run outside a transaction (see
-- header) — CONCURRENTLY avoids locking the table's writers while it builds.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS zuvy_bootcamp_tracking_user_id_bootcamp_id_idx
  ON zuvy_bootcamp_tracking (user_id, bootcamp_id);

-- zuvy_quiz_tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_quiz_tracking_user_id_chapter_id_idx
  ON zuvy_quiz_tracking (user_id, chapter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_quiz_tracking_assessment_submission_id_idx
  ON zuvy_quiz_tracking (assessment_submission_id);

-- zuvy_module_tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_module_tracking_user_id_module_id_idx
  ON zuvy_module_tracking (user_id, module_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_module_tracking_bootcamp_id_idx
  ON zuvy_module_tracking (bootcamp_id);

-- zuvy_module_chapter
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_module_chapter_module_id_idx
  ON zuvy_module_chapter (module_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_module_chapter_module_id_order_idx
  ON zuvy_module_chapter (module_id, "order");

-- zuvy_assessment_submission
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_assessment_submission_assessment_outsourse_id_idx
  ON zuvy_assessment_submission (assessment_outsourse_id);

-- zuvy_openEnded_questions (mixed-case identifier, must stay quoted)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "zuvy_openEnded_questions_org_id_idx"
  ON "zuvy_openEnded_questions" (org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "zuvy_openEnded_questions_tag_id_idx"
  ON "zuvy_openEnded_questions" (tag_id);

-- zuvy_chapter_tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_chapter_tracking_user_id_chapter_id_idx
  ON zuvy_chapter_tracking (user_id, chapter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_chapter_tracking_module_id_idx
  ON zuvy_chapter_tracking (module_id);

-- zuvy_outsourse_assessments
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_outsourse_assessments_chapter_id_idx
  ON zuvy_outsourse_assessments (chapter_id);

-- zuvy_form_tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_form_tracking_user_id_chapter_id_idx
  ON zuvy_form_tracking (user_id, chapter_id);

-- zuvy_coding_questions
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_coding_questions_org_id_idx
  ON zuvy_coding_questions (org_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_coding_questions_tag_id_idx
  ON zuvy_coding_questions (tag_id);

-- zuvy_sessions
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_sessions_chapter_id_idx
  ON zuvy_sessions (chapter_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_sessions_batch_id_idx
  ON zuvy_sessions (batch_id);

-- zuvy_learner_education_branch_details
CREATE INDEX CONCURRENTLY IF NOT EXISTS zuvy_learner_education_branch_details_degree_id_idx
  ON zuvy_learner_education_branch_details (degree_id);
