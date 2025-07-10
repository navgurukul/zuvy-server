# Zoom Integration Guide

## Overview

The Zuvy LMS now supports both Google Meet and Zoom for live classes. This integration uses a hybrid approach where:

1. **Google Calendar** handles the scheduling and student invitations
2. **Zoom** provides the meeting platform and recording capabilities
3. **Database** stores both Google Calendar event IDs and Zoom meeting details

## Setup Requirements

### Environment Variables
Add these to your `.env` file:
```env
ZOOM_ACCESS_TOKEN=your_zoom_access_token_here
```

### Database Schema
The `zuvySessions` table includes these Zoom-specific fields:
- `meetingType`: 'google_meet' or 'zoom'
- `zoomMeetingId`: Zoom meeting ID
- `zoomJoinUrl`: Zoom join URL for students
- `zoomStartUrl`: Zoom start URL for hosts
- `zoomPassword`: Zoom meeting password (if required)

## API Endpoints

### 1. Create Zoom Session
```http
POST /classes/zoom
```

**Request Body:**
```json
{
  "title": "Python Programming Class",
  "description": "Introduction to Python basics",
  "startDateTime": "2025-07-10T10:00:00Z",
  "endDateTime": "2025-07-10T11:00:00Z",
  "timeZone": "Asia/Kolkata",
  "batchId": 1,
  "moduleId": 2,
  "daysOfWeek": ["Monday", "Wednesday", "Friday"],
  "totalClasses": 10
}
```

### 2. Update Zoom Session
```http
PATCH /classes/zoom/update/{meetingId}
```

### 3. Delete Zoom Session
```http
DELETE /classes/zoom/delete/{meetingId}
```

### 4. Get Zoom Attendance
```http
GET /classes/zoom/attendance/{meetingId}
```

### 5. Get Zoom Analytics
```http
GET /classes/zoom/analytics/{sessionId}
```

## Using the Unified Create Endpoint

You can also use the main create endpoint with the `useZoom` flag:

```http
POST /classes/
```

**Request Body:**
```json
{
  "title": "Math Class",
  "startDateTime": "2025-07-10T10:00:00Z",
  "endDateTime": "2025-07-10T11:00:00Z",
  "timeZone": "Asia/Kolkata",
  "batchId": 1,
  "moduleId": 2,
  "useZoom": true,
  "daysOfWeek": ["Monday"],
  "totalClasses": 1
}
```

## How It Works

### Session Creation Process

1. **Validation**: Check admin permissions, validate batch/module
2. **Chapter Creation**: Create a course chapter for the live class
3. **Student Emails**: Fetch enrolled student emails
4. **Zoom Meeting**: Create Zoom meeting via Zoom API
5. **Google Calendar Event**: Create calendar event with Zoom details
6. **Database Storage**: Save session with both Google and Zoom IDs

### Key Features

- **Calendar Integration**: Students receive calendar invites with Zoom links
- **Automatic Invitations**: All enrolled students are automatically invited
- **Recording Support**: Zoom cloud recordings are automatically enabled
- **Attendance Tracking**: Uses Zoom's participant reports for attendance
- **Recurring Classes**: Supports weekly recurring patterns

### Data Flow

```
Admin creates Zoom session → 
Zoom API creates meeting → 
Google Calendar creates event with Zoom link → 
Students get calendar invite → 
Session data saved to database
```

## Attendance Tracking

Zoom attendance uses participant duration data:
- Fetches participant reports from Zoom API
- Calculates attendance based on 75% duration threshold
- Marks students as present/absent automatically

## Recording Management

- Zoom cloud recordings are automatically enabled
- Recordings are accessible through Zoom API
- Recording links are included in analytics endpoints

## Error Handling

The integration includes comprehensive error handling for:
- Missing Zoom access tokens
- Failed API calls to Zoom
- Google Calendar authentication issues
- Database transaction failures

## Migration Notes

Existing Google Meet classes remain unchanged. New classes can choose between:
- Google Meet (default, `useZoom: false`)
- Zoom (`useZoom: true` or use specific Zoom endpoints)

Both systems work independently and can coexist in the same LMS instance.
