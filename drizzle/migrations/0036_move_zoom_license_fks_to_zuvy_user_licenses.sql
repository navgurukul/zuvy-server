-- ============================================================
-- Migration: Create/Alter zuvy_user_licenses + Move FK
-- references from main.licenses to main.zuvy_user_licenses
-- ============================================================

-- Step 1: Create zuvy_user_licenses table if it doesn't exist
CREATE TABLE IF NOT EXISTS main.zuvy_user_licenses (
    id SERIAL PRIMARY KEY,
    zoom_email VARCHAR(255) NOT NULL,
    zoom_user_id VARCHAR(128),
    user_name VARCHAR(255),
    license_type INTEGER NOT NULL DEFAULT 2, -- schema default is 2, not 1
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    is_protected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 2: Add missing columns if table already exists but columns are absent
ALTER TABLE main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS zoom_user_id VARCHAR(128);

ALTER TABLE main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS user_name VARCHAR(255);

ALTER TABLE main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS license_type INTEGER NOT NULL DEFAULT 2;

ALTER TABLE main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'active';

ALTER TABLE main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS is_protected BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

ALTER TABLE main.zuvy_user_licenses
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

-- Step 3: Add unique index on zoom_email (matches Drizzle schema:
-- uniqueIndex('zoom_user_licenses_email_pool_key').on(table.zoomEmail))
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'main'
      AND tablename  = 'zuvy_user_licenses'
      AND indexname  = 'zoom_user_licenses_email_pool_key'
  ) THEN
    CREATE UNIQUE INDEX zoom_user_licenses_email_pool_key
      ON main.zuvy_user_licenses (zoom_email);
  END IF;
END $$;

-- Step 4: Drop existing FK constraints on license_id from zuvy_sessions
-- and license_assignments (pointing to old main.licenses table)
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

-- Step 5: Backfill zuvy_user_licenses from main.licenses
-- for any rows referenced by existing sessions or assignments
INSERT INTO
    main.zuvy_user_licenses (
        zoom_email,
        zoom_user_id,
        user_name,
        license_type,
        status,
        is_protected,
        created_at,
        updated_at
    )
SELECT DISTINCT
    lower(l.zoom_id),
    NULL,
    l.name,
    CASE
        WHEN l.status = 'active' THEN 2
        ELSE 1
    END,
    l.status,
    false,
    NOW(),
    NOW()
FROM main.licenses l
WHERE (
        EXISTS (
            SELECT 1
            FROM main.zuvy_sessions zs
            WHERE
                zs.license_id = l.id
        )
        OR EXISTS (
            SELECT 1
            FROM main.license_assignments la
            WHERE
                la.license_id = l.id
        )
    )
ON CONFLICT (zoom_email) DO NOTHING;

-- Step 6: Rewrite license_id values to point to zuvy_user_licenses.id
UPDATE main.zuvy_sessions zs
SET
    license_id = zul.id
FROM main.licenses l
    JOIN main.zuvy_user_licenses zul ON lower(l.zoom_id) = lower(zul.zoom_email)
WHERE
    zs.license_id = l.id;

UPDATE main.license_assignments la
SET
    license_id = zul.id
FROM main.licenses l
    JOIN main.zuvy_user_licenses zul ON lower(l.zoom_id) = lower(zul.zoom_email)
WHERE
    la.license_id = l.id;

-- Step 7: Add new FK constraints pointing to zuvy_user_licenses
ALTER TABLE main.zuvy_sessions
ADD CONSTRAINT zuvy_sessions_license_id_zuvy_user_licenses_id_fk FOREIGN KEY (license_id) REFERENCES main.zuvy_user_licenses (id);

ALTER TABLE main.license_assignments
ADD CONSTRAINT license_assignments_license_id_zuvy_user_licenses_id_fk FOREIGN KEY (license_id) REFERENCES main.zuvy_user_licenses (id);