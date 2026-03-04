ALTER TABLE IF EXISTS main.zuvy_learner_education_details
ADD COLUMN IF NOT EXISTS college_name varchar(255),
ADD COLUMN IF NOT EXISTS degree_program varchar(100),
ADD COLUMN IF NOT EXISTS branch_name varchar(100);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_education_details'
      AND column_name = 'category'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'main'
      AND table_name = 'zuvy_learner_education_details'
      AND column_name = 'name'
  ) THEN
    UPDATE main.zuvy_learner_education_details
    SET college_name = name
    WHERE category = 'college' AND college_name IS NULL;

    UPDATE main.zuvy_learner_education_details
    SET degree_program = name
    WHERE category = 'programType' AND degree_program IS NULL;

    UPDATE main.zuvy_learner_education_details
    SET branch_name = name
    WHERE category = 'branch' AND branch_name IS NULL;
  END IF;
END $$;

ALTER TABLE IF EXISTS main.zuvy_learner_education_details
DROP COLUMN IF EXISTS category,
DROP COLUMN IF EXISTS name;

DROP INDEX IF EXISTS main.zuvy_learner_education_details_category_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_college_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_degree_program_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_branch_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_education_details_row_unique;

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_education_details_row_unique
ON main.zuvy_learner_education_details (college_name, degree_program, branch_name);
