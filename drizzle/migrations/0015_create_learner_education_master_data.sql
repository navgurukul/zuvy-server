CREATE TABLE IF NOT EXISTS main.zuvy_learner_education_details (
	id serial PRIMARY KEY,
	college_name varchar(255),
	degree_program varchar(100),
	branch_name varchar(100),
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_education_details_row_unique
ON main.zuvy_learner_education_details (college_name, degree_program, branch_name);
