CREATE TABLE IF NOT EXISTS main.zuvy_learners_remote_location (
	id serial PRIMARY KEY,
	name varchar(100) NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now(),
	updated_at timestamptz NOT NULL DEFAULT now()
);

UPDATE main.zuvy_learners_remote_location
SET name = TRIM(name)
WHERE name IS NOT NULL;

DELETE FROM main.zuvy_learners_remote_location
WHERE name IS NULL OR name = '';

WITH ranked AS (
	SELECT
		id,
		ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) AS row_num
	FROM main.zuvy_learners_remote_location
)
DELETE FROM main.zuvy_learners_remote_location current_row
USING ranked
WHERE current_row.id = ranked.id
	AND ranked.row_num > 1;

DROP INDEX IF EXISTS main.zuvy_learners_remote_location_name_unique;
CREATE UNIQUE INDEX zuvy_learners_remote_location_name_unique
ON main.zuvy_learners_remote_location (name);

INSERT INTO main.zuvy_learners_remote_location (name)
VALUES
	('Open to Remote'),
	('Bangalore'),
	('Delhi/NCR'),
	('Hyderabad'),
	('Mumbai'),
	('Pune'),
	('Chennai'),
	('Kolkata'),
	('Ahmedabad'),
	('Jaipur'),
	('Indore'),
	('Lucknow'),
	('Chandigarh'),
	('Coimbatore'),
	('Kochi'),
	('Surat')
ON CONFLICT (name) DO NOTHING;
