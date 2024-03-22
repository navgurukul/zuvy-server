import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { db } from '../db/index';
import { eq, sql, count } from 'drizzle-orm';
import { users } from '../../drizzle/schema';


@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

 async use(req, res: Response, next: NextFunction) {

//   if(req._parsedUrl.pathname === '/classes'  && req.method === 'GET')
//   {
//     next();
//     return;
//   }
//   if(req._parsedUrl.pathname === '/classes/redirect/'  && req.method === 'GET')
//   {
//     next();
//     return;
//   }if(req._parsedUrl.pathname === '/classes/getAllAttendance/:batchId'  && req.method === 'GET')
//   {
//     next();
//     return;
//   }
//   if(req._parsedUrl.pathname === '/classes/getAllAttendance/:batchId/'  && req.method === 'GET')
//   {
//     next();
//     return;
//   }
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // let user;
    // if (!token) {
    //   throw new UnauthorizedException('Token not found');
    // }
     try {
    //  const decoded = await this.jwtService.decode(token);
    //   if(decoded != null)
    //   {
    //     user = await db.select().from(users).where(sql`${users.id} = ${decoded.id} AND ${users.email} = ${decoded.email}`);
    //     req.user = user;
    //     if(user.length == 0)
    //     {
    //         throw new UnauthorizedException('User is not authorized');
    //     }
    //   }
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  } 
}