-- ============================================
-- Course-scoped viewMentorship permission.
--
-- 1. Adds a nullable bootcamp_id to zuvy_permissions_roles so a role can be
--    granted a permission for one specific course. Existing rows keep
--    bootcamp_id = NULL and remain organization-level assignments.
-- 2. Replaces UNIQUE (role_id, permission_id) with two partial unique indexes:
--      - org-level rows   : UNIQUE (role_id, permission_id)            WHERE bootcamp_id IS NULL
--      - course-level rows: UNIQUE (role_id, permission_id, bootcamp_id) WHERE bootcamp_id IS NOT NULL
--    Every existing row has bootcamp_id = NULL, so existing uniqueness is unchanged.
-- 3. Adds the Mentorship resource and its 'view' permission (viewMentorship)
--    only if they do not already exist.
-- 4. Grants viewMentorship at organization level to every org 'admin' role
--    (the same default every new org's admin role gets in createDefaultRoles).
--    super_admin needs no row: it is bypassed in code.
--
-- No existing rows are deleted or updated. Safe to run more than once.
-- ============================================

BEGIN;

-- 1. Course scope column
ALTER TABLE main.zuvy_permissions_roles
  ADD COLUMN IF NOT EXISTS bootcamp_id INTEGER
    REFERENCES main.zuvy_bootcamps(id) ON DELETE CASCADE;

-- 2. Uniqueness: org-level (NULL course) and course-level assignments
ALTER TABLE main.zuvy_permissions_roles
  DROP CONSTRAINT IF EXISTS uniq_role_permission;
DROP INDEX IF EXISTS main.uniq_role_permission;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_role_permission
  ON main.zuvy_permissions_roles (role_id, permission_id)
  WHERE bootcamp_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_role_permission_bootcamp
  ON main.zuvy_permissions_roles (role_id, permission_id, bootcamp_id)
  WHERE bootcamp_id IS NOT NULL;

-- 3. Mentorship resource + view permission (no duplicates)
INSERT INTO main.zuvy_resources (key, display_name, description)
VALUES ('Mentorship', 'Mentorship', 'Course mentorship sessions')
ON CONFLICT (key) DO NOTHING;

INSERT INTO main.zuvy_permissions (name, resource_id, description)
SELECT 'view', r.id, 'View mentorship sessions of a course'
FROM main.zuvy_resources r
WHERE r.key = 'Mentorship'
  AND NOT EXISTS (
    SELECT 1 FROM main.zuvy_permissions p
    WHERE p.resource_id = r.id AND p.name = 'view'
  );

-- 4. Default org-level grant for existing org admin roles
INSERT INTO main.zuvy_permissions_roles (permission_id, role_id, org_id)
SELECT p.id, ur.id, ur.org_id
FROM main.zuvy_user_roles ur
CROSS JOIN main.zuvy_permissions p
JOIN main.zuvy_resources r ON r.id = p.resource_id
WHERE ur.name = 'admin'
  AND ur.org_id IS NOT NULL
  AND r.key = 'Mentorship'
  AND p.name = 'view'
ON CONFLICT DO NOTHING;

COMMIT;
