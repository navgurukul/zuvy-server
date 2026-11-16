-- ============================================
-- Participant-wise attendance for mentor bookings.
-- One row per join -> leave interval, written from Zoom
-- meeting.participant_joined / meeting.participant_left webhooks.
-- Safe to run more than once.
-- ============================================

-- Participant-wise attendance intervals for mentor bookings.

CREATE TABLE IF NOT EXISTS zuvy_mentor_session_attendance_intervals (
  id SERIAL PRIMARY KEY,
  booking_id INTEGER NOT NULL
    REFERENCES zuvy_mentor_slot_booking(id) ON DELETE CASCADE,
  participant_role VARCHAR(16) NOT NULL,
  zoom_participant_key TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL,
  left_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uniq_mentor_attendance_interval
    UNIQUE (booking_id, zoom_participant_key, joined_at)
);

CREATE INDEX IF NOT EXISTS idx_mentor_attendance_booking_role
ON zuvy_mentor_session_attendance_intervals (booking_id, participant_role);



ALTER TABLE zuvy_mentor_session_attendance_intervals
RENAME TO zuvy_mentor_session_attendance;




SELECT table_name
FROM information_schema.tables
WHERE table_name IN (
  'zuvy_mentor_session_attendance',
  'zuvy_mentor_session_attendance_intervals'
);