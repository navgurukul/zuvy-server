BEGIN;

CREATE TABLE IF NOT EXISTS main.zuvy_learner_education_details_reordered (
  id serial PRIMARY KEY,
  college_name varchar(255),
  degree_program varchar(100),
  branch_name varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO main.zuvy_learner_education_details_reordered (
  id,
  college_name,
  degree_program,
  branch_name,
  created_at,
  updated_at
)
SELECT
  id,
  college_name,
  degree_program,
  branch_name,
  created_at,
  updated_at
FROM main.zuvy_learner_education_details;

DROP TABLE main.zuvy_learner_education_details;

ALTER TABLE main.zuvy_learner_education_details_reordered
RENAME TO zuvy_learner_education_details;

SELECT setval(
  pg_get_serial_sequence('main.zuvy_learner_education_details', 'id'),
  COALESCE((SELECT MAX(id) FROM main.zuvy_learner_education_details), 1),
  true
);

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_education_details_row_unique
ON main.zuvy_learner_education_details (college_name, degree_program, branch_name);

COMMIT;
