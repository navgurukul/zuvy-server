DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_year_of_study') THEN
		CREATE TYPE learner_year_of_study AS ENUM ('1st', '2nd', '3rd', '4th');
	END IF;
END $$;

DO $$
BEGIN
	IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'learner_current_status') THEN
		CREATE TYPE learner_current_status AS ENUM ('Learning', 'Looking for Job', 'Working');
	END IF;
END $$;

CREATE TABLE IF NOT EXISTS main.zuvy_learner_information (
	id serial PRIMARY KEY,
	user_id bigint NOT NULL REFERENCES main.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
	full_name varchar(255) NOT NULL,
	email varchar(255) NOT NULL,
	phone_number varchar(20) NOT NULL,
	college_name varchar(255) NOT NULL,
	other_college_name varchar(100),
	degree_program varchar(100),
	branch_specialisation varchar(100) NOT NULL,
	year_of_study learner_year_of_study NOT NULL,
	expected_graduation_month integer NOT NULL,
	expected_graduation_year integer NOT NULL,
	current_status learner_current_status NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_information_user_id_unique
	ON main.zuvy_learner_information(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_information_email_unique
	ON main.zuvy_learner_information(email);
