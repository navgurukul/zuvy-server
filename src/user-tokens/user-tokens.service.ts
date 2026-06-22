import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import {
  zuvyUserOrganizations,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
} from 'drizzle/schema';
import { db } from 'src/db';

type UpsertParams = {
  userId: number;
  organizationId: number;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
};
type DeleteFilter = {
  userId?: number;
  userEmail?: string;
  organizationId?: number;
};

@Injectable()
export class UserTokensService {
  private readonly logger = new Logger(UserTokensService.name);
  async upsertToken(params: UpsertParams) {
    const { userId, organizationId, userEmail, accessToken, refreshToken } =
      params;
    try {
      // 🚀 Check if user is Super Admin by checking roles
      const [superAdminRole] = await db
        .select({ id: zuvyUserRoles.id })
        .from(zuvyUserRoles)
        .where(eq(zuvyUserRoles.name, 'super_admin'))
        .limit(1);

      let superAdmin = null;
      if (superAdminRole) {
        [superAdmin] = await db
          .select()
          .from(zuvyUserRolesAssigned)
          .where(
            and(
              eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
              eq(zuvyUserRolesAssigned.roleId, superAdminRole.id),
            ),
          )
          .limit(1);
      }

      if (superAdmin) {
        // Super Admin: Find if *any* row exists for this user
        const [existingRow] = await db
          .select()
          .from(zuvyUserOrganizations)
          .where(eq(zuvyUserOrganizations.userId, userId))
          .limit(1);

        if (existingRow) {
          // Update the existing row (even if organizationId is different)
          const [updated] = await db
            .update(zuvyUserOrganizations)
            .set({
              accessToken,
              refreshToken,
              userEmail,
              // Optional: Update organizationId to current one if you want to track where they are
              organizationId: organizationId,
            } as unknown as typeof zuvyUserOrganizations.$inferInsert) // Type assertion to bypass strict type checks for dynamic fields
            .where(eq(zuvyUserOrganizations.id, existingRow.id))
            .returning();

          return {
            success: true,
            message: 'UPSERT_OK (Super Admin)',
            data: updated,
          };
        }
      }

      // Standard logic for non-super admins (or new super admin)
      let setData = { userEmail, accessToken, refreshToken };
      const [row] = await db
        .insert(zuvyUserOrganizations)
        .values(params)
        .onConflictDoUpdate({
          target: [
            zuvyUserOrganizations.userId,
            zuvyUserOrganizations.organizationId,
          ],
          set: setData,
        })
        .returning();

      return { success: true, message: 'UPSERT_OK', data: row };
    } catch (err) {
      this.logger.error('Failed to upsert user tokens:', err);
      throw new InternalServerErrorException({
        success: false,
        message: 'UPSERT_FAILED',
        error: String(err?.message ?? err),
      });
    }
  }

  async getUserTokens(userId: bigint, orgId?: number) {
    try {
      const conditions = [eq(zuvyUserOrganizations.userId, Number(userId))];
      if (orgId) {
        conditions.push(eq(zuvyUserOrganizations.organizationId, orgId));
      }

      const [tokens] = await db
        .select({
          accessToken: zuvyUserOrganizations.accessToken,
          refreshToken: zuvyUserOrganizations.refreshToken,
        })
        .from(zuvyUserOrganizations)
        .where(and(...conditions));

      if (!tokens) {
        return { success: false, message: 'No tokens found for this user' };
      }

      return {
        success: true,
        message: 'Tokens retrieved successfully',
        data: tokens,
      };
    } catch (error) {
      this.logger.error('Failed to fetch user tokens:', error);
      throw new Error('Failed to fetch user tokens');
    }
  }

  async deleteToken(filter: DeleteFilter) {
    if (!filter.userId && !filter.userEmail)
      throw new BadRequestException({
        success: false,
        message: 'BAD_REQUEST: provide userId or userEmail',
      });

    const conditions = [];
    if (filter.userId) {
      conditions.push(eq(zuvyUserOrganizations.userId, filter.userId));
    }
    if (filter.userEmail) {
      conditions.push(eq(zuvyUserOrganizations.userEmail, filter.userEmail));
    }
    if (filter.organizationId) {
      conditions.push(
        eq(zuvyUserOrganizations.organizationId, filter.organizationId),
      );
    }

    const where = and(...conditions);

    try {
      const deleted = await db
        .delete(zuvyUserOrganizations)
        .where(where)
        .returning();
      const found = deleted.length > 0;
      return {
        success: found,
        message: found ? 'DELETE_OK' : 'NOT_FOUND',
        data: deleted,
      };
    } catch (err) {
      this.logger.error('Failed to delete user tokens:', err);
      throw new InternalServerErrorException({
        success: false,
        message: 'DELETE_FAILED',
        error: String(err?.message ?? err),
      });
    }
  }
}
