DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_scope') THEN
    CREATE TYPE assessment_scope AS ENUM ('bootcamp', 'domain');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assessment_status') THEN
    CREATE TYPE assessment_status AS ENUM ('draft', 'scheduled', 'published');
  END IF;
END $$;



ALTER TABLE ai_assessment
RENAME TO zuvy_ai_assessment;

ALTER TABLE zuvy_ai_assessment
  ADD COLUMN IF NOT EXISTS chapter_id integer,
  ADD COLUMN IF NOT EXISTS scope assessment_scope DEFAULT 'bootcamp' NOT NULL,
  ADD COLUMN IF NOT EXISTS status assessment_status DEFAULT 'draft' NOT NULL,
  ADD COLUMN IF NOT EXISTS domain_id integer,
  ADD COLUMN IF NOT EXISTS objective varchar(255),
  ADD COLUMN IF NOT EXISTS expected_outcomes varchar(255),
  ADD COLUMN IF NOT EXISTS chapter_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pool_topics jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamp with time zone;

UPDATE zuvy_ai_assessment
SET objective = COALESCE(objective, title, '')
WHERE objective IS NULL;

ALTER TABLE zuvy_ai_assessment
  ALTER COLUMN objective SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'zuvy_ai_assessment'
      AND column_name = 'topics'
  ) THEN
    ALTER TABLE zuvy_ai_assessment ALTER COLUMN topics DROP NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zuvy_ai_assessment_chapter_id_fkey'
  ) THEN
    ALTER TABLE zuvy_ai_assessment
      ADD CONSTRAINT zuvy_ai_assessment_chapter_id_fkey
      FOREIGN KEY (chapter_id) REFERENCES zuvy_module_chapter(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'zuvy_ai_assessment_domain_id_fkey'
  ) THEN
    ALTER TABLE zuvy_ai_assessment
      ADD CONSTRAINT zuvy_ai_assessment_domain_id_fkey
      FOREIGN KEY (domain_id) REFERENCES zuvy_course_modules(id);
  END IF;
END $$;





ALTER TABLE ai_assessment_question_sets
RENAME TO zuvy_ai_assessment_question_sets;

CREATE TABLE IF NOT EXISTS ai_assessment_question_sets (
  id serial PRIMARY KEY NOT NULL,
  ai_assessment_id integer NOT NULL REFERENCES ai_assessment(id) ON DELETE cascade,
  set_index integer NOT NULL,
  label varchar(32) NOT NULL,
  level_code varchar(8),
  status varchar(32) DEFAULT 'draft' NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uniq_ai_assessment_set_index UNIQUE (ai_assessment_id, set_index)
);




ALTER TABLE ai_assessment_questions
RENAME TO zuvy_ai_assessment_questions;

CREATE TABLE IF NOT EXISTS ai_assessment_questions (
  id serial PRIMARY KEY NOT NULL,
  question_set_id integer NOT NULL REFERENCES ai_assessment_question_sets(id) ON DELETE cascade,
  question_id integer NOT NULL REFERENCES zuvy_questions(id) ON DELETE cascade,
  is_common boolean DEFAULT false NOT NULL,
  position integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT uniq_ai_assessment_set_question UNIQUE (question_set_id, question_id),
  CONSTRAINT uniq_ai_assessment_set_position UNIQUE (question_set_id, position)
);

ALTER TABLE student_assessment
  ADD COLUMN IF NOT EXISTS question_set_id integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'student_assessment_question_set_id_fkey'
  ) THEN
    ALTER TABLE student_assessment
      ADD CONSTRAINT student_assessment_question_set_id_fkey
      FOREIGN KEY (question_set_id)
      REFERENCES ai_assessment_question_sets(id)
      ON DELETE set null;
  END IF;
END $$;
