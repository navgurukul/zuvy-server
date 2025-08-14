import { UnauthorizedException, ForbiddenException, ExecutionContext, CallHandler } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

// Import the code under test.
// The implementation classes appear to be located in src/middleware/jwt.middleware.spec.ts per the diff,
// but to avoid circular import issues we will import from that path directly.
// If the implementation actually resides in src/middleware/jwt.middleware.ts in your repo, adjust the import below accordingly.
import { JwtMiddleware, WrapUserInArrayInterceptor } from '../jwt.middleware.spec';

describe('JwtMiddleware', () => {
  // Testing library & framework: Jest (NestJS default). Using plain Jest unit tests here with manual mocks.
  let jwtService: any;
  let authService: any; // currently unused by middleware, but included for constructor parity
  let middleware: JwtMiddleware;

  // db and other module-level imports are directly imported in the middleware file.
  // We will mock drizzle-orm db functions by monkey-patching the imported 'db' module using jest.mock.
  // However, because the middleware imports db directly from '../db/index', we need to mock that path.
  jest.mock('../../db/index', () => {
    const selectChain = () => ({
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([]),
    });
    return {
      db: {
        select: jest.fn(selectChain),
      },
    };
  });

  // Mock schema exports to satisfy TypeScript imports (not used directly in tests)
  jest.mock('../../../drizzle/schema', () => ({
    users: {},
    sansaarUserRoles: {},
  }));

  // Mock helperVariable roles
  jest.mock('../../constants/helper', () => ({
    helperVariable: {
      admin: 'admin',
      instructor: 'instructor',
    },
  }));

  // After jest.mock calls, re-require to get the mocked modules in scope for type inference if needed
  const { db } = require('../../db/index');
  const { helperVariable } = require('../../constants/helper');

  const makeReq = (overrides: Partial<Request> = {}): Request => {
    const base: any = {
      headers: {},
      method: 'GET',
      _parsedUrl: { pathname: '/' },
      user: undefined,
    };
    return Object.assign(base, overrides) as unknown as Request;
  };

  const makeRes = (): Response => {
    // We don't rely on res in this middleware. Provide minimal stub.
    return {} as Response;
  };

  const makeNext = () => jest.fn() as unknown as NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();
    // Fresh instances with jest.fn stubs for each test
    jwtService = {
      verifyAsync: jest.fn(),
    };
    authService = {}; // not used
    middleware = new JwtMiddleware(jwtService, authService);
    // Ensure process.env var used by jwtService.verifyAsync secret exists
    process.env.JWT_SECRET_KEY = 'test-secret';
  });

  describe('unrestricted routes', () => {
    it('allows POST /auth/login without token', async () => {
      const req = makeReq({
        method: 'POST',
        _parsedUrl: { pathname: '/auth/login' },
      });
      const res = makeRes();
      const next = makeNext();

      await middleware.use(req as any, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('allows GET /classes/getAllAttendance/:batchId pattern without token', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/classes/getAllAttendance/123' },
      });
      const res = makeRes();
      const next = makeNext();

      await middleware.use(req as any, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });
  });

  describe('authorization header handling', () => {
    it('throws UnauthorizedException when token is missing for restricted route', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/dashboard' },
        headers: {}, // no Authorization
      });
      const res = makeRes();

      await expect(middleware.use(req as any, res, makeNext())).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    });

    it('throws UnauthorizedException when token verification fails', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/dashboard' },
        headers: { authorization: 'Bearer bad.token' },
      });
      const res = makeRes();
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error('invalid token'));

      await expect(middleware.use(req as any, res, makeNext())).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith('bad.token', { secret: process.env.JWT_SECRET_KEY });
    });

    it('throws UnauthorizedException when decoded is falsy', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/dashboard' },
        headers: { authorization: 'Bearer x.y.z' },
      });
      const res = makeRes();
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(null);

      await expect(middleware.use(req as any, res, makeNext())).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('user lookup and role enforcement', () => {
    it('throws UnauthorizedException when user not found', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/some/protected' },
        headers: { authorization: 'Bearer x.y.z' },
      });
      const res = makeRes();
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-1', email: 'u@example.com' });

      // Mock db to return empty user array
      (db.select as jest.Mock).mockImplementation(() => ({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValueOnce([]), // first select() is for users
      }));

      await expect(middleware.use(req as any, res, makeNext())).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('populates req.user and calls next for non-instructor route when user exists', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/student/home' },
        headers: { authorization: 'Bearer x.y.z' },
      });
      const res = makeRes();
      const next = makeNext();
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-2', email: 'student@example.com' });

      // First select(): users -> returns one user
      // Second select(): sansaarUserRoles -> returns roles array
      const selectChainFirst = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValueOnce([{ id: 'user-2', email: 'student@example.com' }]),
      };
      const selectChainSecond = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValueOnce([{ role: 'student' }, { role: 'member' }]),
      };

      (db.select as jest.Mock)
        .mockImplementationOnce(() => selectChainFirst as any)
        .mockImplementationOnce(() => selectChainSecond as any);

      await middleware.use(req as any, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user).toBeDefined();
      expect((req as any).user.email).toBe('student@example.com');
      expect((req as any).user.roles).toEqual(['student', 'member']);
    });

    it('throws ForbiddenException for /instructor path when user lacks admin/instructor roles', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/gradebook' },
        headers: { authorization: 'Bearer x.y.z' },
      });
      const res = makeRes();
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-3', email: 'user3@example.com' });

      const selectChainFirst = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValueOnce([{ id: 'user-3', email: 'user3@example.com' }]),
      };
      const selectChainSecond = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValueOnce([{ role: 'student' }]), // no admin/instructor
      };

      (db.select as jest.Mock)
        .mockImplementationOnce(() => selectChainFirst as any)
        .mockImplementationOnce(() => selectChainSecond as any);

      await expect(middleware.use(req as any, res, makeNext())).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('allows /instructor path when user has instructor role', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/instructor/overview' },
        headers: { authorization: 'Bearer good.token' },
      });
      const res = makeRes();
      const next = makeNext();
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue({ sub: 'user-4', email: 'inst@example.com' });

      const selectChainFirst = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValueOnce([{ id: 'user-4', email: 'inst@example.com' }]),
      };
      const selectChainSecond = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockResolvedValueOnce([{ role: helperVariable.instructor }]),
      };

      (db.select as jest.Mock)
        .mockImplementationOnce(() => selectChainFirst as any)
        .mockImplementationOnce(() => selectChainSecond as any);

      await middleware.use(req as any, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect((req as any).user.roles).toEqual([helperVariable.instructor]);
    });
  });

  describe('error fallback behavior', () => {
    it('rethrows UnauthorizedException and ForbiddenException as-is', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/protected' },
        headers: { authorization: 'Bearer t' },
      });
      const res = makeRes();
      // Force middleware to throw an UnauthorizedException inside try
      (jwtService.verifyAsync as jest.Mock).mockImplementation(() => {
        throw new UnauthorizedException('explicit unauthorized');
      });

      await expect(middleware.use(req as any, res, makeNext())).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('wraps unexpected errors as UnauthorizedException("Invalid token")', async () => {
      const req = makeReq({
        method: 'GET',
        _parsedUrl: { pathname: '/protected' },
        headers: { authorization: 'Bearer t' },
      });
      const res = makeRes();
      (jwtService.verifyAsync as jest.Mock).mockImplementation(() => {
        throw new Error('unexpected');
      });

      await expect(middleware.use(req as any, res, makeNext())).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});

describe('WrapUserInArrayInterceptor', () => {
  // Testing library & framework: Jest
  const makeContext = (req: any): ExecutionContext => {
    const http = {
      getRequest: () => req,
    };
    return {
      switchToHttp: () => http,
    } as unknown as ExecutionContext;
  };

  const makeHandler = (): CallHandler => {
    return {
      handle: jest.fn().mockReturnValue({ pipe: jest.fn() }),
    } as unknown as CallHandler;
  };

  it('wraps non-array req.user into an array', () => {
    const interceptor = new WrapUserInArrayInterceptor();
    const req: any = { user: { id: '1' } };
    const context = makeContext(req);
    const next = makeHandler();

    interceptor.intercept(context, next);

    expect(Array.isArray(req.user)).toBe(true);
    expect(req.user).toEqual([{ id: '1' }]);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('leaves req.user as array if already array', () => {
    const interceptor = new WrapUserInArrayInterceptor();
    const original = [{ id: '1' }, { id: '2' }];
    const req: any = { user: original };
    const context = makeContext(req);
    const next = makeHandler();

    interceptor.intercept(context, next);

    expect(req.user).toBe(original);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('does nothing if req.user is undefined', () => {
    const interceptor = new WrapUserInArrayInterceptor();
    const req: any = {};
    const context = makeContext(req);
    const next = makeHandler();

    interceptor.intercept(context, next);

    expect(req.user).toBeUndefined();
    expect(next.handle).toHaveBeenCalledTimes(1);
  });
});