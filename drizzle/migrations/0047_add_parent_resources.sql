-- Parent resources for Role Management (Course, Question Bank, Roles &
-- Permissions).
--   zuvy_parent_resources               the parent groups (id, name).
--   zuvy_resources.parent_resource_id   the parent a resource belongs to; the
--                                       only link between the two tables
--                                       (one parent, many resources).
--   zuvy_resources.is_parent            marks the one resource row each parent
--                                       has for its own permissions. Role
--                                       permissions always belong to a
--                                       zuvy_resources row, so this row's ID is
--                                       the parent's ID for the existing
--                                       permission endpoints.
-- Child resources keep their IDs, permissions and role assignments.
-- Run after 0046_ct_session_ids.sql. Safe to run more than once.
-- Rollback: 0047_add_parent_resources.down.sql.

-- 1. Parent table and records.
CREATE TABLE IF NOT EXISTS "zuvy_parent_resources" (
  "id" serial PRIMARY KEY NOT NULL,
  "name" varchar(255) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  CONSTRAINT "zuvy_parent_resources_name_unique" UNIQUE ("name")
);

INSERT INTO "zuvy_parent_resources" ("name")
VALUES ('Course'), ('Question Bank'), ('Roles & Permissions')
ON CONFLICT ("name") DO NOTHING;

-- 2. Link from zuvy_resources to its parent.
ALTER TABLE "zuvy_resources" ADD COLUMN IF NOT EXISTS "parent_resource_id" integer;
ALTER TABLE "zuvy_resources" ADD COLUMN IF NOT EXISTS "is_parent" boolean DEFAULT false NOT NULL;
-- done this need to run the from 34 
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zuvy_resources_parent_resource_id_fk'
  ) THEN
    ALTER TABLE "zuvy_resources"
      ADD CONSTRAINT "zuvy_resources_parent_resource_id_fk"
      FOREIGN KEY ("parent_resource_id") REFERENCES "zuvy_parent_resources"("id")
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "zuvy_resources_parent_resource_id_idx"
  ON "zuvy_resources" ("parent_resource_id");
-- At most one permission row per parent.
CREATE UNIQUE INDEX IF NOT EXISTS "zuvy_resources_parent_row_unique"
  ON "zuvy_resources" ("parent_resource_id") WHERE "is_parent";

-- 3. Each parent's own resource row. "key" is unique and some child keys
-- (e.g. Course) are taken, so these are keyed <Name>Parent. Their effective
-- permission names (viewCourseParent, ...) therefore never match a child's
-- (viewCourse, ...), so a parent grant never passes a child permission check.
INSERT INTO "zuvy_resources" ("key", "display_name", "description", "parent_resource_id", "is_parent")
SELECT v.resource_key, pr.name, 'Parent-level permissions for ' || pr.name, pr.id, true
FROM (VALUES
  ('Course Studio', 'CourseParent'),
  ('Question Bank', 'QuestionBankParent'),
  ('Roles & Permissions', 'RolesAndPermissionParent')
) AS v(parent_name, resource_key)
JOIN "zuvy_parent_resources" pr ON pr.name = v.parent_name
ON CONFLICT ("key") DO UPDATE
  SET "parent_resource_id" = EXCLUDED.parent_resource_id, "is_parent" = true;

-- 4. Parent permissions, the same four as child resources. zuvy_permissions
-- has no unique (resource_id, name), so skip any that already exist.
INSERT INTO "zuvy_permissions" ("name", "resource_id", "description")
SELECT v.name, r.id, v.verb || ' ' || r.display_name
FROM "zuvy_resources" r
CROSS JOIN (VALUES
  ('view', 'View'),
  ('edit', 'Edit'),
  ('create', 'Create'),
  ('delete', 'Delete')
) AS v(name, verb)
WHERE r.is_parent
  AND NOT EXISTS (
    SELECT 1 FROM "zuvy_permissions" p
    WHERE p.resource_id = r.id AND p.name = v.name
  );

-- 5. Children. Only resources with no parent yet are moved, so a later manual
-- regrouping is not undone by a re-run. Organization and Mentor Dashboard
-- stay top level.
UPDATE "zuvy_resources" child
SET "parent_resource_id" = pr.id, "updated_at" = now()
FROM (VALUES
  ('Course', 'Course'),
  ('Course', 'Bootcamp'),
  ('Course', 'Batch'),
  ('Course', 'Module'),
  ('Course', 'Chapter'),
  ('Course', 'Topic'),
  ('Course', 'Class'),
  ('Course', 'Student'),
  ('Course', 'Submission'),
  ('Course', 'Setting'),
  ('Question Bank', 'Question'),
  ('Question Bank', 'Mcq'),
  ('Question Bank', 'CodingQuestion'),
  ('Question Bank', 'OpendEnded'),
  ('Roles & Permissions', 'RolesAndPermission'),
  ('Roles & Permissions', 'User')
) AS grouping(parent_name, child_key)
JOIN "zuvy_parent_resources" pr ON pr.name = grouping.parent_name
WHERE child.key = grouping.child_key
  AND child.parent_resource_id IS NULL
  AND NOT child.is_parent;
