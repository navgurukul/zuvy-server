-- ============================================================
-- MENTOR SLOT MANAGEMENT - PRODUCTION GRADE
-- Fully PRD aligned
-- ============================================================

-- ============================================================
-- 1. MENTOR SLOT MANAGEMENT PROFILE
-- ============================================================

CREATE TABLE zuvy_mentor_slot_management (
    id SERIAL PRIMARY KEY,

    mentor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES zuvy_organizations(id) ON DELETE CASCADE,

    mentor_type VARCHAR(50) DEFAULT 'instructor',

    
    is_buffer_enabled BOOLEAN DEFAULT FALSE,
    buffer_minutes INTEGER DEFAULT 0,
    timezone VARCHAR(100) DEFAULT 'UTC',

    
    total_available_slots INTEGER DEFAULT 0,
    total_booked_slots INTEGER DEFAULT 0,
    total_cancelled_slots INTEGER DEFAULT 0,

    title VARCHAR(255),
    bio TEXT,
    expertise JSONB,

    status VARCHAR(50) DEFAULT 'active',
    is_verified BOOLEAN DEFAULT FALSE,
    accepts_new_mentees BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uniq_mentor_org UNIQUE (mentor_user_id, organization_id)
);

CREATE INDEX idx_mgmt_mentor ON zuvy_mentor_slot_management(mentor_user_id);
CREATE INDEX idx_mgmt_org ON zuvy_mentor_slot_management(organization_id);

-- ============================================================
-- 2. SLOT AVAILABILITY
-- ============================================================

CREATE TABLE zuvy_mentor_slot_availability (
    id SERIAL PRIMARY KEY,

    mentor_slot_management_id INTEGER NOT NULL 
        REFERENCES zuvy_mentor_slot_management(id) ON DELETE CASCADE,

    slot_start_date_time TIMESTAMPTZ NOT NULL,
    slot_end_date_time TIMESTAMPTZ NOT NULL,

    duration_minutes INTEGER NOT NULL,

    max_capacity INTEGER DEFAULT 1,
    current_booked_count INTEGER DEFAULT 0,

    topic VARCHAR(255),
    description TEXT,
    slot_type VARCHAR(50) DEFAULT 'one-on-one',

    meeting_link VARCHAR(500),
    meeting_type VARCHAR(50) DEFAULT 'video',
    location VARCHAR(255),

    status VARCHAR(50) DEFAULT 'available',

    cancellation_reason TEXT,

    is_recurring BOOLEAN DEFAULT FALSE,
    recurrence_rule TEXT,
    recurrence_end_date TIMESTAMPTZ,

    tags JSONB,
    is_public BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT chk_time_valid CHECK (slot_end_date_time > slot_start_date_time)
);

CREATE INDEX idx_slot_mgmt ON zuvy_mentor_slot_availability(mentor_slot_management_id);
CREATE INDEX idx_slot_start ON zuvy_mentor_slot_availability(slot_start_date_time);
CREATE INDEX idx_slot_status ON zuvy_mentor_slot_availability(status);

-- ============================================================
-- 3. SLOT BOOKING (CORE SESSION ENGINE)
-- ============================================================

CREATE TABLE zuvy_mentor_slot_booking (
    id SERIAL PRIMARY KEY,

    slot_availability_id INTEGER NOT NULL
        REFERENCES zuvy_mentor_slot_availability(id) ON DELETE CASCADE,

    student_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mentor_user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id INTEGER NOT NULL REFERENCES zuvy_organizations(id) ON DELETE CASCADE,

    status VARCHAR(50) DEFAULT 'confirmed',

    session_lifecycle_state VARCHAR(50) DEFAULT 'SCHEDULED',

    
    reschedule_requested_at TIMESTAMPTZ,
    reschedule_proposed_slot_id INTEGER,
    reschedule_status VARCHAR(50),

    
    cancellation_reason TEXT,
    cancelled_by VARCHAR(50),
    cancelled_at TIMESTAMPTZ,

    
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    duration_attended INTEGER,

    
    mentor_feedback JSONB,
    mentor_rating INTEGER,
    mentor_feedback_submitted_at TIMESTAMPTZ,
    mentor_feedback_locked BOOLEAN DEFAULT FALSE,

    
    student_feedback JSONB,
    student_rating INTEGER,

    booked_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    CONSTRAINT uniq_student_slot UNIQUE (student_user_id, slot_availability_id)
);

CREATE INDEX idx_booking_mentor ON zuvy_mentor_slot_booking(mentor_user_id);
CREATE INDEX idx_booking_lifecycle ON zuvy_mentor_slot_booking(session_lifecycle_state);
CREATE INDEX idx_booking_feedback_pending ON zuvy_mentor_slot_booking(mentor_feedback_submitted_at);

-- ============================================================
-- MENTOR NOTIFICATION SUBSYSTEM
-- ============================================================

