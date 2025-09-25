-- Migration: add startDate/endDate to zuvyBatches and enrolledDate,lastActiveDate,status to zuvyBatchEnrollments
-- Also ensure duration field is integer type in zuvy_bootcamps

-- Ensure batch start/end use snake_case names
ALTER TABLE IF EXISTS zuvy_batches
ADD COLUMN IF NOT EXISTS start_date timestamptz NULL,
ADD COLUMN IF NOT EXISTS end_date timestamptz NULL,
ADD COLUMN IF NOT EXISTS status varchar(64) DEFAULT 'Ongoing';

-- Safely ensure enrollment date columns exist and normalize any pre-existing camelCase columns
DO $$ BEGIN
  -- If old camelCase columns exist (created by older migrations), rename them to snake_case
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zuvy_batch_enrollments' AND column_name = 'enrolledDate'
  ) THEN
    EXECUTE 'ALTER TABLE zuvy_batch_enrollments RENAME COLUMN "enrolledDate" TO enrolled_date';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zuvy_batch_enrollments' AND column_name = 'lastActiveDate'
  ) THEN
    EXECUTE 'ALTER TABLE zuvy_batch_enrollments RENAME COLUMN "lastActiveDate" TO last_active_date';
  END IF;

  -- Add snake_case columns if they don't already exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zuvy_batch_enrollments' AND column_name = 'enrolled_date'
  ) THEN
    ALTER TABLE zuvy_batch_enrollments ADD COLUMN enrolled_date timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zuvy_batch_enrollments' AND column_name = 'last_active_date'
  ) THEN
    ALTER TABLE zuvy_batch_enrollments ADD COLUMN last_active_date timestamptz NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'zuvy_batch_enrollments' AND column_name = 'status'
  ) THEN
    ALTER TABLE zuvy_batch_enrollments ADD COLUMN status varchar(32) DEFAULT 'active';
  END IF;
END $$;

-- Ensure duration field in zuvy_bootcamps is integer type
-- This handles cases where duration might have been varchar before
DO $$ BEGIN
  -- Check if duration column exists and alter type if needed
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'zuvy_bootcamps' 
    AND column_name = 'duration'
    AND data_type != 'integer'
  ) THEN
    -- Convert varchar duration to integer, handling null and non-numeric values
    ALTER TABLE zuvy_bootcamps 
    ALTER COLUMN duration TYPE integer 
    USING CASE 
      WHEN duration ~ '^[0-9]+$' THEN duration::integer 
      ELSE NULL 
    END;
  END IF;
END $$;

-- Optional: create enum for status if desired (Postgres)
-- DO $$ BEGIN
--   IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
--     CREATE TYPE enrollment_status AS ENUM ('active','graduate','dropout');
--   END IF;
-- END$$;

-- If you prefer to use an enum, uncomment above and then alter column accordingly:
-- ALTER TABLE zuvyBatchEnrollments ALTER COLUMN status TYPE enrollment_status USING status::enrollment_status;