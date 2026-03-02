CREATE TABLE IF NOT EXISTS main.zuvy_learner_personal_details (
  id serial PRIMARY KEY,
  user_id bigint NOT NULL REFERENCES main.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  full_name varchar(255) NOT NULL,
  phone_number varchar(20) NOT NULL,
  email varchar(255) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS zuvy_learner_personal_details_user_id_unique
  ON main.zuvy_learner_personal_details(user_id);
