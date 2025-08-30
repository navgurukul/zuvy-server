import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

// Mock path-alias imports used by the controller.
// Adjust these mocks to match your jest config/moduleNameMapper if paths differ.

jest.mock('../../auth/google-auth', () => ({
  auth2Client: {
    getToken: jest.fn(),
  },
}));

// Mock drizzle db and schema chainables used in the controller
const dbInsertMock = {
  values: jest.fn().mockReturnThis(),
  onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
};
const dbSelectChain = {
  from: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  limit: jest.fn().mockResolvedValue([{ bootcampId: 123 }]),
};
jest.mock('../../db/index', () => ({
  db: {
    insert: jest.fn(() => dbInsertMock),
    select: jest.fn(() => dbSelectChain),
  },
}));

// Mock drizzle schema - just provide shape referenced by controller
jest.mock('../../../drizzle/schema', () => ({
  userTokens: { userId: 'userId', userEmail: 'userEmail', accessToken: 'accessToken', refreshToken: 'refreshToken' },
  zuvyBatches: { id: 'id', bootcampId: 'bootcampId' },
}));

// Mock SuccessResponse/ErrorResponse constructors to inspect usage without depending on their implementation
const SuccessResponseCtor = jest.fn().mockImplementation((message: string, statusCode: number, data?: any) => ({
  __type: 'SuccessResponse',
  message,
  statusCode,
  data,
}));
jest.mock('src/errorHandler/handler', () => ({
  SuccessResponse: SuccessResponseCtor,
  ErrorResponse: jest.fn(),
}));

// Import mocks after jest.mock calls
import { auth2Client } from '../../auth/google-auth';
import { db } from '../../db/index';
import { userTokens, zuvyBatches } from '../../../drizzle/schema';
import { SuccessResponse } from 'src/errorHandler/handler';

