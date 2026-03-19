ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
ADD COLUMN IF NOT EXISTS resume_url VARCHAR(1024);

ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);

INSERT INTO main.zuvy_learners_complete_profile (user_id, resume_url, original_filename)
SELECT r.user_id, r.resume_url, r.original_filename
FROM main.zuvy_learner_resumes r
ON CONFLICT (user_id) DO UPDATE
SET
  resume_url = EXCLUDED.resume_url,
  original_filename = EXCLUDED.original_filename,
  updated_at = NOW();
