import { Test, TestingModule } from '@nestjs/testing';
import { ScheduleService } from './schedule.service';
import { Logger } from '@nestjs/common';
import { ClassesService } from '../controller/classes/classes.service';
import { Cron } from '@nestjs/schedule';

// We will mock the external modules used inside the service.
// Mock drizzle schema symbols used only to be passed into mocked db calls.
const mockSchema = {
  userTokens: {},
  zuvySessions: {},
  zuvyBatchEnrollments: {},
  users: {},
  zuvyStudentAttendance: {},
  zuvyOutsourseAssessments: {},
};

// jest.mock for modules imported in the service
jest.mock('../db/index', () => {
  // Provide a highly flexible, chainable mock for drizzle-orm query builder
  // We'll stub the methods we need per test via overrides.
  const chain = () => ({
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
  });
  const db = chain();
  // Expose ability to swap methods in tests
  (db as any).__chainFactory = chain;
  return { db };
});

jest.mock('../../drizzle/schema', () => mockSchema);

// Mock googleapis usage within service
const mockCalendarGet = jest.fn();
const mockCalendar = jest.fn().mockReturnValue({
  events: {
    get: mockCalendarGet,
  },
});
const mockAdmin = jest.fn().mockReturnValue({
  activities: {
    list: jest.fn(),
  },
});
const mockDrive = jest.fn().mockReturnValue({
  files: {
    get: jest.fn(),
  },
});

const mockJWTAuthorize = jest.fn();
const mockOAuth2SetCredentials = jest.fn();

jest.mock('googleapis', () => {
  const original = jest.requireActual('googleapis');
  return {
    google: {
      auth: {
        OAuth2: jest.fn().mockImplementation(() => ({
          setCredentials: mockOAuth2SetCredentials,
        })),
        JWT: jest.fn().mockImplementation(() => ({
          authorize: mockJWTAuthorize,
        })),
      },
      calendar: (...args: any[]) => mockCalendar(...args),
      admin: (...args: any[]) => mockAdmin(...args),
      drive: (...args: any[]) => mockDrive(...args),
    },
    // Preserve types if needed
    ...original,
  };
});

// Silence logger during unit tests but allow inspection
const loggerLog = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
const loggerWarn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
const loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

// Mock timers to control setTimeout and cron-like behavior
jest.useFakeTimers();

