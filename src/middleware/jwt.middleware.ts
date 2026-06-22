import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { db } from '../db/index';
import { sql } from 'drizzle-orm';
import { users } from '../../drizzle/schema';
import { helperVariable } from 'src/constants/helper';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req, res: Response, next: NextFunction) {
    // ABSOLUTE BYPASS FOR ZOOM WEBHOOKS (BEFORE ANY AUTH LOGIC)
    if (req.originalUrl?.startsWith('/webhooks/zoom')) {
      return next();
    }

    const unrestrictedRoutes = [
      { path: '/auth/login', method: 'POST' },
      { path: '/auth/refresh', method: 'POST' },
      { path: '/auth/debug-token', method: 'POST' },
      { path: '/classes', method: 'GET' },
      { path: '/classes/redirect/', method: 'GET' },
      { path: '/classes/google-auth/redirect', method: 'GET' },
      { path: '/classes/create-session-public', method: 'POST' },
      { path: '/classes/getAllAttendance/:batchId', method: 'GET' },
      { path: '/classes/test-endpoint', method: 'GET' },
      { path: '/student/apply', method: 'POST' },
      { path: '/users/verify-token', method: 'POST' },
      // GOOGLE OAUTH
      { path: '/google/connect', method: 'GET' },
      { path: '/google/callback', method: 'GET' },
      // Add more unrestricted routes here as needed
    ];

    const unrestricted = unrestrictedRoutes.some((route) => {
      // Handle exact matches
      if (
        route.path === req._parsedUrl.pathname &&
        req.method === route.method
      ) {
        return true;
      }

      // Handle routes with parameters (e.g., /classes/getAllAttendance/:batchId)
      if (route.path.includes(':')) {
        const routePattern = route.path.replace(/:[^/]+/g, '[^/]+');
        const regex = new RegExp(`^${routePattern}$`);
        return (
          regex.test(req._parsedUrl.pathname) && req.method === route.method
        );
      }

      return false;
    });

    if (unrestricted) {
      next();
      return;
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      const decoded: any = await this.authService.validateToken(token);

      if (!decoded) {
        throw new UnauthorizedException('Invalid token');
      }
      const user: any[] = await db
        .select()
        .from(users)
        .where(
          sql`${users.id} = ${decoded.sub} AND ${users.email} = ${decoded.email}`,
        );

      if (user.length === 0) {
        throw new UnauthorizedException('User is not authorized');
      }

      user[0].roles = await this.authService.getUserRoles(
        Number(decoded.sub),
        decoded.orgId ?? null,
      );
      user[0].orgId = decoded.orgId ?? null;
      user[0].orgName = decoded.orgName ?? null;

      // Initialize req.user as an array if it doesn't exist
      if (!req.user) {
        req.user = [];
      }
      req.user = user[0];
      // Role-based access control
      const userRoles = user[0].roles || [];
      const isAdmin = userRoles.includes(helperVariable.admin);
      const isInstructor = userRoles.includes(helperVariable.instructor);

      // Restrict access to instructor-side routes
      if (
        req._parsedUrl.pathname.startsWith('/instructor') &&
        !isAdmin &&
        !isInstructor
      ) {
        throw new ForbiddenException(
          'Access restricted to admins and instructors',
        );
      }

      // Add user role information to request for use in controllers
      req.user.roleInfo = {
        roles: userRoles,
        isAdmin,
        isInstructor,
        hasRole: (role: string) => userRoles.includes(role),
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      } else {
        throw new UnauthorizedException('Invalid token');
      }
    }
  }
}
@Injectable()
export class WrapUserInArrayInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    if (req.user && !Array.isArray(req.user)) {
      req.user = [req.user];
    }
    return next.handle();
  }
}
