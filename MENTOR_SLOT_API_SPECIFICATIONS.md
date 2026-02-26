# Mentor Slot Management System - API Specifications Guide

## Overview

This document provides API endpoint specifications for the Mentor Slot Management System. Use this as a reference for backend API development.

---

## 1. MENTOR SLOT MANAGEMENT ENDPOINTS

### 1.1 Create/Update Mentor Profile

**POST** `/api/v1/mentor/profile`

**Request:**

```json
{
  "mentorUserId": 123,
  "organizationId": 1,
  "mentorType": "instructor",
  "title": "Senior Full Stack Developer",
  "expertise": ["JavaScript", "TypeScript", "React", "NodeJS"],
  "bio": "10+ years of experience in web development",
  "acceptsNewMentees": true,
  "status": "active"
}
```

**Response (201 Created):**

```json
{
  "id": 45,
  "mentorUserId": 123,
  "organizationId": 1,
  "mentorType": "instructor",
  "title": "Senior Full Stack Developer",
  "expertise": ["JavaScript", "TypeScript", "React", "NodeJS"],
  "bio": "10+ years of experience in web development",
  "status": "active",
  "totalAvailableSlots": 0,
  "totalBookedSlots": 0,
  "totalCancelledSlots": 0,
  "acceptsNewMentees": true,
  "isVerified": false,
  "createdAt": "2026-02-23T10:30:00Z",
  "updatedAt": "2026-02-23T10:30:00Z"
}
```

**Errors:**

- `400` - Invalid request data
- `403` - User not authorized (not mentor/instructor/admin)
- `409` - Mentor profile already exists for this org

---

### 1.2 Get Mentor Profile

**GET** `/api/v1/mentor/profile/:mentorUserId/:organizationId`

**Response (200 OK):**

```json
{
  "id": 45,
  "mentorUserId": 123,
  "organizationId": 1,
  "mentorType": "instructor",
  "title": "Senior Full Stack Developer",
  "expertise": ["JavaScript", "TypeScript", "React", "NodeJS"],
  "bio": "10+ years of experience",
  "status": "active",
  "totalAvailableSlots": 10,
  "totalBookedSlots": 7,
  "totalCancelledSlots": 1,
  "acceptsNewMentees": true,
  "isVerified": true,
  "mentor": {
    "id": 123,
    "name": "John Developer",
    "email": "john@zuvy.io",
    "profilePicture": "https://..."
  },
  "stats": {
    "upcomingSlots": 5,
    "activeStudents": 8,
    "avgRating": 4.8,
    "totalSessions": 45
  }
}
```

---

### 1.3 List Mentors by Organization

**GET** `/api/v1/organization/:organizationId/mentors`

**Query Parameters:**

```
?status=active
?expertise=javascript,react
?isVerified=true
?acceptsNewMentees=true
?page=1&limit=20
?sortBy=totalBookedSlots&order=desc
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 45,
      "mentorUserId": 123,
      "name": "John Developer",
      "title": "Senior Full Stack Developer",
      "expertise": ["JavaScript", "React"],
      "status": "active",
      "totalBookedSlots": 7,
      "upcomingSlots": 5,
      "avgRating": 4.8,
      "acceptsNewMentees": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "pages": 3
  }
}
```

---

## 2. SLOT AVAILABILITY ENDPOINTS

### 2.1 Create Slot Availability

**POST** `/api/v1/mentor/slots`

**Request:**

```json
{
  "mentorSlotManagementId": 45,
  "slotStartDateTime": "2026-03-01T10:00:00Z",
  "slotEndDateTime": "2026-03-01T11:00:00Z",
  "topic": "JavaScript Async/Await Deep Dive",
  "description": "In-depth discussion about async programming patterns",
  "maxCapacity": 2,
  "slotType": "one-on-one",
  "meetingType": "video",
  "meetingLink": "https://zoom.us/j/123456789",
  "tags": ["javascript", "async", "advanced"],
  "isPublic": true,
  "isRecurring": false
}
```

**Response (201 Created):**

```json
{
  "id": 1023,
  "mentorSlotManagementId": 45,
  "slotStartDateTime": "2026-03-01T10:00:00Z",
  "slotEndDateTime": "2026-03-01T11:00:00Z",
  "durationMinutes": 60,
  "topic": "JavaScript Async/Await Deep Dive",
  "description": "In-depth discussion about async programming patterns",
  "maxCapacity": 2,
  "currentBookedCount": 0,
  "slotType": "one-on-one",
  "meetingType": "video",
  "meetingLink": "https://zoom.us/j/123456789",
  "tags": ["javascript", "async", "advanced"],
  "status": "available",
  "isPublic": true,
  "isRecurring": false,
  "createdAt": "2026-02-23T10:30:00Z",
  "updatedAt": "2026-02-23T10:30:00Z"
}
```

