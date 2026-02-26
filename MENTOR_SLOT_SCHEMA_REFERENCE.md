# Mentor Slot Management System - Schema Diagram & Quick Reference

## Quick Reference Guide

### Table Summary

| Table                             | Purpose                | Key Foreign Keys                                 | Status Values                                              |
| --------------------------------- | ---------------------- | ------------------------------------------------ | ---------------------------------------------------------- |
| `zuvy_mentor_slot_management`     | Mentor profile hub     | mentorUserId → users, organizationId → orgs      | active, inactive, paused                                   |
| `zuvy_mentor_slot_availability`   | Time slots for booking | mentorSlotManagementId                           | available, full, cancelled, completed, archived            |
| `zuvy_mentor_slot_booking`        | Student bookings       | slotAvailabilityId, studentUserId, mentorUserId  | pending, confirmed, attended, missed, cancelled, no-show   |
| `zuvy_mentor_student_association` | Mentor-student links   | mentorUserId, studentUserId, batchId, bootcampId | active, inactive, completed, promoted, declined, suspended |

---

## Entity Relationship Diagram (Text Format)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   users                                      │
│                          (Mentors & Students)                               │
│                          id (bigserial PK)                                  │
└─────────────┬─────────────────────────────┬─────────────────────────────────┘
              │                             │
              │ mentorUserId                │ studentUserId
              │                             │
    ┌─────────▼──────────────────────┐     │
    │ zuvyMentorSlotManagement       │     │
    ├───────────────────────────────┤     │
    │ id (PK)                       │     │
    │ mentorUserId (FK) ────────────┼─────┤
    │ organizationId (FK)           │     │
    │ totalAvailableSlots           │     │
    │ totalBookedSlots              │     │
    │ totalCancelledSlots           │     │
    │ status (active/inactive)      │     │
    │ expertise (jsonb)             │     │
    │ acceptsNewMentees             │     │
    │ createdAt, updatedAt          │     │
    └──────┬───────────────────────┬┘     │
           │                       │       │
           │ (1:N)                 │       │
           │ mentorSlotMgmtId      │       │
           │                       │       │
    ┌──────▼─────────────────────────────────┤
    │ zuvy_mentor_slot_availability           │
    ├─────────────────────────────────────────┤
    │ id (PK)                                 │
    │ mentorSlotManagementId (FK)             │
    │ slotStartDateTime                       │
    │ slotEndDateTime                         │
    │ durationMinutes                         │
    │ maxCapacity                             │
    │ currentBookedCount                      │
    │ topic, description                      │
    │ slotType (one-on-one/group/batch)      │
    │ meetingLink, meetingType                │
    │ status (available/full/cancelled)       │
    │ tags (jsonb - skills)                   │
    │ isRecurring, recurrencePattern          │
    │ isPublic                                │
    │ createdAt, updatedAt                    │
    └──────┬──────────────────────────────────┘
           │
           │ (1:N)
           │ slotAvailabilityId
           │
    ┌──────▼──────────────────────────────────┐
    │ zuvy_mentor_slot_booking                 │
    ├──────────────────────────────────────────┤
    │ id (PK)                                  │
    │ slotAvailabilityId (FK)                  │
    │ studentUserId (FK) ──────────────────────┼──→ users
    │ mentorUserId (FK - denormalized)         │
    │ organizationId (FK)                      │
    │ status (pending/confirmed/attended)      │
    │ joinedAt, leftAt                         │
    │ durationAttended                         │
    │ studentRating, mentorRating (1-5)       │
    │ sessionNotes                             │
    │ studentFeedback, mentorFeedback (jsonb)  │
    │ cancellationReason, cancelledBy          │
    │ followUpAction                           │
    │ bookedAt, confirmedAt, completedAt       │
    │ createdAt, updatedAt                     │
    └─────────────────────────────────────────┘

                    zuvyMentorStudentAssociation
                    ├──────────────────────────────────────────┐
                    │ id (PK)                                  │
                    │ mentorUserId (FK) → users                │
                    │ studentUserId (FK) → users               │
                    │ organizationId (FK) → org                │
                    │ associationType (direct/batch/bootcamp)  │
                    │ batchId (FK) → zuvyBatches              │
                    │ bootcampId (FK) → zuvyBootcamps         │
                    │ status (active/completed/promoted)       │
                    │ role (mentee/peer/assistant)             │
                    │ goals (jsonb)                            │
                    │ totalSessions, totalAttendedSessions    │
                    │ averageAttendanceRate                    │
                    │ assignedAt, startDate, endDate          │
                    │ createdAt, updatedAt                    │
                    └──────────────────────────────────────────┘
