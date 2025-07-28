# Zoom Integration Documentation

## 📋 Overview
Complete documentation for Zoom meeting CRUD APIs integration with Google Calendar synchronization and database storage.

## 🚀 Quick Start
```bash
# Run Zoom API tests
npm run test:e2e zoom.e2e-spec.ts

# Start development server
npm run dev
```

---

## 🔧 API Endpoints

### 1. **POST /zoom/create** - Create Meeting
Creates a new Zoom meeting with Google Calendar integration and database storage.

**Request Body:**
```typescript
{
  title: string;           // Meeting title
  batchId: number;         // Batch identifier
  bootcampId: number;      // Bootcamp identifier  
  moduleId: number;        // Module identifier
  chapterId?: number;      // Chapter identifier (optional)
  description?: string;    // Meeting description (optional)
  startDateTime: string;   // ISO 8601 format
  endDateTime: string;     // ISO 8601 format
  timeZone: string;        // Valid timezone
}
```

**Response:**
```typescript
{
  status: 'success',
  message: 'Zoom meeting created successfully',
  data: {
    meetingId: string,
    zoomJoinUrl: string,
    zoomStartUrl: string,
    zoomPassword: string,
    title: string,
    batchId: number,
    bootcampId: number,
    moduleId: number,
    chapterId: number,
    isZoomMeet: true,
    status: 'upcoming'
  }
}
```

### 2. **GET /zoom/get/:meetingId** - Get Meeting Details
Retrieves Zoom meeting details by meeting ID.

**Response:**
```typescript
{
  status: 'success',
  message: 'Zoom meeting details fetched successfully',
  data: {
    id: string,
    topic: string,
    join_url: string,
    start_url: string,
    password: string,
    // ... other Zoom API fields
  }
}
```

### 3. **PUT /zoom/update/:meetingId** - Update Meeting
Updates existing Zoom meeting details.

**Request Body:**
```typescript
{
  topic?: string;          // Updated meeting title
  start_time?: string;     // Updated start time
  duration?: number;       // Duration in minutes
  timezone?: string;       // Updated timezone
}
```

### 4. **DELETE /zoom/delete/:meetingId** - Delete Meeting
Deletes a Zoom meeting and removes from database.

**Response:**
```typescript
{
  status: 'success',
  message: 'Zoom meeting deleted successfully'
}
```

---

## 💾 Database Integration

### zuvySessions Table Storage
All meeting data is stored in the `zuvySessions` table with the following fields:

```sql
- meetingId (Zoom meeting ID)
- batchId, bootcampId, moduleId, chapterId
- title, description
- startDateTime, endDateTime, timeZone
- zoomJoinUrl, zoomStartUrl, zoomPassword
- isZoomMeet: true
- status: 'upcoming'
```

### User Tokens Integration
Google Calendar integration uses user-specific tokens from `userTokens` table:
- Retrieved by userId (currently hardcoded to 58083)
- Used for creating Google Calendar events
- Graceful fallback if tokens unavailable

---

## 🌐 Google Calendar Integration

### Automatic Event Creation
- Calendar events created automatically during meeting creation
- Uses user-specific Google OAuth tokens
- Event includes meeting details and Zoom join URL
- Proper timezone handling for calendar events

### Error Handling
- Meeting creation continues even if calendar fails
- Logged errors for debugging calendar issues
- No impact on core Zoom functionality

---

## 🧪 Test Coverage

### Core CRUD Tests (25+ scenarios)

#### ✅ CREATE Tests
- Valid meeting creation with all fields
- Missing required fields validation
- Invalid data types handling
- Long titles (300+ chars)
- Past dates and invalid timezones
- Empty string validation

#### ✅ READ Tests  
- Valid meeting retrieval
- Non-existent meeting handling
- Invalid ID format validation
- SQL injection prevention

#### ✅ UPDATE Tests
- Full and partial updates
- Non-existent meeting handling
- Invalid data type validation

#### ✅ DELETE Tests
- Valid deletion
- Cascade verification
- Double deletion handling

#### ✅ Integration Tests
- Complete CRUD flow (Create → Read → Update → Delete)
- Database persistence validation
- Google Calendar integration testing
- Concurrent operations handling

#### ✅ Security Tests
- SQL injection prevention
- Large payload handling
- XSS prevention
- Input sanitization

#### ✅ Performance Tests
- Response time validation (< 2 seconds)
- Concurrent request handling
- Resource cleanup verification

---

## 🛠️ Implementation Details

### Service Layer (`ZoomService`)
```typescript
- createAndStoreZoomMeeting() // Main creation method
- createMeeting()            // Zoom API integration
- getMeeting()              // Retrieve meeting details
- updateMeeting()           // Update meeting
- deleteMeeting()           // Delete meeting
- createGoogleCalendarEvent() // Calendar integration
```