**Errors:**

- `400` - Invalid time range (end before start)
- `403` - Mentor not authorized
- `404` - Mentor slot management not found

---

### 2.2 List Slots (Multiple Queries Supported)

**GET** `/api/v1/mentor/slots`

**Query Parameters:**

```
?mentorSlotManagementId=45           # Mentor's slots
?organizationId=1&status=available    # Org-wide available slots
?topic=javascript                     # Filter by topic
?tags=debugging,performance           # Filter by tags
?startDate=2026-03-01                # Date range
?endDate=2026-03-31
?isPublic=true                        # Public slots only
?slotType=one-on-one                 # Type filter
?page=1&limit=20
?sortBy=slotStartDateTime&order=asc
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 1023,
      "topic": "JavaScript Async/Await Deep Dive",
      "slotStartDateTime": "2026-03-01T10:00:00Z",
      "slotEndDateTime": "2026-03-01T11:00:00Z",
      "durationMinutes": 60,
      "maxCapacity": 2,
      "currentBookedCount": 1,
      "status": "available",
      "slotType": "one-on-one",
      "meetingType": "video",
      "tags": ["javascript", "async"],
      "mentor": {
        "name": "John Developer",
        "expertise": ["JavaScript", "React"]
      },
      "spotsAvailable": 1
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
```

---

### 2.3 Update Slot

**PUT** `/api/v1/mentor/slots/:slotId`

**Request:**

```json
{
  "topic": "Updated Topic",
  "description": "Updated description",
  "meetingLink": "https://zoom.us/j/updated",
  "tags": ["updated", "tags"],
  "maxCapacity": 3
}
```

**Response (200 OK):**

```json
{
  "id": 1023,
  "topic": "Updated Topic",
  "description": "Updated description",
  "meetingLink": "https://zoom.us/j/updated",
  "tags": ["updated", "tags"],
  "maxCapacity": 3,
  "updatedAt": "2026-02-23T11:00:00Z"
}
```

---

### 2.4 Cancel Slot

**DELETE** `/api/v1/mentor/slots/:slotId`

**Request:**

```json
{
  "cancellationReason": "Schedule conflict"
}
```

**Response (200 OK):**

```json
{
  "id": 1023,
  "status": "cancelled",
  "cancellationReason": "Schedule conflict",
  "cancelledAt": "2026-02-23T11:00:00Z",
  "affectedBookings": 2
}
```

---

## 3. SLOT BOOKING ENDPOINTS

### 3.1 Book a Slot (Student)

**POST** `/api/v1/student/slots/book`

**Request:**

```json
{
  "slotAvailabilityId": 1023,
  "studentUserId": 456,
  "note": "Looking forward to learning about async patterns"
}
```

**Response (201 Created):**

```json
{
  "id": 5001,
  "slotAvailabilityId": 1023,
  "studentUserId": 456,
  "mentorUserId": 123,
  "organizationId": 1,
  "status": "pending",
  "slot": {
    "topic": "JavaScript Async/Await Deep Dive",
    "slotStartDateTime": "2026-03-01T10:00:00Z",
    "slotEndDateTime": "2026-03-01T11:00:00Z",
    "meetingLink": "https://zoom.us/j/123456789"
  },
  "mentor": {
    "name": "John Developer",
    "email": "john@zuvy.io"
  },
  "bookedAt": "2026-02-23T10:30:00Z"
}
```

**Errors:**

- `400` - Invalid slot ID or student ID
- `403` - Student not authorized or not associated with mentor
- `409` - Slot full or already booked by student
- `410` - Slot is in the past or cancelled

---

### 3.2 Confirm Booking (Mentor)

**PUT** `/api/v1/mentor/bookings/:bookingId/confirm`

**Response (200 OK):**

```json
{
  "id": 5001,
  "status": "confirmed",
  "confirmedAt": "2026-02-23T11:00:00Z",
  "student": {
    "name": "Jane Student",
    "email": "jane@zuvy.io"
  }
}
```

---

### 3.3 Cancel Booking

**DELETE** `/api/v1/bookings/:bookingId`

**Query Parameters:**

