import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { inArray, sql, eq, and } from 'drizzle-orm';
import { userRoles, zuvyPermissions, zuvyResources, zuvyRolePermissions, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';
import { ResourceList } from './utility';

@Injectable()
export class RbacAllocPermsService {
  private readonly logger = new Logger(RbacAllocPermsService.name);

  async getUserPermissionsByResource(userId: bigint, resourceId: number): Promise<any> {
    try {
      // Check if user exists
      const userCheck = await db.execute(sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`);
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }
      // Get user's role
      const userRoleResult = await db
        .select({ roleId: zuvyUserRolesAssigned.roleId })
        .from(zuvyUserRolesAssigned)
        .where(eq(zuvyUserRolesAssigned.userId, userId))
        .limit(1);
      if (!userRoleResult.length) {
        // Return empty permissions if user has no role assigned
        return { userId, roleId: null, permissions: {} };
      }
      const userRoleId = userRoleResult[0].roleId;
      // Get user's permissions
      const userPermissionsResult = await db.select({
        permissionName: zuvyPermissions.name,
        resourceId: zuvyPermissions.resourcesId,
        resourceName: zuvyResources.name
      })
        .from(zuvyRolePermissions)
        .innerJoin(zuvyPermissions, eq(zuvyRolePermissions.permissionId, zuvyPermissions.id))
        .innerJoin(zuvyResources, eq(zuvyPermissions.resourcesId, zuvyResources.id))
        .where(and(
          eq(zuvyRolePermissions.roleId, userRoleId),
          eq(zuvyPermissions.resourcesId, resourceId)
        ));
      const permissions = {};
      userPermissionsResult.forEach(perm => {
        const resourceName = perm.resourceName === 'course' ? 'Bootcamp' :
          perm.resourceName === 'contentBank' ? 'ContentBank' :
            perm.resourceName;
        const permissionKey = `${perm.permissionName}${resourceName.charAt(0).toUpperCase() + resourceName.slice(1)}`;
        permissions[permissionKey] = true;
      });
      return {
        userId,
        roleId: userRoleId,
        permissions
      };
    } catch (err) {
      this.logger.error(`Error getting user permissions for user ${userId} and resource ${resourceId}:`, err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to retrieve user permissions');
    }
  }

  async getAllUserPermissions(userId: number): Promise<any> {
    try {
      // First check if user exists
      const userCheck = await db.execute(sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`);
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      // Get all permissions through roles grouped by resource
      const rolePermissions = await db.execute(sql`
        SELECT DISTINCT 
          p.id as permission_id,
          p.name as permission_name,
          r.id as resource_id,
          r.name as resource_name,
          ur.name as role_name,
          'role_based' as permission_type
        FROM main.zuvy_permissions p
        INNER JOIN main.zuvy_resources r ON p.resources_id = r.id
        INNER JOIN main.zuvy_role_permissions rp ON p.id = rp.permission_id
        INNER JOIN main.zuvy_user_roles ur ON rp.role_id = ur.id
        INNER JOIN main.zuvy_user_roles_assigned ura ON ura.role_id = ur.id
        WHERE ura.user_id = ${userId}
        ORDER BY r.name, p.name
      `);

      // Get all extra permissions grouped by resource
      const extraPermissions = await db.execute(sql`
        SELECT DISTINCT 
          ep.id as extra_permission_id,
          p.name as permission_name,
          r.id as resource_id,
          r.name as resource_name,
          ep.action,
          ep.course_name,
          'extra' as permission_type,
          u2.email as granted_by_email
        FROM main.zuvy_extra_permissions ep
        INNER JOIN main.zuvy_permissions p ON ep.permission_id = p.id
        INNER JOIN main.zuvy_resources r ON ep.resource_id = r.id
        INNER JOIN main.users u2 ON ep.granted_by = u2.id
        WHERE ep.user_id = ${userId}
        ORDER BY r.name, p.name
      `);

      const rolePermissionsList = (rolePermissions as any).rows || [];
      const extraPermissionsList = (extraPermissions as any).rows || [];

      // Group permissions by resource
      const permissionsByResource = {};

      // Process role-based permissions
      rolePermissionsList.forEach(perm => {
        if (!permissionsByResource[perm.resource_id]) {
          permissionsByResource[perm.resource_id] = {
            resourceId: perm.resource_id,
            resourceName: perm.resource_name,
            roleBased: [],
            extra: [],
            total: 0
          };
        }
        permissionsByResource[perm.resource_id].roleBased.push(perm);
      });

      // Process extra permissions
      extraPermissionsList.forEach(perm => {
        if (!permissionsByResource[perm.resource_id]) {
          permissionsByResource[perm.resource_id] = {
            resourceId: perm.resource_id,
            resourceName: perm.resource_name,
            roleBased: [],
            extra: [],
            total: 0
          };
        }
        permissionsByResource[perm.resource_id].extra.push(perm);
      });

      // Calculate totals
      Object.values(permissionsByResource).forEach((resource: any) => {
        resource.total = resource.roleBased.length + resource.extra.length;
      });

      return {
        status: 'success',
        message: 'User permissions retrieved successfully',
        code: 200,
        data: {
          userId,
          permissionsByResource: Object.values(permissionsByResource),
          summary: {
            totalResources: Object.keys(permissionsByResource).length,
            totalPermissions: rolePermissionsList.length + extraPermissionsList.length,
            roleBasedCount: rolePermissionsList.length,
            extraPermissionsCount: extraPermissionsList.length,
            uniquePermissions: [...new Set([
              ...rolePermissionsList.map(p => p.permission_name),
              ...extraPermissionsList.map(p => p.permission_name)
            ])]
          }
        }
      };
    } catch (err) {
      this.logger.error(`Error getting all user permissions for user ${userId}:`, err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to retrieve user permissions');
    }
  }

  async getUserPermissionsForMultipleResources(userId: bigint): Promise<any> {
    try {
      // Check if user exists
      const userCheck = await db.execute(
        sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`
      );
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      // Get user's role
      const userRoleResult = await db
        .select({ roleId: zuvyUserRolesAssigned.roleId })
        .from(zuvyUserRolesAssigned)
        .where(eq(zuvyUserRolesAssigned.userId, userId))
        .limit(1);

      if (!userRoleResult.length) {
        return { userId, roleId: null, permissions: {} };
      }

      const userRoleId = userRoleResult[0].roleId;

      // Fetch permissions directly from zuvy_permissions for this role
      const userPermissionsResult = await db.execute(sql`
      SELECT 
        p.name AS "permissionName",
        r.name AS "resourceName"
      FROM main.zuvy_permissions p
      INNER JOIN main.zuvy_resources r ON p.resource_id = r.id
      WHERE p.role_id = ${userRoleId}
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

          const key =
            `${perm.permissionName}${resourceName.charAt(0).toUpperCase()}${resourceName.slice(1)}`;

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
      throw new InternalServerErrorException('Failed to retrieve user permissions');
    }
  }



  async checkUserPermission(userId: number, resourceId: number, permissionName: string): Promise<any> {
    try {
      // First check if user exists
      const userCheck = await db.execute(sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`);
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      // Check if resource exists
      const resourceCheck = await db.execute(sql`SELECT id, name FROM main.zuvy_resources WHERE id = ${resourceId} LIMIT 1`);
      if (!(resourceCheck as any).rows?.length) {
        throw new NotFoundException('Resource not found');
      }

      // Check role-based permission
      const rolePermission = await db.execute(sql`
        SELECT DISTINCT 
          p.id as permission_id,
          p.name as permission_name,
          r.name as resource_name,
          ur.name as role_name,
          'role_based' as permission_type
        FROM main.zuvy_permissions p
        INNER JOIN main.zuvy_resources r ON p.resources_id = r.id
        INNER JOIN main.zuvy_role_permissions rp ON p.id = rp.permission_id
        INNER JOIN main.zuvy_user_roles ur ON rp.role_id = ur.id
        INNER JOIN main.zuvy_user_roles_assigned ura ON ura.role_id = ur.id
        WHERE ura.user_id = ${userId} AND r.id = ${resourceId} AND p.name = ${permissionName}
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
            extra: hasExtraPermission
          },
          details: {
            roleBased: hasRolePermission ? (rolePermission as any).rows : [],
            extra: hasExtraPermission ? (extraPermission as any).rows : []
          }
        }
      };
    } catch (err) {
      this.logger.error(`Error checking permission for user ${userId}, resource ${resourceId}, permission ${permissionName}:`, err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to check user permission');
    }
  }

  async formatPermissionsAndCompare(
    permissions: any[],
    targetPermissions: string[]
  ): Promise<Record<string, boolean>> {
    try {
      const formattedPermissions: Record<string, boolean> = {};

      for (const perm of targetPermissions) {
        formattedPermissions[perm] = false;
      }

      for (const perm of permissions) {
        const action = perm.name; // create / read / edit / delete
        const resourceName = perm.resourceName || perm.resourcesName;

        for (const [resourceKey, actions] of Object.entries(ResourceList)) {
          if (resourceKey === resourceName && actions[action as keyof typeof actions]) {
            const targetKey = actions[action as keyof typeof actions];
            if (targetPermissions.includes(targetKey)) {
              formattedPermissions[targetKey] = true;
            }
          }
        }
      }

      return formattedPermissions;
    } catch (err) {
      this.logger.error('Error formatting permissions:', err);
      throw new InternalServerErrorException('Failed to format permissions');
    }
  }


  async getAllPermissions(roleName: string[], targetPermissions: string[], resourceIds?: number): Promise<any> {
    try {
      if (!resourceIds) {
        // Check if role exists
        const roleCheck = await db
          .select({ id: zuvyUserRoles.id })
          .from(zuvyUserRoles)
          .where(eq(zuvyUserRoles.name, roleName[0]))
          .limit(1);

        if (!roleCheck.length) {
          throw new NotFoundException('Role not found');
        }
        const roleId = roleCheck[0].id;

        // Get resources
        const resources = await db
          .select({
            id: zuvyResources.id,
            name: zuvyResources.name
          })
          .from(zuvyResources)
          .where(eq(zuvyResources.roleId, roleId));

        const resourceIds = resources.map(r => r.id);

        //if resourceid length is 0 then return the targetpermissions with false
        if (resourceIds.length === 0) {
          const permissionsObj: Record<string, boolean> = {};
          targetPermissions.forEach(perm => {
            permissionsObj[perm] = false;
          });
          return { roleName, permissions: permissionsObj };
        }
      }
      const permissionWhere = Array.isArray(resourceIds) ? resourceIds : [resourceIds];
      // Get permissions for these resources
      const assignedPermissions = await db
        .select({
          id: zuvyPermissions.id,
          name: zuvyPermissions.name,
          resourcesId: zuvyPermissions.resourcesId,
          description: zuvyPermissions.description,
          grantable: zuvyPermissions.grantable
        })
        .from(zuvyPermissions)
        .where(and(
          (inArray(zuvyPermissions.resourcesId, permissionWhere),
            eq(zuvyPermissions.grantable, true))));
      // Filter permissions based on targetPermissions
      const filteredPermissions = await this.formatPermissionsAndCompare(assignedPermissions, targetPermissions)

      return { roleName, permissions: filteredPermissions };
    }
    catch (err) {
      this.logger.error('Error retrieving all permissions:', err);
      throw new InternalServerErrorException('Failed to retrieve permissions');
    }
  }
}
