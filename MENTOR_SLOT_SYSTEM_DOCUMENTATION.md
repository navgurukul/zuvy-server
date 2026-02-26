# Mentor Slot Management System - Technical Documentation

## Overview

A comprehensive slot management system that enables instructors, mentors, and admin staff to create time slots and manage mentorship sessions with students. The system tracks availability, bookings, and mentor-student associations across organizations and batches.

## System Architecture

### Core Tables

#### 1. **zuvy_mentor_slot_management**

**Purpose:** Main configuration hub for mentor slot management

**Key Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `mentorUserId` | bigserial | References `users.id` - The mentor/instructor/admin/ops staff |
| `organizationId` | integer | References `zuvyOrganizations.id` - Organization context |
| `mentorType` | varchar(50) | 'admin', 'instructor', 'ops', 'mentor' |
| `totalAvailableSlots` | integer | Count of available slots |
| `totalBookedSlots` | integer | Count of booked slots |
| `totalCancelledSlots` | integer | Count of cancelled slots |
| `title` | varchar(255) | Job designation/title |
| `expertise` | jsonb | Array of expertise areas (e.g., ['JavaScript', 'NodeJS']) |
| `status` | varchar(50) | 'active', 'inactive', 'paused' |
| `isVerified` | boolean | Profile verification status |
| `acceptsNewMentees` | boolean | Whether mentor accepts new students |
| `createdAt`, `updatedAt` | timestamp | Audit timestamps |

**Relationships:**

- One mentor per organization (Unique constraint)
- Links to `users` table (mentor profile)
- Links to `zuvyOrganizations` table (org context)
- Referenced by `zuvyMentorSlotAvailability` (slots created)
- Referenced by `zuvyMentorStudentAssociation` (students managed)

**Unique Constraints:**

- `uniqMentorOrg`: `(mentorUserId, organizationId)` - Ensures one profile per mentor per org

**Indices:**

- `idx_mentor_slot_mgmt_mentor_user_id` - Fast lookup by mentor
- `idx_mentor_slot_mgmt_org_id` - Fast lookup by organization
- `idx_mentor_slot_mgmt_status` - Fast lookup by status

---

#### 2. **zuvy_mentor_slot_availability**

**Purpose:** Individual time slots created by mentors available for booking

**Key Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `mentorSlotManagementId` | integer | FK to `zuvyMentorSlotManagement.id` |
| `slotStartDateTime` | timestamp | Slot start time (with timezone) |
| `slotEndDateTime` | timestamp | Slot end time (with timezone) |
| `durationMinutes` | integer | Calculated duration in minutes |
| `maxCapacity` | integer | How many students can book (default: 1) |
| `currentBookedCount` | integer | Current confirmed bookings |
| `topic` | varchar(255) | Session title/topic |
| `description` | text | Detailed description |
| `slotType` | varchar(50) | 'one-on-one', 'group', 'batch' |
| `meetingLink` | varchar(500) | Zoom/Teams/Google Meet link |
| `meetingType` | varchar(50) | 'video', 'audio', 'in-person' |
| `location` | varchar(255) | Physical location if in-person |
| `status` | varchar(50) | 'available', 'full', 'cancelled', 'completed', 'archived' |
| `isRecurring` | boolean | Whether slot is recurring |
| `recurrencePattern` | varchar(100) | 'daily', 'weekly', 'monthly' |
| `tags` | jsonb | Skill tags for filtering (e.g., ['javascript', 'debugging']) |
| `isPublic` | boolean | Visible to all or specific students only |
| `cancellationReason` | text | Reason if cancelled |

**Relationships:**

- References `zuvyMentorSlotManagement` (parent)
- Referenced by `zuvyMentorSlotBooking` (student bookings)

**Status Flow:**

```
available → full (when maxCapacity reached)
         → cancelled (mentor cancels)
         → completed (slot time passed)
         → archived (old slot)
```

**Indices:**

- `idx_slot_avail_mgmt_id` - Lookup by mentor
- `idx_slot_avail_start_datetime` - Upcoming slots
- `idx_slot_avail_status` - Filter by status
- `idx_slot_avail_is_public` - Filter public slots

**Key Features:**

- Capacity management (1-N students per slot)
- Recurring slot support
- Meeting link management (Zoom/Teams/Google Meet)
- Public/private slot visibility
- Skill-based tagging for student filtering

---

