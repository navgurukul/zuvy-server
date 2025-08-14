/**
 * Test framework: Jest + @nestjs/testing (NestJS)
 * These tests validate JwtMiddleware and WrapUserInArrayInterceptor behaviors,
 * focusing on unrestricted route handling, token verification, user/role loading,
 * role-based access control for instructor routes, and error propagation.
 */

import 'reflect-metadata';
import { UnauthorizedException, ForbiddenException, CallHandler, ExecutionContext } from '@nestjs/common';
import { JwtMiddleware, WrapUserInArrayInterceptor } from './jwt.middleware'; // Adjust if implementation file differs
import { JwtService } from '@nestjs/jwt';

// Mocks for external modules
jest.mock('../db/index', () => ({
  db: {
    select: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    where: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../drizzle/schema', () => ({
  users: { id: 'users.id', email: 'users.email' },
  sansaarUserRoles: { userId: 'sansaarUserRoles.userId' },
}));

jest.mock('drizzle-orm', () => ({
  sql: (...args: any[]) => args.join(''),
  count: jest.fn(),
  eq: jest.fn(),
}));

jest.mock('src/constants/helper', () => ({
  helperVariable: {
    admin: 'admin',
    instructor: 'instructor',
  },
}));

// Pull in mocks after jest.mock
import { db } from '../db/index';
import { users, sansaarUserRoles } from '../../drizzle/schema';
import { helperVariable } from 'src/constants/helper';

class MockAuthService {}
class MockJwtService {
  verifyAsync = jest.fn();
}

// Helper: build a mock Request/Response/NextFunction
const createReq = (overrides: Partial<any> = {}) => {
  return {
    headers: {},
    method: 'GET',
    _parsedUrl: { pathname: '/' },
    user: undefined,
    ...overrides,
  };
};

const nextFn = jest.fn();

describe('JwtMiddleware', () => {
  let middleware: JwtMiddleware;
  let jwtService: MockJwtService;

  const setJWTSecret = (value: string | undefined) => {
    // Ensure process.env is set for each test case
    (process as any).env.JWT_SECRET_KEY = value as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jwtService = new MockJwtService();
    middleware = new JwtMiddleware(jwtService as unknown as JwtService, new MockAuthService() as any);
    setJWTSecret('test-secret');
  });

  describe('Unrestricted routes', () => {
    const unrestricted = [
      { path: '/auth/login', method: 'POST' },
      { path: '/auth/refresh', method: 'POST' },
      { path: '/auth/debug-token', method: 'POST' },
      { path: '/classes', method: 'GET' },
      { path: '/classes/redirect/', method: 'GET' },
      { path: '/classes/google-auth/redirect', method: 'GET' },
      { path: '/classes/create-session-public', method: 'POST' },
      { path: '/classes/getAllAttendance/123', method: 'GET' }, // parameterized path match
      { path: '/classes/test-endpoint', method: 'GET' },
      { path: '/student/apply', method: 'POST' },
      { path: '/users/verify-token', method: 'POST' },
    ];

    for (const route of unrestricted) {
      it(`should bypass auth for ${route.method} ${route.path}`, async () => {
        const req = createReq({
          method: route.method,
          _parsedUrl: { pathname: route.path },
        });

        const res = {} as any;
        const next = jest.fn();

        await middleware.use(req as any, res, next);
        expect(next).toHaveBeenCalledTimes(1);
        expect(jwtService.verifyAsync).not.toHaveBeenCalled();
      });
    }

    it('should not bypass when method mismatch on same path', async () => {
      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/auth/login' }, // expects POST
      });

      const res = {} as any;
      const next = jest.fn();

      await expect(middleware.use(req as any, res, next)).rejects.toBeInstanceOf(UnauthorizedException);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Authorization header handling', () => {
    it('should throw UnauthorizedException when token header is missing', async () => {
      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: {}, // no Authorization
      });
      await expect(middleware.use(req as any, {} as any, nextFn)).rejects.toThrow(new UnauthorizedException('Token not found'));
    });

    it('should throw UnauthorizedException when jwtService.verifyAsync returns falsy decoded', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce(null); // falsy decoded
      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: { authorization: 'Bearer token' },
      });

      await expect(middleware.use(req as any, {} as any, nextFn)).rejects.toThrow(new UnauthorizedException('Invalid token'));
    });

    it('should use JWT_SECRET_KEY from env while verifying token', async () => {
      setJWTSecret('abc123');
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'u1', email: 'e1@example.com' });

      // Mock DB responses for a valid user
      // db.select().from(users).where(...) -> we mock where to resolve array
      (db.where as jest.Mock).mockResolvedValueOnce([{ id: 'u1', email: 'e1@example.com' }]); // user
      // roles query
      (db.where as jest.Mock).mockResolvedValueOnce([{ role: 'admin' }]); // roles

      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: { authorization: 'Bearer good' },
      });

      const next = jest.fn();
      await middleware.use(req as any, {} as any, next);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith('good', { secret: 'abc123' });
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('User loading and role assignment', () => {
    it('should attach loaded user and roles to req.user and call next()', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-1', email: 'john@doe.com' });

      (db.where as jest.Mock)
        // First where: user lookup
        .mockResolvedValueOnce([{ id: 'user-1', email: 'john@doe.com' }])
        // Second where: roles lookup
        .mockResolvedValueOnce([{ role: 'instructor' }, { role: 'admin' }]);

      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: { authorization: 'Bearer token' },
      });

      const next = jest.fn();
      await middleware.use(req as any, {} as any, next);

      expect(req.user).toEqual(
        expect.objectContaining({
          id: 'user-1',
          email: 'john@doe.com',
          roles: expect.arrayContaining(['instructor', 'admin']),
        })
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException when user is not found', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'user-x', email: 'missing@user.com' });

      (db.where as jest.Mock)
        // First where: user lookup -> empty
        .mockResolvedValueOnce([])
        // Ensure further calls do not matter
        .mockResolvedValueOnce([]);

      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: { authorization: 'Bearer tok' },
      });

      await expect(middleware.use(req as any, {} as any, nextFn)).rejects.toThrow(
        new UnauthorizedException('User is not authorized')
      );
    });
  });

  describe('Instructor/admin route restriction', () => {
    it('should allow /instructor route for admin', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'u1', email: 'e1' });
      (db.where as jest.Mock)
        .mockResolvedValueOnce([{ id: 'u1', email: 'e1' }]) // user
        .mockResolvedValueOnce([{ role: helperVariable.admin }]); // roles

      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/dashboard' },
        headers: { authorization: 'Bearer tok' },
      });

      const next = jest.fn();
      await middleware.use(req as any, {} as any, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should allow /instructor route for instructor', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'u2', email: 'e2' });
      (db.where as jest.Mock)
        .mockResolvedValueOnce([{ id: 'u2', email: 'e2' }])
        .mockResolvedValueOnce([{ role: helperVariable.instructor }]);

      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/classes' },
        headers: { authorization: 'Bearer tok' },
      });

      const next = jest.fn();
      await middleware.use(req as any, {} as any, next);

      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should forbid /instructor route for regular user without roles', async () => {
      jwtService.verifyAsync.mockResolvedValueOnce({ sub: 'u3', email: 'e3' });
      (db.where as jest.Mock)
        .mockResolvedValueOnce([{ id: 'u3', email: 'e3' }])
        .mockResolvedValueOnce([{ role: 'student' }]);

      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/reports' },
        headers: { authorization: 'Bearer tok' },
      });

      await expect(middleware.use(req as any, {} as any, nextFn)).rejects.toThrow(
        new ForbiddenException('Access restricted to admins and instructors')
      );
    });
  });

  describe('Error handling', () => {
    it('should rethrow UnauthorizedException from internals', async () => {
      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: { authorization: 'Bearer tok' },
      });
      const error = new UnauthorizedException('boom');
      jwtService.verifyAsync.mockRejectedValueOnce(error);

      await expect(middleware.use(req as any, {} as any, nextFn)).rejects.toBe(error);
    });

    it('should rethrow ForbiddenException from internals', async () => {
      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: { authorization: 'Bearer tok' },
      });
      const error = new ForbiddenException('nope');
      jwtService.verifyAsync.mockRejectedValueOnce(error);

      await expect(middleware.use(req as any, {} as any, nextFn)).rejects.toBe(error);
    });

    it('should wrap unknown errors as UnauthorizedException("Invalid token")', async () => {
      const req = createReq({
        method: 'GET',
        _parsedUrl: { pathname: '/secure' },
        headers: { authorization: 'Bearer tok' },
      });
      jwtService.verifyAsync.mockRejectedValueOnce(new Error('weird'));

      await expect(middleware.use(req as any, {} as any, nextFn)).rejects.toThrow(
        new UnauthorizedException('Invalid token')
      );
    });
  });
});

