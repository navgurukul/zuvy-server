-- Add degreeId column to zuvy_learner_education_branch_details table
ALTER TABLE main.zuvy_learner_education_branch_details
ADD COLUMN IF NOT EXISTS degree_id integer;

-- Add foreign key constraint
ALTER TABLE main.zuvy_learner_education_branch_details
ADD CONSTRAINT zuvy_learner_education_branch_details_degree_id_fk
FOREIGN KEY (degree_id)
REFERENCES main.zuvy_learners_degree_details(id)
ON DELETE CASCADE;

-- Create index on degree_id for better query performance
CREATE INDEX IF NOT EXISTS zuvy_learner_education_branch_details_degree_id_idx
ON main.zuvy_learner_education_branch_details(degree_id);
