export const helperVariable= {
    schemaName: 'stage',
    admin: 'admin',
    instructor:'instructor',
    success: 'success',
    error: 'error',
    ongoing: 'ongoing',
    upcoming: 'upcoming',
    completed: 'completed',
    currentISOTime: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, -1) + '+05:30',
    ACCEPTED: 'Accepted',
    SUBMIT: 'submit',
    RUN: 'run',
    MCQ_POINTS: { "Easy": 4, "Medium": 8, "Hard": 12 },
    CODING_POINTS: { "Easy": 10, "Medium": 15, "Hard": 20 },
    OPEN_ENDED_POINTS: { "Easy": 3, "Medium": 6, "Hard": 9 },
    WAIT_API_RESPONSE: 2990,
    TOTAL_SCORE: 100,
    DIFFICULTY: {
      EASY: 'Easy',
      MEDIUM: 'Medium',
      HARD: 'Hard',
    },
    PROGRAM_DETAILS: {
      NAME: "Amazon Future Engineer Bootcamp 2024",
      APPLICATION_LINK: "www.zuvy.org/apply",
      ORGANIZATION_NAME: "Zuvy Team",
    },
    CONTACT_DETAILS: {
        WHATSAPP_NUMBER: "+918949619081",
        EMAIL: "join-zuvy@navgurukul.org",
    },
    QUESTIONNAIRE: {
        DEADLINE: "within the next 2 days",
        DURATION: "approximately 10 to 15 minutes",
    },
    REQUIRED_DOCUMENTS: [
        "Aadhaar Card",
        "College ID",
        "B.Tech Entrance Exam Rank Certificate",
        "Income Certificate"

    ],
    REATTMEPT_STATUS:{
        "NOT_ATTEMPTED": "Not Attempted",
        "ATTEMPTED": "Attempted",
        "REATTEMPTED": "Reattempted",
        "REJECTED": "Rejected",
        "ACCEPTED": "Accepted",
        "PENDING": "Pending",
        "SUBMITTED": "Submitted",
    },
    
    // Schedule Service Constants
    GOOGLE_SCOPES: [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/drive',
    ],
    
    DRIVE_SCOPES: [
        'https://www.googleapis.com/auth/drive.metadata.readonly',
        'https://www.googleapis.com/auth/calendar.events.readonly',
    ],
    
    ADMIN_REPORTS_CONFIG: {
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
    },
    
    CALENDAR_FIELDS: 'attachments(fileId,mimeType,fileUrl)',
    VIDEO_METADATA_FIELDS: 'videoMediaMetadata(durationMillis)',
    VIDEO_MIME_TYPE: 'video/mp4',
    CALENDAR_ID: 'primary',
    
    ATTENDANCE_THRESHOLDS: {
        NEW_LOGIC: 0.75, // 75% threshold for new attendance calculation
        OLD_LOGIC: 0.7,  // 70% threshold for old attendance calculation
    },
    
    ERROR_MESSAGES: {
        USER_NOT_FOUND: 'User not found',
        TOKENS_UNAVAILABLE: 'Unable to fetch tokens',
        RECORDING_NOT_UPDATED: 'Recording not yet updated. You can download attendance once recording is available',
        SESSION_DATA_ERROR: 'Error fetching session data',
        MEETING_NOT_FOUND: 'Meeting not found',
        ATTENDANCE_NOT_FOUND: 'No attendance found',
        MEETINGS_FETCH_ERROR: 'Error fetching meetings',
    },
    
    SUCCESS_MESSAGES: {
        MEETINGS_FETCHED: 'Meetings fetched successfully',
        ATTENDANCE_SUCCESS: 'success',
        MANUAL_PROCESSING_COMPLETED: 'Manual session processing completed',
    },
    
    LOG_MESSAGES: {
        STARTING_TASK: 'Starting scheduled task: Processing completed sessions with null s3link',
        COMPLETED_TASK: 'Completed scheduled task: Processing completed sessions with null s3link',
        MANUAL_TRIGGER: 'Manual trigger: Processing completed sessions with null s3link',
        PROCESSING_ANALYTICS: 'Processing analytics for meeting',
        ATTENDANCE_UPDATED: 'Attendance updated for new classes',
    },
    
    SPECIAL_EMAILS: {
        ZUVY_TEAM: 'team@zuvy.org',
    },
    
    HTTP_STATUS_CODES: {
        BAD_REQUEST: 400,
        UNAUTHORIZED: 402,
        NOT_FOUND: 404,
    },
    
    PARAMETER_NAMES: {
        ORGANIZER_EMAIL: 'organizer_email',
        IDENTIFIER: 'identifier',
        DURATION_SECONDS: 'duration_seconds',
    },
    
    API_VERSIONS: {
        ADMIN_REPORTS: 'reports_v1' as const,
        CALENDAR: 'v3' as const,
        DRIVE: 'v3' as const,
    },
    
    CRON_SCHEDULE: '*/2 * * * *', // Every 2 minutes
    CRON_DESCRIPTION: 'Every 2 minutes (*/2 * * * *)',
    SCHEDULE_DESCRIPTION: 'Processes completed sessions with null s3link',
    
    // Google OAuth Configuration Validation
    GOOGLE_OAUTH_ERRORS: {
        CLIENT_SECRET_MISSING: 'Google client secret is missing in environment variables',
        INVALID_CREDENTIALS: 'Invalid Google OAuth credentials',
        TOKEN_REFRESH_FAILED: 'Failed to refresh Google OAuth token',
        INSUFFICIENT_PERMISSIONS: 'Insufficient Google API permissions',
    },
    
    // Google API Configuration Requirements
    REQUIRED_ENV_VARS: {
        GOOGLE_CLIENT_ID: 'GOOGLE_CLIENT_ID',
        GOOGLE_CLIENT_SECRET: 'GOOGLE_SECRET',
        GOOGLE_REDIRECT_URI: 'GOOGLE_REDIRECT',
        PRIVATE_KEY: 'PRIVATE_KEY',
        CLIENT_EMAIL: 'CLIENT_EMAIL',
    },
  };
