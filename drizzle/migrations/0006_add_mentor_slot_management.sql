-- 0006_add_mentor_slot_management.sql
-- Migration: add mentor slot management tables
-- Generated from drizzle/schema.ts (mentor-slot management section)

BEGIN;

-- Create mentor slot management profile
CREATE TABLE IF NOT EXISTS zuvy_mentor_slot_management (
  id                SERIAL PRIMARY KEY,
  mentor_user_id    BIGINT NOT NULL,
  organization_id   INTEGER NOT NULL,
  mentor_type       VARCHAR(50) NOT NULL DEFAULT 'instructor',
  total_available_slots INTEGER DEFAULT 0,
  total_booked_slots INTEGER DEFAULT 0,
  total_cancelled_slots INTEGER DEFAULT 0,
  title             VARCHAR(255),
  bio               TEXT,
  expertise         JSONB,
  status            VARCHAR(50) NOT NULL DEFAULT 'active',
  is_verified       BOOLEAN DEFAULT false,
  accepts_new_mentees BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  version           VARCHAR(10)
);

ALTER TABLE zuvy_mentor_slot_management
  ADD CONSTRAINT uniq_mentor_org UNIQUE (mentor_user_id, organization_id);

-- Foreign keys
ALTER TABLE zuvy_mentor_slot_management
  ADD CONSTRAINT fk_zuvy_mentor_slot_mgmt_user FOREIGN KEY (mentor_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_slot_management
  ADD CONSTRAINT fk_zuvy_mentor_slot_mgmt_org FOREIGN KEY (organization_id) REFERENCES zuvy_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mentor_slot_mgmt_mentor_user_id ON zuvy_mentor_slot_management (mentor_user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_slot_mgmt_org_id ON zuvy_mentor_slot_management (organization_id);
CREATE INDEX IF NOT EXISTS idx_mentor_slot_mgmt_status ON zuvy_mentor_slot_management (status);


-- Create mentor slot availability
CREATE TABLE IF NOT EXISTS zuvy_mentor_slot_availability (
  id                      SERIAL PRIMARY KEY,
  mentor_slot_management_id INTEGER NOT NULL,
  slot_start_date_time    TIMESTAMPTZ NOT NULL,
  slot_end_date_time      TIMESTAMPTZ NOT NULL,
  duration_minutes        INTEGER NOT NULL,
  max_capacity            INTEGER NOT NULL DEFAULT 1,
  current_booked_count    INTEGER NOT NULL DEFAULT 0,
  topic                   VARCHAR(255),
  description             TEXT,
  slot_type               VARCHAR(50) NOT NULL DEFAULT 'one-on-one',
  meeting_link            VARCHAR(500),
  meeting_type            VARCHAR(50) DEFAULT 'video',
  location                VARCHAR(255),
  status                  VARCHAR(50) NOT NULL DEFAULT 'available',
  cancellation_reason     TEXT,
  is_recurring            BOOLEAN DEFAULT false,
  recurrence_pattern      VARCHAR(100),
  recurrence_end_date     TIMESTAMPTZ,
  tags                    JSONB,
  is_public               BOOLEAN DEFAULT true,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now(),
  version                 VARCHAR(10)
);

ALTER TABLE zuvy_mentor_slot_availability
  ADD CONSTRAINT fk_slot_avail_mgmt FOREIGN KEY (mentor_slot_management_id) REFERENCES zuvy_mentor_slot_management(id) ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS idx_slot_avail_mgmt_id ON zuvy_mentor_slot_availability (mentor_slot_management_id);
CREATE INDEX IF NOT EXISTS idx_slot_avail_start_datetime ON zuvy_mentor_slot_availability (slot_start_date_time);
CREATE INDEX IF NOT EXISTS idx_slot_avail_end_datetime ON zuvy_mentor_slot_availability (slot_end_date_time);
CREATE INDEX IF NOT EXISTS idx_slot_avail_status ON zuvy_mentor_slot_availability (status);
CREATE INDEX IF NOT EXISTS idx_slot_avail_is_public ON zuvy_mentor_slot_availability (is_public);
CREATE INDEX IF NOT EXISTS idx_slot_avail_time_validation ON zuvy_mentor_slot_availability (slot_start_date_time, slot_end_date_time);


-- Create mentor slot bookings
CREATE TABLE IF NOT EXISTS zuvy_mentor_slot_booking (
  id                    SERIAL PRIMARY KEY,
  slot_availability_id  INTEGER NOT NULL,
  student_user_id       BIGINT NOT NULL,
  mentor_user_id        BIGINT NOT NULL,
  organization_id       INTEGER NOT NULL,
  status                VARCHAR(50) NOT NULL DEFAULT 'pending',
  cancellation_reason   TEXT,
  cancelled_by          VARCHAR(50),
  cancelled_at          TIMESTAMPTZ,
  session_notes         TEXT,
  student_feedback      JSONB,
  mentor_feedback       JSONB,
  joined_at             TIMESTAMPTZ,
  left_at               TIMESTAMPTZ,
  duration_attended     INTEGER,
  student_rating        INTEGER,
  mentor_rating         INTEGER,
  reference             TEXT,
  follow_up_action      TEXT,
  booked_at             TIMESTAMPTZ DEFAULT now(),
  confirmed_at          TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  version               VARCHAR(10)
);

ALTER TABLE zuvy_mentor_slot_booking
  ADD CONSTRAINT fk_slot_booking_slot_avail FOREIGN KEY (slot_availability_id) REFERENCES zuvy_mentor_slot_availability(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
  ADD CONSTRAINT fk_slot_booking_student_user FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
  ADD CONSTRAINT fk_slot_booking_mentor_user FOREIGN KEY (mentor_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
  ADD CONSTRAINT fk_slot_booking_org FOREIGN KEY (organization_id) REFERENCES zuvy_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_slot_booking
  ADD CONSTRAINT uniq_student_slot_booking UNIQUE (student_user_id, slot_availability_id);

CREATE INDEX IF NOT EXISTS idx_slot_booking_slot_avail_id ON zuvy_mentor_slot_booking (slot_availability_id);
CREATE INDEX IF NOT EXISTS idx_slot_booking_student_user_id ON zuvy_mentor_slot_booking (student_user_id);
CREATE INDEX IF NOT EXISTS idx_slot_booking_mentor_user_id ON zuvy_mentor_slot_booking (mentor_user_id);
CREATE INDEX IF NOT EXISTS idx_slot_booking_org_id ON zuvy_mentor_slot_booking (organization_id);
CREATE INDEX IF NOT EXISTS idx_slot_booking_status ON zuvy_mentor_slot_booking (status);
CREATE INDEX IF NOT EXISTS idx_slot_booking_booked_at ON zuvy_mentor_slot_booking (booked_at);
CREATE INDEX IF NOT EXISTS idx_slot_booking_joined_at ON zuvy_mentor_slot_booking (joined_at);


-- Create mentor-student association
CREATE TABLE IF NOT EXISTS zuvy_mentor_student_association (
  id                    SERIAL PRIMARY KEY,
  mentor_user_id        BIGINT NOT NULL,
  student_user_id       BIGINT NOT NULL,
  organization_id       INTEGER NOT NULL,
  association_type      VARCHAR(50) NOT NULL,
  batch_id              INTEGER,
  bootcamp_id           INTEGER,
  status                VARCHAR(50) NOT NULL DEFAULT 'active',
  role                  VARCHAR(50),
  goals                 JSONB,
  notes                 TEXT,
  total_sessions        INTEGER DEFAULT 0,
  total_booked_slots    INTEGER DEFAULT 0,
  total_attended_sessions INTEGER DEFAULT 0,
  average_attendance_rate DOUBLE PRECISION,
  assigned_at           TIMESTAMPTZ DEFAULT now(),
  start_date            TIMESTAMPTZ,
  end_date              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  version               VARCHAR(10)
);

ALTER TABLE zuvy_mentor_student_association
  ADD CONSTRAINT fk_assoc_mentor_user FOREIGN KEY (mentor_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_student_association
  ADD CONSTRAINT fk_assoc_student_user FOREIGN KEY (student_user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_student_association
  ADD CONSTRAINT fk_assoc_org FOREIGN KEY (organization_id) REFERENCES zuvy_organizations(id) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE zuvy_mentor_student_association
  ADD CONSTRAINT fk_assoc_batch FOREIGN KEY (batch_id) REFERENCES zuvy_batches(id) ON DELETE SET NULL;

ALTER TABLE zuvy_mentor_student_association
  ADD CONSTRAINT fk_assoc_bootcamp FOREIGN KEY (bootcamp_id) REFERENCES zuvy_bootcamps(id) ON DELETE SET NULL;

ALTER TABLE zuvy_mentor_student_association
  ADD CONSTRAINT uniq_mentor_student_batch UNIQUE (mentor_user_id, student_user_id, batch_id);

CREATE INDEX IF NOT EXISTS idx_assoc_mentor_user_id ON zuvy_mentor_student_association (mentor_user_id);
CREATE INDEX IF NOT EXISTS idx_assoc_student_user_id ON zuvy_mentor_student_association (student_user_id);
CREATE INDEX IF NOT EXISTS idx_assoc_org_id ON zuvy_mentor_student_association (organization_id);
CREATE INDEX IF NOT EXISTS idx_assoc_association_type ON zuvy_mentor_student_association (association_type);
CREATE INDEX IF NOT EXISTS idx_assoc_status ON zuvy_mentor_student_association (status);
CREATE INDEX IF NOT EXISTS idx_assoc_batch_id ON zuvy_mentor_student_association (batch_id);
CREATE INDEX IF NOT EXISTS idx_assoc_bootcamp_id ON zuvy_mentor_student_association (bootcamp_id);
CREATE INDEX IF NOT EXISTS idx_assoc_start_end_date ON zuvy_mentor_student_association (start_date, end_date);

COMMIT;

-- End of migration 0006