```
?cancelledBy=student  # or 'mentor'
```

**Request:**

```json
{
  "cancellationReason": "Cannot attend due to personal reasons"
}
```

**Response (200 OK):**

```json
{
  "id": 5001,
  "status": "cancelled",
  "cancelledBy": "student",
  "cancellationReason": "Cannot attend due to personal reasons",
  "cancelledAt": "2026-02-23T11:00:00Z"
}
```

---

### 3.4 Reschedule Booking

**PUT** `/api/v1/bookings/:bookingId/reschedule`

**Request:**

```json
{
  "newSlotId": 1024,
  "reason": "Time conflict"
}
```

**Response (200 OK):**

```json
{
  "id": 5001,
  "status": "confirmed",
  "slotAvailabilityId": 1024,
  "oldSlotId": 1023,
  "slot": {
    "slotStartDateTime": "2026-03-02T15:00:00Z",
    "topic": "New slot topic"
  },
  "rescheduledAt": "2026-02-23T11:00:00Z"
}
```

---

### 3.5 Get Booking Details

**GET** `/api/v1/bookings/:bookingId`

**Response (200 OK):**

```json
{
  "id": 5001,
  "status": "confirmed",
  "slot": {
    "id": 1023,
    "topic": "JavaScript Async/Await Deep Dive",
    "slotStartDateTime": "2026-03-01T10:00:00Z",
    "slotEndDateTime": "2026-03-01T11:00:00Z",
    "meetingLink": "https://zoom.us/j/123456789"
  },
  "student": {
    "id": 456,
    "name": "Jane Student",
    "email": "jane@zuvy.io"
  },
  "mentor": {
    "id": 123,
    "name": "John Developer",
    "email": "john@zuvy.io"
  },
  "joinedAt": null,
  "leftAt": null,
  "durationAttended": null,
  "studentRating": null,
  "mentorRating": null,
  "sessionNotes": null,
  "bookedAt": "2026-02-23T10:30:00Z",
  "confirmedAt": "2026-02-23T11:00:00Z",
  "completedAt": null
}
```

---

### 3.6 List Student's Bookings

**GET** `/api/v1/student/:studentUserId/bookings`

**Query Parameters:**

```
?status=upcoming    # 'upcoming', 'past', 'attended', 'cancelled', 'all'
?page=1&limit=20
?sortBy=slotStartDateTime&order=desc
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 5001,
      "status": "confirmed",
      "slotStartDateTime": "2026-03-01T10:00:00Z",
      "topic": "JavaScript Async/Await Deep Dive",
      "mentor": {
        "name": "John Developer",
        "avgRating": 4.8
      },
      "timeUntilSlot": "6 days"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 12
  }
}
```

---

### 3.7 Mark Attendance

**POST** `/api/v1/bookings/:bookingId/attend`

**Request:**

```json
{
  "joinedAt": "2026-03-01T10:00:00Z"
}
```

**Response (200 OK):**

```json
{
  "id": 5001,
  "status": "attended",
  "joinedAt": "2026-03-01T10:00:00Z",
  "leftAt": null,
  "durationAttended": null
}
```

---

### 3.8 Mark Departure & Complete Session

**POST** `/api/v1/bookings/:bookingId/complete`

**Request:**

```json
{
  "leftAt": "2026-03-01T11:05:00Z",
  "sessionNotes": "Covered async/await, Promises, callbacks",
  "status": "attended"
}
```

**Response (200 OK):**

```json
{
  "id": 5001,
  "status": "attended",
  "joinedAt": "2026-03-01T10:00:00Z",
  "leftAt": "2026-03-01T11:05:00Z",
  "durationAttended": 65,
  "sessionNotes": "Covered async/await, Promises, callbacks",
  "completedAt": "2026-03-01T11:05:00Z"
}
```

---

### 3.9 Submit Booking Feedback

**POST** `/api/v1/bookings/:bookingId/feedback`

**Request (from Student):**

```json
{
  "rating": 5,
  "feedback": {
    "rating": 5,
    "comment": "Excellent mentor, very clear explanations",
    "helpfulness": 10,
    "wouldBookAgain": true,
    "suggestedTopics": ["advanced patterns", "performance optimization"]
  }
}
```

**Request (from Mentor):**

```json
{
  "rating": 4,
  "feedback": {
    "studentPreparation": "good",
    "studentEngagement": "excellent",
    "understandingLevel": "intermediate",
    "recommendations": "Focus on practice projects",
    "nextTopics": ["design patterns", "error handling"]
  }
}
```