#### 3. **zuvy_mentor_slot_booking**

**Purpose:** Student bookings against available slots - The transaction record

**Key Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `slotAvailabilityId` | integer | FK to `zuvyMentorSlotAvailability.id` |
| `studentUserId` | bigserial | FK to `users.id` - Student booking |
| `mentorUserId` | bigserial | FK to `users.id` - Mentor (denormalized for speed) |
| `organizationId` | integer | FK to `zuvyOrganizations.id` |
| `status` | varchar(50) | 'pending', 'confirmed', 'attended', 'missed', 'cancelled', 'no-show' |
| `sessionNotes` | text | Notes from the session |
| `studentFeedback` | jsonb | Student rating/feedback |
| `mentorFeedback` | jsonb | Mentor feedback |
| `joinedAt` | timestamp | When student joined the meeting |
| `leftAt` | timestamp | When student left |
| `durationAttended` | integer | Actual duration in minutes |
| `studentRating` | integer | 1-5 star from student |
| `mentorRating` | integer | 1-5 star from mentor |
| `cancellationReason` | text | Why booking was cancelled |
| `cancelledBy` | varchar(50) | 'student' or 'mentor' |
| `cancelledAt` | timestamp | When cancelled |
| `followUpAction` | text | Action items from session |
| `bookedAt` | timestamp | When booking was made |
| `confirmedAt` | timestamp | When mentor confirmed |
| `completedAt` | timestamp | When session completed |

**Relationships:**

- References `zuvyMentorSlotAvailability` (the slot)
- References `users` (student and mentor)
- References `zuvyOrganizations` (org context)

**Status Lifecycle:**

```
pending → confirmed → attended → [completed]
       → cancelled (from pending/confirmed)
       ↓
missed/no-show (if not attended after time passed)
```

**Unique Constraints:**

- `uniqStudentSlot`: `(studentUserId, slotAvailabilityId)` - One booking per student per slot

**Indices:**

- `idx_slot_booking_slot_avail_id` - Lookup by slot
- `idx_slot_booking_student_user_id` - Student's bookings
- `idx_slot_booking_mentor_user_id` - Mentor's bookings
- `idx_slot_booking_status` - Filter by status
- `idx_slot_booking_bookedAt` - Timeline queries

**Key Features:**

- Complete booking lifecycle tracking
- Attendance verification with join/leave times
- Bidirectional feedback system
- Session note documentation
- Cancellation reasons and audit trail

---

#### 4. **zuvy_mentor_student_association**

**Purpose:** Links mentors with their associated students and manages the relationship context

**Key Columns:**
| Column | Type | Description |
|--------|------|-------------|
| `id` | serial | Primary key |
| `mentorUserId` | bigserial | FK to `users.id` - Mentor |
| `studentUserId` | bigserial | FK to `users.id` - Student |
| `organizationId` | integer | FK to `zuvyOrganizations.id` |
| `associationType` | varchar(50) | 'direct', 'batch', 'bootcamp', 'course', 'request' |
| `batchId` | integer | FK to `zuvyBatches.id` (nullable) |
| `bootcampId` | integer | FK to `zuvyBootcamps.id` (nullable) |
| `status` | varchar(50) | 'active', 'inactive', 'completed', 'promoted', 'declined', 'suspended' |
| `role` | varchar(50) | 'mentee', 'peer', 'assistant', etc. |
| `goals` | jsonb | Array of mentorship goals |
| `notes` | text | Contextual notes |
| `totalSessions` | integer | Count of slots booked |
| `totalBookedSlots` | integer | Alias for totalSessions |
| `totalAttendedSessions` | integer | Count of attended sessions |
| `averageAttendanceRate` | doublePrecision | % of sessions attended |
| `assignedAt` | timestamp | When association created |
| `startDate` | timestamp | Mentorship start date |
| `endDate` | timestamp | Mentorship end date |

**Relationships:**

- References `users` (mentor and student)
- References `zuvyOrganizations` (org context)
- References `zuvyBatches` (if batch-based)
- References `zuvyBootcamps` (if bootcamp-based)

**Association Types:**

1. **direct** - Admin directly assigns mentor to student
2. **batch** - Students in same batch get batch mentor
3. **bootcamp** - Students in bootcamp get bootcamp mentor
4. **course** - Through course enrollment
5. **request** - Student requested mentor

**Status States:**

