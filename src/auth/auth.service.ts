import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { db } from '../db';
import { users, blacklistedTokens, sansaarUserRoles } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT,JWT_SECRET_KEY } = process.env;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleAuthClient: OAuth2Client;

  constructor(
    private jwtService: JwtService,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    this.googleAuthClient = new OAuth2Client(clientId);
  }

  async validateUser(email: string, googleUserId: string): Promise<any> {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (user && user.googleUserId === googleUserId) {
      return user;
    }
    return null;
  }

  async getUserRoles(userId: number | string): Promise<string[]> {
    const userRoles = await db.select()
      .from(sansaarUserRoles)
      .where(eq(sansaarUserRoles.userId, Number(userId)));

    return userRoles.length > 0 
      ? userRoles.map(role => role.role)
      : ['student'];
  }

  async login(loginDto: LoginDto) {
    try {      
      // 1. Verify the Google ID token
      const ticket = await this.googleAuthClient.verifyIdToken({
        idToken: loginDto.googleIdToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();

      // 2. Extract user info from token
      const tokenEmail = payload.email;
      const googleUserId = payload.sub;

      // 3. Validate that the email in the request matches the email in the token
      if (loginDto.email.toLowerCase() !== tokenEmail.toLowerCase()) {
        throw new UnauthorizedException('Email mismatch between request and Google token');
      }

      // 4. Find user in your DB
      const [user] = await db.select().from(users).where(eq(users.email, tokenEmail));
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      if (!user.googleUserId) {
        await db.update(users)
          .set({ googleUserId: googleUserId })
          .where(eq(users.id, user.id));
        // Optionally, update the user object in memory as well
        user.googleUserId = googleUserId;
      }
      if (user.googleUserId !== googleUserId) {
        throw new UnauthorizedException('Google user ID mismatch');
      }

      // Update last login timestamp
      await db.update(users)
        .set({ lastLoginAt: new Date().toISOString() })
        .where(eq(users.id, user.id));

      // Get user roles
      const roles = await this.getUserRoles(user.id.toString());

      const jwtPayload = { 
        sub: user.id.toString(),
        email: user.email,
        googleUserId: user.googleUserId,
        role: user.mode,
        rolesList: roles
      };

      const access_token = this.jwtService.sign(jwtPayload);
      const refresh_token = this.jwtService.sign(jwtPayload, { expiresIn: '7d' });

      return {
        access_token,
        refresh_token,
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          profilePicture: user.profilePicture,
          role: user.mode,
          center: user.center,
          rolesList: roles
        }
      };
    } catch (error) {
      if (error.message.includes('Wrong recipient')) {
        throw new UnauthorizedException('Invalid Google client ID configuration');
      } else if (error.message.includes('Token used too late')) {
        throw new UnauthorizedException('Token has expired');
      } else if (error.message.includes('Invalid token')) {
        throw new UnauthorizedException('Invalid Google ID token');
      } else {
        throw new UnauthorizedException('Authentication failed: ' + error.message);
      }
    }
  }

  async logout(userId: bigint, token: string) {
    try {
      // Decode token to get expiration
      const decoded = this.jwtService.decode(token) as { exp: number };
      const expiresAt = new Date(decoded.exp * 1000).toISOString();

      // Add token to blacklist
      await db.insert(blacklistedTokens).values({
        token,
        userId: BigInt(userId),
        expiresAt: new Date(expiresAt)
      });

      return { message: 'Successfully logged out' };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async validateToken(token: string) {
    try {      
      // Check if token is blacklisted
      const [blacklistedToken] = await db.select()
        .from(blacklistedTokens)
        .where(eq(blacklistedTokens.token, token));

      if (blacklistedToken) {
        throw new UnauthorizedException('Token has been invalidated');
      }

      const payload = await this.jwtService.verifyAsync(token);
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      const [blacklistedToken] = await db.select()
        .from(blacklistedTokens)
        .where(eq(blacklistedTokens.token, refreshToken));
      if (blacklistedToken) {
        throw new UnauthorizedException('Refresh token has been invalidated');
      }
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const [user] = await db.select()
        .from(users)
        .where(eq(users.id, payload.sub));
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const newPayload = {
        sub: user.id,
        email: user.email,
        googleUserId: user.googleUserId,
        role: user.mode
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, { expiresIn: '7d' });

      // Blacklist the old refresh token
      const decoded = this.jwtService.decode(refreshToken) as { exp: number };
      const expiresAt = new Date(decoded.exp * 1000).toISOString();
      
      await db.insert(blacklistedTokens).values({
        token: refreshToken,
        expiresAt: new Date(expiresAt),
        userId: payload.sub
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // Cleanup expired blacklisted tokens (can be called by a scheduled task)
  async cleanupExpiredTokens() {
    const now = new Date();
    await db.delete(blacklistedTokens)
      .where(eq(blacklistedTokens.expiresAt, now));
  }
} 