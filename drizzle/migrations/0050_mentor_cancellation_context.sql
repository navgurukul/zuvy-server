ALTER TABLE zuvy_mentor_slot_booking
  ADD COLUMN IF NOT EXISTS cancellation_category TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_asked_by VARCHAR(20);
