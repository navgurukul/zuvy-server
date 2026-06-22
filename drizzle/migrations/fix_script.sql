-- =========================================================
-- FIX SCRIPT FOR STAGE_TEMPLATE (SAFE)
-- =========================================================
SELECT current_database();
SELECT current_schema();
SHOW search_path;

SET search_path TO stage_template;

-- =========================================================
-- 1. CLEAN DUPLICATE / WRONG FOREIGN KEYS
-- =========================================================

-- MENTOR SLOT BOOKING
ALTER TABLE zuvy_mentor_slot_booking
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_slot_availability_id_fkey,
DROP CONSTRAINT IF EXISTS fk_booking_slot,
DROP CONSTRAINT IF EXISTS fk_booking_student,
DROP CONSTRAINT IF EXISTS fk_booking_mentor,
DROP CONSTRAINT IF EXISTS fk_booking_org;

-- STUDENT METRICS
ALTER TABLE zuvy_student_booking_metrics
DROP CONSTRAINT IF EXISTS zuvy_student_booking_metrics_user_id_users_id_fk,
DROP CONSTRAINT IF EXISTS zuvy_student_booking_metrics_user_id_fkey;

-- COURSE MODULES
ALTER TABLE zuvy_course_modules
DROP CONSTRAINT IF EXISTS zuvy_course_modules_bootcamp_id_zuvy_bootcamps_id_fk,
DROP CONSTRAINT IF EXISTS zuvy_course_modules_project_id_zuvy_course_projects_id_fk;

-- BOOTCAMP TYPE
ALTER TABLE zuvy_bootcamp_type
DROP CONSTRAINT IF EXISTS zuvy_bootcamp_type_bootcamp_id_zuvy_bootcamps_id_fk;

-- =========================================================
-- 2. RECREATE CLEAN FOREIGN KEYS (ONLY stage_template)
-- =========================================================

