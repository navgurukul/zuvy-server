import { Test, TestingModule } from '@nestjs/testing';
import { ClassesService } from './classes.service';
import { ZoomService } from '../../services/zoom/zoom.service';

// Mock uuid v4
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-123'),
}));

// Mock google oauth client used in service
const mockAuth2Client = {
  generateAuthUrl: jest.fn(),
  setCredentials: jest.fn(),
  getToken: jest.fn(),
};

// Mock the module path exactly as used in the service
jest.mock('../../auth/google-auth', () => ({
  auth2Client: mockAuth2Client,
}));

// Minimal googleapis mock with calendar and admin clients
const mockCalendarsGet = jest.fn();
const mockCalendarEventsGet = jest.fn();
const mockCalendarEventsInsert = jest.fn();
const mockCalendarEventsDelete = jest.fn();
const mockCalendarEventsUpdate = jest.fn();

const mockAdminActivitiesList = jest.fn();

jest.mock('googleapis', () => ({
  google: {
    calendar: jest.fn(() => ({
      calendars: { get: mockCalendarsGet },
      events: {
        get: mockCalendarEventsGet,
        insert: mockCalendarEventsInsert,
        delete: mockCalendarEventsDelete,
        update: mockCalendarEventsUpdate,
      },
    })),
    admin: jest.fn(() => ({
      activities: { list: mockAdminActivitiesList },
    })),
  },
}));

// Mock AWS S3 client
const mockS3UploadPromise = jest.fn();
const mockS3Upload = jest.fn(() => ({ promise: mockS3UploadPromise }));
jest.mock('aws-sdk', () => {
  return {
    S3: jest.fn().mockImplementation(() => ({
      upload: mockS3Upload,
    })),
  };
});

// Helper types for readability
type InvitedStudent = { userId: number; email: string };

