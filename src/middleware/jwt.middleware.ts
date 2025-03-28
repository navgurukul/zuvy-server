import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/index';
import { eq, sql, count } from 'drizzle-orm';
import { users, sansaarUserRoles } from '../../drizzle/schema';
import { helperVariable } from 'src/constants/helper';

@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) { }

  async use(req, res: Response, next: NextFunction) {

    const unrestrictedRoutes = [
      { path: '/classes', method: 'GET' },
      { path: '/classes/redirect/', method: 'GET' },
      { path: '/classes/getAllAttendance/:batchId', method: 'GET' },
      { path: "/student/apply", method: 'POST' },
    ];

    const unrestricted = unrestrictedRoutes.some(
      route => req._parsedUrl.pathname === route.path && req.method === route.method
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

      const user: any[] = await db
        .select()
        .from(users)
        .where(sql`${users.id} = ${decoded.id} AND ${users.email} = ${decoded.email}`);
      if (user.length === 0) {
        throw new UnauthorizedException('User is not authorized');
      }

      const rolesArray = await db
        .select()
        .from(sansaarUserRoles)
        .where(sql`${sansaarUserRoles.userId} = ${user[0].id}`);
      user[0].roles = rolesArray.map(role => role.role);

      req.user = user;

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
      if (error instanceof UnauthorizedException || error instanceof ForbiddenException) {
        throw error;
      } else {
        throw new UnauthorizedException('Invalid token');
      }
    }
  }
}
