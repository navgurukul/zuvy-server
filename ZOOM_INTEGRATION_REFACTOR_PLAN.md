# Zoom Integration Refactor Plan

## Overview
This document outlines the plan to integrate Zoom functionality directly into the existing /classes APIs instead of having separate Zoom endpoints. The integration will be based on the `isZoomMeet` boolean flag in the sessions table.

## Current State Analysis

### Database Schema (zuvy_sessions table)
```sql
- id: serial (primary key)
- meetingId: text (Google Calendar event ID or Zoom meeting ID)
- isZoomMeet: boolean (true for Zoom, false for Google Meet)
- zoomMeetingId: text (Zoom-specific meeting ID)
- zoomStartUrl: text (Zoom admin start URL)
- zoomPassword: text (Zoom meeting password)
- hangoutLink: text (Google Meet link)
- Other session fields...
```

### Current API Structure
- **Classes Controller**: `/classes/*` - Handles both Google Meet and some Zoom sessions
- **Zoom Service**: `/services/zoom/*` - Separate Zoom service with dedicated methods
- **Current Methods**:
  - `createZoomSession()` - Creates Zoom sessions (partially implemented)
  - `createGoogleMeetSession()` - Creates Google Meet sessions
  - `deleteSession()` - Basic delete (needs Zoom integration)
  - `updateSession()` - Basic update (needs Zoom integration)

### Issues with Current Implementation
1. **Fragmented Logic**: Zoom functionality is split between classes service and separate Zoom service
2. **Incomplete Implementation**: `deleteSession()` and `updateSession()` don't handle Zoom cleanup
3. **Inconsistent APIs**: Separate endpoints for Zoom operations instead of unified session management
4. **Mock Implementation**: Zoom service uses placeholder methods instead of actual Zoom API calls

## Proposed Refactoring

### 1. Integration Strategy
Instead of separate Zoom endpoints, enhance existing session endpoints to handle both Google Meet and Zoom based on `isZoomMeet` flag:

```
GET /classes/sessions/:id        → Check isZoomMeet, return appropriate data
PUT /classes/sessions/:id        → Check isZoomMeet, update both DB and Zoom/Google
DELETE /classes/sessions/:id     → Check isZoomMeet, cleanup both DB and Zoom/Google  
POST /classes/sessions           → Based on request, create Zoom or Google Meet session
```

### 2. Required Changes

#### A. Classes Service Enhancements

##### 2.1 Import Zoom Service
```typescript
// In classes.service.ts
import { ZoomService } from '../../services/zoom/zoom.service';

@Injectable()
export class ClassesService {
  constructor(private zoomService: ZoomService) {}
}
```

##### 2.2 Enhance Session Retrieval (`getSession` method)
```typescript
async getSession(sessionId: number, userInfo: any) {
  // Get session from DB
  const session = await db.select().from(zuvySessions)...
  
  if (session.isZoomMeet) {
    // Enrich with Zoom-specific data
    try {
      const zoomMeeting = await this.zoomService.getMeeting(session.zoomMeetingId);
      return {
        ...session,
        zoomDetails: zoomMeeting,
        joinUrl: session.hangoutLink, // Zoom join URL
        startUrl: session.zoomStartUrl
      };
    } catch (error) {
      // Handle Zoom API errors gracefully
    }
  }
  
  return session; // Google Meet session
}
```

##### 2.3 Enhance Session Update (`updateSession` method)
```typescript
async updateSession(sessionId: number, updateData: updateSessionDto, userInfo: any) {
  // Get current session
  const currentSession = await db.select().from(zuvySessions)
    .where(eq(zuvySessions.id, sessionId));
    
  if (!currentSession.length) {
    return { success: false, message: 'Session not found' };
  }
  
  const session = currentSession[0];
  
  // Update database record first
  await db.update(zuvySessions)
    .set(updateData)
    .where(eq(zuvySessions.id, sessionId));
  
  // Handle platform-specific updates
  if (session.isZoomMeet) {
    // Update Zoom meeting
    if (session.zoomMeetingId) {
      try {
        await this.zoomService.updateMeeting(session.zoomMeetingId, {
          topic: updateData.title,
          start_time: updateData.startTime,
          duration: calculateDuration(updateData.startTime, updateData.endTime)
        });
      } catch (error) {
        this.logger.error(`Failed to update Zoom meeting: ${error.message}`);
        // Could rollback DB changes or continue with warning
      }
    }
  } else {
    // Update Google Calendar event
    if (session.meetingId && session.meetingId !== session.zoomMeetingId) {
      try {
        // Update Google Calendar event using existing logic
        await this.updateGoogleCalendarEvent(session.meetingId, updateData);
      } catch (error) {
        this.logger.error(`Failed to update Google Calendar: ${error.message}`);
      }
    }
  }
  
  return { success: true, message: 'Session updated successfully' };
}
```

