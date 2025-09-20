-- Migration: add startDate/endDate to zuvyBatches and enrolledDate,lastActiveDate,status to zuvyBatchEnrollments

ALTER TABLE IF EXISTS zuvyBatches
ADD COLUMN IF NOT EXISTS "startDate" timestamptz NULL,
ADD COLUMN IF NOT EXISTS "endDate" timestamptz NULL;

ALTER TABLE IF EXISTS zuvyBatchEnrollments
ADD COLUMN IF NOT EXISTS "enrolledDate" timestamptz NULL,
ADD COLUMN IF NOT EXISTS "lastActiveDate" timestamptz NULL,
ADD COLUMN IF NOT EXISTS "status" varchar(32) DEFAULT 'active';

-- Optional: create enum for status if desired (Postgres)
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
--     CREATE TYPE enrollment_status AS ENUM ('active','graduate','dropout');
--   END IF;
-- END$$;

-- If you prefer to use an enum, uncomment above and then alter column accordingly:
-- ALTER TABLE zuvyBatchEnrollments ALTER COLUMN status TYPE enrollment_status USING status::enrollment_status;