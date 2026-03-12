CREATE TABLE IF NOT EXISTS main.zuvy_learner_education_branch_details (
  id serial PRIMARY KEY,
  name varchar(100) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learner_education_branch_details
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learner_education_branch_details
WHERE name IS NULL OR name = '';

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
  FROM main.zuvy_learner_education_branch_details
)
DELETE FROM main.zuvy_learner_education_branch_details current_row
USING ranked
WHERE current_row.id = ranked.id
  AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learner_education_branch_details_name_unique;
CREATE UNIQUE INDEX zuvy_learner_education_branch_details_name_unique
ON main.zuvy_learner_education_branch_details (name);

INSERT INTO main.zuvy_learner_education_branch_details (name)
VALUES
  ('Computer Science'),
  ('Electronics')
ON CONFLICT (name) DO NOTHING;