##### 2.4 Enhance Session Deletion (`deleteSession` method)
```typescript
async deleteSession(sessionId: number, userInfo: any) {
  try {
    // Get session details
    const session = await db.select().from(zuvySessions)
      .where(eq(zuvySessions.id, sessionId));
      
    if (!session.length) {
      return { success: false, message: 'Session not found' };
    }
    
    const sessionData = session[0];
    
    // Delete from external platforms first
    if (sessionData.isZoomMeet) {
      // Delete Zoom meeting
      if (sessionData.zoomMeetingId) {
        try {
          await this.zoomService.deleteMeeting(sessionData.zoomMeetingId);
          this.logger.log(`Zoom meeting ${sessionData.zoomMeetingId} deleted`);
        } catch (error) {
          this.logger.error(`Failed to delete Zoom meeting: ${error.message}`);
          // Continue with DB deletion even if Zoom deletion fails
        }
      }
    } else {
      // Delete Google Calendar event
      if (sessionData.meetingId && sessionData.meetingId !== sessionData.zoomMeetingId) {
        try {
          await this.deleteGoogleCalendarEvent(sessionData.meetingId);
          this.logger.log(`Google Calendar event ${sessionData.meetingId} deleted`);
        } catch (error) {
          this.logger.error(`Failed to delete Google Calendar event: ${error.message}`);
        }
      }
    }
    
    // Delete from database
    await db.delete(zuvySessions).where(eq(zuvySessions.id, sessionId));
    
    // Clean up related records (attendance, etc.)
    await db.delete(zuvyStudentAttendance)
      .where(eq(zuvyStudentAttendance.sessionId, sessionId));
    
    return {
      success: true,
      message: 'Session and all related data deleted successfully'
    };
    
  } catch (error) {
    this.logger.error(`Error deleting session ${sessionId}: ${error.message}`);
    return {
      success: false,
      error: error.message,
      message: 'Failed to delete session'
    };
  }
}
```

##### 2.5 Replace Mock Zoom Implementation
```typescript
// Remove createZoomMeetingDirect mock method
// Replace with actual Zoom service integration

private async createZoomMeetingDirect(meetingData: any) {
  try {
    return await this.zoomService.createMeeting(meetingData);
  } catch (error) {
    this.logger.error(`Error creating Zoom meeting: ${error.message}`);
    throw error;
  }
}
```

#### B. Zoom Service Enhancements

##### 2.1 Fix Access Token Management
```typescript
// In zoom.service.ts
constructor() {
  // Use actual Zoom OAuth implementation instead of static token
  this.accessToken = process.env.ZOOM_ACCESS_TOKEN || '';
  // TODO: Implement proper OAuth flow for production
}
```

##### 2.2 Add Error Handling and Logging
```typescript
async createMeeting(meetingData: ZoomMeetingRequest): Promise<{ success: boolean; data?: ZoomMeetingResponse; error?: string }> {
  try {
    const response = await axios.post(url, meetingData, { headers: this.getHeaders() });
    this.logger.log(`Zoom meeting created successfully: ${response.data.id}`);
    return { success: true, data: response.data };
  } catch (error) {
    this.logger.error(`Error creating Zoom meeting: ${error.response?.data || error.message}`);
    return { 
      success: false, 
      error: `Failed to create Zoom meeting: ${error.response?.data?.message || error.message}` 
    };
  }
}
```

#### C. Module Integration

##### 2.1 Update Classes Module
```typescript
// In classes.module.ts
import { ZoomModule } from '../../services/zoom/zoom.module';

@Module({
  imports: [ZoomModule],
  controllers: [ClassesController],
  providers: [ClassesService],
})
export class ClassesModule {}
```

### 3. API Endpoint Changes

#### Before (Fragmented):
```
POST /classes/                           → Create session (Google Meet only)
POST /classes/zoom/create                → Create Zoom session  
PUT /classes/sessions/:id                → Update session (basic)
DELETE /classes/sessions/:id             → Delete session (basic)
GET /classes/zoom/attendance/:meetingId  → Get Zoom attendance
DELETE /classes/zoom/delete/:meetingId   → Delete Zoom meeting
```

