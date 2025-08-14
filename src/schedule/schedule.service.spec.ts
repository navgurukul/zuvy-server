/* 
  Test suite for ScheduleService

  Assumed Test Framework: Jest + ts-jest (NestJS default).
  If your repository uses a different test runner (e.g., Vitest, Mocha),
  adjust the imports and mocking accordingly.

  Strategy:
  - Pure/time-based logic tested with Jest fake timers and direct method invocation via (service as any) to access privates.
  - External services (db, googleapis, ClassesService) are mocked.
  - Focus on robustness: happy paths, edge cases, and error handling.

  NOTE: This suite purposefully avoids executing any real Google or DB calls.
*/

import { Logger } from '@nestjs/common';
import type { TestingModule } from '@nestjs/testing'; // only type ref, not used directly
// The service under test
import { ScheduleService } from './schedule.service';

// Hard-mock drizzle db module used by ScheduleService
// We emulate chainable API shapes for select/from/where, update/set/where, insert/values/execute
const makeChain = (finalValue: any) => ({
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue(finalValue),
});

const makeUpdateChain = () => ({
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockResolvedValue(undefined),
});

const makeInsertChain = () => ({
  values: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(undefined),
});

// Mocks for schema symbols to allow where()/eq() to reference values
const mockSchema = new Proxy({}, { get: (_t, p) => ({ [p as string]: p }) });

// Create a mod-scoped mutable db mock so each test can customize implementations
const dbSelect = jest.fn();
const dbUpdate = jest.fn();
const dbInsert = jest.fn();

jest.mock('../db/index', () => ({
  db: {
    select: (...args: any[]) => dbSelect(...args),
    update: (...args: any[]) => dbUpdate(...args),
    insert: (...args: any[]) => dbInsert(...args),
    query: {}, // not used by active code
  }
}));

// Mock drizzle schema import bindings to any object (fields not read directly by code)
jest.mock('../../drizzle/schema', () => ({
  userTokens: mockSchema.userTokens,
  zuvySessions: mockSchema.zuvySessions,
  zuvyBatchEnrollments: mockSchema.zuvyBatchEnrollments,
  users: mockSchema.users,
  zuvyStudentAttendance: mockSchema.zuvyStudentAttendance,
  zuvyOutsourseAssessments: mockSchema.zuvyOutsourseAssessments,
}));

// Mock googleapis
const setCredentialsMock = jest.fn();
const calendarEventsGetMock = jest.fn();
const googleCalendarMock = jest.fn(() => ({
  events: { get: calendarEventsGetMock },
}));
const jwtAuthorizeMock = jest.fn();
const googleDriveMock = jest.fn(() => ({
  files: { get: jest.fn() },
}));
const googleAdminMock = jest.fn(() => ({
  activities: { list: jest.fn() },
}));
const OAuth2Mock = jest.fn().mockImplementation(() => ({
  setCredentials: setCredentialsMock,
}));

jest.mock('googleapis', () => {
  const actual = jest.requireActual('googleapis');
  return {
    ...actual,
    google: {
      auth: {
        OAuth2: OAuth2Mock,
        JWT: jest.fn().mockImplementation((_opts) => ({
          authorize: jwtAuthorizeMock,
        })),
      },
      calendar: googleCalendarMock,
      admin: googleAdminMock,
      drive: googleDriveMock,
    },
  };
});

// Minimal ClassesService stub injected into ScheduleService ctor
class ClassesServiceStub {
  processCompletedSessionsForAttendance = jest.fn().mockResolvedValue(undefined);
}

