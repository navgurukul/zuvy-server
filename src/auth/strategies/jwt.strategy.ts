import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { db } from 'src/db';
import { sansaarUserRoles } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT,JWT_SECRET_KEY } = process.env;

// Extend Express Request type to include user property
interface RequestWithUser extends Request {
  user?: any[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: JWT_SECRET_KEY,
      passReqToCallback: true,
    });
  }

  async validate(req: RequestWithUser, payload: any) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    // Validate token against blacklist
    await this.authService.validateToken(token);

    // Get user roles
    const roles = await this.authService.getUserRoles(payload.sub);

    // Create user data object
    const userData = {
      id: payload.sub,
      email: payload.email,
      roles: roles
    };
    const arr = [userData];
req.user = arr;            // still fine to do, but optional now
return arr;
  }
} 