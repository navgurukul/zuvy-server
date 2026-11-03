-- Rolls back 0047_add_parent_resources.sql. Safe to run more than once.
-- Child resources, their permissions and their role assignments are kept.
-- Parent-level role assignments are deleted with the parent permissions.

BEGIN;

DO $$
DECLARE
  grants_table text;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zuvy_resources' AND column_name = 'is_parent'
      AND table_schema = ANY (current_schemas(false))
  ) THEN
    CREATE TEMP TABLE parent_resource_ids ON COMMIT DROP AS
      SELECT id FROM "zuvy_resources" WHERE is_parent;
    CREATE TEMP TABLE parent_permission_ids ON COMMIT DROP AS
      SELECT p.id FROM "zuvy_permissions" p
      WHERE p.resource_id IN (SELECT id FROM parent_resource_ids);

    -- Every table that can hold a parent permission; not every database has
    -- all of them.
    FOREACH grants_table IN ARRAY ARRAY[
      'zuvy_permissions_roles', 'zuvy_role_permissions',
      'zuvy_user_permissions', 'zuvy_permissions_scope'
    ] LOOP
      IF to_regclass(grants_table) IS NOT NULL THEN
        EXECUTE format(
          'DELETE FROM %I WHERE permission_id IN (SELECT id FROM parent_permission_ids)',
          grants_table
        );
      END IF;
    END LOOP;

    -- Tracking/audit logs are not deleted: if any point at a parent's
    -- resource row the deletes below fail and the whole rollback is undone.
    DELETE FROM "zuvy_permissions"
    WHERE id IN (SELECT id FROM parent_permission_ids);
    DELETE FROM "zuvy_resources"
    WHERE id IN (SELECT id FROM parent_resource_ids);
  END IF;
END $$;

DROP INDEX IF EXISTS "zuvy_resources_parent_row_unique";
DROP INDEX IF EXISTS "zuvy_resources_parent_resource_id_idx";
ALTER TABLE "zuvy_resources" DROP CONSTRAINT IF EXISTS "zuvy_resources_parent_resource_id_fk";
ALTER TABLE "zuvy_resources" DROP COLUMN IF EXISTS "is_parent";
ALTER TABLE "zuvy_resources" DROP COLUMN IF EXISTS "parent_resource_id";
DROP TABLE IF EXISTS "zuvy_parent_resources";

COMMIT;