describe('ScheduleService', () => {
  let service: ScheduleService;
  let classesService: { processCompletedSessionsForAttendance: jest.Mock };

  // Helper to reset db chainable mocks between tests
  function resetDb() {
    const { db } = require('../db/index');
    const chainFactory = (db as any).__chainFactory;
    const fresh = chainFactory();
    Object.keys(fresh).forEach((k) => {
      if (typeof fresh[k] === 'function') {
        (db as any)[k] = fresh[k];
      }
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    resetDb();

    classesService = {
      processCompletedSessionsForAttendance: jest.fn().mockResolvedValue(undefined),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: ClassesService, useValue: classesService },
      ],
    }).compile();

    service = module.get<ScheduleService>(ScheduleService);
  });

  afterAll(() => {
    jest.useRealTimers();
    loggerLog.mockRestore();
    loggerWarn.mockRestore();
    loggerError.mockRestore();
  });

  describe('getDayBounds', () => {
    it('should compute start and end of the given day', () => {
      const date = new Date('2024-01-15T12:34:56.789Z');
      // @ts-expect-error access private for test
      const [start, end] = service['getDayBounds'](date);
      expect(start.getUTCHours()).toBe(0);
      expect(start.getUTCMinutes()).toBe(0);
      expect(start.getUTCSeconds()).toBe(0);
      expect(start.getUTCMilliseconds()).toBe(0);
      // Notice endOfDay using 24:59:59.999 yields next day hour 0 with minute 59, second 59, ms 999 in local tz.
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
    });
  });

  describe('shouldProcessSessions', () => {
    it('returns true if time since last run exceeds matched interval', () => {
      const now = new Date();
      // Force lastProcessedTime to be far in the past
      // @ts-expect-error override for test
      service['lastProcessedTime'] = new Date(now.getTime() - 200 * 60 * 1000);
      expect(
        // @ts-expect-error access private
        service['shouldProcessSessions'](0, now)
      ).toBe(true);
    });

    it('returns false if within the matched interval window', () => {
      const now = new Date();
      // Using condition bracket [0..1] with interval 100*60*1000 (per code comments).
      // Set lastProcessedTime to just 10 min ago
      // @ts-expect-error override
      service['lastProcessedTime'] = new Date(now.getTime() - 10 * 60 * 1000);
      expect(
        // @ts-expect-error
        service['shouldProcessSessions'](1, now)
      ).toBe(false);
    });

    it('falls back to default 1 minute interval if no condition matches', () => {
      const now = new Date();
      // @ts-expect-error override
      service['lastProcessedTime'] = new Date(now.getTime() - 30 * 1000);
      // Use an out-of-range session count to avoid matching any condition, e.g., 1000
      expect(
        // @ts-expect-error
        service['shouldProcessSessions'](1000, now)
      ).toBe(false);
      // After 65 seconds
      // @ts-expect-error override
      service['lastProcessedTime'] = new Date(now.getTime() - 65 * 1000);
      expect(
        // @ts-expect-error
        service['shouldProcessSessions'](1000, now)
      ).toBe(true);
    });
  });

  describe('getIntervalBasedOnSessionCount', () => {
    it('returns the interval that matches provided conditions', () => {
      // @ts-expect-error private access
      const ms = service['getIntervalBasedOnSessionCount'](2);
      // Using code-defined conditions: sessionCount 2 falls into min:2 max:3 interval 70*60*1000
      expect(ms).toBe(70 * 60 * 1000);
    });

    it('returns default when no condition matches', () => {
      // @ts-expect-error private access
      const ms = service['getIntervalBasedOnSessionCount'](999);
      expect(ms).toBe(2 * 60 * 1000);
    });
  });

  describe('handleDynamicScheduling', () => {
    it('skips if previous job still running', async () => {
      // @ts-expect-error set flag
      service['processingActive'] = true;
      await service.handleDynamicScheduling();
      expect(loggerLog).toHaveBeenCalledWith('Skipping: Previous job still running');
    });

    it('fetches sessions and sets recursive timeout when processing should occur', async () => {
      const sessions = [{ id: 1 }, { id: 2 }];
      const shouldProcessSpy = jest
        // @ts-expect-error private access
        .spyOn(service as any, 'shouldProcessSessions')
        .mockReturnValue(true);

      // Mock fetchSessions to return two sessions
      const fetchSessionsSpy = jest
        // @ts-expect-error private access
        .spyOn(service as any, 'fetchSessions')
        .mockResolvedValue(sessions);

      // Spy on startRecursiveTimeout
      const startTimeoutSpy = jest
        // @ts-expect-error private access
        .spyOn(service as any, 'startRecursiveTimeout')
        .mockImplementation(() => undefined);

      await service.handleDynamicScheduling();

      expect(fetchSessionsSpy).toHaveBeenCalled();
      expect(shouldProcessSpy).toHaveBeenCalled();
      expect(startTimeoutSpy).toHaveBeenCalledWith(sessions);
      // @ts-expect-error check interval set
      expect(service['currentInterval']).toBeGreaterThan(0);
    });

    it('does not start recursive timeout if shouldProcessSessions returns false', async () => {
      jest
        // @ts-expect-error private access
        .spyOn(service as any, 'shouldProcessSessions')
        .mockReturnValue(false);
      const fetchSessionsSpy = jest
        // @ts-expect-error private access
        .spyOn(service as any, 'fetchSessions')
        .mockResolvedValue([{ id: 1 }]);
      const startTimeoutSpy = jest
        // @ts-expect-error private access
        .spyOn(service as any, 'startRecursiveTimeout')
        .mockImplementation(() => undefined);

      await service.handleDynamicScheduling();

      expect(fetchSessionsSpy).toHaveBeenCalled();
      expect(startTimeoutSpy).not.toHaveBeenCalled();
    });

    it('logs error and resets processingActive on failure', async () => {
      const fetchSessionsSpy = jest
        // @ts-expect-error private access
        .spyOn(service as any, 'fetchSessions')
        .mockRejectedValue(new Error('boom'));

      await service.handleDynamicScheduling();

      expect(fetchSessionsSpy).toHaveBeenCalled();
      expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('Scheduling error: boom'));
      // @ts-expect-error check flag was reset
      expect(service['processingActive']).toBe(false);
    });
  });

  describe('startRecursiveTimeout and processSessions', () => {
    it('schedules recursive processing and handles per-session processing with delays', async () => {
      // Keep the interval small to simulate tick
      // @ts-expect-error private
      service['currentInterval'] = 1000;

      const sessions = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const processSingleSessionSpy = jest
        // @ts-expect-error private
        .spyOn(service as any, 'processSingleSession')
        .mockResolvedValue(undefined);

      // @ts-expect-error private
      service['startRecursiveTimeout'](sessions);

      // Fast-forward initial timeout
      jest.advanceTimersByTime(1000);

      // processSessions kicks off processNext with 1 second per item
      // Allow the per-session delays to elapse
      jest.advanceTimersByTime(1_000 * sessions.length + 500);

      expect(processSingleSessionSpy).toHaveBeenCalledTimes(3);

      // It should schedule another recursive run after currentInterval
      jest.advanceTimersByTime(1000);
      // process again (but our spy doesn't track a reset index; the implementation restarts with same list)
      jest.advanceTimersByTime(1_000 * sessions.length + 500);
      expect(processSingleSessionSpy).toHaveBeenCalledTimes(6);
    });
  });

  describe('processSingleSession', () => {
    it('returns early if no session', async () => {
      // @ts-expect-error private access
      await service['processSingleSession'](null);
      expect(mockOAuth2SetCredentials).not.toHaveBeenCalled();
    });

    it('warns and returns if no tokens found for creator', async () => {
      const { db } = require('../db/index');
      // getUserTokens selects from userTokens where .userEmail === creator
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockResolvedValueOnce([]); // No tokens returned

      const session = { creator: 'a@b.com' };
      // @ts-expect-error private
      await service['processSingleSession'](session);

      expect(loggerWarn).toHaveBeenCalledWith('No tokens found for creator: a@b.com');
      expect(mockOAuth2SetCredentials).not.toHaveBeenCalled();
    });

    it('updates session link, handles old sessions and inserts attendance when not existing', async () => {
      const { db } = require('../db/index');

      // Mock getUserTokens call
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock)
        // getUserTokens result
        .mockResolvedValueOnce([{ accessToken: 'x', refreshToken: 'y' }])
        // check existing attendance
        .mockResolvedValueOnce([]); // no existing attendance

      // Mock google calendar event get -> with mp4 attachment
      mockCalendarGet.mockResolvedValueOnce({
        data: {
          attachments: [
            { mimeType: 'video/mp4', fileUrl: 'https://video.example/file.mp4' },
          ],
        },
      });

      // Mock db.update for updateSessionLink and handleOldSessions and attendance insert
      (db.update as jest.Mock).mockReturnThis();
      (db.set as jest.Mock).mockReturnThis();
      (db.insert as jest.Mock).mockReturnThis();
      (db.values as jest.Mock).mockReturnThis();
      (db.execute as jest.Mock).mockResolvedValue(undefined);

      // getAttendanceByBatchId should return [null, { data, status: 'success' }]
      const attendancePayload = { data: [{ email: 's1@example.com', duration: 10, attendance: 'present' }], status: 'success' };
      const getAttendanceSpy = jest
        // @ts-expect-error private
        .spyOn(service as any, 'getAttendanceByBatchId')
        .mockResolvedValue([null, attendancePayload]);

      const recentStart = new Date(Date.now() - (2 * 24 * 60 * 60 * 1000)).toISOString();
      const session = {
        id: 123,
        creator: 'a@b.com',
        meetingId: 'm-1',
        status: 'completed',
        batchId: 5,
        bootcampId: 9,
        startTime: recentStart, // not old session, but handleOldSessions still executes and evaluates condition
      };

      // @ts-expect-error private
      await service['processSingleSession'](session);

      expect(mockOAuth2SetCredentials).toHaveBeenCalledWith({
        access_token: 'x',
        refresh_token: 'y',
      });
      expect(mockCalendarGet).toHaveBeenCalledWith({
        calendarId: 'primary',
        eventId: 'm-1',
      });
      // update called at least once for s3link update
      expect(db.update).toHaveBeenCalled();
      // attendance insertion should happen
      expect(getAttendanceSpy).toHaveBeenCalledWith(5, 'a@b.com');
      expect(db.insert).toHaveBeenCalled();
    });

    it('does not insert attendance if attendance service returns array (error-like)', async () => {
      const { db } = require('../db/index');

      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock)
        .mockResolvedValueOnce([{ accessToken: 'x', refreshToken: 'y' }])
        .mockResolvedValueOnce([]); // no existing attendance

      mockCalendarGet.mockResolvedValueOnce({
        data: {
          attachments: [{ mimeType: 'video/mp4', fileUrl: 'https://video.example/file.mp4' }],
        },
      });

      (db.update as jest.Mock).mockReturnThis();
      (db.set as jest.Mock).mockReturnThis();
      (db.insert as jest.Mock).mockReturnThis();
      (db.values as jest.Mock).mockReturnThis();

      // Emulate getAttendanceByBatchId returning an array only (error branch)
      jest
        // @ts-expect-error private
        .spyOn(service as any, 'getAttendanceByBatchId')
        .mockResolvedValue([{ status: 'error', message: 'x' }]);

      const session = {
        id: 1, creator: 'c@d.com', meetingId: 'm2', status: 'completed', batchId: 10, bootcampId: 1, startTime: new Date().toISOString(),
      };

      // @ts-expect-error private
      await service['processSingleSession'](session);

      // Should not call insert for attendance because the payload was not the object with 'data'
      expect((db.insert as jest.Mock)).not.toHaveBeenCalledWith(expect.anything());
    });
  });

  describe('updateSessionLink', () => {
    it('updates s3link when mp4 attachment exists', async () => {
      const { db } = require('../db/index');
      (db.update as jest.Mock).mockReturnThis();
      (db.set as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockReturnThis();

      const calendar = { events: { get: jest.fn().mockResolvedValue({ data: { attachments: [{ mimeType: 'video/mp4', fileUrl: 'https://f.mp4' }] } }) } };
      const session = { id: 5 };
      // @ts-expect-error private
      await service['updateSessionLink'](calendar, session);

      expect(db.set).toHaveBeenCalledWith({ s3link: 'https://f.mp4' });
    });

    it('does nothing when there is no mp4 attachment', async () => {
      const { db } = require('../db/index');
      (db.update as jest.Mock).mockReturnThis();
      (db.set as jest.Mock).mockReturnThis();

      const calendar = { events: { get: jest.fn().mockResolvedValue({ data: { attachments: [{ mimeType: 'application/pdf', fileUrl: 'x' }] } }) } };
      const session = { id: 5 };
      // @ts-expect-error private
      await service['updateSessionLink'](calendar, session);

      // set should not have been called because no mp4 found
      expect(db.set).not.toHaveBeenCalledWith({ s3link: expect.any(String) });
    });
  });

  describe('handleOldSessions', () => {
    it('updates s3link to "not found" if older than 3 days', async () => {
      const { db } = require('../db/index');
      (db.update as jest.Mock).mockReturnThis();
      (db.set as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockReturnThis();
      const session = { id: 1, startTime: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() };
      // @ts-expect-error private
      await service['handleOldSessions'](session);
      expect(db.set).toHaveBeenCalledWith({ s3link: 'not found' });
    });

    it('does not update if within 3 days', async () => {
      const { db } = require('../db/index');
      (db.update as jest.Mock).mockReturnThis();
      (db.set as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockReturnThis();
      const session = { id: 1, startTime: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() };
      // @ts-expect-error private
      await service['handleOldSessions'](session);
      expect(db.set).not.toHaveBeenCalledWith({ s3link: 'not found' });
    });
  });

  describe('getUserTokens', () => {
    it('returns first record when tokens exist', async () => {
      const { db } = require('../db/index');
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      const tokenRow = { accessToken: 'a', refreshToken: 'b' };
      (db.where as jest.Mock).mockResolvedValue([tokenRow]);

      // @ts-expect-error private
      const res = await service['getUserTokens']('someone@example.com');
      expect(res).toEqual(tokenRow);
    });

    it('returns null when no tokens', async () => {
      const { db } = require('../db/index');
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockResolvedValue([]);

      // @ts-expect-error private
      const res = await service['getUserTokens']('none@example.com');
      expect(res).toBeNull();
    });
  });

  describe('getAttendanceByBatchId', () => {
    it('warns and returns error when user not found', async () => {
      const { db } = require('../db/index');

      // students
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock)
        // students
        .mockResolvedValueOnce([{ userId: 1 }])
        // userData -> empty
        .mockResolvedValueOnce([]);

      // @ts-expect-error private
      const res = await service['getAttendanceByBatchId'](100, 'creator@example.com');
      expect(loggerWarn).toHaveBeenCalledWith('No user found for email: creator@example.com');
      expect(Array.isArray(res)).toBe(true);
      expect(res[0]).toEqual([{ status: 'error', message: 'User not found' }]);
    });

    it('returns error when no tokens for user', async () => {
      const { db } = require('../db/index');

      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock)
        // students
        .mockResolvedValueOnce([{ userId: 1 }])
        // userData
        .mockResolvedValueOnce([{ id: 10 }])
        // tokens -> none
        .mockResolvedValueOnce([]);

      // @ts-expect-error private
      const res = await service['getAttendanceByBatchId'](100, 'creator@example.com');
      expect(res[0]).toEqual([{ status: 'error', message: 'Unable to fetch tokens' }]);
    });

    it('returns attendance data when all dependencies succeed', async () => {
      const { db } = require('../db/index');

      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock)
        // students
        .mockResolvedValueOnce([{ userId: 1 }])
        // userData
        .mockResolvedValueOnce([{ id: 10 }])
        // tokens
        .mockResolvedValueOnce([{ accessToken: 'at', refreshToken: 'rt' }])
        // meetings
        .mockResolvedValueOnce([{ meetingId: 'm1', status: 'completed' }]);

      // calculateAttendance returns [null, data]
      jest
        // @ts-expect-error private
        .spyOn(service as any, 'calculateAttendance')
        .mockResolvedValue([null, [{ email: 's1@example.com', attendance: 'present', duration: 123 }]]);

      // @ts-expect-error private
      const res = await service['getAttendanceByBatchId'](100, 'creator@example.com');
      expect(res[0]).toBeNull();
      expect(res[1]).toEqual({ data: [{ email: 's1@example.com', attendance: 'present', duration: 123 }], status: 'success' });
    });

    it('throws descriptive error on unexpected failure', async () => {
      const { db } = require('../db/index');

      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockRejectedValue(new Error('db-down'));

      await expect(
        // @ts-expect-error private
        service['getAttendanceByBatchId'](42, 'x@y.com')
      ).rejects.toThrow('Error fetching attendance: db-down');
    });
  });

  describe('calculateAttendance', () => {
    it('skips meetings with no recording and computes presence based on 75% cutoff', async () => {
      // Arrange: client.activities.list returns items for meeting with events
      const mockedActivitiesList = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              events: [
                {
                  parameters: [
                    { name: 'organizer_email', value: 'host@example.com' },
                    { name: 'identifier', value: 's1@example.com' },
                    { name: 'duration_seconds', intValue: 300 },
                  ],
                },
              ],
            },
          ],
        },
      });
      (mockAdmin as any).mockReturnValueOnce({ activities: { list: mockedActivitiesList } });

      // calendar.events.get returns no mp4 attachment, causing a skip
      (mockCalendar as any).mockReturnValueOnce({
        events: {
          get: jest.fn().mockResolvedValue({ data: { attachments: [{ mimeType: 'application/pdf' }] } }),
        },
      });

      // drive.files.get won't be called due to skip, but provide a default
      (mockDrive as any).mockReturnValueOnce({ files: { get: jest.fn() } });

      // jwt authorize is called
      mockJWTAuthorize.mockResolvedValue(undefined);

      // Prepare students and meetings
      const { db } = require('../db/index');
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      // For users lookup during building attendance map
      (db.where as jest.Mock).mockResolvedValueOnce([{ email: 's1@example.com', id: 1 }]);

      const meetings = [{ meetingId: 'm1' }];
      const students = [{ userId: 1 }];

      // @ts-expect-error private
      const [err, attendance] = await service['calculateAttendance']({}, meetings, students);
      expect(err).toBeNull();
      // Attendance for skipped meeting still results from baseline map with duration 0 -> absent
      expect(attendance).toEqual([
        { email: 's1@example.com', duration: 0, attendance: 'absent' },
      ]);
    });

    it('computes present when accumulated duration exceeds 75% of video length', async () => {
      // Activities list returns a host and two duration events
      const activitiesList = jest.fn().mockResolvedValue({
        data: {
          items: [
            {
              events: [
                {
                  parameters: [
                    { name: 'organizer_email', value: 'host@example.com' },
                    { name: 'identifier', value: 's1@example.com' },
                    { name: 'duration_seconds', intValue: 600 }, // 10 minutes
                  ],
                },
              ],
            },
          ],
        },
      });
      (mockAdmin as any).mockReturnValueOnce({ activities: { list: activitiesList } });

      // calendar events -> mp4 attachment
      const eventsGet = jest.fn().mockResolvedValue({
        data: {
          attachments: [{ mimeType: 'video/mp4', fileId: 'file-1' }],
        },
      });
      (mockCalendar as any).mockReturnValueOnce({ events: { get: eventsGet } });

      // drive video length -> 12 minutes (720 sec)
      const driveGet = jest.fn().mockResolvedValue({
        data: { videoMediaMetadata: { durationMillis: (12 * 60 * 1000).toString() } },
      });
      (mockDrive as any).mockReturnValueOnce({ files: { get: driveGet } });

      mockJWTAuthorize.mockResolvedValue(undefined);

      const { db } = require('../db/index');
      (db.select as jest.Mock).mockReturnThis();
      (db.from as jest.Mock).mockReturnThis();
      (db.where as jest.Mock).mockResolvedValueOnce([{ email: 's1@example.com', id: 1 }]);

      const meetings = [{ meetingId: 'm2' }];
      const students = [{ userId: 1 }];

      // @ts-expect-error private
      const [err, attendance] = await service['calculateAttendance']({}, meetings, students);
      expect(err).toBeNull();
      // cutoff = 75% of 720 sec = 540 sec. student = 600 sec -> present
      expect(attendance).toEqual([
        { email: 's1@example.com', duration: 600, attendance: 'present' },
      ]);
    });
  });

  describe('processZoomAttendance (Cron)', () => {
    it('invokes ClassesService to process completed sessions', async () => {
      await service.processZoomAttendance();
      expect(classesService.processCompletedSessionsForAttendance).toHaveBeenCalledTimes(1);
      expect(loggerLog).toHaveBeenCalledWith('Zoom attendance processing completed');
    });

    it('logs error if processing throws', async () => {
      classesService.processCompletedSessionsForAttendance.mockRejectedValueOnce(new Error('oops'));
      await service.processZoomAttendance();
      expect(loggerError).toHaveBeenCalledWith(expect.stringContaining('Error processing Zoom attendance: oops'));
    });
  });
});

/*
Note on framework:
- Tests are authored for Jest with NestJS TestingModule (@nestjs/testing) and jest timers.
- If repository uses a different framework than Jest, adjust imports and expectations accordingly.
*/