# LMS Backend Refactoring: Schema and API Changes Documentation

## Overview
This document outlines all the changes made to the existing database schema and APIs during the Zoom integration refactoring. The goal was to unify Zoom and Google Meet session management under a single set of endpoints while maintaining backward compatibility.

## 🗄️ Database Schema Changes

### Table: `zuvy_sessions`

#### New Fields Added
```sql
-- Meeting type and Zoom-specific fields
is_zoom_meet BOOLEAN DEFAULT true,           -- true for Zoom, false for Google Meet
zoom_start_url TEXT,                         -- Admin start URL for Zoom meetings
zoom_password TEXT,                          -- Meeting password for Zoom
zoom_meeting_id TEXT                         -- Zoom-specific meeting ID
```

#### Field Purpose
| Field | Type | Purpose | Example |
|-------|------|---------|---------|
| `is_zoom_meet` | boolean | Determines the meeting platform | `true` = Zoom, `false` = Google Meet |
| `zoom_start_url` | text | Admin/host start URL for Zoom | `https://zoom.us/s/123?zak=xyz` |
| `zoom_password` | text | Meeting password for security | `abcd1234` |
| `zoom_meeting_id` | text | Zoom-specific meeting identifier | `123456789` |

#### Existing Fields (No Changes)
- `id` - Primary key
- `meeting_id` - Google Calendar event ID or general meeting ID
- `hangout_link` - Google Meet link or Zoom join URL
- `title`, `description`, `start_time`, `end_time` - Session details
- `batch_id`, `module_id`, `bootcamp_id` - Relationships
- `creator`, `status` - Session metadata

## 🔄 API Changes

### 1. Session Creation Endpoint

#### Endpoint
```
POST /classes/
```

#### Request Payload Changes

**BEFORE:**
```json
{
  "title": "Python Class",
  "startDateTime": "2024-07-21T10:00:00Z",
  "endDateTime": "2024-07-21T11:00:00Z",
  "timeZone": "Asia/Kolkata",
  "batchId": 1,
  "moduleId": 2,
  "daysOfWeek": ["Monday"],
  "totalClasses": 5
}
```

**AFTER:**
```json
{
  "title": "Python Class",
  "startDateTime": "2024-07-21T10:00:00Z",
  "endDateTime": "2024-07-21T11:00:00Z",
  "timeZone": "Asia/Kolkata",
  "batchId": 1,
  "moduleId": 2,
  "daysOfWeek": ["Monday"],
  "totalClasses": 5,
  "isZoomMeet": true  // NEW: Platform selection (default: true)
}
```

#### Response Changes

**Google Meet Response:**
```json
{
  "status": "success",
  "message": "5 Google Meet sessions created successfully",
  "data": [
    {
      "id": 123,
      "meetingId": "google_calendar_event_id",
      "hangoutLink": "https://meet.google.com/abc-defg-hij",
      "isZoomMeet": false,
      "title": "Python Class - Class 1",
      // ...other fields
    }
  ]
}
```

**Zoom Response:**
```json
{
  "status": "success",
  "message": "Zoom session created successfully",
  "data": [
    {
      "id": 124,
      "meetingId": "123456789",
      "zoomMeetingId": "123456789",
      "hangoutLink": "https://zoom.us/j/123456789?pwd=abcd",
      "zoomStartUrl": "https://zoom.us/s/123456789?zak=xyz",
      "zoomPassword": "abcd1234",
      "isZoomMeet": true,
      "title": "Python Class",
      // ...other fields
    }
  ]
}
```

### 2. Session Retrieval Endpoints

#### Role-Based Access Control Added

**Admin Users:**
- Get full session data including `zoomStartUrl`
- Can see all Zoom administrative links

**Regular Users:**
- Get session data with `hangoutLink` only
- `zoomStartUrl` is filtered out for security

#### Example Responses

**Admin Response:**
```json
{
  "id": 123,
  "title": "Math Class",
  "hangoutLink": "https://zoom.us/j/123456789",
  "zoomStartUrl": "https://zoom.us/s/123456789?zak=admin",
  "zoomPassword": "password123",
  "isZoomMeet": true
}
```

**Student Response:**
```json
{
  "id": 123,
  "title": "Math Class", 
  "hangoutLink": "https://zoom.us/j/123456789",
  "isZoomMeet": true
  // zoomStartUrl filtered out
}
```

### 3. Session Update Endpoint

#### Enhanced Integration
```
PUT /sessions/:id
```

**New Behavior:**
- Automatically detects platform based on `isZoomMeet` flag in database
- Updates both database record AND external platform (Zoom/Google Calendar)
- Graceful degradation if external API fails

