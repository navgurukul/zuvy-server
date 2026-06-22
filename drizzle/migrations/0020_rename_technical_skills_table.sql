DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'main'
		  AND table_name = 'zuvy_technical_skills'
	) THEN
		ALTER TABLE main.zuvy_technical_skills
		RENAME TO zuvy_learners_techinal_skills;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'main'
		  AND table_name = 'zuvy_learner_technical_skills'
	) THEN
		ALTER TABLE main.zuvy_learner_technical_skills
		RENAME TO zuvy_learners_techinal_skills;
	END IF;
END $$;

CREATE TABLE IF NOT EXISTS main.zuvy_learners_techinal_skills (
	id serial PRIMARY KEY,
	name varchar(100) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

DROP INDEX IF EXISTS main.zuvy_technical_skills_name_unique;
DROP INDEX IF EXISTS main.zuvy_learner_technical_skills_name_unique;

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learners_techinal_skills_name_unique
ON main.zuvy_learners_techinal_skills (name);