```

---

## Status State Machines

### Slot Availability Status

```
┌──────────────┐
│  available   │ ← Newly created slot
└──────┬───────┘
       │
       ├─→ full (when currentBookedCount == maxCapacity)
       │     └─→ available (booking cancelled, count reduced)
       │
       ├─→ cancelled (mentor cancels before slot time)
       │
       └─→ completed (slot datetime has passed and students attended)
             └─→ archived (after completion period)
```

### Slot Booking Status

```
┌─────────────────────────────────────────────────────────────────────┐
│                      BOOKING LIFECYCLE                              │
└─────────────────────────────────────────────────────────────────────┘

         pending (initial)
           │
           ├─→ confirmed (mentor approves)
           │     │
           │     ├─→ attended (student attends session)
           │     │     └─→ completed ✓
           │     │
           │     └─→ missed/no-show (slot time passed, student didn't join)
           │
           └─→ cancelled (from pending or confirmed state)
                 ├─→ Reason: student initiated
                 └─→ Reason: mentor initiated
```

### Mentor-Student Association Status

```
┌─────────────┐
│   active    │ ← Current mentorship
└──────┬──────┘
       │
       ├─→ inactive (paused, can be reactivated)
       │
       ├─→ completed (mentorship officially ended)
       │
       ├─→ promoted (student promoted to peer/leader)
       │
       ├─→ suspended (temporary issue, can be reactivated)
       │
       └─→ declined (if type='request', request was rejected)
```

---

## Column Definitions by Data Type

### Integer Columns (Counts & Metrics)

- `totalAvailableSlots`, `totalBookedSlots`, `totalCancelledSlots`
- `maxCapacity`, `currentBookedCount`
- `durationMinutes`, `durationAttended`
- `totalSessions`, `totalAttendedSessions`
- `studentRating`, `mentorRating` (1-5 scale)

### Varchar Columns (Categories)

- `mentorType`: 'admin', 'instructor', 'ops', 'mentor'
- `slotType`: 'one-on-one', 'group', 'batch'
- `meetingType`: 'video', 'audio', 'in-person'
- `status`: Various (see status machines above)
- `associationType`: 'direct', 'batch', 'bootcamp', 'course', 'request'

### JSONB Columns (Structured Data)

- `expertise`: `["JavaScript", "NodeJS", "Python"]`
- `tags`: `["debugging", "performance", "testing"]`
- `goals`: `[{"goal": "Learn async/await", "progress": 75}, ...]`
- `studentFeedback`: `{"rating": 5, "comment": "Great session!", "helpful": true}`
- `mentorFeedback`: `{"studentPrep": "good", "engagement": "excellent"}`

### Text Columns (Long-form Content)

- `bio`: Mentor biography
- `description`: Detailed slot description
- `sessionNotes`: Session discussion points and outcomes
- `notes`: Contextual notes about association
- `cancellationReason`: Why something was cancelled
- `followUpAction`: Action items from session

---

## Important Indices

### Performance-Critical Indices

```
zuvy_mentor_slot_management:
  - idx_mentor_slot_mgmt_mentor_user_id (frequent lookup)
  - idx_mentor_slot_mgmt_status (status filtering)

zuvy_mentor_slot_availability:
  - idx_slot_avail_mgmt_id (find mentor's slots)
  - idx_slot_avail_start_datetime (upcoming slots)
  - idx_slot_avail_status (list available/full)
  - idx_slot_avail_is_public (public slots discovery)

zuvy_mentor_slot_booking:
  - idx_slot_booking_slot_avail_id (find bookings for slot)
  - idx_slot_booking_student_user_id (student's history)
  - idx_slot_booking_mentor_user_id (mentor's bookings)
  - idx_slot_booking_status (pending confirmations)
  - idx_slot_booking_booked_at (timeline queries)

zuvy_mentor_student_association:
  - idx_assoc_mentor_user_id (find students)
  - idx_assoc_student_user_id (find mentors)
  - idx_assoc_status (active only lookups)
```

---

## Data Format Examples

### Expertise Array

```json
[
  "JavaScript",
  "TypeScript",
  "React",
  "NodeJS",
  "Problem Solving",
  "Code Review"
]
```

### Tags Array (Skills)

```json
["debugging", "performance", "security", "testing", "refactoring"]
```

### Goals Array

```json
[
  {
    "goal": "Master async/await in JavaScript",
    "priority": "high",
    "progress": 75,
    "sessions": 3
  },
  {
    "goal": "Build a production-ready Node API",
    "priority": "high",
    "progress": 50,
    "sessions": 5
  }
]
```

### Student Feedback

```json
{
  "rating": 5,
  "comment": "Very helpful session, mentor was patient and clear",
  "helpfulness": 10,
  "wouldBookAgain": true,
  "suggestedImprovements": "Could share more code examples"
}
```

### Mentor Feedback

```json
{
  "studentPreparation": "good",
  "studentEngagement": "excellent",
  "understandingLevel": "advanced",
  "recommendedTopics": ["advanced async patterns", "performance optimization"],
  "nextSteps": "Practice with real-world projects"
}
```

---

## Unique Constraints & Key Validations

### Unique Constraints (Database Level)

```sql
-- One mentor profile per organization
UNIQUE(mentorUserId, organizationId)

-- One booking per student per slot
UNIQUE(studentUserId, slotAvailabilityId)

-- One active association per mentor-student-batch combination
UNIQUE(mentorUserId, studentUserId, batchId)
```

### Business Logic Validations (Application Level)

1. ✅ `currentBookedCount` ≤ `maxCapacity`
2. ✅ `slotEndDateTime` > `slotStartDateTime`
3. ✅ Duration cannot exceed 8 hours
4. ✅ Cannot book slot in the past
5. ✅ Student can only book if actively associated with mentor
6. ✅ Mentor must be in 'active' status to create slots
7. ✅ Booking can only be initiated by active student/mentor pairs

---

## Query Patterns for API Development

### Pattern 1: Get Mentor's Available Slots

```sql
SELECT
  msm.id as mentorId,
  msm.expertise,
  COUNT(msa.id) as totalSlots,
  SUM(CASE WHEN msa.status = 'available' THEN 1 ELSE 0 END) as availableSlots,
  SUM(CASE WHEN msa.status = 'full' THEN 1 ELSE 0 END) as fullSlots
FROM zuvy_mentor_slot_management msm
LEFT JOIN zuvy_mentor_slot_availability msa ON msm.id = msa.mentorSlotManagementId
WHERE msm.mentorUserId = $1 AND msm.organizationId = $2
GROUP BY msm.id
```

### Pattern 2: Recommended Mentors for Student

```sql
SELECT DISTINCT
  msm.id,
  u.name,
  u.email,
  msm.expertise,
  COUNT(DISTINCT msa.id) as availableSlots,
  msm.averageRating
FROM zuvy_mentor_slot_management msm
JOIN users u ON msm.mentorUserId = u.id
LEFT JOIN zuvy_mentor_slot_availability msa ON msm.id = msa.mentorSlotManagementId
  AND msa.status = 'available'
  AND msa.isPublic = true
  AND msa.slotStartDateTime > NOW()
WHERE msm.organizationId = $1
  AND msm.status = 'active'
  AND msm.isVerified = true
  AND msm.acceptsNewMentees = true
GROUP BY msm.id, u.name, u.email, msm.expertise
ORDER BY availableSlots DESC
```

### Pattern 3: Student's Booking History with Details

```sql
SELECT
  msb.id,
  msb.status,
  msa.topic,
  msa.slotStartDateTime,
  msa.slotEndDateTime,
  u.name as mentorName,
  msb.studentRating,
  msb.mentorRating,
  msb.durationAttended,
  CASE WHEN msb.status = 'attended' THEN 'Completed' ELSE msb.status END as displayStatus
FROM zuvy_mentor_slot_booking msb
JOIN zuvy_mentor_slot_availability msa ON msb.slotAvailabilityId = msa.id
JOIN users u ON msb.mentorUserId = u.id
WHERE msb.studentUserId = $1
ORDER BY msa.slotStartDateTime DESC
LIMIT 50
```

### Pattern 4: Mentor Dashboard Stats

```sql
SELECT
  msm.id,
  COUNT(DISTINCT msa.id) as totalSlots,
  SUM(CASE WHEN msa.status = 'available' THEN 1 ELSE 0 END) as openSlots,
  COUNT(DISTINCT msb.id) as totalBookings,
  COUNT(DISTINCT CASE WHEN msb.status = 'attended' THEN msb.id END) as completedSessions,
  COUNT(DISTINCT msb.studentUserId) as uniqueStudents,
  AVG(msb.studentRating) as avgStudentRating,
  SUM(msb.durationAttended) as totalHoursMentored
FROM zuvy_mentor_slot_management msm
LEFT JOIN zuvy_mentor_slot_availability msa ON msm.id = msa.mentorSlotManagementId
LEFT JOIN zuvy_mentor_slot_booking msb ON msa.id = msb.slotAvailabilityId
WHERE msm.mentorUserId = $1 AND msm.organizationId = $2
GROUP BY msm.id
```

---

## Migration Notes

These tables are designed to be:

- **Non-destructive** - No impact on existing tables
- **Independent** - Don't require existing data migrations
- **Scalable** - Indices designed for performance at scale
- **Audit-friendly** - All timestamps and status tracking included

Create migration file: `000X_add_mentor_slot_management_system.sql`