**Response (200 OK):**

```json
{
  "id": 5001,
  "studentRating": 5,
  "mentorRating": 4,
  "studentFeedback": { ... },
  "mentorFeedback": { ... },
  "updatedAt": "2026-03-02T11:00:00Z"
}
```

---

## 4. MENTOR-STUDENT ASSOCIATION ENDPOINTS

### 4.1 Create Association

**POST** `/api/v1/mentor-student/associate`

**Request:**

```json
{
  "mentorUserId": 123,
  "studentUserId": 456,
  "organizationId": 1,
  "associationType": "direct",
  "batchId": null,
  "bootcampId": null,
  "role": "mentee",
  "goals": [
    {
      "goal": "Master JavaScript fundamentals",
      "priority": "high",
      "targetDate": "2026-06-30"
    }
  ],
  "notes": "Directly assigned by admin"
}
```

**Response (201 Created):**

```json
{
  "id": 7001,
  "mentorUserId": 123,
  "studentUserId": 456,
  "organizationId": 1,
  "associationType": "direct",
  "role": "mentee",
  "status": "active",
  "goals": [
    {
      "goal": "Master JavaScript fundamentals",
      "priority": "high",
      "targetDate": "2026-06-30",
      "progress": 0
    }
  ],
  "totalSessions": 0,
  "totalAttendedSessions": 0,
  "assignedAt": "2026-02-23T10:30:00Z",
  "startDate": "2026-02-23",
  "endDate": null,
  "createdAt": "2026-02-23T10:30:00Z"
}
```

---

### 4.2 Get Association

**GET** `/api/v1/mentor-student/association/:associationId`

**Response (200 OK):**

```json
{
  "id": 7001,
  "mentor": {
    "id": 123,
    "name": "John Developer",
    "email": "john@zuvy.io",
    "expertise": ["JavaScript", "React"]
  },
  "student": {
    "id": 456,
    "name": "Jane Student",
    "email": "jane@zuvy.io"
  },
  "associationType": "direct",
  "role": "mentee",
  "status": "active",
  "goals": [],
  "notes": "Directly assigned by admin",
  "stats": {
    "totalSessions": 5,
    "totalAttendedSessions": 4,
    "attendanceRate": 80,
    "lastSessionDate": "2026-02-20"
  },
  "assignedAt": "2026-02-23T10:30:00Z",
  "startDate": "2026-02-23",
  "endDate": null
}
```

---

### 4.3 List Student's Mentors

**GET** `/api/v1/student/:studentUserId/mentors`

**Query Parameters:**

```
?status=active      # 'active', 'inactive', 'completed', 'all'
?organizationId=1
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 7001,
      "mentor": {
        "name": "John Developer",
        "email": "john@zuvy.io",
        "title": "Senior Developer",
        "expertise": ["JavaScript", "React"],
        "avgRating": 4.8
      },
      "associationType": "direct",
      "role": "mentee",
      "status": "active",
      "stats": {
        "totalSessions": 5,
        "attendanceRate": 80
      }
    }
  ]
}
```

---

### 4.4 List Mentor's Students

**GET** `/api/v1/mentor/:mentorUserId/students`

**Query Parameters:**

```
?status=active
?organizationId=1
?associationType=batch
?page=1&limit=20
```

**Response (200 OK):**

```json
{
  "data": [
    {
      "id": 7001,
      "student": {
        "name": "Jane Student",
        "email": "jane@zuvy.io",
        "batchName": "Batch A"
      },
      "associationType": "batch",
      "status": "active",
      "totalSessions": 5,
      "totalAttendedSessions": 4,
      "attendanceRate": 80
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 15
  }
}
```

---

### 4.5 Update Association

**PUT** `/api/v1/mentor-student/association/:associationId`

**Request:**

```json
{
  "status": "active",
  "role": "mentor",
  "goals": [
    {
      "goal": "Master async patterns",
      "progress": 50
    }
  ],
  "notes": "Progressing well, ready for advanced topics"
}
```

**Response (200 OK):**

```json
{
  "id": 7001,
  "status": "active",
  "role": "mentor",
  "goals": [ ... ],
  "notes": "Progressing well, ready for advanced topics",
  "updatedAt": "2026-02-23T11:00:00Z"
}
```

---

### 4.6 End Association

**DELETE** `/api/v1/mentor-student/association/:associationId`

**Request:**

```json
{
  "reason": "Mentorship period completed",
  "newStatus": "completed"
}
```

