import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { db } from '../db';
import {
  users,
  blacklistedTokens,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  sansaarUserRoles,
  userTokens,
} from '../../drizzle/schema';
import { eq, inArray } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { UserTokensService } from 'src/user-tokens/user-tokens.service';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT, JWT_SECRET_KEY } =
  process.env;
// import { Role } from '../rbac/utility';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleAuthClient: OAuth2Client;

  constructor(
    private jwtService: JwtService,
    private readonly userTokenService: UserTokensService,
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

  async getUserRoles(userId: bigint): Promise<string[]> {
    try {
      // 🔹 Step 1: Try new role system first
      let userRoles = await db
        .select({
          roleId: zuvyUserRolesAssigned.roleId,
          roleName: zuvyUserRoles.name,
        })
        .from(zuvyUserRolesAssigned)
        .innerJoin(
          zuvyUserRoles,
          eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
        )
        .where(eq(zuvyUserRolesAssigned.userId, userId));

      // 🔹 Step 2: If no roles found, fallback to legacy system
      if (userRoles.length === 0) {
        const oldUserRoles = await db
          .select()
          .from(sansaarUserRoles)
          .where(eq(sansaarUserRoles.userId, Number(userId)));

        if (oldUserRoles.length > 0) {
          const legacyRoleName = oldUserRoles[0].role;
          const normalizedRoleName = legacyRoleName.trim().toLowerCase();

          // 🔹 Step 3: Check if role already exists (case-insensitive handled)
          const existingRole = await db
            .select()
            .from(zuvyUserRoles)
            .where(eq(zuvyUserRoles.name, normalizedRoleName))
            .limit(1);

          let roleId: number;

          if (existingRole.length > 0) {
            // Role already exists
            roleId = existingRole[0].id;
          } else {
            // 🔹 Step 4: Create role safely (normalized)
            try {
              const addNewRole = {
                name: normalizedRoleName,
                description: `Migrated role: ${legacyRoleName}`,
              };

              const newRole = await db
                .insert(zuvyUserRoles)
                .values(addNewRole)
                .returning();

              roleId =
                newRole.length > 0
                  ? newRole[0].id
                  : normalizedRoleName === 'admin'
                    ? 2
                    : normalizedRoleName === 'instructor'
                      ? 3
                      : 4;
            } catch (error) {
              this.logger.error(
                `Error creating role ${legacyRoleName}:`,
                error,
              );

              // 🔹 Safe fallback mapping
              roleId =
                normalizedRoleName === 'admin'
                  ? 2
                  : normalizedRoleName === 'instructor'
                    ? 3
                    : 4;
            }
          }

          // 🔹 Step 5: Assign role to user
          const assignRole = {
            userId: userId,
            roleId: roleId,
          };
          await db.insert(zuvyUserRolesAssigned).values(assignRole);

          // 🔹 Step 6: Cleanup legacy role entry
          await db
            .delete(sansaarUserRoles)
            .where(eq(sansaarUserRoles.userId, Number(userId)));

          userRoles = [
            {
              roleId: roleId,
              roleName: normalizedRoleName,
            },
          ];
        }
      }

      // 🔹 Step 7: Return roles or default
      return userRoles.length > 0
        ? userRoles.map((role) => role.roleName)
        : ['student'];
    } catch (error) {
      this.logger.error('Error fetching user roles:', error);
      return ['student'];
    }
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
        throw new UnauthorizedException(
          'Email mismatch between request and Google token',
        );
      }

      // 4. Find user in your DB
      const result = await db
        .select()
        .from(users)
        .where(eq(users.email, tokenEmail));
      let user = result[0];

      if (!user) {
        // Create new user if not exists
        const [newUser] = await db
          .insert(users)
          .values({
            email: tokenEmail,
            name: payload.name || '',
            profilePicture: payload.picture || '',
            googleUserId: googleUserId,
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            mode: 'student', // Default mode
          })
          .returning();
        user = newUser;
      } else {
        // Existing user logic
        if (!user.googleUserId) {
          await db
            .update(users)
            .set({ googleUserId: googleUserId })
            .where(eq(users.id, user.id));
          // Update the user object in memory as well
          user.googleUserId = googleUserId;
        }

        if (user.googleUserId !== googleUserId) {
          throw new UnauthorizedException('Google user ID mismatch');
        }

        // Update last login timestamp
        await db
          .update(users)
          .set({ lastLoginAt: new Date().toISOString() })
          .where(eq(users.id, user.id));
      }

      // Get user roles
      const roles = await this.getUserRoles(user.id);

      const jwtPayload = {
        sub: user.id.toString(),
        email: user.email,
        googleUserId: user.googleUserId,
        role: user.mode,
        rolesList: roles,
      };

      const access_token = this.jwtService.sign(jwtPayload);
      const refresh_token = this.jwtService.sign(jwtPayload, {
        expiresIn: '7d',
      });

      // Store tokens in database so they can be blacklisted when user info is updated
      await db
        .insert(userTokens)
        .values({
          userId: Number(user.id),
          userEmail: user.email,
          accessToken: access_token,
          refreshToken: refresh_token,
        })
        .onConflictDoUpdate({
          target: userTokens.userId,
          set: {
            accessToken: access_token,
            refreshToken: refresh_token,
          },
        });

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
          rolesList: roles,
        },
      };
    } catch (error) {
      if (error.message.includes('Wrong recipient')) {
        throw new UnauthorizedException(
          'Invalid Google client ID configuration',
        );
      } else if (error.message.includes('Token used too late')) {
        throw new UnauthorizedException('Token has expired');
      } else if (error.message.includes('Invalid token')) {
        throw new UnauthorizedException('Invalid Google ID token');
      } else {
        throw new UnauthorizedException(
          'Authentication failed: ' + error.message,
        );
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
        expiresAt: new Date(expiresAt),
      });

      return { message: 'Successfully logged out' };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async updateUserlogout(userId: bigint, accToken: string, refToken: string) {
    try {
      // Decode access token
      const decodedAcc = this.jwtService.decode(accToken) as { exp: number };
      const accExpiresAt = new Date(decodedAcc.exp * 1000);

      // Decode refresh token
      const decodedRef = this.jwtService.decode(refToken) as { exp: number };
      const refExpiresAt = new Date(decodedRef.exp * 1000);

      // Insert access token
      await db
        .insert(blacklistedTokens)
        .values({
          token: accToken,
          userId: BigInt(userId),
          expiresAt: accExpiresAt,
        })
        .onConflictDoNothing();

      // Insert refresh token
      await db
        .insert(blacklistedTokens)
        .values({
          token: refToken,
          userId: BigInt(userId),
          expiresAt: refExpiresAt,
        })
        .onConflictDoNothing();

      return { message: 'Successfully logged out' };
    } catch (error) {
      this.logger.error('Logout error:', error);
      throw new UnauthorizedException('Invalid tokens');
    }
  }

  async validateToken(token: string) {
    try {
      // Check if token is blacklisted
      const [blacklistedToken] = await db
        .select()
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
      const [blacklistedToken] = await db
        .select()
        .from(blacklistedTokens)
        .where(eq(blacklistedTokens.token, refreshToken));
      if (blacklistedToken) {
        throw new UnauthorizedException('Refresh token has been invalidated');
      }
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, payload.sub));
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Get user roles for the new token
      const roles = await this.getUserRoles(user.id);

      // Generate new tokens
      const newPayload = {
        sub: user.id.toString(),
        email: user.email,
        googleUserId: user.googleUserId,
        role: user.mode,
        rolesList: roles,
      };

      const newAccessToken = this.jwtService.sign(newPayload);
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });
      // Blacklist the old refresh token
      const decoded = this.jwtService.decode(refreshToken) as { exp: number };
      const expiresAt = new Date(decoded.exp * 1000).toISOString();

      await db.insert(blacklistedTokens).values({
        token: refreshToken,
        expiresAt: new Date(expiresAt),
        userId: payload.sub,
      });

      await this.userTokenService.upsertToken({
        userId: Number(user.id),
        userEmail: user.email,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      });

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // Cleanup expired blacklisted tokens (can be called by a scheduled task)
  async cleanupExpiredTokens() {
    const now = new Date();
    await db
      .delete(blacklistedTokens)
      .where(eq(blacklistedTokens.expiresAt, now));
  }
}
