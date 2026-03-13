CREATE TABLE IF NOT EXISTS main.zuvy_learner_resumes (
  id SERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL,
  resume_url VARCHAR(1024) NOT NULL,
  original_filename VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_zuvy_learner_resumes_user_id ON main.zuvy_learner_resumes (user_id);
