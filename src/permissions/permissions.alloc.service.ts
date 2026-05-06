import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import { inArray, sql, eq, and, isNull, or } from 'drizzle-orm';
import {
  userRoles,
  users,
  zuvyExtraPermissions,
  zuvyPermissions,
  zuvyPermissionsRoles,
  zuvyResources,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
} from 'drizzle/schema';
import { ResourceList } from 'src/rbac/utility';

@Injectable()
export class PermissionsAllocationService {
  private readonly logger = new Logger(PermissionsAllocationService.name);

  async getUserPermissionsByResource(
    userId: bigint,
    resourceId: number,
    orgId: number | null,
  ): Promise<any> {
    try {
      // ✅ Check if user exists (replace raw SQL)
      const userCheck = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userCheck.length) {
        throw new NotFoundException('User not found');
      }

      // ✅ Get user's role
      const userRoleResult = await db
        .select({ roleId: zuvyUserRolesAssigned.roleId })
        .from(zuvyUserRolesAssigned)
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, userId),
            orgId !== null
              ? or(
                  eq(zuvyUserRolesAssigned.organizationId, orgId),
                  isNull(zuvyUserRolesAssigned.organizationId),
                )
              : isNull(zuvyUserRolesAssigned.organizationId),
          ),
        )
        .limit(1);

      if (!userRoleResult.length) {
        return { userId, roleId: null, permissions: {} };
      }

      const userRoleId = userRoleResult[0].roleId;

      // ✅ Fetch permissions
      const userPermissionsResult = await db
        .select({
          permissionName: zuvyPermissions.name,
          resourceId: zuvyPermissions.resourcesId,
          resourceName: zuvyResources.name,
        })
        .from(zuvyPermissionsRoles)
        .innerJoin(
          zuvyPermissions,
          eq(zuvyPermissionsRoles.permissionId, zuvyPermissions.id),
        )
        .innerJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
        .where(
          and(
            eq(zuvyPermissionsRoles.roleId, userRoleId),
            orgId !== null
              ? or(
                  eq(zuvyPermissionsRoles.orgId, orgId),
                  isNull(zuvyPermissionsRoles.orgId),
                )
              : isNull(zuvyPermissionsRoles.orgId),
            eq(zuvyPermissions.resourcesId, resourceId),
          ),
        );

      // ✅ Build permissions object
      const permissions: Record<string, boolean> = {};

      userPermissionsResult.forEach((perm) => {
        const resourceName =
          perm.resourceName === 'course'
            ? 'Bootcamp'
            : perm.resourceName === 'contentBank'
              ? 'ContentBank'
              : perm.resourceName;

        const permissionKey = `${perm.permissionName}${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`;

        permissions[permissionKey] = true;
      });

      return {
        userId,
        roleId: userRoleId,
        permissions,
      };
    } catch (err) {
      this.logger.error(
        `Error getting user permissions for user ${userId} and resource ${resourceId}:`,
        err,
      );

      if (err instanceof NotFoundException) throw err;

      throw new InternalServerErrorException(
        'Failed to retrieve user permissions',
      );
    }
  }

  async getUserPermissionsForMultipleResources(
    userId: bigint,
    orgId: number | null,
  ): Promise<any> {
    try {
      // ✅ Check if user exists (Drizzle way)
      const userCheck = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!userCheck.length) {
        throw new NotFoundException('User not found');
      }

      // ✅ Get user's role
      const userRoleResult = await db
        .select({ roleId: zuvyUserRolesAssigned.roleId })
        .from(zuvyUserRolesAssigned)
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, userId),
            orgId !== null
              ? or(
                  eq(zuvyUserRolesAssigned.organizationId, orgId),
                  isNull(zuvyUserRolesAssigned.organizationId),
                )
              : isNull(zuvyUserRolesAssigned.organizationId),
          ),
        )
        .limit(1);

      if (!userRoleResult.length) {
        return { userId, roleId: null, permissions: {} };
      }

      const userRoleId = userRoleResult[0].roleId;

      // ✅ Fetch permissions (Drizzle returns array directly)
      const userPermissionsResult = await db
        .select({
          permissionName: zuvyPermissions.name,
          resourceName: zuvyResources.name,
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
        .where(
          and(
            eq(zuvyPermissionsRoles.roleId, userRoleId),
            orgId !== null
              ? or(
                  eq(zuvyPermissionsRoles.orgId, orgId),
                  isNull(zuvyPermissionsRoles.orgId),
                )
              : isNull(zuvyPermissionsRoles.orgId),
            inArray(zuvyPermissions.resourcesId, [1, 2, 3]),
          ),
        );

      // ✅ Build permissions object
      const permissions: Record<string, boolean> = {};

      userPermissionsResult.forEach((perm) => {
        const resourceName =
          perm.resourceName === 'course'
            ? 'Bootcamp'
            : perm.resourceName === 'contentBank'
              ? 'ContentBank'
              : perm.resourceName;

        const key = `${perm.permissionName}${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`;

        permissions[key] = true;
      });

      return { userId, roleId: userRoleId, permissions };
    } catch (err) {
      this.logger.error(
        `Error in getUserPermissionsForMultipleResources for user ${userId}:`,
        err,
      );

      if (err instanceof NotFoundException) throw err;

      throw new InternalServerErrorException(
        'Failed to retrieve user permissions',
      );
    }
  }

  async checkUserPermission(
    userId: number,
    resourceId: number,
    permissionName: string,
    orgId: number | null,
  ): Promise<any> {
    try {
      // First check if user exists
      const userCheck = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, BigInt(userId)))
        .limit(1);
      if (!userCheck.length) {
        throw new NotFoundException('User not found');
      }

      // Check if resource exists
      // Resource check
      const resourceCheck = await db
        .select({ id: zuvyResources.id, name: zuvyResources.name })
        .from(zuvyResources)
        .where(eq(zuvyResources.id, resourceId))
        .limit(1);
      if (!resourceCheck.length) {
        throw new NotFoundException('Resource not found');
      }

      // Role-based permission check
      const rolePermission = await db
        .select({
          permissionId: zuvyPermissions.id,
          permissionName: zuvyPermissions.name,
          resourceName: zuvyResources.name,
          roleName: zuvyUserRoles.name,
          permissionType: sql<string>`'role_based'`,
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
              ? or(
                  eq(zuvyUserRolesAssigned.organizationId, orgId),
                  isNull(zuvyUserRolesAssigned.organizationId),
                )
              : isNull(zuvyUserRolesAssigned.organizationId),
            orgId !== null
              ? or(
                  eq(zuvyPermissionsRoles.orgId, orgId),
                  isNull(zuvyPermissionsRoles.orgId),
                )
              : isNull(zuvyPermissionsRoles.orgId),
            eq(zuvyResources.id, resourceId),
            eq(zuvyPermissions.name, permissionName),
          ),
        );

      // Extra permission check
      const extraPermission = await db
        .select({
          extraPermissionId: zuvyExtraPermissions.id,
          permissionName: zuvyPermissions.name,
          resourceName: zuvyResources.name,
          action: zuvyExtraPermissions.action,
          courseName: zuvyExtraPermissions.courseName,
          permissionType: sql<string>`'extra'`,
          grantedByEmail: users.email,
        })
        .from(zuvyExtraPermissions)
        .innerJoin(
          zuvyPermissions,
          eq(zuvyExtraPermissions.permissionId, zuvyPermissions.id),
        )
        .innerJoin(
          zuvyResources,
          eq(zuvyExtraPermissions.resourceId, zuvyResources.id),
        )
        .innerJoin(users, eq(zuvyExtraPermissions.grantedBy, users.id))
        .where(
          and(
            eq(zuvyExtraPermissions.userId, BigInt(userId)),
            eq(zuvyExtraPermissions.resourceId, resourceId),
            eq(zuvyPermissions.name, permissionName),
          ),
        );

      const hasRolePermission = rolePermission.length > 0;
      const hasExtraPermission = extraPermission.length > 0;
      const hasPermission = hasRolePermission || hasExtraPermission;

      return {
        status: 'success',
        message: 'Permission check completed',
        code: 200,
        data: {
          userId,
          resourceId,
          resourceName: resourceCheck[0].name,
          permissionName,
          hasPermission,
          permissionSources: {
            roleBased: hasRolePermission,
            extra: hasExtraPermission,
          },
          details: {
            roleBased: hasRolePermission ? rolePermission : [],
            extra: hasExtraPermission ? extraPermission : [],
          },
        },
      };
    } catch (err) {
      this.logger.error(
        `Error checking permission for user ${userId}, resource ${resourceId}, permission ${permissionName}:`,
        err,
      );
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to check user permission');
    }
  }

  async formatPermissionsAndCompare(
    rolePermissions: string[],
    targetPermissions: string[],
  ): Promise<Record<string, boolean>> {
    try {
      const permissions: Record<string, boolean> = {};
      const permissionSet = new Set(rolePermissions);

      for (const target of targetPermissions) {
        permissions[target] = permissionSet.has(target);
      }

      return permissions;
    } catch (err) {
      this.logger.error('Error formatting permissions:', err);
      throw new InternalServerErrorException('Failed to format permissions');
    }
  }

  async getAllPermissions(
    roleNames: string[],
    targetPermissions: string[],
    orgId: number | null,
  ): Promise<any> {
    try {
      if (!roleNames || roleNames.length === 0) {
        return {
          permissions: await this.formatPermissionsAndCompare(
            [],
            targetPermissions,
          ),
        };
      }

      // 🔹 Super Admin Bypass: Return all requested permissions as true
      if (roleNames.includes('super_admin')) {
        const permissions: Record<string, boolean> = {};
        targetPermissions.forEach((perm) => (permissions[perm] = true));
        return { permissions };
      }

      const roles = await db
        .select({ id: zuvyUserRoles.id })
        .from(zuvyUserRoles)
        .where(
          and(
            inArray(zuvyUserRoles.name, roleNames),
            orgId !== null
              ? or(eq(zuvyUserRoles.orgId, orgId), isNull(zuvyUserRoles.orgId))
              : isNull(zuvyUserRoles.orgId),
          ),
        );

      if (!roles.length) {
        // Log a warning instead of throwing if roles aren't found in this org,
        // as the user might have roles from other orgs or default roles.
        this.logger.warn(
          `No roles found for ${roleNames.join(', ')} in org ${orgId}`,
        );
        return {
          permissions: await this.formatPermissionsAndCompare(
            [],
            targetPermissions,
          ),
        };
      }

      const roleIds = roles.map((r) => r.id);

      const permissionsWithRoles = await db
        .select({ action: zuvyPermissions.name, key: zuvyResources.key })
        .from(zuvyPermissions)
        .innerJoin(
          zuvyPermissionsRoles,
          eq(zuvyPermissionsRoles.permissionId, zuvyPermissions.id),
        )
        .innerJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
        .where(
          and(
            inArray(zuvyPermissionsRoles.roleId, roleIds),
            orgId !== null
              ? or(
                  eq(zuvyPermissionsRoles.orgId, orgId),
                  isNull(zuvyPermissionsRoles.orgId),
                )
              : isNull(zuvyPermissionsRoles.orgId),
          ),
        );

      const assignedPermissions: string[] = permissionsWithRoles.map(
        (r) => `${r.action}${r.key}`,
      );

      const filteredPermissions = await this.formatPermissionsAndCompare(
        assignedPermissions,
        targetPermissions,
      );

      return { permissions: filteredPermissions };
    } catch (err) {
      this.logger.error('Error retrieving all permissions:', err);
      // If it's already a NestJS exception (like NotFoundException), re-throw it
      if (err.status && err.getResponse) {
        throw err;
      }
      throw new InternalServerErrorException(
        'Failed to retrieve permissions: ' + err.message,
      );
    }
  }
}
