DROP INDEX IF EXISTS main.zuvy_learner_information_email_unique;

ALTER TABLE main.zuvy_learner_information
ALTER COLUMN full_name DROP NOT NULL,
ALTER COLUMN email DROP NOT NULL,
ALTER COLUMN phone_number DROP NOT NULL,
ALTER COLUMN college_name DROP NOT NULL,
ALTER COLUMN branch_specialisation DROP NOT NULL,
ALTER COLUMN year_of_study DROP NOT NULL,
ALTER COLUMN expected_graduation_month DROP NOT NULL,
ALTER COLUMN expected_graduation_year DROP NOT NULL,
ALTER COLUMN current_status DROP NOT NULL;