### Controller Layer (`ZoomController`)
```typescript
- POST /zoom/create     // Uses CreateAndStoreZoomMeetingDto
- GET /zoom/get/:id     // Returns Zoom meeting details
- PUT /zoom/update/:id  // Uses UpdateMeetingDto
- DELETE /zoom/delete/:id // Returns success/error
```

### DTO Validation
```typescript
// CreateAndStoreZoomMeetingDto
- title: @IsString() @IsNotEmpty()
- batchId: @IsNumber() @IsNotEmpty()
- bootcampId: @IsNumber() @IsNotEmpty()
- moduleId: @IsNumber() @IsNotEmpty()
- chapterId: @IsNumber() @IsOptional()
- startDateTime: @IsString() @IsNotEmpty()
- endDateTime: @IsString() @IsNotEmpty()
- timeZone: @IsString() @IsNotEmpty()

// UpdateMeetingDto
- topic: @IsString() @IsOptional()
- start_time: @IsString() @IsOptional()
- duration: @IsNumber() @IsOptional()
- timezone: @IsString() @IsOptional()
```

---

## 🔧 Configuration

### Environment Variables
```bash
ZOOM_CLIENT_ID=your_zoom_client_id
ZOOM_CLIENT_SECRET=your_zoom_client_secret
ZOOM_ACCOUNT_ID=your_zoom_account_id
DATABASE_URL=your_database_url
```

### Zoom API Setup
- Server-to-Server OAuth app required
- Account-level API access
- Meeting creation/management scopes needed

### Database Schema
```typescript
// zuvySessions table includes:
export const zuvySessions = pgTable('zuvy_sessions', {
  id: serial('id').primaryKey(),
  meetingId: varchar('meeting_id'),
  batchId: integer('batch_id'),
  bootcampId: integer('bootcamp_id'),
  moduleId: integer('module_id'),
  chapterId: integer('chapter_id'),
  title: varchar('title'),
  description: text('description'),
  startDateTime: timestamp('start_date_time'),
  endDateTime: timestamp('end_date_time'),
  timeZone: varchar('time_zone'),
  zoomJoinUrl: varchar('zoom_join_url'),
  zoomStartUrl: varchar('zoom_start_url'),
  zoomPassword: varchar('zoom_password'),
  isZoomMeet: boolean('is_zoom_meet'),
  status: varchar('status'),
  // ... other fields
});
```

---

## 🚀 Usage Examples

### Create Meeting
```bash
curl -X POST http://localhost:3000/zoom/create \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Team Meeting",
    "batchId": 1,
    "bootcampId": 1,
    "moduleId": 1,
    "chapterId": 1,
    "description": "Weekly team sync",
    "startDateTime": "2024-07-28T10:00:00Z",
    "endDateTime": "2024-07-28T11:00:00Z",
    "timeZone": "UTC"
  }'
```

### Get Meeting
```bash
curl http://localhost:3000/zoom/get/123456789
```

### Update Meeting
```bash
curl -X PUT http://localhost:3000/zoom/update/123456789 \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Updated Meeting Title",
    "duration": 90
  }'
```

### Delete Meeting
```bash
curl -X DELETE http://localhost:3000/zoom/delete/123456789
```

---

## 🐛 Troubleshooting

### Common Issues

#### Zoom API Errors
- **Invalid credentials**: Check ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_ACCOUNT_ID
- **Insufficient permissions**: Ensure proper OAuth scopes for meeting management
- **Rate limiting**: Implement retry logic for API calls

#### Database Issues
- **Connection errors**: Verify DATABASE_URL and database connectivity
- **Schema mismatch**: Run migrations to ensure table structure is current
- **Constraint violations**: Check for valid foreign key references

#### Google Calendar Issues
- **Token errors**: Verify user has valid Google OAuth tokens in userTokens table
- **API quota**: Monitor Google Calendar API usage limits
- **Timezone issues**: Ensure consistent timezone handling between Zoom and Calendar

### Debug Logging
Enable detailed logging by setting log level to 'debug' in the service:
```typescript
this.logger.debug('Zoom API request', { meetingData });
```

---

## 📈 Performance Considerations

### Response Times
- Target: < 2 seconds for all CRUD operations
- Monitor database query performance
- Implement caching for frequently accessed data

### Scalability
- Connection pooling for database connections
- Async processing for Google Calendar integration
- Error recovery and retry mechanisms

### Resource Management
- Proper cleanup of database connections
- Memory leak prevention in long-running processes
- Graceful handling of external API failures

---

## 🔄 Future Enhancements

### Potential Improvements
- Batch meeting operations
- Meeting recording management
- Participant management APIs
- Webhook integration for meeting events
- Advanced scheduling features
- Meeting analytics and reporting

### Integration Expansions
- Microsoft Teams integration
- Slack notifications
- Email reminders
- Calendar sync with multiple providers

---

*This documentation covers the complete Zoom integration implementation with comprehensive API details, testing coverage, and troubleshooting guides.*