describe('ClassesController (unit)', () => {
  let controller: ClassesController;
  let service: jest.Mocked<ClassesService>;

  const makeReq = (user?: any, query?: any) =>
    ({
      user: user ?? [{ id: '101', email: 'user@example.com', roles: [] }],
      query: query ?? {},
    } as any);

  const makeRes = () =>
    ({
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      redirect: jest.fn(),
      send: jest.fn(),
    } as any);

  beforeEach(async () => {
    jest.clearAllMocks();

    const serviceMock: jest.Mocked<ClassesService> = {
      googleAuthentication: jest.fn(),
      googleAuthenticationRedirect: jest.fn(),
      createSession: jest.fn(),
      getAttendance: jest.fn(),
      meetingAttendanceAnalytics: jest.fn(),
      getClassesByBatchId: jest.fn(),
      getClassesBy: jest.fn(),
      unattendanceClassesByBootcampId: jest.fn(),
      accessOfCalendar: jest.fn(),
      getSessionForAdmin: jest.fn(),
      getSessionForStudent: jest.fn(),
      updateSession: jest.fn(),
      deleteSession: jest.fn(),
      fetchZoomAttendanceForSession: jest.fn(),
      processCompletedSessionsForAttendance: jest.fn(),
      mergeClasses: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [{ provide: ClassesService, useValue: serviceMock }],
    }).compile();

    controller = module.get<ClassesController>(ClassesController);
    service = module.get(ClassesService);
  });

  describe('googleAuth', () => {
    it('delegates to service.googleAuthentication with res, email, and userId', async () => {
      const res = makeRes();
      (service.googleAuthentication as jest.Mock).mockResolvedValue({ ok: true });

      const result = await controller.googleAuth(res, 55 as any, 'a@b.com');
      expect(service.googleAuthentication).toHaveBeenCalledWith(res, 'a@b.com', 55);
      expect(result).toEqual({ ok: true });
    });
  });

  describe('googleAuthRedirectOld', () => {
    it('delegates to service.googleAuthenticationRedirect with request and request.user', async () => {
      const req = makeReq([{ id: '1', email: 'e', roles: [] }]);
      (service.googleAuthenticationRedirect as jest.Mock).mockResolvedValue({ redirected: true });

      const result = await controller.googleAuthRedirectOld(req);
      expect(service.googleAuthenticationRedirect).toHaveBeenCalledWith(req, req.user);
      expect(result).toEqual({ redirected: true });
    });
  });

  describe('googleAuthRedirect (new OAuth redirect)', () => {
    it('stores tokens and returns success on happy path', async () => {
      (auth2Client.getToken as jest.Mock).mockResolvedValue({
        tokens: { access_token: 'acc', refresh_token: 'ref' },
      });
      const req = makeReq(undefined, {
        code: 'code123',
        state: JSON.stringify({ id: 42, email: 'x@y.z' }),
      });

      const result = await (controller as any).googleAuthRedirect(req);

      // Ensure token exchange called
      expect(auth2Client.getToken).toHaveBeenCalledWith('code123');

      // Ensure db insert call chain was invoked correctly
      expect((db.insert as any)).toHaveBeenCalledWith(userTokens);
      expect(dbInsertMock.values).toHaveBeenCalledWith({
        userId: 42,
        userEmail: 'x@y.z',
        accessToken: 'acc',
        refreshToken: 'ref',
      });
      expect(dbInsertMock.onConflictDoUpdate).toHaveBeenCalledWith({
        target: [userTokens.userId],
        set: { accessToken: 'acc', refreshToken: 'ref' },
      });

      expect(result).toEqual({
        status: 'success',
        message: 'Calendar access granted successfully',
      });
    });

    it('returns error object if any step throws', async () => {
      (auth2Client.getToken as jest.Mock).mockRejectedValue(new Error('boom'));
      const req = makeReq(undefined, { code: 'c', state: '{}' });

      const result = await (controller as any).googleAuthRedirect(req);

      expect(result).toEqual({
        status: 'error',
        message: 'Failed to authenticate with Google Calendar',
      });
    });
  });

  describe('create (session)', () => {
    const baseDto = { batchId: 777, title: 'Session Title', startTime: new Date().toISOString() } as any;

    it('throws BadRequestException if batch not found', async () => {
      (db.select as any).mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValueOnce([]),
      });

      await expect(controller.create(baseDto, {} as any)).rejects.toBeInstanceOf(BadRequestException);
      expect(db.select).toHaveBeenCalled();
    });

    it('adds bootcampId from batch and calls service.createSession with admin userInfo', async () => {
      (service.createSession as jest.Mock).mockResolvedValue({ created: true });

      const res = await controller.create(baseDto, {} as any);

      expect(service.createSession).toHaveBeenCalled();
      const [eventDetails, userInfo] = (service.createSession as jest.Mock).mock.calls[0];
      expect(eventDetails).toMatchObject({
        ...baseDto,
        bootcampId: 123,
      });
      expect(userInfo).toEqual({
        id: 58083,
        email: 'team@zuvy.org',
        roles: ['admin'],
      });
      expect(res).toEqual({ created: true });
    });
  });

  describe('extractMeetAttendance', () => {
    it('returns values when service returns [null, values]', async () => {
      (service.getAttendance as jest.Mock).mockResolvedValue([null, { ok: 1 }]);
      const req = makeReq([{ id: '10', email: 'e', roles: [] }]);

      const data = await controller.extractMeetAttendance(req, 'meet123');

      expect(service.getAttendance).toHaveBeenCalledWith('meet123', {
        id: 10,
        email: 'e',
        roles: [],
      });
      expect(data).toEqual({ ok: 1 });
    });

    it('throws BadRequestException when service returns [err]', async () => {
      (service.getAttendance as jest.Mock).mockResolvedValue(['ERR!', null]);
      const req = makeReq([{ id: '10', email: 'e', roles: [] }]);

      await expect(controller.extractMeetAttendance(req, 'meet123')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('meetingAttendanceAnalytics', () => {
    it('returns values when no error', async () => {
      (service.meetingAttendanceAnalytics as jest.Mock).mockResolvedValue([null, { stat: true }]);
      const req = makeReq([{ id: '9', email: 'z', roles: [] }]);

      const out = await controller.meetingAttendanceAnalytics(req, 111 as any);
      expect(service.meetingAttendanceAnalytics).toHaveBeenCalledWith(111, {
        id: 9,
        email: 'z',
        roles: [],
      });
      expect(out).toEqual({ stat: true });
    });

    it('throws BadRequestException when err present', async () => {
      (service.meetingAttendanceAnalytics as jest.Mock).mockResolvedValue(['oops', null]);
      const req = makeReq();

      await expect(controller.meetingAttendanceAnalytics(req, 222 as any)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getClassesByBatchId', () => {
    it('delegates to service.getClassesByBatchId with correct args', async () => {
      (service.getClassesByBatchId as jest.Mock).mockResolvedValue({ page: [] });
      const out = await controller.getClassesByBatchId(5 as any, 10 as any, 'BATCH1');
      expect(service.getClassesByBatchId).toHaveBeenCalledWith('BATCH1', 5, 10);
      expect(out).toEqual({ page: [] });
    });
  });

  describe('getClassesBy', () => {
    it('delegates to service.getClassesBy with all params and user', async () => {
      (service.getClassesBy as jest.Mock).mockResolvedValue({ ok: true });
      const req = makeReq([{ id: '7', email: 'e@e', roles: ['student'] }]);

      const out = await controller.getClassesBy(
        999 as any,
        123 as any,
        'completed',
        20 as any,
        40 as any,
        'search-str',
        req,
      );

      expect(service.getClassesBy).toHaveBeenCalledWith(
        999,
        req.user[0],
        123,
        20,
        40,
        'search-str',
        'completed',
      );
      expect(out).toEqual({ ok: true });
    });
  });

  describe('getClassesByBootcamp (defaults)', () => {
    it('passes default status="all", limit=10, offset=0 when omitted', async () => {
      (service.getClassesBy as jest.Mock).mockResolvedValue({ ok: true });
      const req = makeReq([{ id: '3', email: 'e3', roles: [] }]);

      const out = await controller.getClassesByBootcamp(
        42 as any,
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
        req,
      );

      expect(service.getClassesBy).toHaveBeenCalledWith(42, req.user[0], undefined, 10, 0, undefined, 'all');
      expect(out).toEqual({ ok: true });
    });
  });

  describe('getClassesBybootcampId (unattendance)', () => {
    it('calls service.unattendanceClassesByBootcampId with provided id', async () => {
      (service.unattendanceClassesByBootcampId as jest.Mock).mockResolvedValue({ list: [] });

      const out = await controller.getClassesBybootcampId('BC1');
      expect(service.unattendanceClassesByBootcampId).toHaveBeenCalledWith('BC1');
      expect(out).toEqual({ list: [] });
    });
  });

  describe('checkCalendarAccess', () => {
    it('returns not success when service returns status=error', async () => {
      (service.accessOfCalendar as jest.Mock).mockResolvedValue({ status: 'error', message: 'No access' });
      const req = makeReq([{ id: '1', email: 'a', roles: ['admin'] }]);

      const out = await controller.checkCalendarAccess(req);
      expect(out).toEqual({ status: 'not success', message: 'No access' });
    });

    it('returns success when service returns ok value without status=error', async () => {
      (service.accessOfCalendar as jest.Mock).mockResolvedValue({ calendar: 'ok' });
      const req = makeReq([{ id: '1', email: 'a', roles: ['admin'] }]);

      const out = await controller.checkCalendarAccess(req);
      expect(out).toEqual({ status: 'success', message: 'Calendar access verified' });
    });

    it('returns not success with error message on exception', async () => {
      (service.accessOfCalendar as jest.Mock).mockRejectedValue(new Error('fail'));
      const req = makeReq([{ id: '1', email: 'a', roles: ['admin'] }]);

      const out = await controller.checkCalendarAccess(req);
      expect(out).toEqual({
        status: 'not success',
        message: 'Failed to verify calendar access',
        error: 'fail',
      });
    });
  });

  describe('getSession (role-based)', () => {
    it('calls getSessionForAdmin when role includes admin', async () => {
      (service.getSessionForAdmin as jest.Mock).mockResolvedValue({ admin: true });
      const req = makeReq([{ id: '1', email: 'e', roles: ['admin'] }]);

      const out = await controller.getSession(77 as any, req);
      expect(service.getSessionForAdmin).toHaveBeenCalledWith(77, { id: 1, email: 'e', roles: ['admin'] });
      expect(out).toEqual({ admin: true });
    });

    it('calls getSessionForStudent when not admin', async () => {
      (service.getSessionForStudent as jest.Mock).mockResolvedValue({ student: true });
      const req = makeReq([{ id: '1', email: 'e', roles: ['student'] }]);

      const out = await controller.getSession(77 as any, req);
      expect(service.getSessionForStudent).toHaveBeenCalledWith(77, { id: 1, email: 'e', roles: ['student'] });
      expect(out).toEqual({ student: true });
    });
  });

  describe('updateSession', () => {
    it('passes sessionId, updateData, and userInfo to service', async () => {
      (service.updateSession as jest.Mock).mockResolvedValue({ updated: true });
      const req = makeReq([{ id: '5', email: 'em', roles: [] }]);
      const dto = { title: 'new', startTime: '2025-01-01T00:00:00Z' } as any;

      const out = await controller.updateSession(55 as any, dto, req);
      expect(service.updateSession).toHaveBeenCalledWith(55, dto, { id: 5, email: 'em', roles: [] });
      expect(out).toEqual({ updated: true });
    });
  });

  describe('deleteSession', () => {
    it('passes sessionId and userInfo to service', async () => {
      (service.deleteSession as jest.Mock).mockResolvedValue({ deleted: true });
      const req = makeReq([{ id: '6', email: 'e6', roles: [] }]);

      const out = await controller.deleteSession(66 as any, req);
      expect(service.deleteSession).toHaveBeenCalledWith(66, { id: 6, email: 'e6', roles: [] });
      expect(out).toEqual({ deleted: true });
    });
  });

  describe('fetchSessionAttendance (admin only)', () => {
    it('throws BadRequestException if user is not admin', async () => {
      const req = makeReq([{ id: '8', email: 'e8', roles: ['student'] }]);
      await expect(controller.fetchSessionAttendance(100 as any, req)).rejects.toBeInstanceOf(BadRequestException);
      expect(service.fetchZoomAttendanceForSession).not.toHaveBeenCalled();
    });

    it('calls service when admin', async () => {
      (service.fetchZoomAttendanceForSession as jest.Mock).mockResolvedValue({ fetched: true });
      const req = makeReq([{ id: '8', email: 'e8', roles: ['admin'] }]);

      const out = await controller.fetchSessionAttendance(100 as any, req);
      expect(service.fetchZoomAttendanceForSession).toHaveBeenCalledWith(100);
      expect(out).toEqual({ fetched: true });
    });
  });

  describe('processAttendanceForCompletedSessions (admin only)', () => {
    it('throws BadRequestException if not admin', async () => {
      const req = makeReq([{ id: '9', email: 'e9', roles: [] }]);
      await expect(controller.processAttendanceForCompletedSessions(req)).rejects.toBeInstanceOf(BadRequestException);
      expect(service.processCompletedSessionsForAttendance).not.toHaveBeenCalled();
    });

    it('calls service when admin', async () => {
      (service.processCompletedSessionsForAttendance as jest.Mock).mockResolvedValue({ processed: true });
      const req = makeReq([{ id: '9', email: 'e9', roles: ['admin'] }]);

      const out = await controller.processAttendanceForCompletedSessions(req);
      expect(service.processCompletedSessionsForAttendance).toHaveBeenCalled();
      expect(out).toEqual({ processed: true });
    });
  });

  describe('mergeClasses (admin only with SuccessResponse)', () => {
    it('throws BadRequestException if not admin', async () => {
      const req = makeReq([{ id: '1', email: 'e', roles: [] }]);
      await expect(controller.mergeClasses({ childSessionId: 1, parentSessionId: 2 } as any, req))
        .rejects
        .toBeInstanceOf(BadRequestException);
      expect(service.mergeClasses).not.toHaveBeenCalled();
    });

    it('returns SuccessResponse when service reports success', async () => {
      (service.mergeClasses as jest.Mock).mockResolvedValue({ success: true, data: { id: 2 } });
      const req = makeReq([{ id: '1', email: 'e', roles: ['admin'] }]);

      const res = await controller.mergeClasses({ childSessionId: 11, parentSessionId: 22 } as any, req);

      expect(service.mergeClasses).toHaveBeenCalledWith(11, 22, { id: 1, email: 'e', roles: ['admin'] });
      expect(SuccessResponse).toHaveBeenCalledWith('Classes merged successfully', 200, { id: 2 });
      expect(res).toEqual({
        __type: 'SuccessResponse',
        message: 'Classes merged successfully',
        statusCode: 200,
        data: { id: 2 },
      });
    });

    it('throws BadRequestException when service reports failure', async () => {
      (service.mergeClasses as jest.Mock).mockResolvedValue({ success: false, message: 'Could not merge' });
      const req = makeReq([{ id: '1', email: 'e', roles: ['admin'] }]);

      await expect(controller.mergeClasses({ childSessionId: 1, parentSessionId: 2 } as any, req))
        .rejects
        .toBeInstanceOf(BadRequestException);
    });
  });
});