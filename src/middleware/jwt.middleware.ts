import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  NestInterceptor,
  ExecutionContext,
  CallHandler
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/index';
import { eq, sql, count } from 'drizzle-orm';
import { users, sansaarUserRoles } from '../../drizzle/schema';
import { helperVariable } from 'src/constants/helper';
import { AuthService } from '../auth/auth.service';
import { Observable } from 'rxjs';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT,JWT_SECRET_KEY } = process.env;

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly authService: AuthService
  ) {}

  async use(req, res: Response, next: NextFunction) {
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
      { path: "/student/apply", method: 'POST' },
      { path: "/users/verify-token", method: 'POST' },
      // Add more unrestricted routes here as needed
    ];

    const unrestricted = unrestrictedRoutes.some(
      route => {
        // Handle exact matches
        if (route.path === req._parsedUrl.pathname && req.method === route.method) {
          return true;
        }
        
        // Handle routes with parameters (e.g., /classes/getAllAttendance/:batchId)
        if (route.path.includes(':')) {
          const routePattern = route.path.replace(/:[^/]+/g, '[^/]+');
          const regex = new RegExp(`^${routePattern}$`);
          return regex.test(req._parsedUrl.pathname) && req.method === route.method;
        }
        
        return false;
      }
    );

    if (unrestricted) {
      next();
      return;
    }

    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }

    try {
      // Check if token is blacklisted
      const decoded: any = await this.jwtService.verifyAsync(token, {
        secret: JWT_SECRET_KEY
      });
      
      if (!decoded) {
        throw new UnauthorizedException('Invalid token');
      }
      const user: any[] = await db
        .select()
        .from(users)
        .where(sql`${users.id} = ${decoded.sub} AND ${users.email} = ${decoded.email}`);
      
  
      
      if (user.length === 0) {
        throw new UnauthorizedException('User is not authorized');
      }

      const rolesArray = await db
        .select()
        .from(sansaarUserRoles)
        .where(sql`${sansaarUserRoles.userId} = ${user[0].id}`);
      user[0].roles = rolesArray.map(role => role.role);

      // Initialize req.user as an array if it doesn't exist
      if (!req.user) {
        req.user = [];
      }
      req.user = user[0];
      // Restrict access to instructor-side routes
      if (
        req._parsedUrl.pathname.startsWith('/instructor') &&
        !user[0].roles.includes(helperVariable.admin) &&
        !user[0].roles.includes(helperVariable.instructor)
      ) {
        throw new ForbiddenException('Access restricted to admins and instructors');
      }

      next();
    } catch (error) {
      console.error("Token verification error:", error);
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
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
