import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';


// interface DecodedUser {
//   id: string; // Define id as bigint
//   // Add other properties as needed
// }

// declare global {
//   namespace Express {
//     interface Request {
//       user?: DecodedUser;
//     }
//   }
// }
@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

 async use(req: Request, res: Response, next: NextFunction) {
    
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }
    try {
        console.log(token,process.env.JWT_SECRET_KEY);
      const decoded = await this.jwtService.verifyAsync(token,{
        secret: process.env.JWT_SECRET_KEY,
      });
      console.log(decoded);
      req['user'] = decoded;
      next();
    } catch (error) {
        console.log("Error",error);
      throw new UnauthorizedException('Invalid token');
    }
  }
}