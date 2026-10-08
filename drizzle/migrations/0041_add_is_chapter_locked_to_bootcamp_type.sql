ALTER TABLE "zuvy_bootcamp_type"
  ADD COLUMN IF NOT EXISTS "is_chapter_locked" boolean DEFAULT false;
