import 'jest';
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { ClassesService } from '../classes.service'; // Adjust import if service is colocated
import { ZoomService } from '../../services/zoom/zoom.service';

// Mocks for external modules
jest.mock('googleapis', () => {
  const calendarsGetMock = jest.fn();
  const eventsInsertMock = jest.fn();
  const eventsDeleteMock = jest.fn();
  const eventsUpdateMock = jest.fn();
  const eventsGetMock = jest.fn();
  const adminActivitiesListMock = jest.fn();

  return {
    google: {
      calendar: jest.fn(() => ({
        calendars: { get: calendarsGetMock },
        events: {
          insert: eventsInsertMock,
          delete: eventsDeleteMock,
          update: eventsUpdateMock,
          get: eventsGetMock,
        },
      })),
      admin: jest.fn(() => ({
        activities: {
          list: adminActivitiesListMock,
        },
      })),
    },
    // Expose internals for assertions if needed
    __mocks__: {
      calendarsGetMock,
      eventsInsertMock,
      eventsDeleteMock,
      eventsUpdateMock,
      eventsGetMock,
      adminActivitiesListMock,
    },
  };
});

jest.mock('../../auth/google-auth', () => {
  const generateAuthUrl = jest.fn();
  const getToken = jest.fn();
  const setCredentials = jest.fn();
  return {
    auth2Client: { generateAuthUrl, getToken, setCredentials },
    __mocks__: { generateAuthUrl, getToken, setCredentials },
  };
});

jest.mock('../../db/index', () => {
  const selectMock = jest.fn();
  const insertMock = jest.fn();
  const updateMock = jest.fn();
  const deleteMock = jest.fn();
  const returningMock = jest.fn(function(this: any) { return this; });
  const valuesMock = jest.fn(function(this: any) { return this; });
  const whereMock = jest.fn(function(this: any) { return this; });
  const limitMock = jest.fn(function(this: any) { return this; });
  const innerJoinMock = jest.fn(function(this: any) { return this; });
  const leftJoinMock = jest.fn(function(this: any) { return this; });
  const onConflictDoUpdateMock = jest.fn(function(this: any) { return this; });
  const setMock = jest.fn(function(this: any) { return this; });
  const executeMock = jest.fn(function(this: any) { return { rowCount: 1 }; });
  const orderByMock = jest.fn(function(this: any) { return this; });
  const offsetMock = jest.fn(function(this: any) { return this; });
  const $dynamicMock = jest.fn(function(this: any) { return this; });

  const db = {
    select: jest.fn(() => ({
      from: jest.fn(() => ({
        where: whereMock,
        limit: limitMock,
        innerJoin: innerJoinMock,
        leftJoin: leftJoinMock,
        orderBy: orderByMock,
      })),
      $dynamic: $dynamicMock,
      fromRaw: jest.fn(),
    })),
    insert: jest.fn(() => ({
      values: valuesMock,
      returning: returningMock,
      execute: executeMock,
      onConflictDoUpdate: onConflictDoUpdateMock,
    })),
    update: jest.fn(() => ({
      set: setMock,
      where: whereMock,
      execute: executeMock,
    })),
    delete: jest.fn(() => ({
      where: whereMock,
    })),
  };
  return { db, __mocks__: { db } };
});

jest.mock('aws-sdk', () => {
  const uploadMock = jest.fn().mockReturnValue({ promise: jest.fn().mockResolvedValue({}) });
  class S3 {
    upload = uploadMock;
  }
  return { S3, __mocks__: { uploadMock } };
});

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'uuid-123'),
}));

