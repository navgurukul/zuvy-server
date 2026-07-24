-- ============================================
-- Performance indexes for student-side APIs
-- Adds secondary indexes to hot-path tracking/enrollment/quiz/content
-- tables that previously had only a primary key. Matches the index()
-- definitions added to drizzle/schema.ts for the same tables.
-- ============================================

-- zuvy_batch_enrollments
CREATE INDEX IF NOT EXISTS zuvy_batch_enrollments_user_id_idx
  ON zuvy_batch_enrollments (user_id);
CREATE INDEX IF NOT EXISTS zuvy_batch_enrollments_bootcamp_id_idx
  ON zuvy_batch_enrollments (bootcamp_id);
CREATE INDEX IF NOT EXISTS zuvy_batch_enrollments_batch_id_idx
  ON zuvy_batch_enrollments (batch_id);

-- zuvy_module_quiz
CREATE INDEX IF NOT EXISTS zuvy_module_quiz_org_id_idx
  ON zuvy_module_quiz (org_id);
CREATE INDEX IF NOT EXISTS zuvy_module_quiz_tag_id_idx
  ON zuvy_module_quiz (tag_id);

-- zuvy_module_quiz_variants
CREATE INDEX IF NOT EXISTS zuvy_module_quiz_variants_quiz_id_idx
  ON zuvy_module_quiz_variants (quiz_id);

-- zuvy_course_modules
CREATE INDEX IF NOT EXISTS zuvy_course_modules_bootcamp_id_idx
  ON zuvy_course_modules (bootcamp_id);
CREATE INDEX IF NOT EXISTS zuvy_course_modules_bootcamp_id_order_idx
  ON zuvy_course_modules (bootcamp_id, "order");

-- zuvy_assignment_submission
CREATE INDEX IF NOT EXISTS zuvy_assignment_submission_user_id_chapter_id_idx
  ON zuvy_assignment_submission (user_id, chapter_id);

-- zuvy_project_tracking
CREATE INDEX IF NOT EXISTS zuvy_project_tracking_user_id_module_id_idx
  ON zuvy_project_tracking (user_id, module_id);

-- zuvy_bootcamp_tracking
CREATE INDEX IF NOT EXISTS zuvy_bootcamp_tracking_user_id_bootcamp_id_idx
  ON zuvy_bootcamp_tracking (user_id, bootcamp_id);

-- zuvy_quiz_tracking
CREATE INDEX IF NOT EXISTS zuvy_quiz_tracking_user_id_chapter_id_idx
  ON zuvy_quiz_tracking (user_id, chapter_id);
CREATE INDEX IF NOT EXISTS zuvy_quiz_tracking_assessment_submission_id_idx
  ON zuvy_quiz_tracking (assessment_submission_id);

-- zuvy_module_tracking
CREATE INDEX IF NOT EXISTS zuvy_module_tracking_user_id_module_id_idx
  ON zuvy_module_tracking (user_id, module_id);
CREATE INDEX IF NOT EXISTS zuvy_module_tracking_bootcamp_id_idx
  ON zuvy_module_tracking (bootcamp_id);

-- zuvy_module_chapter
CREATE INDEX IF NOT EXISTS zuvy_module_chapter_module_id_idx
  ON zuvy_module_chapter (module_id);
CREATE INDEX IF NOT EXISTS zuvy_module_chapter_module_id_order_idx
  ON zuvy_module_chapter (module_id, "order");

-- zuvy_assessment_submission
CREATE INDEX IF NOT EXISTS zuvy_assessment_submission_assessment_outsourse_id_idx
  ON zuvy_assessment_submission (assessment_outsourse_id);

-- zuvy_openEnded_questions (mixed-case identifier, must stay quoted)
CREATE INDEX IF NOT EXISTS "zuvy_openEnded_questions_org_id_idx"
  ON "zuvy_openEnded_questions" (org_id);
CREATE INDEX IF NOT EXISTS "zuvy_openEnded_questions_tag_id_idx"
  ON "zuvy_openEnded_questions" (tag_id);

-- zuvy_chapter_tracking
CREATE INDEX IF NOT EXISTS zuvy_chapter_tracking_user_id_chapter_id_idx
  ON zuvy_chapter_tracking (user_id, chapter_id);
CREATE INDEX IF NOT EXISTS zuvy_chapter_tracking_module_id_idx
  ON zuvy_chapter_tracking (module_id);

-- zuvy_outsourse_assessments
CREATE INDEX IF NOT EXISTS zuvy_outsourse_assessments_chapter_id_idx
  ON zuvy_outsourse_assessments (chapter_id);

-- zuvy_form_tracking
CREATE INDEX IF NOT EXISTS zuvy_form_tracking_user_id_chapter_id_idx
  ON zuvy_form_tracking (user_id, chapter_id);

-- zuvy_coding_questions
CREATE INDEX IF NOT EXISTS zuvy_coding_questions_org_id_idx
  ON zuvy_coding_questions (org_id);
CREATE INDEX IF NOT EXISTS zuvy_coding_questions_tag_id_idx
  ON zuvy_coding_questions (tag_id);

-- zuvy_sessions
CREATE INDEX IF NOT EXISTS zuvy_sessions_chapter_id_idx
  ON zuvy_sessions (chapter_id);
CREATE INDEX IF NOT EXISTS zuvy_sessions_batch_id_idx
  ON zuvy_sessions (batch_id);

-- zuvy_learner_education_branch_details
CREATE INDEX IF NOT EXISTS zuvy_learner_education_branch_details_degree_id_idx
  ON zuvy_learner_education_branch_details (degree_id);
