-- Nested resources inside a parent group, for the Course Studio tree:
--   Course Studio
--   ├── Bootcamp
--   ├── Curriculum
--   │   └── Module
--   │       └── Chapter
--   ├── Student
--   ├── Batch
--   ├── Submission
--   └── Setting
--
--   zuvy_resources.parent_id   the resource this one sits under inside its
--                              group (Module -> Curriculum, Chapter -> Module);
--                              null for a resource directly under its group.
--                              parent_resource_id still says which group.
-- Adds the Curriculum resource with view/edit/create/delete. Module and
-- Chapter keep their IDs, permissions and role assignments.
-- Run after 0047_add_parent_resources.sql (and again if 0047 is re-run, since
-- 0047 does not know Curriculum). Safe to run more than once.
-- Rollback: 0048_nest_course_studio_resources.down.sql.

BEGIN;

-- 1. Resource-to-resource link.
ALTER TABLE "zuvy_resources" ADD COLUMN IF NOT EXISTS "parent_id" integer;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zuvy_resources_parent_id_fk'
  ) THEN
    ALTER TABLE "zuvy_resources"
      ADD CONSTRAINT "zuvy_resources_parent_id_fk"
      FOREIGN KEY ("parent_id") REFERENCES "zuvy_resources"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'zuvy_resources_parent_not_self'
  ) THEN
    ALTER TABLE "zuvy_resources"
      ADD CONSTRAINT "zuvy_resources_parent_not_self" CHECK ("parent_id" <> "id");
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "zuvy_resources_parent_id_idx"
  ON "zuvy_resources" ("parent_id");

-- 2. Curriculum, in the Course Studio group, with the same four permissions
-- as the other resources.
INSERT INTO "zuvy_resources" ("key", "display_name", "description", "parent_resource_id")
SELECT 'Curriculum', 'Curriculum', 'Manages curriculum-related operations', group_row.parent_resource_id
FROM "zuvy_resources" group_row
WHERE group_row.key = 'CourseParent' AND group_row.is_parent
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "zuvy_permissions" ("name", "resource_id", "description")
SELECT v.name, r.id, v.verb || ' Curriculum'
FROM "zuvy_resources" r
CROSS JOIN (VALUES
  ('create', 'Create'),
  ('view', 'View'),
  ('edit', 'Edit'),
  ('delete', 'Delete')
) AS v(name, verb)
WHERE r.key = 'Curriculum'
  AND NOT EXISTS (
    SELECT 1 FROM "zuvy_permissions" p
    WHERE p.resource_id = r.id AND p.name = v.name
  );

-- 3. Nesting. The mapping is child key -> parent key, matched on "key" (unique,
-- never shown). Listed resources are nested under their parent and put in
-- the parent's group; every other resource sits directly under its group.
DO $$
DECLARE
  nesting jsonb := '{
    "Curriculum": "CourseParent",
    "Module":     "Curriculum",
    "Chapter":    "Module"
  }';
  missing text;
BEGIN
  -- Curriculum sits directly under the Course Studio group.
  UPDATE "zuvy_resources" r
  SET "parent_resource_id" = group_row.parent_resource_id, "updated_at" = now()
  FROM "zuvy_resources" group_row
  WHERE r.key = 'Curriculum'
    AND group_row.key = 'CourseParent' AND group_row.is_parent
    AND r.parent_resource_id IS DISTINCT FROM group_row.parent_resource_id;

  -- parent_id: a resource parent for Module and Chapter, none for the rest.
  -- Group rows (is_parent) are never a parent_id, so Curriculum gets none.
  UPDATE "zuvy_resources" child
  SET "parent_id" = target.parent_id, "updated_at" = now()
  FROM (
    SELECT r.id, parent.id AS parent_id
    FROM "zuvy_resources" r
    LEFT JOIN jsonb_each_text(nesting) m(child_key, parent_key) ON m.child_key = r.key
    LEFT JOIN "zuvy_resources" parent ON parent.key = m.parent_key AND NOT parent.is_parent
    WHERE NOT r.is_parent
  ) target
  WHERE child.id = target.id
    AND child.parent_id IS DISTINCT FROM target.parent_id;

  -- A nested resource is in its parent's group (Module and Chapter: Course Studio).
  UPDATE "zuvy_resources" child
  SET "parent_resource_id" = parent.parent_resource_id, "updated_at" = now()
  FROM "zuvy_resources" parent
  WHERE child.parent_id = parent.id
    AND child.parent_resource_id IS DISTINCT FROM parent.parent_resource_id;

  -- Report anything listed that this database does not have.
  SELECT string_agg(m.child_key, ', ') INTO missing
  FROM jsonb_each_text(nesting) m(child_key, parent_key)
  LEFT JOIN "zuvy_resources" child ON child.key = m.child_key
  WHERE child.id IS NULL;
  IF missing IS NOT NULL THEN
    RAISE WARNING 'Nested resources: missing: %', missing;
  END IF;
END $$;

COMMIT;