// Drizzle schema symbols referenced by service; provide minimal dummies to avoid import errors
jest.mock('../../../drizzle/schema', () => {
  // Provide symbol-like objects that service references without structural enforcement.
  return {
    zuvySessions: { id: 'zuvySessions.id', meetingId: 'zuvySessions.meetingId', hangoutLink: 'zuvySessions.hangoutLink', startTime: 'zuvySessions.startTime', endTime: 'zuvySessions.endTime', batchId: 'zuvySessions.batchId', bootcampId: 'zuvySessions.bootcampId', moduleId: 'zuvySessions.moduleId', chapterId: 'zuvySessions.chapterId', title: 'zuvySessions.title', status: 'zuvySessions.status', zoomStartUrl: 'zuvySessions.zoomStartUrl', zoomPassword: 'zuvySessions.zoomPassword', zoomMeetingId: 'zuvySessions.zoomMeetingId', s3link: 'zuvySessions.s3link', recurringId: 'zuvySessions.recurringId', hasBeenMerged: 'zuvySessions.hasBeenMerged' },
    zuvyStudentAttendance: { meetingId: 'zuvyStudentAttendance.meetingId', attendance: 'zuvyStudentAttendance.attendance', batchId: 'zuvyStudentAttendance.batchId', bootcampId: 'zuvyStudentAttendance.bootcampId' },
    zuvyStudentAttendanceRecords: { userId: 'zuvyStudentAttendanceRecords.userId', sessionId: 'zuvyStudentAttendanceRecords.sessionId', status: 'zuvyStudentAttendanceRecords.status', attendanceDate: 'zuvyStudentAttendanceRecords.attendanceDate' },
    zuvyBatches: { id: 'zuvyBatches.id', bootcampId: 'zuvyBatches.bootcampId', instructorId: 'zuvyBatches.instructorId', name: 'zuvyBatches.name' },
    zuvyBatchEnrollments: { userId: 'zuvyBatchEnrollments.userId', batchId: 'zuvyBatchEnrollments.batchId', bootcampId: 'zuvyBatchEnrollments.bootcampId' },
    zuvyCourseModules: { id: 'zuvyCourseModules.id' },
    zuvyModuleChapter: { id: 'zuvyModuleChapter.id' },
    zuvyBootcamps: { id: 'zuvyBootcamps.id' },
    userTokens: { userEmail: 'userTokens.userEmail', userId: 'userTokens.userId', accessToken: 'userTokens.accessToken', refreshToken: 'userTokens.refreshToken' },
    users: { id: 'users.id', email: 'users.email', name: 'users.name' },
    zuvySessionMerge: { id: 'zuvySessionMerge.id', childSessionId: 'zuvySessionMerge.childSessionId', parentSessionId: 'zuvySessionMerge.parentSessionId', redirectMeetingUrl: 'zuvySessionMerge.redirectMeetingUrl', isActive: 'zuvySessionMerge.isActive' },
  };
});

// Drizzle helpers used by service; provide stubs so .where(eq(...)) doesn't crash during tests
jest.mock('drizzle-orm', () => ({
  eq: (..._args: any[]) => ({}),
  desc: (..._args: any[]) => ({}),
  and: (..._args: any[]) => ({}),
  or: (..._args: any[]) => ({}),
  sql: (..._args: any[]) => ({}),
  ilike: (..._args: any[]) => ({}),
  inArray: (..._args: any[]) => ({}),
}));

// Extract inner mocks for fine control
const { google, __mocks__: googleMocks } = jest.requireMock('googleapis');
const { auth2Client, __mocks__: authMocks } = jest.requireMock('../../auth/google-auth');
const { db: dbMock } = jest.requireMock('../../db/index').__mocks__;