#### After (Unified):
```
POST /classes/sessions                   → Create session (Zoom or Google Meet based on isZoomMeet)
GET /classes/sessions/:id                → Get session (includes Zoom/Google Meet details)
PUT /classes/sessions/:id                → Update session (updates both DB and Zoom/Google)
DELETE /classes/sessions/:id             → Delete session (cleans up DB, Zoom, and Google)
GET /classes/sessions/:id/attendance     → Get attendance (Zoom or Google Meet)
```

### 4. Request/Response Format Changes

#### 4.1 Create Session Request
```typescript
// Enhanced CreateSessionDto
interface CreateSessionDto {
  title: string;
  description?: string;
  startDateTime: string;
  endDateTime: string;
  timeZone: string;
  batchId: number;
  moduleId: number;
  isZoomMeet: boolean;  // NEW: Determines platform
  // Zoom-specific (optional)
  zoomSettings?: {
    waiting_room?: boolean;
    auto_recording?: 'cloud' | 'local' | 'none';
    mute_upon_entry?: boolean;
  };
}
```

#### 4.2 Session Response
```typescript
interface SessionResponse {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  isZoomMeet: boolean;
  
  // Common fields
  meetingId: string;
  joinUrl: string;
  
  // Platform-specific fields
  zoomMeetingId?: string;
  zoomStartUrl?: string;
  zoomPassword?: string;
  
  // Google Meet specific
  hangoutLink?: string;
}
```

### 5. Database Migration Requirements

No schema changes required - the existing schema already supports the needed fields:
- `isZoomMeet` boolean flag
- `zoomMeetingId` for Zoom meeting ID
- `zoomStartUrl` for Zoom admin URL  
- `zoomPassword` for Zoom meeting password
- `meetingId` for Google Calendar event ID
- `hangoutLink` for Google Meet URL

### 6. Implementation Steps

#### Phase 1: Core Integration
1. ✅ Analyze current codebase
2. ✅ Create refactoring plan
3. Update Classes Service to import Zoom Service
4. Enhance `getSession` method with Zoom integration
5. Update `updateSession` method with dual platform support
6. Update `deleteSession` method with cleanup logic

#### Phase 2: Service Improvements  
7. Replace mock Zoom implementation with real service calls
8. Add proper error handling and rollback mechanisms
9. Update Classes Module to include Zoom Module dependency
10. Add comprehensive logging

#### Phase 3: API Standardization
11. Update DTOs to support unified session creation
12. Modify controller endpoints to handle both platforms
13. Remove separate Zoom endpoints (if any exist)
14. Update API documentation

#### Phase 4: Testing & Validation
15. Test session CRUD operations for both platforms
16. Test error scenarios and rollback mechanisms
17. Validate attendance fetching for both platforms
18. Performance testing with real Zoom API calls

### 7. Rollback Strategy

If issues arise during implementation:
1. **Database**: No rollback needed (schema unchanged)
2. **Code**: Git revert to previous working state
3. **API**: Maintain backward compatibility during transition
4. **External Services**: Ensure cleanup scripts for orphaned meetings

### 8. Benefits of This Approach

1. **Unified Experience**: Single set of APIs for all session management
2. **Cleaner Architecture**: Platform-specific logic encapsulated within service methods
3. **Better Error Handling**: Centralized error handling and rollback mechanisms
4. **Easier Maintenance**: One place to manage session lifecycle
5. **Future Flexibility**: Easy to add new meeting platforms (Teams, WebEx, etc.)

### 9. Potential Challenges

1. **Zoom API Rate Limits**: Need to implement retry logic and rate limiting
2. **Token Management**: Zoom OAuth tokens need proper refresh mechanism  
3. **Error Recovery**: Handle cases where DB updates succeed but external API fails
4. **Testing**: Need to mock Zoom API calls for unit tests
5. **Migration**: Existing sessions need to be handled gracefully

### 10. Next Steps

1. Review and approve this plan
2. Set up development environment with Zoom API credentials
3. Begin Phase 1 implementation
4. Create unit tests for each enhanced method
5. Document the new unified API endpoints

---

**Note**: This refactoring maintains backward compatibility while providing a cleaner, more maintainable architecture for session management across both Google Meet and Zoom platforms.