- `active` - Currently mentoring
- `inactive` - Paused mentorship
- `completed` - Mentorship ended
- `promoted` - Student promoted to peer/leader
- `declined` - Request was rejected
- `suspended` - Temporarily suspended

**Unique Constraints:**

- `uniqMentorStudentBatch`: `(mentorUserId, studentUserId, batchId)` - One active relationship per context

**Indices:**

- `idx_assoc_mentor_user_id` - Mentor's students
- `idx_assoc_student_user_id` - Student's mentors
- `idx_assoc_association_type` - Filter by type
- `idx_assoc_status` - Filter by status
- `idx_assoc_batch_id` - Batch-based lookups
- `idx_assoc_bootcamp_id` - Bootcamp-based lookups

**Key Features:**

- Multi-channel associations (direct, batch, bootcamp, course)
- Goal tracking for mentorship
- Attendance metrics (sessions attended, attendance rate)
- Status lifecycle management
- Role-based relationships (mentee, peer, assistant)

---

## Data Relationships

### Relational Diagram

```
users (mentor)
   ↑
   │ mentorUserId
   │
zuvyMentorSlotManagement ─→ zuvyOrganizations
   │
   ├─ (has many) → zuvyMentorSlotAvailability
   │                       ↓
   │                   (has many) → zuvyMentorSlotBooking
   │                                       ↓
   │                                   users (student)
   │
   └─ (has many) → zuvyMentorStudentAssociation
                           ├─→ users (student)
                           ├─→ zuvyBatches
                           └─→ zuvyBootcamps
```

### Key Reference Points

#### Finding All Slots for a Mentor

```sql
SELECT * FROM zuvy_mentor_slot_availability
WHERE mentorSlotManagementId = (
  SELECT id FROM zuvy_mentor_slot_management
  WHERE mentorUserId = ? AND organizationId = ?
)
```

#### Finding All Students Associated with a Mentor

```sql
SELECT DISTINCT studentUserId
FROM zuvy_mentor_student_association
WHERE mentorUserId = ?
  AND organizationId = ?
  AND status = 'active'
```

#### Finding Upcoming Available Slots

```sql
SELECT * FROM zuvy_mentor_slot_availability
WHERE status = 'available'
  AND slotStartDateTime > NOW()
  AND isPublic = true
ORDER BY slotStartDateTime ASC
```

#### Finding a Student's Booking History

```sql
SELECT b.*, s.topic, s.slotStartDateTime
FROM zuvy_mentor_slot_booking b
JOIN zuvy_mentor_slot_availability s ON b.slotAvailabilityId = s.id
WHERE b.studentUserId = ?
ORDER BY s.slotStartDateTime DESC
```

#### Finding Active Mentor Relationships

```sql
SELECT m.*, u.name, u.email
FROM zuvy_mentor_student_association m
JOIN users u ON m.mentorUserId = u.id
WHERE m.studentUserId = ?
  AND m.status = 'active'
```

---

## API Development Guidelines

### 1. Slot Management APIs

#### Create Slot Availability

```
POST /api/mentor/slots/create
Request:
{
  "mentorSlotManagementId": 123,
  "slotStartDateTime": "2026-03-01T10:00:00Z",
  "slotEndDateTime": "2026-03-01T11:00:00Z",
  "topic": "JavaScript Debugging",
  "maxCapacity": 2,
  "slotType": "one-on-one",
  "meetingLink": "https://zoom.us/...",
  "tags": ["javascript", "debugging"]
}
```

#### List Available Slots

```
GET /api/mentor/slots?organizationId=X&mentorUserId=Y&status=available
GET /api/slots/public?bootcampId=X&tags=javascript
```

#### Book a Slot

```
POST /api/student/slots/book
Request:
{
  "slotAvailabilityId": 456,
  "studentUserId": 789
}
```

#### Confirm/Cancel Booking

```
PUT /api/mentor/bookings/:bookingId/confirm
PUT /api/student/bookings/:bookingId/cancel
```

---

## Data Integrity Constraints

### 1. Capacity Management

- `currentBookedCount` should never exceed `maxCapacity`
- When booking, increment `currentBookedCount`
- When cancelling, decrement `currentBookedCount`

### 2. Slot Time Validation

- `slotEndDateTime` must be after `slotStartDateTime`
- Calculate `durationMinutes` = (endTime - startTime) / 60

### 3. Mentor Slot Management Updates