**Response (200 OK):**

```json
{
  "id": 7001,
  "status": "completed",
  "endDate": "2026-02-23",
  "reason": "Mentorship period completed",
  "finalStats": {
    "totalSessions": 12,
    "totalAttendedSessions": 11,
    "attendanceRate": 92,
    "mentorFinalRating": 5,
    "studentFinalRating": 5
  }
}
```

---

## 5. DASHBOARD & ANALYTICS ENDPOINTS

### 5.1 Mentor Dashboard

**GET** `/api/v1/mentor/:mentorUserId/dashboard`

**Query Parameters:**

```
?organizationId=1
?dateRange=month  # 'week', 'month', 'quarter', 'year'
```

**Response (200 OK):**

```json
{
  "profile": {
    "name": "John Developer",
    "avgRating": 4.8,
    "status": "active"
  },
  "slots": {
    "totalCreated": 20,
    "available": 5,
    "full": 3,
    "cancelled": 2,
    "completed": 10
  },
  "bookings": {
    "total": 15,
    "confirmed": 12,
    "attended": 10,
    "missed": 1,
    "cancelled": 2
  },
  "students": {
    "totalAssociated": 8,
    "active": 6,
    "completed": 2
  },
  "engagement": {
    "totalHoursMentored": 12.5,
    "avgSessionDuration": 60,
    "upcomingSlots": 3,
    "pendingBookings": 1
  },
  "trends": {
    "bookingsThisMonth": 5,
    "avgStudentRating": 4.7,
    "attendanceRate": 87
  }
}
```

---

### 5.2 Student Learning Dashboard

**GET** `/api/v1/student/:studentUserId/learning-dashboard`

**Response (200 OK):**

```json
{
  "profile": {
    "name": "Jane Student",
    "currentBatch": "Batch A"
  },
  "mentors": {
    "active": 2,
    "completed": 1
  },
  "upcomingSessions": [
    {
      "id": 5001,
      "topic": "Async JavaScript",
      "mentorName": "John Developer",
      "dateTime": "2026-03-01T10:00:00Z",
      "status": "confirmed"
    }
  ],
  "pastSessions": [
    {
      "id": 5000,
      "topic": "JavaScript Fundamentals",
      "mentorName": "John Developer",
      "dateTime": "2026-02-20T10:00:00Z",
      "duration": 60,
      "rating": 5,
      "attended": true
    }
  ],
  "stats": {
    "totalSessions": 12,
    "sessionsAttended": 10,
    "attendanceRate": 83,
    "avgMentorRating": 4.8
  }
}
```

---

### 5.3 Organization Analytics

**GET** `/api/v1/organization/:organizationId/analytics`

**Query Parameters:**

```
?dateRange=month
?groupBy=mentor  # 'mentor', 'batch', 'bootcamp'
```

**Response (200 OK):**

```json
{
  "summary": {
    "totalMentors": 12,
    "totalStudents": 145,
    "totalSlots": 250,
    "totalBookings": 180,
    "avgAttendanceRate": 85
  },
  "byMentor": [
    {
      "mentorName": "John Developer",
      "slotsCreated": 20,
      "bookingsReceived": 18,
      "attendanceRate": 89,
      "avgStudentRating": 4.8
    }
  ],
  "trends": {
    "bookingsGrowth": 15,
    "attendanceRateTrend": 2
  }
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {},
    "timestamp": "2026-02-23T11:00:00Z"
  }
}
```

### Common Error Codes

- `VALIDATION_ERROR` - Invalid request data
- `NOT_FOUND` - Resource not found
- `UNAUTHORIZED` - Not authenticated
- `FORBIDDEN` - Not authorized for this action
- `CONFLICT` - Resource already exists
- `CAPACITY_FULL` - Slot is at max capacity
- `INVALID_STATUS_TRANSITION` - Cannot transition to that status
- `SLOT_IN_PAST` - Cannot book past slots
- `MENTOR_STUDENT_NOT_ASSOCIATED` - Student not associated with mentor

---

## Rate Limiting

API endpoints are rate-limited:

- `100 requests/minute` for authenticated users
- `10 requests/minute` for unauthenticated requests

Headers returned:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1645624860
```

---

## Authentication

All endpoints require JWT token in Authorization header:

```
Authorization: Bearer <JWT_TOKEN>
```

---

## Pagination

List endpoints support pagination:

```
?page=1&limit=20&sortBy=createdAt&order=desc
```

---
