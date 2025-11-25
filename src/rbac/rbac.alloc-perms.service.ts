import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { inArray, sql, eq, and } from 'drizzle-orm';
import { userRoles, zuvyPermissions, zuvyPermissionsRoles, zuvyResources, zuvyRolePermissions, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';
import { ResourceList } from './utility';
import { PermissionsAllocationService } from 'src/permissions/permissions.alloc.service';

@Injectable()
export class RbacAllocPermsService {
  constructor(
    private readonly permissionAllocationService: PermissionsAllocationService
  ){}
  private readonly logger = new Logger(RbacAllocPermsService.name);

  async getUserPermissionsByResource(userId: bigint, resourceId: number): Promise<any> {
    try {
      await this.permissionAllocationService.getUserPermissionsByResource(userId, resourceId);
    } catch (err) {
      this.logger.error(`Error getting user permissions for user ${userId} and resource ${resourceId}:`, err);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to retrieve user permissions');
    }
  }

  async getUserPermissionsForMultipleResources(userId: bigint): Promise<any> {
    try {
      return await this.permissionAllocationService.getUserPermissionsForMultipleResources(userId);
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
    rolePermissions: string[],
    targetPermissions: string[]
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

  async getAllPermissions(roleName: string[], targetPermissions: string[], resourceIds?: number): Promise<any> {
    try {
      return await this.permissionAllocationService.getAllPermissions(roleName, targetPermissions);
    }
    catch (err) {
      this.logger.error('Error retrieving all permissions:', err);
      throw new InternalServerErrorException('Failed to retrieve permissions');
    }
  }
}
