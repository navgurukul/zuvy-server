ALTER TABLE main.zuvy_learner_information
ADD COLUMN IF NOT EXISTS first_name varchar(100);

ALTER TABLE main.zuvy_learner_information
ADD COLUMN IF NOT EXISTS last_name varchar(100);

UPDATE main.zuvy_learner_information
SET
  first_name = COALESCE(first_name, NULLIF(split_part(full_name, ' ', 1), '')),
  last_name = COALESCE(last_name, NULLIF(trim(regexp_replace(full_name, '^\\S+\\s*', '')), ''))
WHERE first_name IS NULL OR last_name IS NULL;
