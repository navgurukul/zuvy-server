import {
  Inject,
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { JwtService } from '@nestjs/jwt';
import { LoginDto } from './dto/login.dto';
import { db } from '../db';
import {
  users,
  blacklistedTokens,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  userTokens,
  zuvyOrganizations,
  zuvyUserOrganizations,
  zuvyPermissions,
  zuvyResources,
  zuvyPermissionsRoles,
  zuvyUserFeatureFlags,
} from '../../drizzle/schema';
import { eq, inArray, and, isNull, or, isNotNull } from 'drizzle-orm';
import { OAuth2Client } from 'google-auth-library';
import { UserTokensService } from 'src/user-tokens/user-tokens.service';
import { ResourceList } from 'src/rbac/utility';
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT_URI, JWT_SECRET_KEY } =
  process.env;
// import { Role } from '../rbac/utility';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly googleAuthClient: OAuth2Client;

  constructor(
    private jwtService: JwtService,
    private readonly userTokenService: UserTokensService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    this.googleAuthClient = new OAuth2Client(clientId);
  }

  /**
   * Checks whether the one-time tooltip should be shown for the given user.
   * On the first call for a user it inserts a record (loginTooltip = true)
   * and returns true. Every subsequent call finds the existing record and
   * returns false. The UNIQUE constraint + onConflictDoNothing is race-safe.
   */
  private async resolveTooltipFlag(userId: bigint): Promise<boolean> {
    const [existing] = await db
      .select({ id: zuvyUserFeatureFlags.id })
      .from(zuvyUserFeatureFlags)
      .where(eq(zuvyUserFeatureFlags.userId, userId))
      .limit(1);

    if (existing) {
      return false;
    }

    await db
      .insert(zuvyUserFeatureFlags)
      .values({
        userId,
        loginTooltip: true,
      } as any)
      .onConflictDoNothing();

    return true;
  }

  async validateUser(email: string, googleUserId: string): Promise<any> {
    const [user] = await db.select().from(users).where(eq(users.email, email));

    if (user && user.googleUserId === googleUserId) {
      return user;
    }
    return null;
  }

  async getUserRoles(userId: number, orgId: number | null): Promise<string[]> {
    try {
      const orgFilter =
        orgId !== null
          ? or(
              eq(zuvyUserRolesAssigned.organizationId, orgId),
              isNull(zuvyUserRolesAssigned.organizationId),
            )
          : isNull(zuvyUserRolesAssigned.organizationId);

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
        .where(
          and(eq(zuvyUserRolesAssigned.userId, BigInt(userId)), orgFilter),
        );

      // 🔹 Step 2: Return roles or default
      return userRoles.length > 0
        ? userRoles.map((role) => role.roleName)
        : ['student'];
    } catch (error) {
      this.logger.error('Error fetching user roles:', error);
      return ['student'];
    }
  }

  async getFormattedPermissions(
    userId: number,
    orgId: number | null,
    roles: string[],
  ): Promise<Record<string, boolean>> {
    try {
      const permissionsMap: Record<string, boolean> = {};

      // Initialize all possible permissions to false or just omit them?
      // The user wants a map of available permissions.

      // Check if user is super_admin
      if (roles.includes('super_admin')) {
        Object.values(ResourceList).forEach((resource) => {
          Object.values(resource).forEach((permissionName) => {
            permissionsMap[permissionName] = true;
          });
        });
        return permissionsMap;
      }

      // Fetch permissions from DB
      const userPermissions = await db
        .selectDistinct({
          permission: zuvyPermissions.name,
          resource: zuvyResources.key, // Use key for mapping
        })
        .from(zuvyPermissions)
        .innerJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
        .innerJoin(
          zuvyPermissionsRoles,
          eq(zuvyPermissions.id, zuvyPermissionsRoles.permissionId),
        )
        .innerJoin(
          zuvyUserRoles,
          eq(zuvyPermissionsRoles.roleId, zuvyUserRoles.id),
        )
        .innerJoin(
          zuvyUserRolesAssigned,
          eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
        )
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
            orgId !== null
              ? eq(zuvyUserRolesAssigned.organizationId, orgId)
              : isNull(zuvyUserRolesAssigned.organizationId),
            orgId !== null
              ? eq(zuvyPermissionsRoles.orgId, orgId)
              : isNull(zuvyPermissionsRoles.orgId),
          ),
        );

      // Map DB permissions to formatted names
      userPermissions.forEach((p) => {
        const resourceKey = p.resource.toLowerCase();
        let action = p.permission.toLowerCase();

        // Database uses 'view' for readability permissions, but ResourceList uses 'read' key
        if (action === 'view') {
          action = 'read';
        }

        if (ResourceList[resourceKey] && ResourceList[resourceKey][action]) {
          const formattedName = ResourceList[resourceKey][action];
          permissionsMap[formattedName] = true;
        }
      });

      return permissionsMap;
    } catch (error) {
      this.logger.error('Error fetching formatted permissions:', error);
      return {};
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

      // Get User Org
      // Fetch user's organizations
      const userOrgs = await db
        .select({
          orgId: zuvyOrganizations.id,
          orgName: zuvyOrganizations.displayName,
          pocEmail: zuvyOrganizations.pocEmail,
        })
        .from(zuvyUserRolesAssigned)
        .innerJoin(
          zuvyOrganizations,
          eq(zuvyUserRolesAssigned.organizationId, zuvyOrganizations.id),
        )
        .where(eq(zuvyUserRolesAssigned.userId, user.id));

      let selectedOrg = null;
      if (userOrgs.length > 0) {
        // Default to first one or use logic to pick preferred
        selectedOrg = userOrgs[0];
      }

      // Get user roles (scoped to org)
      const roles = await this.getUserRoles(
        Number(user.id),
        selectedOrg?.orgId,
      );

      // Get formatted permissions
      const permissions = await this.getFormattedPermissions(
        Number(user.id),
        selectedOrg?.orgId,
        roles,
      );

      const jwtPayload = {
        sub: user.id.toString(),
        email: user.email,
        googleUserId: user.googleUserId,
        role: user.mode,
        rolesList: roles,
        permissions: permissions,
        orgId: selectedOrg?.orgId || null,
        orgName: selectedOrg?.orgName || null,
        isPoc: selectedOrg?.pocEmail === user.email,
      };

      const access_token = this.jwtService.sign(jwtPayload, {
        expiresIn: '24h',
      });
      const refresh_token = this.jwtService.sign(jwtPayload, {
        expiresIn: '7d',
      });

      // Store tokens only for organization-scoped users. Student tokens are
      // deliberately not persisted in zuvyUserOrganizations.
      const setTokenData = {
        accessToken: access_token,
        refreshToken: refresh_token,
      } as any;

      const isStudentOnly =
        roles.length > 0 && roles.every((role) => role === 'student');

      const isSuperAdmin = roles.includes('super_admin');

      // Store tokens only for non-student users
      if (!isStudentOnly && (selectedOrg || isSuperAdmin)) {
        await db
          .insert(zuvyUserOrganizations)
          .values({
            userId: Number(user.id),
            organizationId: selectedOrg?.orgId || null,
            userEmail: user.email,
            accessToken: access_token,
            refreshToken: refresh_token,
          } as any)
          .onConflictDoUpdate({
            target: [
              zuvyUserOrganizations.userId,
              zuvyUserOrganizations.organizationId,
            ],
            set: setTokenData,
          });
      } else if (!isStudentOnly && roles.length > 0) {
        this.logger.warn(
          `[Login Warning] User "${user.email}" (ID: ${user.id}) has the role(s) "${roles.join(', ')}" ` +
            `but is not linked to any organization. Session token was not saved. ` +
            `Please assign this user to a valid organization to allow proper login.`,
        );
      }

      // Legacy userTokens table update removed/commented out as per requirement
      /*
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
      */

      const showTooltip = await this.resolveTooltipFlag(user.id);

      return {
        access_token,
        refresh_token,
        showTooltip,
        user: {
          id: user.id.toString(),
          email: user.email,
          name: user.name,
          profilePicture: user.profilePicture,
          role: user.mode,
          center: user.center,
          rolesList: roles,
          orgId: selectedOrg?.orgId || null,
          orgName: selectedOrg?.orgName || null,
          isPoc: selectedOrg?.pocEmail === user.email,
          permissions: permissions,
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
      // Global Logout: Invalidate all tokens for the user across all organizations

      // 1. Fetch all active tokens from zuvyUserOrganizations for this user
      const activeSessions = await db
        .select({
          accessToken: zuvyUserOrganizations.accessToken,
          refreshToken: zuvyUserOrganizations.refreshToken,
        })
        .from(zuvyUserOrganizations)
        .where(eq(zuvyUserOrganizations.userId, Number(userId)));

      const tokensToBlacklist = [];

      // Add the current token just in case
      tokensToBlacklist.push(token);

      for (const session of activeSessions) {
        if (session.accessToken) tokensToBlacklist.push(session.accessToken);
        if (session.refreshToken) tokensToBlacklist.push(session.refreshToken);
      }

      // 2. Insert into blacklist
      const now = new Date();
      // Default expiry if we can't decode, or 7 days from now
      const defaultExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const t of tokensToBlacklist) {
        try {
          // Try decode to get exp
          const decoded = this.jwtService.decode(t) as { exp: number };
          const expiresAt = decoded?.exp
            ? new Date(decoded.exp * 1000)
            : defaultExpiry;

          await db
            .insert(blacklistedTokens)
            .values({
              token: t,
              userId: BigInt(userId),
              expiresAt: expiresAt,
            })
            .onConflictDoNothing();
        } catch (e) {
          // Ignore decode errors
        }
      }

      // 3. Clear tokens from zuvyUserOrganizations
      await db
        .update(zuvyUserOrganizations)
        .set({
          accessToken: null,
          refreshToken: null,
        } as any)
        .where(eq(zuvyUserOrganizations.userId, Number(userId)));

      return { message: 'Successfully logged out from all organizations' };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async updateUserlogout(userId: number, accToken: string, refToken: string) {
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
      // Check if token is blacklisted. Cache the boolean result in Redis for
      // 30s so this doesn't hit Postgres on every single authenticated
      // request; falls back to the original query on a cache miss.
      const cacheKey = `blacklist:${token}`;
      const cached = await this.cacheManager.get<boolean>(cacheKey);
      let isBlacklisted: boolean;

      if (typeof cached === 'boolean') {
        isBlacklisted = cached;
      } else {
        const [blacklistedToken] = await db
          .select()
          .from(blacklistedTokens)
          .where(eq(blacklistedTokens.token, token));

        isBlacklisted = !!blacklistedToken;
        await this.cacheManager.set(cacheKey, isBlacklisted, 30000);
      }

      if (isBlacklisted) {
        throw new UnauthorizedException('Token has been invalidated');
      }

      const payload = await this.jwtService.verifyAsync(token);
      await this.ensureTokenSessionIsCurrent(token, payload, 'accessToken');
      return payload;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private async ensureTokenSessionIsCurrent(
    token: string,
    payload: any,
    tokenColumn: 'accessToken' | 'refreshToken',
  ) {
    const userId = Number(payload.sub);
    const orgId = payload.orgId ?? null;
    const tokenRoles = Array.isArray(payload.rolesList)
      ? payload.rolesList
      : [];

    if (orgId) {
      const [storedSession] = await db
        .select({
          token: zuvyUserOrganizations[tokenColumn],
        })
        .from(zuvyUserOrganizations)
        .where(
          and(
            eq(zuvyUserOrganizations.userId, userId),
            eq(zuvyUserOrganizations.organizationId, orgId),
          ),
        )
        .limit(1);

      if (!storedSession || storedSession.token !== token) {
        throw new UnauthorizedException('Token is no longer valid');
      }
      return;
    }

    if (tokenRoles.includes('super_admin')) {
      return;
    }

    const [orgScopedRole] = await db
      .select({ id: zuvyUserRolesAssigned.id })
      .from(zuvyUserRolesAssigned)
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
          isNotNull(zuvyUserRolesAssigned.organizationId),
        ),
      )
      .limit(1);

    if (orgScopedRole) {
      throw new UnauthorizedException('Session context is no longer valid');
    }

    if (tokenRoles.includes('student') || tokenRoles.length === 0) {
      return;
    }

    const [storedSession] = await db
      .select({
        token: zuvyUserOrganizations[tokenColumn],
      })
      .from(zuvyUserOrganizations)
      .where(
        and(
          eq(zuvyUserOrganizations.userId, userId),
          isNull(zuvyUserOrganizations.organizationId),
        ),
      )
      .limit(1);

    if (!storedSession || storedSession.token !== token) {
      throw new UnauthorizedException('Token is no longer valid');
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      // 1. Check blacklist
      const [blacklistedToken] = await db
        .select()
        .from(blacklistedTokens)
        .where(eq(blacklistedTokens.token, refreshToken));
      if (blacklistedToken) {
        throw new UnauthorizedException('Refresh token has been invalidated');
      }

      // 2. Verify and decode
      const payload = await this.jwtService.verifyAsync(refreshToken);
      const userId = payload.sub;
      const orgId = payload.orgId;
      await this.ensureTokenSessionIsCurrent(
        refreshToken,
        payload,
        'refreshToken',
      );

      // 3. Verify against DB (Strict One Session Per Org)
      if (orgId) {
        const [storedSession] = await db
          .select()
          .from(zuvyUserOrganizations)
          .where(
            and(
              eq(zuvyUserOrganizations.userId, userId),
              eq(zuvyUserOrganizations.organizationId, orgId),
            ),
          );

        if (!storedSession || storedSession.refreshToken !== refreshToken) {
          // Token rotation mismatch or invalid session
          throw new UnauthorizedException('Refresh token is no longer valid');
        }
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Get user roles
      const roles = await this.getUserRoles(Number(user.id), orgId);

      // Get formatted permissions
      const permissions = await this.getFormattedPermissions(
        Number(user.id),
        orgId,
        roles,
      );

      let orgName = payload.orgName;
      let pocEmail = null;
      // Refresh org details if needed
      if (orgId) {
        const [org] = await db
          .select({
            displayName: zuvyOrganizations.displayName,
            pocEmail: zuvyOrganizations.pocEmail,
          })
          .from(zuvyOrganizations)
          .where(eq(zuvyOrganizations.id, orgId));
        orgName = org?.displayName;
        pocEmail = org?.pocEmail;
      }

      // Generate new tokens
      const newPayload = {
        sub: user.id.toString(),
        email: user.email,
        googleUserId: user.googleUserId,
        role: user.mode,
        rolesList: roles,
        permissions: permissions,
        orgId: orgId,
        orgName: orgName,
        isPoc: pocEmail === user.email,
      };

      const newAccessToken = this.jwtService.sign(newPayload, {
        expiresIn: '24h',
      });
      const newRefreshToken = this.jwtService.sign(newPayload, {
        expiresIn: '7d',
      });

      // Blacklist the old refresh token
      const decoded = this.jwtService.decode(refreshToken) as { exp: number };
      const expiresAt = new Date(decoded.exp * 1000).toISOString();

      await db
        .insert(blacklistedTokens)
        .values({
          token: refreshToken,
          expiresAt: new Date(expiresAt),
          userId: payload.sub,
        })
        .onConflictDoNothing();

      // Update zuvyUserOrganizations
      if (orgId) {
        await db
          .update(zuvyUserOrganizations)
          .set({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          } as any)
          .where(
            and(
              eq(zuvyUserOrganizations.userId, userId),
              eq(zuvyUserOrganizations.organizationId, orgId),
            ),
          );
      } else {
        // Legacy path update?
        // Fetch user's organizations to get an orgId for upsertToken
        const userOrgs = await db
          .select({
            orgId: zuvyUserOrganizations.organizationId,
          })
          .from(zuvyUserOrganizations)
          .where(eq(zuvyUserOrganizations.userId, Number(user.id)))
          .limit(1);

        if (userOrgs.length > 0) {
          await this.userTokenService.upsertToken({
            userId: Number(user.id),
            organizationId: userOrgs[0].orgId,
            userEmail: user.email,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
          });
        }
      }

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
      };
    } catch (e) {
      this.logger.error('Refresh token error', e);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  // Method to generate tokens for switching organization
  async generateTokensForSwitch(userId: bigint, targetOrgId: number) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) throw new UnauthorizedException('User not found');

    // Check for super_admin role globally
    const globalRoles = await this.getUserRoles(Number(userId), null);
    const isSuperAdmin = globalRoles.includes('super_admin');

    if (!isSuperAdmin) {
      // Verify membership for non-super_admins
      const [membership] = await db
        .select()
        .from(zuvyUserRolesAssigned)
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, userId),
            eq(zuvyUserRolesAssigned.organizationId, targetOrgId),
          ),
        );

      if (!membership) {
        throw new UnauthorizedException(
          'User is not a member of this organization',
        );
      }
    }

    const [org] = await db
      .select()
      .from(zuvyOrganizations)
      .where(eq(zuvyOrganizations.id, targetOrgId));

    let roles = await this.getUserRoles(Number(userId), targetOrgId);

    // If super admin, ensure they keep their super_admin role even when switched
    if (isSuperAdmin && !roles.includes('super_admin')) {
      roles = [...roles, 'super_admin'];
    }

    // Get formatted permissions
    const permissions = await this.getFormattedPermissions(
      Number(userId),
      targetOrgId,
      roles,
    );

    const payload = {
      sub: user.id.toString(),
      email: user.email,
      googleUserId: user.googleUserId,
      role: user.mode,
      rolesList: roles,
      permissions: permissions,
      orgId: targetOrgId,
      orgName: org?.displayName,
      isPoc: org?.pocEmail === user.email,
    };

    const access_token = this.jwtService.sign(payload, { expiresIn: '24h' });
    const refresh_token = this.jwtService.sign(payload, { expiresIn: '7d' });

    // Update DB
    let setTokenData = {
      accessToken: access_token,
      refreshToken: refresh_token,
    } as any;
    await db
      .insert(zuvyUserOrganizations)
      .values({
        userId: Number(userId),
        organizationId: targetOrgId,
        userEmail: user.email,
        accessToken: access_token,
        refreshToken: refresh_token,
      } as any)
      .onConflictDoUpdate({
        target: [
          zuvyUserOrganizations.userId,
          zuvyUserOrganizations.organizationId,
        ],
        set: setTokenData,
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
        rolesList: roles,
        orgId: targetOrgId,
        orgName: org?.displayName,
        isPoc: org?.pocEmail === user.email,
        permissions: permissions,
      },
    };
  }

  // Cleanup expired blacklisted tokens (can be called by a scheduled task)
  async cleanupExpiredTokens() {
    const now = new Date();
    await db
      .delete(blacklistedTokens)
      .where(eq(blacklistedTokens.expiresAt, now));
  }
}
