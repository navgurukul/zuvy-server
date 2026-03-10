-- Migration: Create zuvy_learners_complete_profile table
-- This table stores a learner's complete profile data across 5 pages
-- Each page contributes 20% to the total profile strength (100%)

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_score_type') THEN
    CREATE TYPE learner_score_type AS ENUM ('CGPA', '%');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_project_type') THEN
    CREATE TYPE learner_project_type AS ENUM ('Solo', 'Team');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS main.zuvy_learners_complete_profile (
  id serial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES main.users(id) ON UPDATE CASCADE ON DELETE CASCADE,

  -- PAGE 1: BASICS - Personal Details + Education (20%)
  full_name varchar(255),
  phone_number varchar(20),
  email varchar(255),
  linkedin_profile varchar(500),
  college_name varchar(255),
  other_college_name varchar(100),
  degree varchar(100),
  branch varchar(100),
  year_of_study learner_year_of_study,
  graduation_month integer,
  graduation_year integer,
  current_status learner_current_status,

  -- PAGE 2: SKILLS & PROJECTS (20%)
  technical_skills jsonb DEFAULT '[]'::jsonb,
  projects jsonb DEFAULT '[]'::jsonb,

  -- PAGE 3: EDUCATION & EXPERIENCE (20%)
  college_stream varchar(100),
  college_score varchar(20),
  college_score_type learner_score_type,
  class12_board varchar(100),
  class12_score varchar(20),
  class12_score_type learner_score_type,
  class10_board varchar(100),
  class10_score varchar(20),
  class10_score_type learner_score_type,
  has_work_experience boolean DEFAULT false,
  work_experiences jsonb DEFAULT '[]'::jsonb,
  leetcode_username varchar(100),
  codechef_username varchar(100),
  codeforces_username varchar(100),

  -- PAGE 4: PREFERENCES (20%)
  target_roles jsonb DEFAULT '[]'::jsonb,
  preferred_locations jsonb DEFAULT '[]'::jsonb,
  open_to_remote boolean DEFAULT false,
  internship_stipend varchar(50),
  full_time_ctc varchar(50),
  preferred_contact_methods jsonb DEFAULT '[]'::jsonb,

  -- PAGE 5: REVIEW & COMPLETE (20%)
  -- This page is marked complete when the learner reviews and confirms all data
  review_completed boolean DEFAULT false,

  -- Page completion tracking
  page1_completed boolean DEFAULT false,
  page2_completed boolean DEFAULT false,
  page3_completed boolean DEFAULT false,
  page4_completed boolean DEFAULT false,
  page5_completed boolean DEFAULT false,

  -- Profile strength percentage (0-100)
  profile_strength integer DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure one profile per user
CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learners_complete_profile_user_id_unique
ON main.zuvy_learners_complete_profile (user_id);