CREATE TABLE IF NOT EXISTS zuvy_notifications (
    id SERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    type VARCHAR(100) NOT NULL,

    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,

    reference_id INTEGER,
    reference_type VARCHAR(100),

    is_read BOOLEAN DEFAULT FALSE,

    channel VARCHAR(50) DEFAULT 'in-app',

    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES (IMPORTANT FOR PERFORMANCE)
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON zuvy_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read
    ON zuvy_notifications(is_read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at
    ON zuvy_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_notifications_type
    ON zuvy_notifications(type);

-- ============================================================
-- ADD REMINDER TRACKING FLAGS
-- ============================================================

ALTER TABLE zuvy_mentor_slot_booking
ADD COLUMN IF NOT EXISTS reminder_24h_sent BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS reminder_1h_sent BOOLEAN DEFAULT FALSE;

-- ============================================================
-- INDEX FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_booking_reminder_24h
    ON zuvy_mentor_slot_booking(reminder_24h_sent);

CREATE INDEX IF NOT EXISTS idx_booking_reminder_1h
    ON zuvy_mentor_slot_booking(reminder_1h_sent);

-- ============================================================
-- INDEXES FOR METRICS ENGINE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_booking_mentor_lifecycle
    ON zuvy_mentor_slot_booking(mentor_user_id, session_lifecycle_state);

CREATE INDEX IF NOT EXISTS idx_booking_rating
    ON zuvy_mentor_slot_booking(mentor_user_id, mentor_rating);

CREATE INDEX IF NOT EXISTS idx_slot_mgmt_lookup
    ON zuvy_mentor_slot_availability(mentor_slot_management_id);

CREATE INDEX IF NOT EXISTS idx_slot_start_time
    ON zuvy_mentor_slot_availability(slot_start_date_time);


INSERT INTO zuvy_mentor_slot_management (
    mentor_user_id,
    organization_id,
    mentor_type,
    status,
    is_verified,
    accepts_new_mentees,
    created_at,
    updated_at
)
SELECT
    ura.user_id,
    org.id,
    'mentor',
    'active',
    true,
    true,
    NOW(),
    NOW()
FROM zuvy_user_roles_assigned ura
JOIN zuvy_organizations org
ON org.id = ura.organization_id
LEFT JOIN zuvy_mentor_slot_management msm
ON msm.mentor_user_id = ura.user_id
WHERE msm.id IS NULL;

INSERT INTO zuvy_mentor_slot_availability (
    mentor_slot_management_id,
    slot_start_date_time,
    slot_end_date_time,
    duration_minutes,
    max_capacity,
    current_booked_count,
    status,
    is_public,
    created_at,
    updated_at
)
SELECT
    msm.id,
    NOW() + INTERVAL '1 day',
    NOW() + INTERVAL '1 day' + INTERVAL '1 hour',
    60,
    3,
    0,
    'available',
    true,
    NOW(),
    NOW()
FROM zuvy_mentor_slot_management msm
LIMIT 30;


INSERT INTO zuvy_mentor_slot_booking (
    slot_availability_id,
    student_user_id,
    mentor_user_id,
    organization_id,
    status,
    session_lifecycle_state,
    booked_at,
    created_at
)
SELECT
    s.id,
    u.id,
    msm.mentor_user_id,
    msm.organization_id,
    'confirmed',
    'SCHEDULED',
    NOW(),
    NOW()
FROM users u
JOIN zuvy_mentor_slot_availability s ON true
JOIN zuvy_mentor_slot_management msm
ON msm.id = s.mentor_slot_management_id
LEFT JOIN zuvy_user_roles_assigned ura
ON ura.user_id = u.id
WHERE ura.user_id IS NULL
LIMIT 20;


UPDATE zuvy_mentor_slot_availability s
SET current_booked_count = sub.count
FROM (
  SELECT slot_availability_id, COUNT(*) AS count
  FROM zuvy_mentor_slot_booking
  GROUP BY slot_availability_id
) sub
WHERE s.id = sub.slot_availability_id;

INSERT INTO zuvy_notifications (
    user_id,
    type,
    title,
    message,
    is_read,
    created_at
)
SELECT
    student_user_id,
    'SESSION_BOOKED',
    'Session Confirmed',
    'Your mentorship session has been booked.',
    false,
    NOW()
FROM zuvy_mentor_slot_booking
LIMIT 10;

DELETE FROM zuvy_user_roles_assigned
WHERE organization_id = 4;

ALTER TABLE zuvy_mentor_slot_booking
DROP CONSTRAINT uniq_student_slot;

CREATE UNIQUE INDEX uniq_active_student_slot
ON zuvy_mentor_slot_booking(student_user_id, slot_availability_id)
WHERE status != 'cancelled';

ALTER TABLE zuvy_mentor_slot_management
ADD COLUMN google_refresh_token TEXT,
ADD COLUMN google_email VARCHAR(255);

SELECT google_refresh_token
FROM zuvy_mentor_slot_management;

SELECT google_refresh_token
FROM zuvy_mentor_slot_management
WHERE mentor_user_id = 61830;

UPDATE zuvy_mentor_slot_management
SET
bio = 'Senior Backend Mentor',
expertise = '["Node.js","NestJS","PostgreSQL"]',
title = 'Backend Mentor'
WHERE mentor_user_id = 65616;


ALTER TABLE zuvy_mentor_slot_booking
ADD COLUMN google_event_id VARCHAR(255);
ALTER TABLE zuvy_mentor_slot_booking
ADD COLUMN meeting_link VARCHAR(500);

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'zuvy_mentor_slot_booking';

SELECT column_name
FROM information_schema.columns
WHERE table_name = 'zuvy_mentor_slot_management';

ALTER TABLE zuvy_mentor_slot_management
ADD COLUMN past_experiences JSONB;

ALTER TABLE zuvy_bootcamp_type
ADD COLUMN mentorship_enabled BOOLEAN DEFAULT FALSE;