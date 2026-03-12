CREATE TABLE IF NOT EXISTS main.zuvy_learnes_roles (
	id serial PRIMARY KEY,
	name varchar(100) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learnes_roles
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learnes_roles
WHERE name IS NULL OR name = '';

WITH ranked AS (
	SELECT
		id,
		ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
	FROM main.zuvy_learnes_roles
)
DELETE FROM main.zuvy_learnes_roles current_row
USING ranked
WHERE current_row.id = ranked.id
	AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learnes_roles_name_unique;
CREATE UNIQUE INDEX zuvy_learnes_roles_name_unique
ON main.zuvy_learnes_roles (name);

INSERT INTO main.zuvy_learnes_roles (name)
VALUES
	('Software Development Engineer (SDE)'),
	('Full Stack Developer'),
	('Frontend Developer'),
	('Backend Developer'),
	('Data Analyst'),
	('Data Scientist'),
	('DevOps Engineer'),
	('Cloud Engineer'),
	('Mobile Developer'),
	('UI/UX Designer'),
	('QA Engineer'),
	('Product Manager'),
	('Solutions Architect'),
	('Security Engineer'),
	('Machine Learning Engineer')
ON CONFLICT (name) DO NOTHING;
