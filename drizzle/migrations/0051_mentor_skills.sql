-- One fixed list of mentor skills, so the student's skill chips and the
-- mentor-list filter always agree ("React" and "React.js" are one skill).
--
--   zuvy_skills         The list. `aliases` are other spellings that mean
--                       the same skill; case, spaces, dots and a trailing
--                       ".js" are ignored when matching, so only real
--                       variants need listing ("K8s" for Kubernetes).
--                       `is_active = false` hides a skill from the chips and
--                       the filter without deleting it.
--   zuvy_mentor_skills  Which skills each mentor has. Written when a mentor
--                       saves their profile; for existing mentors, by
--                       scripts/map-mentor-skills.ts (dry run first).
--
-- zuvy_mentor_profile.expertise (free text) stays and is still written, so
-- screens that read it keep working.
--
-- The starting list below is approved for now (plan, 17 Nov 2026); Ops can
-- edit it. Seeding never overwrites a skill that already exists.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS "zuvy_skills" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(100) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "aliases" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zuvy_skills_slug_unique" UNIQUE ("slug")
);

CREATE TABLE IF NOT EXISTS "zuvy_mentor_skills" (
  "mentor_user_id" bigint NOT NULL
    REFERENCES "users" ("id") ON DELETE CASCADE,
  "skill_id" integer NOT NULL
    REFERENCES "zuvy_skills" ("id") ON DELETE CASCADE,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "zuvy_mentor_skills_pk" PRIMARY KEY ("mentor_user_id", "skill_id")
);

-- The filter looks mentors up by skill.
CREATE INDEX IF NOT EXISTS "zuvy_mentor_skills_skill_idx"
  ON "zuvy_mentor_skills" ("skill_id");

INSERT INTO "zuvy_skills" ("name", "slug", "aliases") VALUES
  ('Frontend Development', 'frontend-development', '["Frontend", "Front-end Development", "Frontend Engineering", "Front End"]'),
  ('Backend Engineering', 'backend-engineering', '["Backend", "Backend Development", "Back-end Development"]'),
  ('Backend Architecture', 'backend-architecture', '[]'),
  ('Full Stack Development', 'full-stack-development', '["Full Stack", "Fullstack", "Full-stack Development"]'),
  ('System Design', 'system-design', '[]'),
  ('Data Structures & Algorithms', 'data-structures-and-algorithms', '["DSA", "Data Structures and Algorithms", "Algorithms"]'),
  ('JavaScript', 'javascript', '["JS"]'),
  ('TypeScript', 'typescript', '["TS"]'),
  ('React', 'react', '["React.js", "ReactJS"]'),
  ('React Native', 'react-native', '[]'),
  ('Next.js', 'next-js', '["NextJS"]'),
  ('Node.js', 'node-js', '["NodeJS", "Node"]'),
  ('NestJS', 'nestjs', '["Nest.js", "Nest"]'),
  ('Express.js', 'express-js', '["Express", "ExpressJS"]'),
  ('REST APIs', 'rest-apis', '["REST", "REST API", "RESTful APIs"]'),
  ('HTML & CSS', 'html-and-css', '["HTML", "CSS", "HTML and CSS"]'),
  ('CSS Architecture', 'css-architecture', '[]'),
  ('Web Accessibility', 'web-accessibility', '["Accessibility", "a11y"]'),
  ('Python', 'python', '[]'),
  ('Django', 'django', '[]'),
  ('Java', 'java', '[]'),
  ('Kotlin', 'kotlin', '[]'),
  ('Jetpack Compose', 'jetpack-compose', '[]'),
  ('Android Development', 'android-development', '["Android"]'),
  ('Swift', 'swift', '[]'),
  ('SwiftUI', 'swiftui', '[]'),
  ('iOS Development', 'ios-development', '["iOS"]'),
  ('Core Data', 'core-data', '["CoreData"]'),
  ('Flutter', 'flutter', '[]'),
  ('Firebase', 'firebase', '[]'),
  ('Offline-First Architecture', 'offline-first-architecture', '[]'),
  ('App Store Optimization', 'app-store-optimization', '["ASO"]'),
  ('SQL', 'sql', '[]'),
  ('PostgreSQL', 'postgresql', '["Postgres"]'),
  ('MongoDB', 'mongodb', '["Mongo"]'),
  ('BigQuery', 'bigquery', '[]'),
  ('Data Science', 'data-science', '[]'),
  ('Analytics', 'analytics', '["Data Analytics"]'),
  ('Machine Learning', 'machine-learning', '["ML"]'),
  ('MLOps', 'mlops', '[]'),
  ('Feature Engineering', 'feature-engineering', '[]'),
  ('PyTorch', 'pytorch', '[]'),
  ('Apache Spark', 'apache-spark', '["Spark"]'),
  ('Airflow', 'airflow', '["Apache Airflow"]'),
  ('dbt', 'dbt', '[]'),
  ('DevOps', 'devops', '["DevOps Basics"]'),
  ('Docker', 'docker', '[]'),
  ('Kubernetes', 'kubernetes', '["K8s"]'),
  ('Terraform', 'terraform', '[]'),
  ('CI/CD', 'ci-cd', '[]'),
  ('AWS', 'aws', '["Amazon Web Services"]'),
  ('Linux', 'linux', '[]'),
  ('Prometheus', 'prometheus', '[]'),
  ('Grafana', 'grafana', '[]'),
  ('Incident Management', 'incident-management', '[]'),
  ('Cloud Security', 'cloud-security', '[]'),
  ('IAM', 'iam', '[]'),
  ('OWASP', 'owasp', '[]'),
  ('Penetration Testing', 'penetration-testing', '["Pentesting", "Pen Testing"]'),
  ('UI/UX Design', 'ui-ux-design', '["UI/UX", "UX Design", "UI Design"]'),
  ('Product Management', 'product-management', '[]'),
  ('Interview Prep', 'interview-prep', '["Interview Preparation"]'),
  ('Career Coaching', 'career-coaching', '["Career Guidance"]'),
  ('Git', 'git', '[]')
ON CONFLICT ("slug") DO NOTHING;
