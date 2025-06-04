import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { Request } from 'express';
import { db } from 'src/db';
import { sansaarUserRoles } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT,JWT_SECRET_KEY } = process.env;

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

  async validate(req: Request, payload: any) {
    // Get the token from the request
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    // Check if token is blacklisted
    await this.authService.validateToken(token);

    // Get user roles
    const roles = await this.authService.getUserRoles(payload.sub);
    
    return {
      id: payload.sub,
      email: payload.email,
      roles: roles,
    };
  }
} 