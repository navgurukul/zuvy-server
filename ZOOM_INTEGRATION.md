# Zoom Integration Guide

## Overview
The LMS now supports both Google Meet and Zoom for live classes. You can choose which platform to use when creating sessions.

## Setup

### Environment Variables
Add these environment variables to your `.env` file:

```env
# Zoom API Configuration
ZOOM_ACCESS_TOKEN=your_zoom_access_token_here
```

### Getting Zoom Access Token
1. Go to [Zoom Marketplace](https://marketplace.zoom.us/)
2. Create a Server-to-Server OAuth app
3. Get your access token from the app credentials

## Usage

### Creating Classes

#### Option 1: Using the main endpoint with useZoom flag
```typescript
POST /classes/
{
  "title": "Advanced JavaScript Session",
  "description": "Deep dive into JS concepts",
  "startDateTime": "2024-07-21T10:00:00Z",
  "endDateTime": "2024-07-21T11:00:00Z",
  "timeZone": "Asia/Kolkata",
  "batchId": 1,
  "moduleId": 1,
  "useZoom": true,  // Set to true for Zoom, false/omit for Google Meet
  "daysOfWeek": ["Monday", "Wednesday", "Friday"],
  "totalClasses": 10
}
```

#### Option 2: Using dedicated Zoom endpoint
```typescript
POST /classes/zoom
{
  "title": "Advanced JavaScript Session",
  "description": "Deep dive into JS concepts", 
  "startDateTime": "2024-07-21T10:00:00Z",
  "endDateTime": "2024-07-21T11:00:00Z",
  "timeZone": "Asia/Kolkata",
  "batchId": 1,
  "moduleId": 1,
  "daysOfWeek": ["Monday", "Wednesday", "Friday"],
  "totalClasses": 10
}
```

### Managing Zoom Sessions

#### Delete Zoom Session
```typescript
DELETE /classes/zoom/delete/{meetingId}
```

#### Update Zoom Session
```typescript
PATCH /classes/zoom/update/{meetingId}
{
  "title": "Updated Session Title",
  "description": "Updated description"
}
```

#### Get Zoom Attendance
```typescript
GET /classes/zoom/attendance/{meetingId}
```

#### Get Zoom Analytics
```typescript
GET /classes/zoom/analytics/{sessionId}
```

## Features

### Recurring Sessions
- Supports weekly recurring sessions
- Specify days of the week: ["Monday", "Wednesday", "Friday"]
- Set total number of classes

### Attendance Tracking
- Automatic attendance calculation based on duration
- 75% duration threshold for marking present
- Integration with student enrollment data

### Recording Management
- Automatic recording detection
- Recording links stored in database
- Analytics include recording information

## Database Schema

The system automatically stores Zoom-specific data:
- `meetingType`: 'zoom' or 'google_meet'
- `zoomMeetingId`: Zoom meeting ID
- `zoomJoinUrl`: Join URL for students
- `zoomStartUrl`: Start URL for instructors
- `zoomPassword`: Meeting password (if set)

## API Responses

### Success Response
```json
{
  "status": "success",
  "message": "Created Zoom Classes successfully",
  "code": 200,
  "savedClassDetail": [...]
}
```

### Error Response
```json
{
  "status": "error", 
  "message": "Error message here",
  "code": 400
}
```

## Security

- Only admin users can create/update/delete sessions
- Zoom API calls are authenticated using server-to-server OAuth
- Meeting passwords automatically generated for security

## Troubleshooting

### Common Issues

1. **"Failed to create Zoom meeting"**
   - Check ZOOM_ACCESS_TOKEN is valid
   - Verify Zoom app has meeting creation permissions

2. **"No admin role"**
   - User must have admin role to create classes
   - Check user roles in database

3. **"Batch/Module not found"**
   - Verify batchId and moduleId exist in database
   - Check enrollment data

### Logs
Check application logs for detailed error messages:
```bash
npm run start:dev
```

## Migration from Google Meet

Existing Google Meet sessions remain unchanged. New sessions can use either platform based on the `useZoom` flag or endpoint choice.
