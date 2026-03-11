-- Migration: Drop page completion tracking and profile_strength columns
-- These columns are no longer needed in zuvy_learners_complete_profile

ALTER TABLE main.zuvy_learners_complete_profile
  DROP COLUMN IF EXISTS page1_completed,
  DROP COLUMN IF EXISTS page2_completed,
  DROP COLUMN IF EXISTS page3_completed,
  DROP COLUMN IF EXISTS page4_completed,
  DROP COLUMN IF EXISTS page5_completed,
  DROP COLUMN IF EXISTS profile_strength;
