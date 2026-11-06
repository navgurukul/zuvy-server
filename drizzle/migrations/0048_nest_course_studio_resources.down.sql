-- Rolls back 0048_nest_course_studio_resources.sql. Safe to run more than once.
-- Module and Chapter go back to sitting directly under Course Studio. The
-- Curriculum resource is removed with its permissions and role assignments.

BEGIN;

DO $$
DECLARE
  grants_table text;
BEGIN
  IF EXISTS (SELECT 1 FROM "zuvy_resources" WHERE key = 'Curriculum') THEN
    -- Every table that can hold a Curriculum permission; not every database
    -- has all of them.
    FOREACH grants_table IN ARRAY ARRAY[
      'zuvy_permissions_roles', 'zuvy_role_permissions',
      'zuvy_user_permissions', 'zuvy_permissions_scope'
    ] LOOP
      IF to_regclass(grants_table) IS NOT NULL THEN
        EXECUTE format(
          'DELETE FROM %I WHERE permission_id IN (
             SELECT p.id FROM zuvy_permissions p
             JOIN zuvy_resources r ON r.id = p.resource_id
             WHERE r.key = %L)',
          grants_table, 'Curriculum'
        );
      END IF;
    END LOOP;

    -- Tracking/audit logs are not deleted: if any point at Curriculum the
    -- deletes below fail and the whole rollback is undone.
    DELETE FROM "zuvy_permissions"
    WHERE resource_id IN (SELECT id FROM "zuvy_resources" WHERE key = 'Curriculum');
    UPDATE "zuvy_resources" SET "parent_id" = NULL
    WHERE parent_id IN (SELECT id FROM "zuvy_resources" WHERE key = 'Curriculum');
    DELETE FROM "zuvy_resources" WHERE key = 'Curriculum';
  END IF;
END $$;

DROP INDEX IF EXISTS "zuvy_resources_parent_id_idx";
ALTER TABLE "zuvy_resources" DROP CONSTRAINT IF EXISTS "zuvy_resources_parent_not_self";
ALTER TABLE "zuvy_resources" DROP CONSTRAINT IF EXISTS "zuvy_resources_parent_id_fk";
ALTER TABLE "zuvy_resources" DROP COLUMN IF EXISTS "parent_id";

COMMIT;