**Example Request:**
```json
{
  "title": "Updated Python Class",
  "startDateTime": "2024-07-21T11:00:00Z",
  "endDateTime": "2024-07-21T12:00:00Z"
}
```

### 4. Session Deletion Endpoint

#### Enhanced Cleanup
```
DELETE /sessions/:id
```

**New Behavior:**
- Detects platform and cleans up external resources
- For Zoom: Deletes Zoom meeting via API
- For Google Meet: Deletes Google Calendar event
- Removes database records and related attendance data
- Continues with database cleanup even if external API fails

### 5. Attendance Endpoints

#### New Zoom Attendance Endpoints
```
POST /sessions/:id/fetch-attendance    # Manual Zoom attendance fetch
POST /process-attendance               # Bulk attendance processing
```

#### Automatic Processing
- **Cron Job**: Runs every 30 minutes for completed Zoom sessions
- **Data Storage**: Stores participant join/leave times, duration
- **Integration**: Updates student attendance counts automatically

## 🔧 Service Layer Changes

### ClassesService Enhancements

#### New Methods Added
```typescript
// Core session management
async createSession(eventDetails, creatorInfo)         // Unified entry point
async createZoomSession(eventDetails, creatorInfo)     // Zoom-specific creation
async createGoogleMeetSession(eventDetails, creatorInfo) // Google Meet creation

// Session operations with platform detection
async updateSession(sessionId, updateData, userInfo)   // Enhanced update
async deleteSession(sessionId, userInfo)               // Enhanced deletion
async getSession(sessionId, userInfo)                  // Role-based retrieval

// Attendance processing
async fetchZoomAttendanceForSession(sessionId)         // Single session
async processCompletedSessionsForAttendance()          // Bulk processing

// Helper methods
async getAttendance(meetingId, userInfo)               // Platform-agnostic
async meetingAttendanceAnalytics(sessionId, userInfo)  // Enhanced analytics
```

#### Enhanced Logic
- **Platform Detection**: Uses `isZoomMeet` flag to route operations
- **Error Handling**: Graceful degradation when external APIs fail
- **Role-Based Access**: Filters sensitive data based on user roles
- **Fallback Mechanisms**: Continues operation even if external calls fail

### ZoomService Implementation

#### New Service Module
```typescript
// src/services/zoom/zoom.service.ts
class ZoomService {
  async createMeeting(meetingData)
  async updateMeeting(meetingId, updateData)  
  async deleteMeeting(meetingId)
  async getMeeting(meetingId)
  async getMeetingParticipants(meetingUuid)
  async getMeetingRecordings(meetingId)
  calculateAttendance(participants, threshold)
}
```

## 🔒 Security Enhancements

### Role-Based Access Control
- **Admin Fields**: `zoomStartUrl`, `zoomPassword` only visible to admins
- **Student Access**: Limited to join URLs and basic session info
- **Permission Checks**: All CRUD operations require admin role

### Token Management
- **Environment Variables**: Sensitive tokens stored securely
- **Validation**: Access token validation before API calls
- **Error Handling**: Clear messages for missing/invalid tokens

## 📊 Module Integration Changes

### ClassesModule
```typescript
// BEFORE
@Module({
  imports: [],
  providers: [ClassesService],
})

// AFTER  
@Module({
  imports: [ZoomModule],  // NEW: Zoom service integration
  providers: [ClassesService],
})
```

### ScheduleModule
```typescript
// BEFORE
@Module({
  imports: [SubmissionModule],
  providers: [ScheduleService],
})

// AFTER
@Module({
  imports: [SubmissionModule, ClassesModule],  // NEW: Classes integration
  providers: [ScheduleService],
})
```

## 🚦 Middleware Updates

### JWT Middleware Enhancements
```typescript
// Enhanced route pattern matching
const unrestrictedRoutes = [
  { path: '/auth/login', method: 'POST' },
  { path: '/classes/google-auth/redirect', method: 'GET' },  // NEW
  { path: '/classes/create-session-public', method: 'POST' }, // NEW
  { path: '/classes/test-endpoint', method: 'GET' },         // NEW
  // Support for parameterized routes
  { path: '/classes/getAllAttendance/:batchId', method: 'GET' }
];
```

## 🔄 Environment Configuration

### New Environment Variables
```env
# Zoom API Configuration
ZOOM_ACCESS_TOKEN=your_zoom_access_token_here

# Optional: For programmatic token generation
ZOOM_ACCOUNT_ID=your_account_id_here
ZOOM_CLIENT_ID=your_client_id_here  
ZOOM_CLIENT_SECRET=your_client_secret_here
```