-- MENTOR SLOT BOOKING
ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_slot
FOREIGN KEY (slot_availability_id)
REFERENCES stage_template.zuvy_mentor_slot_availability(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_student
FOREIGN KEY (student_user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_mentor
FOREIGN KEY (mentor_user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_org
FOREIGN KEY (organization_id)
REFERENCES stage_template.zuvy_organizations(id)
ON DELETE CASCADE;

-- STUDENT METRICS
ALTER TABLE zuvy_student_booking_metrics
ADD CONSTRAINT fk_student_metrics_user
FOREIGN KEY (user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

-- COURSE MODULES

SELECT DISTINCT bootcamp_id
FROM stage_template.zuvy_course_modules m
WHERE bootcamp_id IS NOT NULL
AND NOT EXISTS (
  SELECT 1 FROM stage_template.zuvy_bootcamps b
  WHERE b.id = m.bootcamp_id
);

UPDATE stage_template.zuvy_course_modules
SET bootcamp_id = NULL
WHERE bootcamp_id IS NOT NULL
AND bootcamp_id NOT IN (
  SELECT id FROM stage_template.zuvy_bootcamps
);

ALTER TABLE zuvy_course_modules
ADD CONSTRAINT fk_course_bootcamp
FOREIGN KEY (bootcamp_id)
REFERENCES stage_template.zuvy_bootcamps(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_course_modules
ADD CONSTRAINT fk_course_project
FOREIGN KEY (project_id)
REFERENCES stage_template.zuvy_course_projects(id);

-- BOOTCAMP TYPE
ALTER TABLE zuvy_bootcamp_type
ADD CONSTRAINT fk_bootcamp_type_bootcamp
FOREIGN KEY (bootcamp_id)
REFERENCES stage_template.zuvy_bootcamps(id)
ON DELETE CASCADE;

-- =========================================================
-- 3. FIX UNIQUE INDEX (CRITICAL)
-- =========================================================

ALTER TABLE stage_template.zuvy_mentor_slot_booking
DROP CONSTRAINT IF EXISTS uniq_student_slot;

CREATE UNIQUE INDEX uniq_active_student_slot
ON stage_template.zuvy_mentor_slot_booking (student_user_id, slot_availability_id)
WHERE status <> 'cancelled';

-- =========================================================
-- 4. ADD MISSING INDEXES
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_booking_reminder_24h 
ON stage_template.zuvy_mentor_slot_booking (reminder_24h_sent);

CREATE INDEX IF NOT EXISTS idx_booking_reminder_1h 
ON stage_template.zuvy_mentor_slot_booking (reminder_1h_sent);

CREATE INDEX IF NOT EXISTS idx_booking_mentor_lifecycle 
ON stage_template.zuvy_mentor_slot_booking (mentor_user_id, session_lifecycle_state);

CREATE INDEX IF NOT EXISTS idx_booking_rating 
ON stage_template.zuvy_mentor_slot_booking (mentor_user_id, mentor_rating);

-- =========================================================
-- DONE
-- =========================================================

-- =========================================================
-- Verification Queries (Run separately to check results)
-- =========================================================
SELECT current_database(), current_schema();
SHOW search_path;

SELECT
  t.relname AS table_name,
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname IN (
  'zuvy_mentor_slot_booking',
  'zuvy_student_booking_metrics',
  'zuvy_course_modules',
  'zuvy_bootcamp_type'
)
AND c.contype = 'f'
ORDER BY t.relname;

SELECT
  conname,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
WHERE conrelid = 'stage_template.zuvy_mentor_slot_booking'::regclass
AND contype = 'f';

-- booking → slot
SELECT COUNT(*) FROM stage_template.zuvy_mentor_slot_booking b
LEFT JOIN stage_template.zuvy_mentor_slot_availability s
ON b.slot_availability_id = s.id
WHERE s.id IS NULL;

-- booking → users
SELECT COUNT(*) FROM stage_template.zuvy_mentor_slot_booking b
LEFT JOIN stage_template.users u
ON b.student_user_id = u.id
WHERE u.id IS NULL;

-- course_modules → bootcamp
SELECT COUNT(*) FROM stage_template.zuvy_course_modules m
LEFT JOIN stage_template.zuvy_bootcamps b
ON m.bootcamp_id = b.id
WHERE m.bootcamp_id IS NOT NULL AND b.id IS NULL;

-- Step 1: insert booking
INSERT INTO stage_template.zuvy_mentor_slot_booking
(student_user_id, slot_availability_id, organization_id)
VALUES (1, 1, 1);

-- Step 2: cancel it
UPDATE stage_template.zuvy_mentor_slot_booking
SET status = 'cancelled'
WHERE student_user_id = 1 AND slot_availability_id = 1;

-- Step 3: insert again (should PASS now)
INSERT INTO stage_template.zuvy_mentor_slot_booking
(student_user_id, slot_availability_id, organization_id)
VALUES (1, 1, 1);

INSERT INTO stage_template.zuvy_mentor_slot_booking
(slot_availability_id, student_user_id, mentor_user_id, organization_id)
VALUES (999999, 1, 1, 1);

SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'zuvy_mentor_slot_booking';

EXPLAIN ANALYZE
SELECT *
FROM stage_template.zuvy_mentor_slot_booking
WHERE mentor_user_id = 61830;

SET search_path TO stage_template;

-- =========================
-- MENTOR SLOT BOOKING (OLD)
-- =========================
ALTER TABLE stage_template.zuvy_mentor_slot_booking
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_organization_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_mentor_user_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_slot_availability_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_student_user_id_fkey;

-- =========================
-- BOOTCAMP TYPE
-- =========================
ALTER TABLE stage_template.zuvy_bootcamp_type
DROP CONSTRAINT IF EXISTS zuvy_bootcamp_type_bootcamp_id_zuvy_bootcamps_id_fk;

-- =========================
-- COURSE MODULES
-- =========================
ALTER TABLE stage_template.zuvy_course_modules
DROP CONSTRAINT IF EXISTS zuvy_course_modules_project_id_zuvy_course_projects_id_fk,
DROP CONSTRAINT IF EXISTS zuvy_course_modules_bootcamp_id_zuvy_bootcamps_id_fk;

-- =========================
-- STUDENT METRICS
-- =========================
ALTER TABLE stage_template.zuvy_student_booking_metrics
DROP CONSTRAINT IF EXISTS zuvy_student_booking_metrics_user_id_users_id_fk;

SELECT
  t.relname,
  c.conname,
  pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE c.contype = 'f'
AND t.relname IN (
  'zuvy_mentor_slot_booking',
  'zuvy_course_modules',
  'zuvy_bootcamp_type',
  'zuvy_student_booking_metrics'
)
ORDER BY t.relname;

SET search_path TO stage_template;

SHOW search_path;

-- ========================================
-- 1. DROP ALL WRONG FKs (AGGRESSIVE)
-- ========================================

-- mentor booking
ALTER TABLE zuvy_mentor_slot_booking
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_organization_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_mentor_user_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_slot_availability_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_student_user_id_fkey;

-- bootcamp type
ALTER TABLE zuvy_bootcamp_type
DROP CONSTRAINT IF EXISTS zuvy_bootcamp_type_bootcamp_id_zuvy_bootcamps_id_fk;

-- course modules
ALTER TABLE zuvy_course_modules
DROP CONSTRAINT IF EXISTS zuvy_course_modules_project_id_zuvy_course_projects_id_fk,
DROP CONSTRAINT IF EXISTS zuvy_course_modules_bootcamp_id_zuvy_bootcamps_id_fk;

-- student metrics
ALTER TABLE zuvy_student_booking_metrics
DROP CONSTRAINT IF EXISTS zuvy_student_booking_metrics_user_id_users_id_fk;

-- ========================================
-- 2. RE-ADD ONLY CORRECT FKs
-- ========================================

-- mentor booking
ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_slot
FOREIGN KEY (slot_availability_id)
REFERENCES stage_template.zuvy_mentor_slot_availability(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_student
FOREIGN KEY (student_user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_mentor
FOREIGN KEY (mentor_user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_org
FOREIGN KEY (organization_id)
REFERENCES stage_template.zuvy_organizations(id)
ON DELETE CASCADE;

-- course modules
ALTER TABLE zuvy_course_modules
ADD CONSTRAINT fk_course_project
FOREIGN KEY (project_id)
REFERENCES stage_template.zuvy_course_projects(id);

ALTER TABLE zuvy_course_modules
ADD CONSTRAINT fk_course_bootcamp
FOREIGN KEY (bootcamp_id)
REFERENCES stage_template.zuvy_bootcamps(id)
ON DELETE CASCADE;

-- bootcamp type
ALTER TABLE zuvy_bootcamp_type
ADD CONSTRAINT fk_bootcamp_type_bootcamp
FOREIGN KEY (bootcamp_id)
REFERENCES stage_template.zuvy_bootcamps(id)
ON DELETE CASCADE;

-- student metrics
ALTER TABLE zuvy_student_booking_metrics
ADD CONSTRAINT fk_student_metrics_user
FOREIGN KEY (user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

SELECT
  t.relname,
  c.conname,
  pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
WHERE c.contype = 'f'
AND t.relname IN (
  'zuvy_mentor_slot_booking',
  'zuvy_course_modules',
  'zuvy_bootcamp_type',
  'zuvy_student_booking_metrics'
)
ORDER BY t.relname;

-- =====================================================
SET search_path TO stage_template;
SHOW search_path;
-- mentor booking
ALTER TABLE zuvy_mentor_slot_booking
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_organization_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_mentor_user_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_slot_availability_id_fkey,
DROP CONSTRAINT IF EXISTS zuvy_mentor_slot_booking_student_user_id_fkey,
DROP CONSTRAINT IF EXISTS fk_booking_slot,
DROP CONSTRAINT IF EXISTS fk_booking_student,
DROP CONSTRAINT IF EXISTS fk_booking_mentor,
DROP CONSTRAINT IF EXISTS fk_booking_org;

-- course modules
ALTER TABLE zuvy_course_modules
DROP CONSTRAINT IF EXISTS zuvy_course_modules_project_id_zuvy_course_projects_id_fk,
DROP CONSTRAINT IF EXISTS zuvy_course_modules_bootcamp_id_zuvy_bootcamps_id_fk,
DROP CONSTRAINT IF EXISTS fk_course_project,
DROP CONSTRAINT IF EXISTS fk_course_bootcamp;

-- bootcamp type
ALTER TABLE zuvy_bootcamp_type
DROP CONSTRAINT IF EXISTS zuvy_bootcamp_type_bootcamp_id_zuvy_bootcamps_id_fk,
DROP CONSTRAINT IF EXISTS fk_bootcamp_type_bootcamp;

-- student metrics
ALTER TABLE zuvy_student_booking_metrics
DROP CONSTRAINT IF EXISTS zuvy_student_booking_metrics_user_id_users_id_fk,
DROP CONSTRAINT IF EXISTS fk_student_metrics_user;

-- mentor booking
ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_slot
FOREIGN KEY (slot_availability_id)
REFERENCES stage_template.zuvy_mentor_slot_availability(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_student
FOREIGN KEY (student_user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_mentor
FOREIGN KEY (mentor_user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
ADD CONSTRAINT fk_booking_org
FOREIGN KEY (organization_id)
REFERENCES stage_template.zuvy_organizations(id)
ON DELETE CASCADE;

-- course modules
ALTER TABLE zuvy_course_modules
ADD CONSTRAINT fk_course_project
FOREIGN KEY (project_id)
REFERENCES stage_template.zuvy_course_projects(id);

ALTER TABLE zuvy_course_modules
ADD CONSTRAINT fk_course_bootcamp
FOREIGN KEY (bootcamp_id)
REFERENCES stage_template.zuvy_bootcamps(id)
ON DELETE CASCADE;

-- bootcamp type
ALTER TABLE zuvy_bootcamp_type
ADD CONSTRAINT fk_bootcamp_type_bootcamp
FOREIGN KEY (bootcamp_id)
REFERENCES stage_template.zuvy_bootcamps(id)
ON DELETE CASCADE;

-- student metrics
ALTER TABLE zuvy_student_booking_metrics
ADD CONSTRAINT fk_student_metrics_user
FOREIGN KEY (user_id)
REFERENCES stage_template.users(id)
ON DELETE CASCADE;



SELECT
  n.nspname AS schema_name,
  t.relname AS table_name,
  c.conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE c.contype = 'f'
AND t.relname IN (
  'zuvy_mentor_slot_booking',
  'zuvy_course_modules',
  'zuvy_bootcamp_type',
  'zuvy_student_booking_metrics'
)
ORDER BY n.nspname, t.relname;

SELECT
  n.nspname AS schema_name,
  t.relname,
  c.conname,
  pg_get_constraintdef(c.oid)
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_namespace n ON n.oid = t.relnamespace
WHERE c.contype = 'f'
AND n.nspname = 'stage_template'
AND t.relname IN (
  'zuvy_mentor_slot_booking',
  'zuvy_course_modules',
  'zuvy_bootcamp_type',
  'zuvy_student_booking_metrics'
);