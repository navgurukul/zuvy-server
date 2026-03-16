CREATE TABLE IF NOT EXISTS main.zuvy_learners_techinal_skills (
	id serial PRIMARY KEY,
	name varchar(100) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learners_techinal_skills_name_unique
ON main.zuvy_learners_techinal_skills (name);

INSERT INTO main.zuvy_learners_techinal_skills (name)
VALUES
	('React'),
	('JavaScript'),
	('TypeScript'),
	('Python'),
	('Java'),
	('C++'),
	('SQL'),
	('HTML5'),
	('CSS3')
ON CONFLICT (name) DO NOTHING;