describe('ClassesService', () => {
  let service: ClassesService;
  let zoomService: jest.Mocked<ZoomService>;

  beforeEach(async () => {
    jest.clearAllMocks();
    // Minimal ZoomService mock
    zoomService = {
      createMeeting: jest.fn(),
      updateMeeting: jest.fn(),
      deleteMeeting: jest.fn(),
      getMeeting: jest.fn(),
      getMeetingParticipants: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassesService,
        { provide: ZoomService, useValue: zoomService },
      ],
    }).compile();

    service = module.get<ClassesService>(ClassesService);
  });

  describe('accessOfCalendar', () => {
    const creator = { id: 1, email: 'user@example.com' };

    it('returns auth URL when no tokens exist', async () => {
      // getUserTokens underlying query: return empty result
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([]),
        }),
      } as any);

      authMocks.generateAuthUrl.mockReturnValue('https://auth.example.com');

      const result = await service.accessOfCalendar(creator);
      expect(result.status).toBe('error');
      expect(result.authUrl).toBe('https://auth.example.com');
      expect(authMocks.generateAuthUrl).toHaveBeenCalled();
    });

    it('verifies calendar access when tokens exist (happy path)', async () => {
      // getUserTokens => returns token
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      } as any);

      authMocks.setCredentials.mockImplementation(() => {});
      // calendars.get resolves ok
      const calsGet = (google as any).__mocks__.calendarsGetMock || googleMocks.calendarsGetMock;
      calsGet.mockResolvedValueOnce({ data: {} });

      const result = await service.accessOfCalendar(creator);
      expect(result.status).toBe('success');
      expect(result.message).toBe('Calendar access verified');
      expect(authMocks.setCredentials).toHaveBeenCalledWith({ access_token: 'at', refresh_token: 'rt' });
      expect(calsGet).toHaveBeenCalledWith({ calendarId: 'primary' });
    });

    it('handles errors gracefully', async () => {
      // tokens exist but calendars.get throws
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      } as any);

      const calsGet = (google as any).__mocks__.calendarsGetMock || googleMocks.calendarsGetMock;
      calsGet.mockRejectedValueOnce(new Error('boom'));

      const result = await service.accessOfCalendar(creator);
      expect(result.status).toBe('error');
      expect(result.message).toBe('Failed to access calendar');
      expect(result.error).toBe('boom');
    });
  });

  describe('saveTokensToDatabase', () => {
    it('saves tokens and returns success', async () => {
      dbMock.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          onConflictDoUpdate: jest.fn().mockReturnValue({}),
        }),
      } as any);

      const res = await service.saveTokensToDatabase(
        { access_token: 'at', refresh_token: 'rt' },
        { id: 10, email: 'u@e.com' },
      );
      expect(dbMock.insert).toHaveBeenCalled();
      expect(res.status).toBe('success');
    });

    it('handles DB error', async () => {
      dbMock.insert.mockImplementationOnce(() => { throw new Error('db failed'); });
      const res = await service.saveTokensToDatabase(
        { access_token: 'at', refresh_token: 'rt' },
        { id: 10, email: 'u@e.com' },
      );
      expect(res.status).toBe('error');
      expect(res.error).toBe('db failed');
    });
  });

  describe('createGoogleCalendarEvent', () => {
    it('returns error when tokens missing', async () => {
      // getUserTokens => []
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([]),
        }),
      } as any);
      // @ts-ignore access private via any
      const result = await (service as any).createGoogleCalendarEvent({ title: 't' }, { email: 'x@y.com' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('No calendar tokens found for user');
    });

    it('inserts event and returns success', async () => {
      // tokens exist
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      } as any);

      const eventsInsert = (google as any).__mocks__.eventsInsertMock || googleMocks.eventsInsertMock;
      eventsInsert.mockResolvedValueOnce({ data: { id: 'evt-1', hangoutLink: 'meet-link' } });

      // @ts-ignore
      const result = await (service as any).createGoogleCalendarEvent({
        title: 'Class 1',
        description: 'desc',
        startTime: '2025-08-14T10:00:00.000Z',
        endTime: '2025-08-14T11:00:00.000Z',
        timeZone: 'UTC',
        attendees: ['a@b.com', 'c@d.com'],
      }, { email: 'admin@ex.com' });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: 'evt-1', hangoutLink: 'meet-link' });
      expect(eventsInsert).toHaveBeenCalledWith({
        calendarId: 'primary',
        requestBody: expect.objectContaining({
          summary: 'Class 1',
          start: expect.any(Object),
          end: expect.any(Object),
          attendees: [{ email: 'a@b.com' }, { email: 'c@d.com' }],
          conferenceData: expect.any(Object),
        }),
        conferenceDataVersion: 1,
      });
    });

    it('handles insert error', async () => {
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      } as any);
      const eventsInsert = (google as any).__mocks__.eventsInsertMock || googleMocks.eventsInsertMock;
      eventsInsert.mockRejectedValueOnce(new Error('insert failed'));

      // @ts-ignore
      const result = await (service as any).createGoogleCalendarEvent({ title: 'x' }, { email: 'admin@ex.com' });
      expect(result.success).toBe(false);
      expect(result.error).toBe('insert failed');
    });
  });

  describe('createZoomSession', () => {
    const creatorInfo = { id: 91, email: 'admin@ex.com', roles: ['admin'] };
    const eventDetails = {
      title: 'Zoom Class',
      description: 'desc',
      startDateTime: '2025-08-14T10:00:00.000Z',
      endDateTime: '2025-08-14T11:00:00.000Z',
      timeZone: 'UTC',
      batchId: 5,
      bootcampId: 2,
      moduleId: 3,
    };

    function mockValidateAndCreateChapter(success = true) {
      // intercept private method via prototype spy
      const spy = jest.spyOn<any, any>(service as any, 'validateAndCreateChapter')
        .mockResolvedValue(success ? ({ success: true, chapter: { id: 77 }, bootcampId: 2 }) : ({ success: false, message: 'bad chapter' }));
      return spy;
    }

    function mockStudents(success = true) {
      // getStudentsEmails is private; spy on prototype
      jest.spyOn<any, any>(service as any, 'getStudentsEmails').mockResolvedValue(success ? ({
        success: true,
        emails: ['s1@e.com', 's2@e.com'],
        students: [{ email: 's1@e.com', name: 'S1' }, { email: 's2@e.com', name: 'S2' }],
        instructor: { email: 'inst@e.com', name: 'Inst' },
      }) : ({ success: false, message: 'no students' }));
    }

    function mockDBForSaveSessions() {
      dbMock.insert.mockReturnValueOnce({
        values: jest.fn().mockReturnValue({
          returning: jest.fn().mockReturnValue([{ id: 1001 }]),
        }),
      } as any);
    }

    it('creates zoom meeting, calendar event, and saves session (happy path)', async () => {
      mockValidateAndCreateChapter(true);
      mockStudents(true);

      // Zoom creation
      zoomService.createMeeting.mockResolvedValue({
        success: true,
        data: { id: 98765, join_url: 'https://zoom.us/j/98765', start_url: 'https://zoom.us/s/98765', password: 'p' },
      });

      // Calendar create success
      dbMock.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      }) as any);
      const eventsInsert = (google as any).__mocks__.eventsInsertMock || googleMocks.eventsInsertMock;
      eventsInsert.mockResolvedValueOnce({ data: { id: 'cal-evt-1', hangoutLink: 'n/a' } });

      // Save session to DB
      mockDBForSaveSessions();

      const res = await service.createZoomSession(eventDetails as any, creatorInfo as any);
      expect(res.status).toBe('success');
      expect(zoomService.createMeeting).toHaveBeenCalled();
      expect(eventsInsert).toHaveBeenCalled();
      expect(dbMock.insert).toHaveBeenCalled();
    });

    it('returns error when students fetch fails', async () => {
      mockValidateAndCreateChapter(true);
      mockStudents(false);
      const res = await service.createZoomSession(eventDetails as any, creatorInfo as any);
      expect(res.status).toBe('error');
      expect(res.message).toBe('Failed to create Zoom session');
      expect(res.error).toMatch(/Failed to fetch students/);
    });

    it('handles zoom meeting creation failure', async () => {
      mockValidateAndCreateChapter(true);
      mockStudents(true);
      zoomService.createMeeting.mockResolvedValue({ success: false, error: 'zoom down' });
      const res = await service.createZoomSession(eventDetails as any, creatorInfo as any);
      expect(res.status).toBe('error');
      expect(res.error).toMatch(/Failed to create Zoom meeting: zoom down/);
    });

    it('skips calendar event if google fails but continues', async () => {
      mockValidateAndCreateChapter(true);
      mockStudents(true);
      zoomService.createMeeting.mockResolvedValue({
        success: true,
        data: { id: 123, join_url: 'join', start_url: 'start', password: 'p' },
      });

      // getUserTokens
      dbMock.select.mockImplementationOnce(() => ({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      }) as any);

      const eventsInsert = (google as any).__mocks__.eventsInsertMock || googleMocks.eventsInsertMock;
      eventsInsert.mockRejectedValueOnce(new Error('calendar fail'));

      mockDBForSaveSessions();

      const res = await service.createZoomSession(eventDetails as any, creatorInfo as any);
      expect(res.status).toBe('success');
      expect(zoomService.createMeeting).toHaveBeenCalled();
      expect(dbMock.insert).toHaveBeenCalled();
    });
  });

  describe('getAttendance', () => {
    const userAdmin = { id: 1, email: 'a@e.com', roles: ['admin'] };

    it('returns 404 when session not found', async () => {
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([]),
          limit: jest.fn().mockReturnValue([]),
        }),
      } as any);

      const [err, data] = await service.getAttendance('meet-1', userAdmin, false);
      expect(err).toBeTruthy();
      expect(err?.code).toBe(404);
      expect(data).toBeNull();
    });

    it('fetches existing attendance successfully', async () => {
      // session exists
      dbMock.select
        .mockReturnValueOnce({ // for session lookup
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([{ id: 42, meetingId: 'meet-42', batchId: 5, bootcampId: 2, isZoomMeet: false }]),
            limit: jest.fn().mockReturnValue([{ id: 42, meetingId: 'meet-42', batchId: 5, bootcampId: 2, isZoomMeet: false }]),
          }),
        } as any)
        .mockReturnValueOnce({ // for attendance fetch
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([{ attendance: [{ email: 's1', duration: 100, attendance: 'present' }] }]),
            limit: jest.fn().mockReturnValue([{ attendance: [{ email: 's1', duration: 100, attendance: 'present' }] }]),
          }),
        } as any);

      const [err, ok] = await service.getAttendance('meet-42', userAdmin, false);
      expect(err).toBeNull();
      expect(ok?.status).toBe('success');
      expect(ok?.data.attendance).toBeDefined();
    });

    it('falls back to fetchGoogleMeetAttendanceForSession when missing', async () => {
      // session exists and is google meet
      dbMock.select
        .mockReturnValueOnce({ // session lookup
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([{ id: 88, meetingId: 'm88', batchId: 1, bootcampId: 1, isZoomMeet: false }]),
            limit: jest.fn().mockReturnValue([{ id: 88, meetingId: 'm88', batchId: 1, bootcampId: 1, isZoomMeet: false }]),
          }),
        } as any)
        .mockReturnValueOnce({ // attendance lookup
          from: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue([]),
            limit: jest.fn().mockReturnValue([]),
          }),
        } as any);

      const spy = jest.spyOn(service as any, 'fetchGoogleMeetAttendanceForSession').mockResolvedValue({ success: true } as any);

      const [err, ok] = await service.getAttendance('m88', userAdmin, false);
      expect(err).toBeNull();
      expect(ok?.success).toBe(true);
      expect(spy).toHaveBeenCalledWith(88, false);
    });
  });

  describe('uploadVideoToS3', () => {
    it('uploads and returns s3 URL', async () => {
      process.env.S3_ACCESS_KEY_ID = 'ak';
      process.env.S3_SECRET_KEY_ACCESS = 'sk';
      process.env.S3_BUCKET_NAME = 'bucket';

      // @ts-ignore private
      const url = await (service as any).uploadVideoToS3(Buffer.from('x'), 'file.mp4');
      expect(url).toBe('https://bucket.s3.amazonaws.com/class-recordings/file.mp4');
    });

    it('throws error when upload fails', async () => {
      const { S3: S3Module } = jest.requireMock('aws-sdk');
      const uploadMock = (S3Module as any).__mocks__.uploadMock;
      uploadMock.mockReturnValueOnce({ promise: jest.fn().mockRejectedValue(new Error('s3fail')) });

      await expect(
        // @ts-ignore
        (service as any).uploadVideoToS3(Buffer.from('x'), 'file.mp4')
      ).rejects.toThrow('Error uploading video to S3');
    });
  });

  describe('fetchRecordingForMeeting', () => {
    it('returns early when no tokens', async () => {
      // getUserTokens('team@zuvy.org') => []
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([]),
        }),
      } as any);

      // @ts-ignore
      const res = await service.fetchRecordingForMeeting('evt-1');
      expect(res).toBeUndefined();
    });

    it('updates session with recording fileUrl found in attachments', async () => {
      // tokens exist
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      } as any);
      // calendar events.get returns attachment with fileUrl
      const eventsGet = (google as any).__mocks__.eventsGetMock || googleMocks.eventsGetMock;
      eventsGet.mockResolvedValueOnce({
        data: {
          attachments: [
            { mimeType: 'application/pdf', fileUrl: 'x' },
            { mimeType: 'video/mp4', fileUrl: 'https://meet.example.com/rec.mp4', title: 'Recording' },
          ],
        },
      });

      // db.update resolve
      dbMock.update.mockReturnValueOnce({
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({ execute: jest.fn() }),
        }),
      } as any);

      const res = await service.fetchRecordingForMeeting('evt-1');
      expect(res).toBe('https://meet.example.com/rec.mp4');
      expect(eventsGet).toHaveBeenCalledWith({ calendarId: 'primary', eventId: 'evt-1' });
      expect(dbMock.update).toHaveBeenCalled();
    });

    it('returns null on API error', async () => {
      // tokens exist
      dbMock.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue([{ accessToken: 'at', refreshToken: 'rt' }]),
        }),
      } as any);
      const eventsGet = (google as any).__mocks__.eventsGetMock || googleMocks.eventsGetMock;
      eventsGet.mockRejectedValueOnce(new Error('api down'));

      const res = await service.fetchRecordingForMeeting('evt-2');
      expect(res).toBeNull();
    });
  });
});

/**
 Note: Testing library and framework
 - Using Jest as the test runner and assertion library with @nestjs/testing for NestJS module scaffolding and dependency injection.
 - External services (googleapis, ZoomService, drizzle db, aws-sdk S3, uuid) are mocked to isolate unit behaviors.
*/