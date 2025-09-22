-- Migration: add startDate/endDate to zuvyBatches and enrolledDate,lastActiveDate,status to zuvyBatchEnrollments
-- Also ensure duration field is integer type in zuvy_bootcamps

ALTER TABLE IF EXISTS zuvyBatches
ADD COLUMN IF NOT EXISTS "startDate" timestamptz NULL,
ADD COLUMN IF NOT EXISTS "endDate" timestamptz NULL;

ALTER TABLE IF EXISTS zuvyBatchEnrollments
ADD COLUMN IF NOT EXISTS "enrolledDate" timestamptz NULL,
ADD COLUMN IF NOT EXISTS "lastActiveDate" timestamptz NULL,
ADD COLUMN IF NOT EXISTS "status" varchar(32) DEFAULT 'active';

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