describe('ScheduleService', () => {
  let service: ScheduleService;
  let classesService: ClassesServiceStub;

  // Silence Logger output in tests; spy for assertions where needed
  const loggerLogSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const loggerWarnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  const loggerErrorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2025-01-15T12:00:00.000Z'));

    // reset db function implementations between tests
    dbSelect.mockReset();
    dbUpdate.mockReset();
    dbInsert.mockReset();

    // sensible defaults for db chains
    dbSelect.mockImplementation(() => makeChain([]));
    dbUpdate.mockImplementation(() => makeUpdateChain());
    dbInsert.mockImplementation(() => makeInsertChain());

    // reset google mocks
    setCredentialsMock.mockReset();
    calendarEventsGetMock.mockReset();
    googleCalendarMock.mockClear();
    GoogleEnv.ensure(); // set envs for any code paths requiring them

    classesService = new ClassesServiceStub();
    service = new ScheduleService(classesService as any);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('getDayBounds (private)', () => {
    it('computes start at 00:00:00.000 and end with 59:59.999 (per implementation)', () => {
      const now = new Date('2025-08-20T10:23:45.678Z');
      const [start, end] = (service as any).getDayBounds(now);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
      expect(start.getMilliseconds()).toBe(0);

      // Implementation sets minutes=59, seconds=59, ms=999; hour may roll across days due to setHours(24,...)
      expect(end.getMinutes()).toBe(59);
      expect(end.getSeconds()).toBe(59);
      expect(end.getMilliseconds()).toBe(999);
      expect(end.getTime()).toBeGreaterThan(start.getTime());
    });
  });

  describe('shouldProcessSessions (private)', () => {
    it('returns false if time since last run is below matched interval', () => {
      (service as any).lastProcessedTime = new Date(Date.now() - 10 * 60 * 1000); // 10 min ago
      const now = new Date();
      // pick sessionCount within {min:2,max:3, interval:70min}
      const result = (service as any).shouldProcessSessions(2, now);
      expect(result).toBe(false);
    });

    it('returns true if time since last run meets matched interval threshold', () => {
      (service as any).lastProcessedTime = new Date(Date.now() - 80 * 60 * 1000); // 80 min ago
      const now = new Date();
      const result = (service as any).shouldProcessSessions(2, now); // 70 min interval bucket
      expect(result).toBe(true);
    });

    it('uses default 1 minute interval for out-of-range session counts', () => {
      (service as any).lastProcessedTime = new Date(Date.now() - 30 * 1000); // 30s ago
      const now = new Date();
      const result1 = (service as any).shouldProcessSessions(1000, now);
      expect(result1).toBe(false);
      (service as any).lastProcessedTime = new Date(Date.now() - 2 * 60 * 1000);
      const result2 = (service as any).shouldProcessSessions(1000, new Date());
      expect(result2).toBe(true);
    });
  });

  describe('getIntervalBasedOnSessionCount (private)', () => {
    it('returns interval for boundary values (inclusive ranges)', () => {
      expect((service as any).getIntervalBasedOnSessionCount(0)).toBe(100 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(1)).toBe(100 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(2)).toBe(70 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(3)).toBe(70 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(4)).toBe(40 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(6)).toBe(40 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(7)).toBe(30 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(10)).toBe(30 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(11)).toBe(20 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(13)).toBe(20 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(14)).toBe(10 * 60 * 1000);
      expect((service as any).getIntervalBasedOnSessionCount(15)).toBe(10 * 60 * 1000);
    });

    it('returns default interval for non-matching session counts', () => {
      expect((service as any).getIntervalBasedOnSessionCount(16)).toBe(2 * 60 * 1000);
    });
  });

  describe('resetTimeout (private)', () => {
    it('clears any existing timeout and logs', () => {
      const clearSpy = jest.spyOn(global, 'clearTimeout');
      (service as any).timeoutId = setTimeout(() => {}, 5000);
      (service as any).resetTimeout();
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(loggerLogSpy).toHaveBeenCalledWith('Previous timeout cleared');
    });

    it('no-op when no timeout is set', () => {
      const clearSpy = jest.spyOn(global, 'clearTimeout');
      (service as any).timeoutId = undefined;
      (service as any).resetTimeout();
      expect(clearSpy).not.toHaveBeenCalled();
    });
  });

  describe('startRecursiveTimeout (private)', () => {
    it('schedules processSessions and re-arms itself', async () => {
      const sessions = [{ id: 1 }];
      (service as any).currentInterval = 500;

      const processSpy = jest.spyOn(service as any, 'processSessions').mockResolvedValue(undefined);
      // intercept recursion call so it doesn't schedule again infinitely
      const rearmSpy = jest.spyOn(service as any, 'startRecursiveTimeout').mockImplementation(() => {});

      (service as any).startRecursiveTimeout(sessions);

      // Nothing called yet
      expect(processSpy).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      // After interval, it should process and then re-arm
      expect(processSpy).toHaveBeenCalledTimes(1);
      expect(processSpy).toHaveBeenCalledWith(sessions);
      expect(rearmSpy).toHaveBeenCalledTimes(1);
      expect(rearmSpy).toHaveBeenCalledWith(sessions);
    });

    it('logs error if processSessions throws', async () => {
      (service as any).currentInterval = 300;
      jest.spyOn(service as any, 'processSessions').mockRejectedValue(new Error('boom'));
      jest.spyOn(service as any, 'startRecursiveTimeout').mockImplementation(() => {});
      (service as any).startRecursiveTimeout([{ id: 1 }]);
      jest.advanceTimersByTime(300);
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error processing sessions: Error: boom'));
    });
  });

  describe('processSessions (private)', () => {
    it('processes each session with a 1 second delay between', async () => {
      const sessions = [{ s: 1 }, { s: 2 }, { s: 3 }];
      const singleSpy = jest.spyOn(service as any, 'processSingleSession').mockResolvedValue(undefined);

      await (service as any).processSessions(sessions);

      // First item processed immediately
      expect(singleSpy).toHaveBeenCalledTimes(1);
      expect(singleSpy).toHaveBeenNthCalledWith(1, sessions[0]);

      // Advance 1s to process #2
      jest.advanceTimersByTime(1000);
      await Promise.resolve(); // allow microtasks to flush
      expect(singleSpy).toHaveBeenCalledTimes(2);
      expect(singleSpy).toHaveBeenNthCalledWith(2, sessions[1]);

      // Advance 1s to process #3
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      expect(singleSpy).toHaveBeenCalledTimes(3);
      expect(singleSpy).toHaveBeenNthCalledWith(3, sessions[2]);
    });

    it('logs "All sessions processed" when list is empty', async () => {
      await (service as any).processSessions([]);
      expect(loggerLogSpy).toHaveBeenCalledWith('All sessions processed');
    });

    it('continues after a processing error', async () => {
      const sessions = [{ s: 1 }, { s: 2 }, { s: 3 }];
      const singleSpy = jest.spyOn(service as any, 'processSingleSession')
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Bad middle'))
        .mockResolvedValueOnce(undefined);

      await (service as any).processSessions(sessions);

      // First immediate
      expect(singleSpy).toHaveBeenCalledTimes(1);
      // Advance to second (error)
      jest.advanceTimersByTime(1000);
      await Promise.resolve();
      // Third
      jest.advanceTimersByTime(1000);
      await Promise.resolve();

      expect(singleSpy).toHaveBeenCalledTimes(3);
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error processing session: Error: Bad middle'));
    });
  });

  describe('processSingleSession (private)', () => {
    it('returns early if session is falsy', async () => {
      const result = await (service as any).processSingleSession(null);
      expect(result).toBeUndefined();
      expect(setCredentialsMock).not.toHaveBeenCalled();
    });

    it('warns and returns if no user tokens for creator', async () => {
      jest.spyOn(service as any, 'getUserTokens').mockResolvedValue(null);
      await (service as any).processSingleSession({ creator: 'x@y.z' });
      expect(loggerWarnSpy).toHaveBeenCalledWith('No tokens found for creator: x@y.z');
    });

    it('calls updateSessionLink and handleOldSessions for completed session with meetingId, inserts attendance when none exists', async () => {
      jest.spyOn(service as any, 'getUserTokens').mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      const updateLinkSpy = jest.spyOn(service as any, 'updateSessionLink').mockResolvedValue(undefined);
      const handleOldSpy = jest.spyOn(service as any, 'handleOldSessions').mockResolvedValue(undefined);

      // No existing attendance
      const selectChain = makeChain([]);
      dbSelect.mockReturnValue(selectChain);

      // getAttendanceByBatchId returns success object with data
      const attendance = { rows: [] };
      jest.spyOn(service as any, 'getAttendanceByBatchId').mockResolvedValue([null, { data: attendance, status: 'success' }]);

      const insertChain = makeInsertChain();
      const insertValuesSpy = insertChain.values;
      const insertExecuteSpy = insertChain.execute;
      dbInsert.mockReturnValue(insertChain);

      const session = {
        id: 101,
        creator: 'creator@example.com',
        meetingId: 'meet-123',
        status: 'completed',
        batchId: 7,
        bootcampId: 9,
      };

      await (service as any).processSingleSession(session);

      expect(setCredentialsMock).toHaveBeenCalledWith({ access_token: 'a', refresh_token: 'r' });
      expect(googleCalendarMock).toHaveBeenCalledWith({ version: 'v3', auth: expect.any(Object) });
      expect(updateLinkSpy).toHaveBeenCalledWith(expect.anything(), session);
      expect(handleOldSpy).toHaveBeenCalledWith(session);

      expect(insertValuesSpy).toHaveBeenCalledWith({
        attendance,
        meetingId: session.meetingId,
        batchId: session.batchId,
        bootcampId: session.bootcampId
      });
      expect(insertExecuteSpy).toHaveBeenCalled();
    });

    it('does not insert attendance if existing records are found', async () => {
      jest.spyOn(service as any, 'getUserTokens').mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      // Existing attendance found
      const selectChain = makeChain([ { id: 1 } ]);
      dbSelect.mockReturnValue(selectChain);

      const insertChain = makeInsertChain();
      dbInsert.mockReturnValue(insertChain);

      const session = { creator: 'c@e.com', meetingId: 'meet-1', status: 'completed', id: 1, batchId: 2, bootcampId: 3 };
      await (service as any).processSingleSession(session);

      expect(dbInsert).not.toHaveBeenCalled();
    });

    it('logs error if getAttendanceByBatchId returns error tuple', async () => {
      jest.spyOn(service as any, 'getUserTokens').mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      const selectChain = makeChain([]);
      dbSelect.mockReturnValue(selectChain);
      jest.spyOn(service as any, 'getAttendanceByBatchId').mockResolvedValue([{ status: 'error', message: 'nope' }]);

      const session = { creator: 'c@e.com', meetingId: 'meet-1', status: 'completed', id: 1, batchId: 2, bootcampId: 3 };
      await (service as any).processSingleSession(session);

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Attendance error:'));
    });

    it('logs error if dataAttendance is an array (unexpected shape)', async () => {
      jest.spyOn(service as any, 'getUserTokens').mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });

      const selectChain = makeChain([]);
      dbSelect.mockReturnValue(selectChain);
      jest.spyOn(service as any, 'getAttendanceByBatchId').mockResolvedValue([null, []]);

      const session = { creator: 'c@e.com', meetingId: 'meet-1', status: 'completed', id: 1, batchId: 2, bootcampId: 3 };
      await (service as any).processSingleSession(session);

      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Attendance error:'));
    });
  });

  describe('getUserTokens (private)', () => {
    it('returns first row or null', async () => {
      const chainEmpty = makeChain([]);
      dbSelect.mockReturnValueOnce(chainEmpty);
      const res1 = await (service as any).getUserTokens('x@y.z');
      expect(res1).toBeNull();

      const chainOne = makeChain([{ id: 1, accessToken: 'A', refreshToken: 'R' }]);
      dbSelect.mockReturnValueOnce(chainOne);
      const res2 = await (service as any).getUserTokens('x@y.z');
      expect(res2).toEqual({ id: 1, accessToken: 'A', refreshToken: 'R' });
    });
  });

  describe('updateSessionLink (private)', () => {
    it('updates s3link when mp4 attachment exists', async () => {
      calendarEventsGetMock.mockResolvedValue({
        data: {
          attachments: [
            { mimeType: 'image/png', fileUrl: 'skip' },
            { mimeType: 'video/mp4', fileUrl: 'https://example.com/video.mp4' },
          ]
        }
      });

      const updateChain = makeUpdateChain();
      const updateSetSpy = updateChain.set;
      const updateWhereSpy = updateChain.where;
      dbUpdate.mockReturnValue(updateChain);

      const calendar = (googleCalendarMock as any)({}) as any;
      const session = { id: 55 };

      await (service as any).updateSessionLink(calendar, session);

      expect(updateSetSpy).toHaveBeenCalledWith({ s3link: 'https://example.com/video.mp4' });
      expect(updateWhereSpy).toHaveBeenCalled();
    });

    it('does not update when no mp4 attachment found', async () => {
      calendarEventsGetMock.mockResolvedValue({ data: { attachments: [{ mimeType: 'text/plain' }] } });
      const updateChain = makeUpdateChain();
      dbUpdate.mockReturnValue(updateChain);

      const calendar = (googleCalendarMock as any)({}) as any;
      await (service as any).updateSessionLink(calendar, { id: 1 });

      expect(dbUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleOldSessions (private)', () => {
    it('sets s3link to "not found" for sessions older than 3 days', async () => {
      const oldStart = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
      const updateChain = makeUpdateChain();
      const updateSetSpy = updateChain.set;
      dbUpdate.mockReturnValue(updateChain);

      await (service as any).handleOldSessions({ id: 1, startTime: oldStart });
      expect(updateSetSpy).toHaveBeenCalledWith({ s3link: 'not found' });
    });

    it('does nothing for recent sessions', async () => {
      const recent = new Date().toISOString();
      const updateChain = makeUpdateChain();
      dbUpdate.mockReturnValue(updateChain);

      await (service as any).handleOldSessions({ id: 1, startTime: recent });
      // Should not update
      expect(dbUpdate).not.toHaveBeenCalled();
    });
  });

  describe('handleDynamicScheduling', () => {
    it('returns early when processingActive is true', async () => {
      (service as any).processingActive = true;
      const fetchSpy = jest.spyOn(service as any, 'fetchSessions');
      await service.handleDynamicScheduling();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith('Skipping: Previous job still running');
    });

    it('skips processing when shouldProcessSessions returns false', async () => {
      jest.spyOn(service as any, 'fetchSessions').mockResolvedValue([{ id: 1 }]);
      jest.spyOn(service as any, 'shouldProcessSessions').mockReturnValue(false);

      const resetSpy = jest.spyOn(service as any, 'resetTimeout');
      const startSpy = jest.spyOn(service as any, 'startRecursiveTimeout');

      await service.handleDynamicScheduling();
      expect(resetSpy).not.toHaveBeenCalled();
      expect(startSpy).not.toHaveBeenCalled();
    });

    it('resets timeout, sets interval and starts recursive timeout when processing is needed', async () => {
      jest.spyOn(service as any, 'fetchSessions').mockResolvedValue([{ id: 1 }, { id: 2 }]);
      jest.spyOn(service as any, 'shouldProcessSessions').mockReturnValue(true);
      jest.spyOn(service as any, 'getIntervalBasedOnSessionCount').mockReturnValue(123000);

      const resetSpy = jest.spyOn(service as any, 'resetTimeout').mockImplementation(() => {});
      const startSpy = jest.spyOn(service as any, 'startRecursiveTimeout').mockImplementation(() => {});

      const before = (service as any).lastProcessedTime;
      await service.handleDynamicScheduling();

      expect((service as any).currentInterval).toBe(123000);
      expect(loggerLogSpy).toHaveBeenCalledWith('Setting interval to 2.05 minutes');
      expect(resetSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledWith([{ id: 1 }, { id: 2 }]);
      expect((service as any).lastProcessedTime.getTime()).toBeGreaterThanOrEqual(before.getTime());
    });

    it('handles and logs exceptions without leaving processingActive true', async () => {
      jest.spyOn(service as any, 'fetchSessions').mockRejectedValue(new Error('fail'));
      await service.handleDynamicScheduling();
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Scheduling error: fail'));
      expect((service as any).processingActive).toBe(false);
    });
  });

  describe('processZoomAttendance (cron task)', () => {
    it('delegates to classesService and logs', async () => {
      await service.processZoomAttendance();
      expect(classesService.processCompletedSessionsForAttendance).toHaveBeenCalled();
      expect(loggerLogSpy).toHaveBeenCalledWith('Zoom attendance processing completed');
    });

    it('logs error when classesService throws', async () => {
      classesService.processCompletedSessionsForAttendance = jest.fn().mockRejectedValue(new Error('oops'));
      await service.processZoomAttendance();
      expect(loggerErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error processing Zoom attendance: oops'));
    });
  });
});

// Helpers
const GoogleEnv = {
  ensure() {
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'id';
    process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'secret';
    process.env.GOOGLE_REDIRECT = process.env.GOOGLE_REDIRECT || 'http://localhost';
    process.env.PRIVATE_KEY = process.env.PRIVATE_KEY || '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n';
    process.env.CLIENT_EMAIL = process.env.CLIENT_EMAIL || 'svc@example.com';
  },
};