describe('ClassesService', () => {
  // Explicitly note testing framework for reviewers:
  // Using Jest with NestJS (@nestjs/testing) to construct the service and inject a mocked ZoomService.

  let service: ClassesService;
  let zoomServiceMock: {
    createMeeting: jest.Mock;
    updateMeeting: jest.Mock;
    deleteMeeting: jest.Mock;
    getMeeting: jest.Mock;
    getMeetingParticipants: jest.Mock;
  };

  beforeEach(async () => {
    zoomServiceMock = {
      createMeeting: jest.fn(),
      updateMeeting: jest.fn(),
      deleteMeeting: jest.fn(),
      getMeeting: jest.fn(),
      getMeetingParticipants: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: ZoomService, useValue: zoomServiceMock },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);

    // Reset all mocks
    jest.clearAllMocks();
    mockS3UploadPromise.mockReset();
    mockS3Upload.mockClear();

    // Default env for tests that touch S3
    process.env.S3_ACCESS_KEY_ID = 'test-access';
    process.env.S3_SECRET_KEY_ACCESS = 'test-secret';
    process.env.S3_BUCKET_NAME = 'test-bucket';
  });

  describe('accessOfCalendar', () => {
    it('should return error with authUrl when user has no tokens', async () => {
      // Arrange
      const creatorInfo = { id: 42, email: 'user@example.com' };
      // getUserTokens is private, spy via 'as any'
      jest.spyOn<any, any>(service as any, 'getUserTokens').mockResolvedValue(null);
      mockAuth2Client.generateAuthUrl.mockReturnValue('https://auth.example.com');

      // Act
      const result = await service.accessOfCalendar(creatorInfo);

      // Assert
      expect(mockAuth2Client.generateAuthUrl).toHaveBeenCalledWith({
        access_type: 'offline',
        scope: [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/admin.reports.audit.readonly',
        ],
        state: JSON.stringify({ id: creatorInfo.id, email: creatorInfo.email }),
      });
      expect(result).toEqual({
        status: 'error',
        message: 'Calendar access required',
        authUrl: 'https://auth.example.com',
      });
    });

    it('should verify calendar access when tokens exist', async () => {
      // Arrange
      const creatorInfo = { id: 1, email: 'admin@example.com' };
      jest.spyOn<any, any>(service as any, 'getUserTokens').mockResolvedValue({
        accessToken: 'ac',
        refreshToken: 'rf',
      });
      mockCalendarsGet.mockResolvedValue({ data: {} });

      // Act
      const result = await service.accessOfCalendar(creatorInfo);

      // Assert
      expect(mockAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: 'ac',
        refresh_token: 'rf',
      });
      expect(mockCalendarsGet).toHaveBeenCalledWith({ calendarId: 'primary' });
      expect(result).toEqual({
        status: 'success',
        message: 'Calendar access verified',
      });
    });

    it('should handle errors and return failure object', async () => {
      const creatorInfo = { id: 1, email: 'boom@example.com' };
      jest.spyOn<any, any>(service as any, 'getUserTokens').mockImplementation(() => {
        throw new Error('unexpected');
      });

      const result = await service.accessOfCalendar(creatorInfo);
      expect(result.status).toBe('error');
      expect(result.message).toBe('Failed to access calendar');
      expect(result.error).toBe('unexpected');
    });
  });

  describe('googleAuthenticationRedirect', () => {
    it('should save tokens and return success', async () => {
      // Arrange
      const req: any = { query: { code: 'abc123', state: JSON.stringify({ id: 7, email: 'u@e.com' }) } };
      const res: any = {};
      mockAuth2Client.getToken.mockResolvedValue({ tokens: { access_token: 'aa', refresh_token: 'rr' } });
      const saveSpy = jest.spyOn(service, 'saveTokensToDatabase').mockResolvedValue({
        status: 'success',
        message: 'Tokens saved successfully',
      } as any);

      // Act
      const out = await service.googleAuthenticationRedirect(req, res);

      // Assert
      expect(mockAuth2Client.getToken).toHaveBeenCalledWith('abc123');
      expect(saveSpy).toHaveBeenCalledWith({ access_token: 'aa', refresh_token: 'rr' }, { id: 7, email: 'u@e.com' });
      expect(out).toEqual({ status: 'success', message: 'Authentication successful' });
    });

    it('should return error on failure', async () => {
      const req: any = { query: { code: 'bad', state: '{}' } };
      const res: any = {};
      mockAuth2Client.getToken.mockRejectedValue(new Error('token error'));

      const out = await service.googleAuthenticationRedirect(req, res);
      expect(out.status).toBe('error');
      expect(out.message).toBe('Authentication failed');
      expect(out.error).toBe('token error');
    });
  });

  describe('createSession (multi-batch invitedStudents)', () => {
    const creatorInfoAdmin = { id: 99, email: 'admin@zuvy.org', roles: ['admin'] };
    const eventDetailsBase = {
      title: 'My Class',
      description: 'desc',
      startDateTime: '2023-10-01T10:00:00.000Z',
      endDateTime: '2023-10-01T11:00:00.000Z',
      timeZone: 'Asia/Kolkata',
      batchId: 1001,
      secondBatchId: 1002,
      bootcampId: 500,
      moduleId: 200,
    };

    it('should reject non-admin users', async () => {
      const result = await service.createSession(eventDetailsBase as any, { roles: [] });
      expect(result).toEqual({
        status: 'error',
        message: 'Only admins can create sessions',
      });
    });

    it('should de-duplicate invited students across two batches and call createZoomSession with combined list', async () => {
      // Arrange: overlap student2 across batches
      const primaryStudents = {
        success: true,
        students: [
          { id: 1, email: 'student1@example.com' },
          { id: 2, email: 'student2@example.com' },
        ],
      };
      const secondaryStudents = {
        success: true,
        students: [
          { id: 2, email: 'student2@example.com' },
          { id: 3, email: 'student3@example.com' },
        ],
      };
      jest.spyOn<any, any>(service as any, 'getStudentsEmails')
        .mockResolvedValueOnce(primaryStudents) // primary
        .mockResolvedValueOnce(secondaryStudents); // secondary

      const createZoomSessionSpy = jest
        .spyOn(service, 'createZoomSession')
        .mockResolvedValue({ status: 'success' } as any);

      // Act
      const out = await service.createSession({ ...eventDetailsBase, isZoomMeet: true } as any, creatorInfoAdmin);

      // Assert
      expect(createZoomSessionSpy).toHaveBeenCalledTimes(1);
      const calledWith = createZoomSessionSpy.mock.calls[0][0];
      const invited: InvitedStudent[] = calledWith.invitedStudents;
      // Should include 1,2,3 with no duplicates
      const ids = invited.map(s => s.userId).sort();
      expect(ids).toEqual([1, 2, 3]);
      expect(out).toEqual({ status: 'success' });
    });

    it('should call createGoogleMeetSession when isZoomMeet is false', async () => {
      jest.spyOn<any, any>(service as any, 'getStudentsEmails').mockResolvedValue({ success: true, students: [] });
      const spy = jest.spyOn(service, 'createGoogleMeetSession').mockResolvedValue({ status: 'success' } as any);
      const out = await service.createSession({ ...eventDetailsBase, isZoomMeet: false } as any, creatorInfoAdmin);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(out).toEqual({ status: 'success' });
    });
  });

  describe('createZoomSession', () => {
    const creatorInfo = { email: 'host@zuvy.org' };
    const baseEvent = {
      title: 'Zoom Class',
      description: 'Live class session',
      startDateTime: '2023-10-01T10:00:00.000Z',
      endDateTime: '2023-10-01T11:30:00.000Z',
      timeZone: 'Asia/Kolkata',
      batchId: 321,
      bootcampId: 123,
      moduleId: 456,
    };

    it('should build Zoom meeting with adjusted time (-5h30m) and save session successfully', async () => {
      // Arrange
      const studentsRes = {
        success: true,
        students: [
          { id: 1, email: 's1@example.com' },
          { id: 2, email: 's2@example.com' },
        ],
        instructor: { id: 9, email: 'instructor@zuvy.org', name: 'Inst', isInstructor: true },
      };
      jest.spyOn<any, any>(service as any, 'getStudentsEmails').mockResolvedValue(studentsRes);

      const createZoomMeetingDirectSpy = jest.spyOn<any, any>(service as any, 'createZoomMeetingDirect')
        .mockResolvedValue({
          success: true,
          data: {
            id: 987654321,
            join_url: 'https://zoom.us/j/987654321',
            start_url: 'https://zoom.us/s/987654321',
            password: 'pass123',
          },
        });

      const createGoogleCalendarEventSpy = jest.spyOn<any, any>(service as any, 'createGoogleCalendarEvent')
        .mockResolvedValue({ success: true, data: { id: 'cal-abc' } });

      const validateAndCreateChapterSpy = jest.spyOn<any, any>(service as any, 'validateAndCreateChapter')
        .mockResolvedValue({ success: true, chapter: { id: 777 }, bootcampId: 123 });

      const saveSessionsSpy = jest.spyOn<any, any>(service as any, 'saveSessionsToDatabase')
        .mockResolvedValue({ status: 'success', data: [{ id: 1 }] });

      // Act
      const result = await service.createZoomSession(baseEvent as any, creatorInfo);

      // Assert
      expect(createZoomMeetingDirectSpy).toHaveBeenCalledTimes(1);
      const meetingArg = createZoomMeetingDirectSpy.mock.calls[0][0];

      // Expected adjusted start is 10:00Z - 5h30m = 04:30Z
      expect(meetingArg.start_time).toBe('2023-10-01T04:30:00.000Z');
      // Duration from 10:00Z->11:30Z is 90 min; minus 5h30m both sides still 90
      expect(meetingArg.duration).toBe(90);
      // Instructor included as alternative host if present
      expect(meetingArg.settings.alternative_hosts).toBe('instructor@zuvy.org');

      expect(createGoogleCalendarEventSpy).toHaveBeenCalledTimes(1);
      expect(validateAndCreateChapterSpy).toHaveBeenCalledTimes(1);
      expect(saveSessionsSpy).toHaveBeenCalledWith(expect.any(Array));

      expect(result).toEqual({
        status: 'success',
        message: 'Zoom session created successfully',
        data: [{ id: 1 }],
      });
    });

    it('should continue if Google Calendar creation fails and still save session', async () => {
      jest.spyOn<any, any>(service as any, 'getStudentsEmails').mockResolvedValue({
        success: true,
        students: [{ id: 1, email: 's1@example.com' }],
        instructor: null,
      });

      jest.spyOn<any, any>(service as any, 'createZoomMeetingDirect').mockResolvedValue({
        success: true,
        data: { id: 1, join_url: 'join', start_url: 'start', password: 'p' },
      });

      jest.spyOn<any, any>(service as any, 'createGoogleCalendarEvent').mockResolvedValue({
        success: false,
        error: 'calendar down',
      });

      jest.spyOn<any, any>(service as any, 'validateAndCreateChapter').mockResolvedValue({
        success: true, chapter: { id: 10 }, bootcampId: 999,
      });

      jest.spyOn<any, any>(service as any, 'saveSessionsToDatabase').mockResolvedValue({
        status: 'success', data: [{ id: 1 }],
      });

      const out = await service.createZoomSession({ ...baseEvent } as any, { email: 'x' });

      expect(out.status).toBe('success');
    });

    it('should return error if Zoom meeting creation fails', async () => {
      jest.spyOn<any, any>(service as any, 'getStudentsEmails').mockResolvedValue({
        success: true,
        students: [],
        instructor: null,
      });

      jest.spyOn<any, any>(service as any, 'createZoomMeetingDirect').mockResolvedValue({
        success: false,
        error: 'zoom err',
      });

      const out = await service.createZoomSession({ ...baseEvent } as any, { email: 'x' });
      expect(out.status).toBe('error');
      expect(out.message).toBe('Failed to create Zoom session');
      expect(out.error).toBe('Failed to create Zoom meeting: zoom err');
    });
  });

  describe('createGoogleMeetSession', () => {
    const creatorInfo = { email: 'host@zuvy.org' };
    const baseEvent = {
      title: 'Meet Class',
      description: 'desc',
      startDateTime: '2023-11-01T10:00:00.000Z',
      endDateTime: '2023-11-01T11:00:00.000Z',
      timeZone: 'Asia/Kolkata',
      batchId: 11,
      bootcampId: 22,
      moduleId: 33,
    };

    it('should create calendar event and save session', async () => {
      jest.spyOn<any, any>(service as any, 'validateAndCreateChapter').mockResolvedValue({
        success: true, chapter: { id: 1 }, bootcampId: 22,
      });
      jest.spyOn<any, any>(service as any, 'getStudentsEmails').mockResolvedValue({
        success: true, students: [{ id: 1, email: 'a@e.com' }],
      });
      jest.spyOn<any, any>(service as any, 'createGoogleCalendarEvent').mockResolvedValue({
        success: true, data: { id: 'cal-1', hangoutLink: 'https://meet.google.com/xyz' },
      });
      jest.spyOn<any, any>(service as any, 'saveSessionsToDatabase').mockResolvedValue({
        status: 'success', data: [{ id: 123 }],
      });

      const out = await service.createGoogleMeetSession(baseEvent as any, creatorInfo);
      expect(out).toEqual({
        status: 'success',
        message: 'Google Meet session created successfully',
        data: [{ id: 123 }],
      });
    });

    it('should return error if calendar creation fails', async () => {
      jest.spyOn<any, any>(service as any, 'validateAndCreateChapter').mockResolvedValue({
        success: true, chapter: { id: 1 }, bootcampId: 22,
      });
      jest.spyOn<any, any>(service as any, 'getStudentsEmails').mockResolvedValue({
        success: true, students: [{ id: 1, email: 'a@e.com' }],
      });
      jest.spyOn<any, any>(service as any, 'createGoogleCalendarEvent').mockResolvedValue({
        success: false, error: 'down',
      });

      const out = await service.createGoogleMeetSession(baseEvent as any, creatorInfo);
      expect(out.status).toBe('error');
      expect(out.message).toBe('Failed to create Google Meet session');
    });
  });

  describe('uploadVideoToS3 (private)', () => {
    it('should throw a friendly error when S3 upload fails', async () => {
      mockS3UploadPromise.mockRejectedValue(new Error('S3 down'));
      await expect(
        (service as any).uploadVideoToS3(Buffer.from('data'), 'file.mp4')
      ).rejects.toThrow('Error uploading video to S3');
    });

    it('should return the constructed S3 URL on success', async () => {
      mockS3UploadPromise.mockResolvedValue({});
      const url = await (service as any).uploadVideoToS3(Buffer.from('data'), 'file.mp4');
      expect(mockS3Upload).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'class-recordings/file.mp4',
        Body: expect.any(Buffer),
      });
      expect(url).toBe('https://test-bucket.s3.amazonaws.com/class-recordings/file.mp4');
    });
  });
});