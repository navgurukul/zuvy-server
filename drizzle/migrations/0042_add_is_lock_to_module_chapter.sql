ALTER TABLE "zuvy_module_chapter"
  ADD COLUMN IF NOT EXISTS "is_lock" boolean DEFAULT false;
