-- Move Zoom session/license assignment foreign keys from the legacy
-- main.licenses table to main.zuvy_user_licenses.
--
-- The column name stays license_id for API/code compatibility, but after this
-- migration the stored value is main.zuvy_user_licenses.id.

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'main'
      AND rel.relname = 'zuvy_sessions'
      AND con.contype = 'f'
      AND con.conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = rel.oid
            AND attname = 'license_id'
        )
      ]::smallint[]
  LOOP
    EXECUTE format(
      'ALTER TABLE main.zuvy_sessions DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;

  FOR constraint_name IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'main'
      AND rel.relname = 'license_assignments'
      AND con.contype = 'f'
      AND con.conkey = ARRAY[
        (
          SELECT attnum
          FROM pg_attribute
          WHERE attrelid = rel.oid
            AND attname = 'license_id'
        )
      ]::smallint[]
  LOOP
    EXECUTE format(
      'ALTER TABLE main.license_assignments DROP CONSTRAINT IF EXISTS %I',
      constraint_name
    );
  END LOOP;
END $$;

-- Preserve any old referenced license rows that do not yet exist in the new
-- mirror table. This protects existing sessions/assignments during backfill.
INSERT INTO main.zuvy_user_licenses (
  zoom_email,
  user_name,
  license_type,
  status,
  is_protected,
  created_at,
  updated_at
)
SELECT DISTINCT
  lower(l.zoom_id),
  l.name,
  CASE WHEN l.status = 'active' THEN 2 ELSE 1 END,
  l.status,
  false,
  NOW(),
  NOW()
FROM main.licenses l
WHERE EXISTS (
  SELECT 1
  FROM main.zuvy_sessions zs
  WHERE zs.license_id = l.id
)
OR EXISTS (
  SELECT 1
  FROM main.license_assignments la
  WHERE la.license_id = l.id
)
ON CONFLICT (zoom_email) DO NOTHING;

-- Rewrite existing old license ids to their matching zuvy_user_licenses ids.
UPDATE main.zuvy_sessions zs
SET license_id = zul.id
FROM main.licenses l
JOIN main.zuvy_user_licenses zul
  ON lower(l.zoom_id) = lower(zul.zoom_email)
WHERE zs.license_id = l.id;

UPDATE main.license_assignments la
SET license_id = zul.id
FROM main.licenses l
JOIN main.zuvy_user_licenses zul
  ON lower(l.zoom_id) = lower(zul.zoom_email)
WHERE la.license_id = l.id;

ALTER TABLE main.zuvy_sessions
ADD CONSTRAINT zuvy_sessions_license_id_zuvy_user_licenses_id_fk
FOREIGN KEY (license_id)
REFERENCES main.zuvy_user_licenses(id);

ALTER TABLE main.license_assignments
ADD CONSTRAINT license_assignments_license_id_zuvy_user_licenses_id_fk
FOREIGN KEY (license_id)
REFERENCES main.zuvy_user_licenses(id);



-- REVERT -----

-- Revert: Move foreign keys back from zuvy_user_licenses to licenses

-- Step 1: Drop the new foreign key constraints
ALTER TABLE main.zuvy_sessions
DROP CONSTRAINT IF EXISTS zuvy_sessions_license_id_zuvy_user_licenses_id_fk;

ALTER TABLE main.license_assignments
DROP CONSTRAINT IF EXISTS license_assignments_license_id_zuvy_user_licenses_id_fk;

-- Step 2: Rewrite license_ids back to old licenses table ids
UPDATE main.zuvy_sessions zs
SET
    license_id = l.id
FROM main.licenses l
    JOIN main.zuvy_user_licenses zul ON lower(l.zoom_id) = lower(zul.zoom_email)
WHERE
    zs.license_id = zul.id;

UPDATE main.license_assignments la
SET
    license_id = l.id
FROM main.licenses l
    JOIN main.zuvy_user_licenses zul ON lower(l.zoom_id) = lower(zul.zoom_email)
WHERE
    la.license_id = zul.id;

-- Step 3: Restore original foreign key constraints back to licenses table
ALTER TABLE main.zuvy_sessions
ADD CONSTRAINT zuvy_sessions_license_id_licenses_id_fk FOREIGN KEY (license_id) REFERENCES main.licenses (id);

ALTER TABLE main.license_assignments
ADD CONSTRAINT license_assignments_license_id_licenses_id_fk FOREIGN KEY (license_id) REFERENCES main.licenses (id);