describe('WrapUserInArrayInterceptor', () => {
  it('should wrap non-array req.user into an array', () => {
    const interceptor = new WrapUserInArrayInterceptor();

    const request = { user: { id: 'u1' } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const handle = jest.fn(() => ({ pipe: jest.fn() }));
    const next: CallHandler = {
      handle: () => ({ subscribe: jest.fn(), toPromise: jest.fn() } as any),
    } as any;

    // Spy on next.handle
    const nextSpy = jest.spyOn(next, 'handle');

    const result = interceptor.intercept(context, next);
    expect(Array.isArray(request.user)).toBe(true);
    expect(request.user[0]).toEqual({ id: 'u1' });
    expect(nextSpy).toHaveBeenCalledTimes(1);
    expect(result).toBeDefined();
  });

  it('should leave req.user as array if already an array', () => {
    const interceptor = new WrapUserInArrayInterceptor();

    const request = { user: [{ id: 'u1' }] };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => ({ subscribe: jest.fn(), toPromise: jest.fn() } as any),
    } as any;

    interceptor.intercept(context, next);
    expect(Array.isArray(request.user)).toBe(true);
    expect(request.user).toEqual([{ id: 'u1' }]);
  });

  it('should do nothing when req.user is undefined', () => {
    const interceptor = new WrapUserInArrayInterceptor();

    const request: any = {}; // no user
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => ({ subscribe: jest.fn(), toPromise: jest.fn() } as any),
    } as any;

    interceptor.intercept(context, next);
    expect(request.user).toBeUndefined();
  });
});