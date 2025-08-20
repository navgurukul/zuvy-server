/**
 * Tests for ClassesController
 * Testing framework: Jest with @nestjs/testing (NestJS standard)
 *
 * These unit tests focus on the controller's public interfaces,
 * mocking all external dependencies (service layer, Google OAuth client, DB).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ClassesController } from './classes.controller';
import { ClassesService } from './classes.service';

// Mock external modules used by the controller
// Note: We mock before importing the controller in case of ESM transpilation order constraints.
jest.mock('../../auth/google-auth', () => ({
  auth2Client: {
    getToken: jest.fn(),
  },
}), { virtual: true });

jest.mock('../../db/index', () => {
  // Create a chainable mock for drizzle db: insert().values().onConflictDoUpdate()
  const chain = {
    values: jest.fn().mockReturnThis(),
    onConflictDoUpdate: jest.fn().mockResolvedValue(undefined),
  };
  return {
    db: {
      insert: jest.fn().mockReturnValue(chain),
    },
  };
}, { virtual: true });

// Provide a minimal shape for userTokens table symbol to satisfy insert(userTokens) calls.
jest.mock('../../../drizzle/schema', () => ({
  userTokens: {
    userId: Symbol('userId'),
    userEmail: Symbol('userEmail'),
    accessToken: Symbol('accessToken'),
    refreshToken: Symbol('refreshToken'),
  },
  zuvyBatches: {},
}), { virtual: true });

// Mock SuccessResponse to a simple class for instanceof checks
jest.mock('src/errorHandler/handler', () => {
  class SuccessResponse {
    constructor(public message: string, public statusCode: number, public data?: any) {}
  }
  class ErrorResponse { constructor(public message: string, public statusCode: number) {} }
  return { SuccessResponse, ErrorResponse };
}, { virtual: true });

import { auth2Client } from '../../auth/google-auth';
import { db } from '../../db/index';
import { SuccessResponse } from 'src/errorHandler/handler';

describe('ClassesController', () => {
  let controller: ClassesController;
  let service: jest.Mocked<ClassesService>;

  const mockService: jest.Mocked<ClassesService> = {
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

  const makeReq = (overrides: any = {}) => ({
    user: [
      {
        id: '101',
        email: 'user@example.com',
        roles: [],
        ...overrides,
      },
    ],
    query: {},
    ...('request' in overrides ? overrides.request : {}),
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ClassesController],
      providers: [
        { provide: ClassesService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<ClassesController>(ClassesController);
    service = module.get(ClassesService) as any;
  });

  describe('googleAuth', () => {
    it('should delegate to classesService.googleAuthentication with correct args (happy path)', async () => {
      const res = {};
      const email = 'test@example.com';
      const userId = 123;
      const expected = { ok: true };

      service.googleAuthentication.mockResolvedValue(expected);

      const result = await controller.googleAuth(res as any, userId as any, email);
      expect(service.googleAuthentication).toHaveBeenCalledWith(res, email, userId);
      expect(result).toBe(expected);
    });
  });

  describe('googleAuthRedirectOld', () => {
    it('should delegate to classesService.googleAuthenticationRedirect with request and request.user', async () => {
      const request = { user: { id: 1 } };
      const expected = { redirected: true };
      service.googleAuthenticationRedirect.mockResolvedValue(expected);

      const result = await controller.googleAuthRedirectOld(request as any);
      expect(service.googleAuthenticationRedirect).toHaveBeenCalledWith(request, request.user);
      expect(result).toBe(expected);
    });
  });

  describe('googleAuthRedirect (OAuth flow)', () => {
    it('should store tokens and return success on happy path', async () => {
      // Arrange
      const tokens = { access_token: 'acc', refresh_token: 'ref' };
      (auth2Client.getToken as jest.Mock).mockResolvedValue({ tokens });

      const request = { query: { code: 'CODE', state: JSON.stringify({ id: 42, email: 'admin@example.com' }) } };

      const result = await controller.googleAuthRedirect(request as any);

      // db.insert called
      expect(db.insert).toHaveBeenCalled();
      const insertCallArg = (db.insert as jest.Mock).mock.calls[0][0];
      expect(insertCallArg).toBeDefined();

      // values called with correct payload
      const chain: any = (db.insert as jest.Mock).mock.results[0].value;
      expect(chain.values).toHaveBeenCalledWith({
        userId: 42,
        userEmail: 'admin@example.com',
        accessToken: 'acc',
        refreshToken: 'ref',
      });
      expect(chain.onConflictDoUpdate).toHaveBeenCalled();

      expect(result).toEqual({
        status: 'success',
        message: 'Calendar access granted successfully',
      });
    });

    it('should return error when auth2Client.getToken throws', async () => {
      (auth2Client.getToken as jest.Mock).mockRejectedValue(new Error('bad'));

      const request = { query: { code: 'CODE', state: JSON.stringify({ id: 42, email: 'admin@example.com' }) } };
      const result = await controller.googleAuthRedirect(request as any);

      expect(result).toEqual({
        status: 'error',
        message: 'Failed to authenticate with Google Calendar',
      });
    });
  });

  describe('create', () => {
    it('should pass userInfo and classData to service', async () => {
      const req = makeReq();
      const classData = { title: 'Session 1' } as any;
      const expected = { id: 1 };

      service.createSession.mockResolvedValue(expected);

      const result = await controller.create(classData, req as any);
      expect(service.createSession).toHaveBeenCalledWith(classData, {
        id: 101,
        email: 'user@example.com',
        roles: [],
      });
      expect(result).toBe(expected);
    });
  });

  describe('extractMeetAttendance', () => {
    it('should return values when no error', async () => {
      const req = makeReq();
      const meetingId = 'abc123';
      service.getAttendance.mockResolvedValue([null, { attendees: [] }]);

      const result = await controller.extractMeetAttendance(req as any, meetingId);
      expect(service.getAttendance).toHaveBeenCalledWith(meetingId, {
        id: 101,
        email: 'user@example.com',
        roles: [],
      });
      expect(result).toEqual({ attendees: [] });
    });

    it('should throw BadRequestException when service returns error', async () => {
      const req = makeReq();
      service.getAttendance.mockResolvedValue(['error!', null]);

      await expect(controller.extractMeetAttendance(req as any, 'mid')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('meetingAttendanceAnalytics', () => {
    it('should return values when no error', async () => {
      const req = makeReq();
      service.meetingAttendanceAnalytics.mockResolvedValue([null, { analytics: true }]);

      const result = await controller.meetingAttendanceAnalytics(req as any, 77 as any);
      expect(service.meetingAttendanceAnalytics).toHaveBeenCalledWith(77, {
        id: 101,
        email: 'user@example.com',
        roles: [],
      });
      expect(result).toEqual({ analytics: true });
    });

    it('should throw BadRequestException when service returns error', async () => {
      const req = makeReq();
      service.meetingAttendanceAnalytics.mockResolvedValue(['fail', null]);

      await expect(controller.meetingAttendanceAnalytics(req as any, 77 as any)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getClassesByBatchId', () => {
    it('should forward batchId, limit, offset to service', async () => {
      service.getClassesByBatchId.mockResolvedValue({ ok: 1 } as any);

      const result = await controller.getClassesByBatchId(25 as any, 5 as any, 'batch-1');
      expect(service.getClassesByBatchId).toHaveBeenCalledWith('batch-1', 25, 5);
      expect(result).toEqual({ ok: 1 });
    });
  });

  describe('getClassesBy', () => {
    it('should call service.getClassesBy with all parameters', async () => {
      const req = makeReq({ roles: ['student'] });
      service.getClassesBy.mockResolvedValue({ list: [] } as any);

      const result = await controller.getClassesBy(
        10 as any,
        20 as any,
        'ongoing',
        15 as any,
        0 as any,
        'react',
        req as any,
      );

      expect(service.getClassesBy).toHaveBeenCalledWith(
        10,
        req.user[0],
        20,
        15,
        0,
        'react',
        'ongoing',
      );
      expect(result).toEqual({ list: [] });
    });
  });

  describe('getClassesByBootcamp (defaults)', () => {
    it('should apply default status=all, limit=10, offset=0 when not provided', async () => {
      const req = makeReq();
      service.getClassesBy.mockResolvedValue({ list: ['a'] } as any);

      const result = await controller.getClassesByBootcamp(
        99 as any,
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
        undefined as any,
        req as any,
      );

      expect(service.getClassesBy).toHaveBeenCalledWith(
        99,
        req.user[0],
        undefined,
        10,
        0,
        undefined,
        'all',
      );
      expect(result).toEqual({ list: ['a'] });
    });
  });

  describe('getClassesBybootcampId', () => {
    it('should call unattendanceClassesByBootcampId with given id', async () => {
      service.unattendanceClassesByBootcampId.mockResolvedValue({ ids: [] } as any);
      const result = await controller.getClassesBybootcampId('BID-1');
      expect(service.unattendanceClassesByBootcampId).toHaveBeenCalledWith('BID-1');
      expect(result).toEqual({ ids: [] });
    });
  });

  describe('checkCalendarAccess', () => {
    it('should return success when calendar access is verified', async () => {
      const req = makeReq({ roles: ['admin'] });
      service.accessOfCalendar.mockResolvedValue({ ok: true } as any);

      const result = await controller.checkCalendarAccess(req as any);
      expect(result).toEqual({
        status: 'success',
        message: 'Calendar access verified',
      });
    });

    it('should return not success when calendar returns error status', async () => {
      const req = makeReq();
      service.accessOfCalendar.mockResolvedValue({ status: 'error', message: 'nope' } as any);

      const result = await controller.checkCalendarAccess(req as any);
      expect(result).toEqual({
        status: 'not success',
        message: 'nope',
      });
    });

    it('should catch and return not success if service throws', async () => {
      const req = makeReq();
      service.accessOfCalendar.mockRejectedValue(new Error('boom'));

      const result = await controller.checkCalendarAccess(req as any);
      expect(result.status).toBe('not success');
      expect(result.message).toBe('Failed to verify calendar access');
      expect(result.error).toBe('boom');
    });
  });

  describe('getSession role routing', () => {
    it('should route to admin service when user has admin role', async () => {
      const req = makeReq({ roles: ['admin'] });
      service.getSessionForAdmin.mockResolvedValue({ admin: true } as any);

      const result = await controller.getSession(55 as any, req as any);
      expect(service.getSessionForAdmin).toHaveBeenCalledWith(55, {
        id: 101, email: 'user@example.com', roles: ['admin'],
      });
      expect(result).toEqual({ admin: true });
      expect(service.getSessionForStudent).not.toHaveBeenCalled();
    });

    it('should route to student service when user is not admin', async () => {
      const req = makeReq({ roles: ['student'] });
      service.getSessionForStudent.mockResolvedValue({ student: true } as any);

      const result = await controller.getSession(55 as any, req as any);
      expect(service.getSessionForStudent).toHaveBeenCalledWith(55, {
        id: 101, email: 'user@example.com', roles: ['student'],
      });
      expect(result).toEqual({ student: true });
      expect(service.getSessionForAdmin).not.toHaveBeenCalled();
    });
  });

  describe('updateSession', () => {
    it('should forward to service with userInfo', async () => {
      const req = makeReq({ roles: ['admin'] });
      const updateData = { topic: 'New Topic' } as any;
      service.updateSession.mockResolvedValue({ ok: true } as any);

      const result = await controller.updateSession(7 as any, updateData, req as any);
      expect(service.updateSession).toHaveBeenCalledWith(7, updateData, {
        id: 101, email: 'user@example.com', roles: ['admin'],
      });
      expect(result).toEqual({ ok: true });
    });
  });

  describe('deleteSession', () => {
    it('should forward to service with userInfo', async () => {
      const req = makeReq();
      service.deleteSession.mockResolvedValue({ deleted: 1 } as any);

      const result = await controller.deleteSession(8 as any, req as any);
      expect(service.deleteSession).toHaveBeenCalledWith(8, {
        id: 101, email: 'user@example.com', roles: [],
      });
      expect(result).toEqual({ deleted: 1 });
    });
  });

  describe('fetchSessionAttendance (admin-only)', () => {
    it('should throw BadRequestException if not admin', async () => {
      const req = makeReq({ roles: ['student'] });

      await expect(controller.fetchSessionAttendance(22 as any, req as any))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(service.fetchZoomAttendanceForSession).not.toHaveBeenCalled();
    });

    it('should call service when admin', async () => {
      const req = makeReq({ roles: ['admin'] });
      service.fetchZoomAttendanceForSession.mockResolvedValue({ fetched: true } as any);

      const result = await controller.fetchSessionAttendance(22 as any, req as any);
      expect(service.fetchZoomAttendanceForSession).toHaveBeenCalledWith(22);
      expect(result).toEqual({ fetched: true });
    });
  });

  describe('processAttendanceForCompletedSessions (admin-only)', () => {
    it('should throw BadRequestException if not admin', async () => {
      const req = makeReq({ roles: [] });

      await expect(controller.processAttendanceForCompletedSessions(req as any))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(service.processCompletedSessionsForAttendance).not.toHaveBeenCalled();
    });

    it('should call service when admin', async () => {
      const req = makeReq({ roles: ['admin'] });
      service.processCompletedSessionsForAttendance.mockResolvedValue({ processed: true } as any);

      const result = await controller.processAttendanceForCompletedSessions(req as any);
      expect(service.processCompletedSessionsForAttendance).toHaveBeenCalled();
      expect(result).toEqual({ processed: true });
    });
  });

  describe('mergeClasses (admin-only)', () => {
    it('should throw BadRequestException if not admin', async () => {
      const req = makeReq({ roles: ['student'] });
      await expect(controller.mergeClasses({ childSessionId: 1, parentSessionId: 2 } as any, req as any))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(service.mergeClasses).not.toHaveBeenCalled();
    });

    it('should return SuccessResponse on success', async () => {
      const req = makeReq({ roles: ['admin'] });
      service.mergeClasses.mockResolvedValue({ success: true, data: { merged: true } });

      const result = await controller.mergeClasses({ childSessionId: 1, parentSessionId: 2 } as any, req as any);
      expect(service.mergeClasses).toHaveBeenCalledWith(1, 2, {
        id: 101, email: 'user@example.com', roles: ['admin'],
      });
      expect(result).toBeInstanceOf(SuccessResponse);
      expect((result as any).message).toBe('Classes merged successfully');
      expect((result as any).data).toEqual({ merged: true });
    });

    it('should throw BadRequestException on failure result', async () => {
      const req = makeReq({ roles: ['admin'] });
      service.mergeClasses.mockResolvedValue({ success: false, message: 'cannot merge' });

      await expect(controller.mergeClasses({ childSessionId: 3, parentSessionId: 4 } as any, req as any))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });
});