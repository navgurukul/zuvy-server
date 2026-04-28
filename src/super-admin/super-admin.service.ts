import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import {
  users,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
  zuvyUserOrganizations,
} from 'drizzle/schema';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class SuperAdminService {
  async addSuperAdmin(email: string) {
    // 1. Find or Create user by email
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      // Create new user if not found
      [user] = await db
        .insert(users)
        .values({
          email: email,
          name: email.split('@')[0], // Default name from email
          createdAt: new Date().toISOString(),
        } as any)
        .returning();

      if (!user) {
        throw new BadRequestException(
          `Failed to create user with email ${email}`,
        );
      }
    }

    // 2. Find role ID for 'super_admin'
    const [superAdminRole] = await db
      .select()
      .from(zuvyUserRoles)
      .where(eq(zuvyUserRoles.name, 'super_admin'))
      .limit(1);

    if (!superAdminRole) {
      throw new NotFoundException(
        `'super_admin' role not found in zuvyUserRoles`,
      );
    }

    return await db.transaction(async (tx) => {
      // 3. Cleanup: Remove all existing organization-related data for this user
      // Delete from zuvyUserRolesAssigned (all orgs)
      await tx
        .delete(zuvyUserRolesAssigned)
        .where(eq(zuvyUserRolesAssigned.userId, user.id));

      // Delete from zuvyUserOrganizations (all orgs)
      await tx
        .delete(zuvyUserOrganizations)
        .where(eq(zuvyUserOrganizations.userId, Number(user.id)));

      // 4. Assign role to user in zuvyUserRolesAssigned (orgId: null)
      await tx.insert(zuvyUserRolesAssigned).values({
        userId: user.id,
        roleId: superAdminRole.id,
        organizationId: null,
      } as unknown as typeof zuvyUserRolesAssigned.$inferInsert);

      // 5. Create a single row for the super admin in zuvyUserOrganizations (orgId: null)
      await tx.insert(zuvyUserOrganizations).values({
        userId: Number(user.id),
        userEmail: user.email,
        organizationId: null,
      } as any);

      return {
        success: true,
        message:
          'Super Admin added successfully. Existing organization data cleared.',
        data: { userId: user.id, email: user.email },
      };
    });
  }

  async removeSuperAdmin(userId: number) {
    // 1. Find role ID for 'super_admin'
    const [superAdminRole] = await db
      .select()
      .from(zuvyUserRoles)
      .where(eq(zuvyUserRoles.name, 'super_admin'))
      .limit(1);

    if (!superAdminRole) {
      throw new NotFoundException(`'super_admin' role not found`);
    }

    // 2. Delete from zuvyUserRolesAssigned
    const deletedRole = await db
      .delete(zuvyUserRolesAssigned)
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
          eq(zuvyUserRolesAssigned.roleId, superAdminRole.id),
        ),
      )
      .returning();

    // 3. Delete from zuvyUserOrganizations where orgId is null
    const deletedOrg = await db
      .delete(zuvyUserOrganizations)
      .where(
        and(
          eq(zuvyUserOrganizations.userId, userId),
          isNull(zuvyUserOrganizations.organizationId),
        ),
      )
      .returning();

    if (deletedRole.length === 0 && deletedOrg.length === 0) {
      throw new NotFoundException(
        `Super Admin with user ID ${userId} not found`,
      );
    }

    return {
      success: true,
      message: 'Super Admin removed successfully',
    };
  }

  async getAllSuperAdmins() {
    // Join zuvyUserRolesAssigned with users and zuvyUserRoles
    const result = await db
      .select({
        userId: users.id,
        email: users.email,
        name: users.name,
        roleName: zuvyUserRoles.name,
      })
      .from(zuvyUserRolesAssigned)
      .innerJoin(users, eq(zuvyUserRolesAssigned.userId, users.id))
      .innerJoin(
        zuvyUserRoles,
        eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
      )
      .where(eq(zuvyUserRoles.name, 'super_admin'));

    return {
      success: true,
      message: 'Super Admins retrieved successfully',
      data: result,
    };
  }

  async updateSuperAdmin(userId: number, data: any) {
    return {
      success: true,
      message: 'Super Admin update placeholder',
      data: { userId, ...data },
    };
  }
}
