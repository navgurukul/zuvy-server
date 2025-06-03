import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/index';
import { eq, sql } from 'drizzle-orm';
import { users, sansaarUserRoles } from '../../drizzle/schema';
import { helperVariable } from 'src/constants/helper';

// Define the base user type from the schema
type BaseUser = typeof users.$inferSelect;

// Define the UserWithRoles interface
interface UserWithRoles extends BaseUser {
  roles: string[];
}

// Extend Express Request type to include user property
interface RequestWithUser extends Request {
  user: UserWithRoles[];
  _parsedUrl: {
    pathname: string;
  };
}

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  async use(req: RequestWithUser, res: Response, next: NextFunction) {
    const unrestrictedRoutes = [
      { path: '/classes', method: 'GET' },
      { path: '/classes/redirect/', method: 'GET' },
      { path: '/classes/getAllAttendance/:batchId', method: 'GET' },
      { path: '/student/apply', method: 'POST' },
      { path: '/auth/google', method: 'GET' },
      { path: '/auth/', method: 'GET' },
      { path: '/auth/google/callback', method: 'GET' },
    ];

    const unrestricted = unrestrictedRoutes.some(
      (route) =>
        req._parsedUrl.pathname === route.path && req.method === route.method,
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
      const decoded: any = await this.jwtService.decode(token);
      if (!decoded) {
        throw new UnauthorizedException('Invalid token');
      }

      const user = await db
        .select()
        .from(users)
        .where(eq(users.id, decoded.id));

      if (user.length === 0) {
        throw new UnauthorizedException('User not found');
      }

      // const allRoles = await db.select().from(sansaarUserRoles);
      // for (const _role of allRoles) {
      //   console.log('====================================');
      //   console.log(_role);
      //   console.log('====================================');
      // }

      const rolesArray = await db
        .select()
        .from(sansaarUserRoles)
        .where(sql`${sansaarUserRoles.userId} = ${user[0].id}`);
      
      // Create a new user object with roles
      const userWithRoles: UserWithRoles = {
        ...user[0],
        roles: rolesArray.map((role) => role.role),
      };

      req.user = [userWithRoles];

      // Restrict access to instructor-side routes
      if (
        req._parsedUrl.pathname.startsWith('/instructor') &&
        !userWithRoles.roles.includes(helperVariable.admin) &&
        !userWithRoles.roles.includes(helperVariable.instructor)
      ) {
        throw new ForbiddenException(
          'Access restricted to admins and instructors',
        );
      }

      next();
    } catch (error) {
      if (
        error instanceof UnauthorizedException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      } else {
        console.log(`Error: ${error.message}`);
        throw new UnauthorizedException('Invalid token');
      }
    }
  }
}