### ⚠️ Important: Zoom API Scope Updates

As of 2024, Zoom has transitioned to **granular scopes**. When setting up your Zoom app, you must use the new scope format:

**Required Granular Scopes:**
- `meeting:read:meeting:admin` - Read meeting details
- `meeting:write:meeting:admin` - Create meetings
- `meeting:update:meeting:admin` - Update meetings  
- `cloud_recording:read:recording:admin` - Access recordings
- `report:read:admin` - Read attendance reports
- `user:read:user:admin` - Read user information

**Legacy scopes like `meeting:write:admin` may not work in new apps.**

**After adding new scopes:**
1. Regenerate your app credentials
2. Get a new access token
3. Update your environment variables

## 🗑️ Removed/Deprecated Features

### Removed DTOs
- `CreateZoomSessionDto` - Replaced by enhanced `CreateSessionDto`
- Separate Zoom-specific validation classes

### Removed Endpoints
- `/classes/zoom/create` - Functionality moved to main endpoint
- `/classes/zoom/delete/:meetingId` - Functionality moved to unified delete
- `/classes/zoom/update/:meetingId` - Functionality moved to unified update
- `/classes/zoom/attendance/:meetingId` - Functionality enhanced in main endpoints

### Removed Service Methods
- Duplicate Zoom creation methods
- Separate Zoom management endpoints
- Conflicting helper methods

## 📈 Performance Improvements

### Cron Job Optimization
- **Batched Processing**: Processes multiple sessions efficiently
- **Error Isolation**: Single session failures don't affect others
- **Rate Limiting**: Respects API rate limits for external services

### Database Optimization
- **Single Table Design**: No separate Zoom tables needed
- **Indexed Fields**: Proper indexing on `isZoomMeet` and `status` fields
- **Efficient Queries**: Optimized queries for role-based access

## 🔄 Migration Strategy

### Backward Compatibility
- **Existing Sessions**: All existing Google Meet sessions continue to work
- **API Compatibility**: Existing endpoints maintain same response format
- **Default Behavior**: New sessions default to Zoom (can be changed)

### Migration Steps for Existing Data
```sql
-- Set default platform for existing sessions
UPDATE zuvy_sessions 
SET is_zoom_meet = false 
WHERE zoom_meeting_id IS NULL;

-- Update existing Zoom sessions if any
UPDATE zuvy_sessions 
SET is_zoom_meet = true 
WHERE zoom_meeting_id IS NOT NULL;
```

## 📋 Testing Changes

### New Test Requirements
- **Platform Detection**: Test Zoom vs Google Meet routing
- **Role-Based Access**: Test admin vs student data filtering  
- **Error Handling**: Test graceful degradation scenarios
- **Attendance Processing**: Test automatic attendance calculation

### Test Data Setup
```json
// Test Zoom session
{
  "isZoomMeet": true,
  "zoomMeetingId": "123456789",
  "zoomStartUrl": "https://zoom.us/s/123...",
  "hangoutLink": "https://zoom.us/j/123..."
}

// Test Google Meet session  
{
  "isZoomMeet": false,
  "meetingId": "google_calendar_event_id",
  "hangoutLink": "https://meet.google.com/abc-defg-hij"
}
```

## 📖 Documentation Updates

### New Documentation Files
- `ZOOM_SETUP_GUIDE.md` - Complete Zoom API setup instructions
- `SESSION_IMPLEMENTATION.md` - Technical implementation details
- `ZOOM_INTEGRATION.md` - User guide for Zoom features
- `CLEANUP_PLAN.md` - Refactoring strategy documentation

### API Documentation Updates
- **Swagger/OpenAPI**: Updated with new fields and examples
- **Request/Response Examples**: Added platform-specific examples
- **Error Codes**: Enhanced error messaging and troubleshooting

## 🎯 Summary of Benefits

### For Developers
- **Unified API**: Single endpoint for both platforms
- **Better Error Handling**: Clear error messages with solutions
- **Maintainable Code**: Clean separation of concerns
- **Extensible Design**: Easy to add new meeting platforms

### For Users
- **Seamless Experience**: Platform choice with single API
- **Role-Based Access**: Appropriate data for each user type
- **Automatic Features**: Attendance tracking and recording
- **Backward Compatible**: Existing sessions continue working

### For Operations
- **Centralized Management**: Single point for session operations
- **Monitoring**: Comprehensive logging and error tracking
- **Scalable**: Efficient processing and rate limiting
- **Secure**: Proper token management and access control

---

*This document reflects the state of the refactoring as of July 2025. All changes maintain backward compatibility while providing enhanced functionality for both Zoom and Google Meet platforms.*
