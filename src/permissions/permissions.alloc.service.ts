import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import { inArray, sql, eq, and } from 'drizzle-orm';
import {
  userRoles,
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
    orgId: number,
  ): Promise<any> {
    try {
      // Check if user exists
      const userCheck = await db.execute(
        sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`,
      );
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }
      // Get user's role for this org
      const userRoleResult = await db
        .select({ roleId: zuvyUserRolesAssigned.roleId })
        .from(zuvyUserRolesAssigned)
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, userId),
            eq(zuvyUserRolesAssigned.organizationId, orgId),
          ),
        )
        .limit(1);
      if (!userRoleResult.length) {
        // Return empty permissions if user has no role assigned
        return { userId, roleId: null, permissions: {} };
      }
      const userRoleId = userRoleResult[0].roleId;
      // Get user's permissions for this org
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
            eq(zuvyPermissionsRoles.orgId, orgId),
            eq(zuvyPermissions.resourcesId, resourceId),
          ),
        );
      const permissions = {};
      userPermissionsResult.forEach((perm) => {
        const resourceName =
          perm.resourceName === 'course'
            ? 'Bootcamp'
            : perm.resourceName === 'contentBank'
              ? 'ContentBank'
              : perm.resourceName;
        const permissionKey = `${perm.permissionName}${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)}`;
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
    orgId: number,
  ): Promise<any> {
    try {
      // Check if user exists
      const userCheck = await db.execute(
        sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`,
      );
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      // Get user's role for this org
      const userRoleResult = await db
        .select({ roleId: zuvyUserRolesAssigned.roleId })
        .from(zuvyUserRolesAssigned)
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, userId),
            eq(zuvyUserRolesAssigned.organizationId, orgId),
          ),
        )
        .limit(1);

      if (!userRoleResult.length) {
        return { userId, roleId: null, permissions: {} };
      }

      const userRoleId = userRoleResult[0].roleId;

      // Fetch permissions directly from zuvy_permissions_roles for this role and org
      const userPermissionsResult = await db.execute(sql`
      SELECT 
        p.name AS "permissionName",
        r.name AS "resourceName"
      FROM main.zuvy_permissions p
      INNER JOIN main.zuvy_resources r ON p.resource_id = r.id
      INNER JOIN main.zuvy_permissions_roles pr ON p.id = pr.permission_id
      WHERE pr.role_id = ${userRoleId}
        AND pr.org_id = ${orgId}
        AND p.resource_id IN (1, 2, 3)
    `);

      // Build permissions object
      const permissions: Record<string, boolean> = {};

      if (userPermissionsResult.rows?.length) {
        (userPermissionsResult.rows as any[]).forEach((perm) => {
          const resourceName =
            perm.resourceName === 'course'
              ? 'Bootcamp'
              : perm.resourceName === 'contentBank'
                ? 'ContentBank'
                : perm.resourceName;

          const key = `${perm.permissionName}${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`;

          permissions[key] = true; // only granted permissions
        });
      }

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
    orgId: number,
  ): Promise<any> {
    try {
      // First check if user exists
      const userCheck = await db.execute(
        sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`,
      );
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      // Check if resource exists
      const resourceCheck = await db.execute(
        sql`SELECT id, name FROM main.zuvy_resources WHERE id = ${resourceId} LIMIT 1`,
      );
      if (!(resourceCheck as any).rows?.length) {
        throw new NotFoundException('Resource not found');
      }

      // Check role-based permission (scoped to org)
      const rolePermission = await db.execute(sql`
        SELECT DISTINCT 
          p.id as permission_id,
          p.name as permission_name,
          r.name as resource_name,
          ur.name as role_name,
          'role_based' as permission_type
        FROM main.zuvy_permissions p
        INNER JOIN main.zuvy_resources r ON p.resources_id = r.id
        INNER JOIN main.zuvy_permissions_roles pr ON p.id = pr.permission_id
        INNER JOIN main.zuvy_user_roles ur ON pr.role_id = ur.id
        INNER JOIN main.zuvy_user_roles_assigned ura ON ura.role_id = ur.id
        WHERE ura.user_id = ${userId} AND ura.organization_id = ${orgId} 
          AND pr.org_id = ${orgId}
          AND r.id = ${resourceId} AND p.name = ${permissionName}
      `);

      // Check extra permission
      const extraPermission = await db.execute(sql`
        SELECT DISTINCT 
          ep.id as extra_permission_id,
          p.name as permission_name,
          r.name as resource_name,
          ep.action,
          ep.course_name,
          'extra' as permission_type,
          u2.email as granted_by_email
        FROM main.zuvy_extra_permissions ep
        INNER JOIN main.zuvy_permissions p ON ep.permission_id = p.id
        INNER JOIN main.zuvy_resources r ON ep.resource_id = r.id
        INNER JOIN main.users u2 ON ep.granted_by = u2.id
        WHERE ep.user_id = ${userId} AND ep.resource_id = ${resourceId} AND p.name = ${permissionName}
      `);

      const hasRolePermission = (rolePermission as any).rows?.length > 0;
      const hasExtraPermission = (extraPermission as any).rows?.length > 0;
      const hasPermission = hasRolePermission || hasExtraPermission;

      return {
        status: 'success',
        message: 'Permission check completed',
        code: 200,
        data: {
          userId,
          resourceId,
          resourceName: (resourceCheck as any).rows[0].name,
          permissionName,
          hasPermission,
          permissionSources: {
            roleBased: hasRolePermission,
            extra: hasExtraPermission,
          },
          details: {
            roleBased: hasRolePermission ? (rolePermission as any).rows : [],
            extra: hasExtraPermission ? (extraPermission as any).rows : [],
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
    orgId: number,
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

      const roles = await db
        .select({ id: zuvyUserRoles.id })
        .from(zuvyUserRoles)
        .where(
          and(
            inArray(zuvyUserRoles.name, roleNames),
            eq(zuvyUserRoles.orgId, orgId),
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
            eq(zuvyPermissionsRoles.orgId, orgId),
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
