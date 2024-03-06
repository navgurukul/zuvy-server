import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';


interface DecodedUser {
  id: bigint; // Define id as bigint
  // Add other properties as needed
}

declare global {
  namespace Express {
    interface Request {
      user?: DecodedUser;
    }
  }
}
@Injectable()
export class JwtMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Token not found');
    }
    try {
      const decoded = this.jwtService.verify(token) as DecodedUser;
      console.log(decoded);
      req.user = decoded; 
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