- When slot is created: `totalAvailableSlots++`
- When slot is booked: nothing changes (tracking in availability)
- When slot is cancelled: `totalCancelledSlots++`
- When booking is confirmed: `totalBookedSlots++` in management

### 4. Student Association Metrics

- `totalSessions` = count of slots associated (for filtering)
- `totalBookedSlots` = count of confirmed bookings
- `totalAttendedSessions` = count of bookings with status 'attended'
- `averageAttendanceRate` = totalAttendedSessions / totalBookedSlots \* 100

---

## Best Practices for API Development

### 1. Pagination

Always paginate results for:

- List all slots
- List all bookings
- List all students for a mentor

### 2. Filters

Support filtering by:

- Status (for both slots and bookings)
- Date range (slotStartDateTime, bookedAt)
- Topic/skills (tags)
- Slot type

### 3. Error Handling

- Validate slot capacity before booking
- Check student association before allowing booking
- Verify mentor belongs to organization
- Handle timezone conversions properly

### 4. Audit Events

Log to `zuvyAuditLogs`:

- Slot creation/cancellation
- Booking confirmation/cancellation
- Status changes
- Attendance marking

---

## Sample Queries for Backend Development

### Get Mentor Dashboard Stats

```sql
SELECT
  msm.id,
  msm.totalAvailableSlots,
  msm.totalBookedSlots,
  msm.totalCancelledSlots,
  (SELECT COUNT(*) FROM zuvy_mentor_slot_booking
   WHERE mentorUserId = msm.mentorUserId
   AND status = 'attended') as attendedSessions,
  (SELECT COUNT(DISTINCT studentUserId)
   FROM zuvy_mentor_student_association
   WHERE mentorUserId = msm.mentorUserId
   AND status = 'active') as activeStudents
FROM zuvy_mentor_slot_management msm
WHERE msm.organizationId = ?
```

### Get Student's Slot History

```sql
SELECT
  b.id,
  b.status,
  s.topic,
  s.slotStartDateTime,
  s.slotEndDateTime,
  b.studentRating,
  b.mentorRating,
  b.sessionNotes
FROM zuvy_mentor_slot_booking b
JOIN zuvy_mentor_slot_availability s ON b.slotAvailabilityId = s.id
WHERE b.studentUserId = ?
ORDER BY s.slotStartDateTime DESC
```

### Find Mentors by Availability

```sql
SELECT DISTINCT msm.*
FROM zuvy_mentor_slot_management msm
WHERE msm.organizationId = ?
  AND msm.status = 'active'
  AND msm.acceptsNewMentees = true
  AND msm.isVerified = true
ORDER BY msm.totalBookedSlots DESC
```

---

## Integration with Existing Tables

### With zuvyBatchEnrollments

- When student enrolls in batch, can auto-create association with batch instructor
- Use `associationType = 'batch'` and reference `zuvyBatches.instructorId`

### With zuvyBootcamps

- Bootcamp can have default mentors
- Auto-create associations for enrolled students

### With zuvyUserRolesAssigned

- Check mentor's role to determine if eligible for mentor profile
- Roles: 'instructor', 'mentor', 'admin', 'ops'

### With zuvyAuditLogs

- Log all slot/booking changes for compliance
- Track who made changes and when

---

## Future Enhancements

1. **Notifications**

   - Student: Slot booked, confirmed, reminder before
   - Mentor: New booking, student rescheduled

2. **Reschedule Logic**

   - Move booking from one slot to another
   - Track reschedule history

3. **Performance Analytics**

   - Student learning outcomes
   - Mentor effectiveness metrics
   - Engagement trends

4. **Integration**

   - Zoom/Google Meet auto-create meetings
   - Calendar sync (Google Calendar, Outlook)
   - Email reminders

5. **Advanced Features**
   - Waitlist management for full slots
   - Group booking (multiple students for group slots)
   - Priority booking for struggling students
   - Mentor substitution/backup handling

---

## Testing Recommendations

### Unit Tests

- Slot capacity validation
- Time calculation (duration, timezone)
- Status transitions
- Constraint checking (unique, foreign keys)

### Integration Tests

- Create mentor → Create slots → Book slot → Complete session
- Multiple students booking same slot
- Cancellation cascade effects
- Mentor assignment through different channels

### E2E Tests

- Full booking workflow
- Dashboard access and updates
- Notification triggers
- Reporting and analytics
