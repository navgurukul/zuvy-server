import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql } from 'drizzle-orm';

@Injectable()
export class RbacAllocPermsService {
  private readonly logger = new Logger(RbacAllocPermsService.name);

  async getUserPermissionsByResource(userId: number, resourceId: number): Promise<any> {
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

      const resourceName = (resourceCheck as any).rows[0].name;

      // Get permissions through roles
      const rolePermissions = await db.execute(sql`
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
        WHERE ura.user_id = ${userId} AND r.id = ${resourceId}
      `);

      // Get extra permissions for this resource
      const extraPermissionsResult = await db.execute(sql`
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
        WHERE ep.user_id = ${userId} AND ep.resource_id = ${resourceId}
      `);

      const rolePermissionsList = (rolePermissions as any).rows || [];
      const extraPermissionsList = (extraPermissionsResult as any).rows || [];

      // Get all possible permissions for this resource to create complete permission object
      const allPermissions = await db.execute(sql`
        SELECT DISTINCT p.name as permission_name
        FROM main.zuvy_permissions p
        INNER JOIN main.zuvy_resources r ON p.resources_id = r.id
        WHERE r.id = ${resourceId}
      `);

      const allPermissionsList = (allPermissions as any).rows || [];

      // Create permissions object with combined resource and permission names
      const permissions = {};

      // Initialize all possible permissions as false
      allPermissionsList.forEach(perm => {
        const combinedKey = `${resourceName}${perm.permission_name}`;
        permissions[combinedKey] = false;
      });

      // Set role-based permissions to true
      rolePermissionsList.forEach(perm => {
        const combinedKey = `${resourceName}${perm.permission_name}`;
        permissions[combinedKey] = true;
      });

      // Set extra permissions to true
      extraPermissionsList.forEach(perm => {
        const combinedKey = `${resourceName}${perm.permission_name}`;
        permissions[combinedKey] = true;
      });

      return {
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

  async getUserPermissionsForMultipleResources(userId: number): Promise<any> {
    try {
      // First check if user exists
      const userCheck = await db.execute(sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`);
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      // Define the three resources we want to check
      const resourceIds = [1, 2, 3]; // course, contentBank, roles and permissions
      
      // Get all resources information
      const resources = await db.execute(sql`
        SELECT id, name FROM main.zuvy_resources WHERE id IN (${resourceIds.join(',')})
      `);
      
      const resourcesList = (resources as any).rows || [];
      const resourceMap = {};
      resourcesList.forEach(resource => {
        resourceMap[resource.id] = resource.name;
      });

      // Get permissions through roles for all three resources with filtering
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
        AND (
          (r.id = 1) OR 
          (r.id = 2 AND p.name = 'view') OR 
          (r.id = 3 AND p.name = 'view')
        )
      `);

      // Get extra permissions for all three resources with filtering
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
        AND (
          (r.id = 1) OR 
          (r.id = 2 AND p.name = 'view') OR 
          (r.id = 3 AND p.name = 'view')
        )
      `);

      // Get all possible permissions for these resources with filtering
      const allPermissionsQuery = await db.execute(sql`
        SELECT DISTINCT p.name as permission_name, r.id as resource_id, r.name as resource_name
        FROM main.zuvy_permissions p
        INNER JOIN main.zuvy_resources r ON p.resources_id = r.id
        WHERE (
          (r.id = 1) OR 
          (r.id = 2 AND p.name = 'view') OR 
          (r.id = 3 AND p.name = 'view')
        )
      `);

      const rolePermissionsList = (rolePermissions as any).rows || [];
      const extraPermissionsList = (extraPermissions as any).rows || [];
      const allPermissionsList = (allPermissionsQuery as any).rows || [];

      // Group permissions by resource
      const permissionsByResource = {};
      
      // Initialize all resources with empty permissions
      resourceIds.forEach(resourceId => {
        const resourceName = resourceMap[resourceId];
        if (resourceName) {
          permissionsByResource[resourceId] = {
            resourceId,
            resourceName,
            permissions: {}
          };
        }
      });

      // Initialize all possible permissions as false (filtering already done in query)
      allPermissionsList.forEach(perm => {
        const resourceId = perm.resource_id;
        const resourceName = perm.resource_name;
        const permissionName = perm.permission_name;
        const combinedKey = `${resourceName}${permissionName}`;
        
        if (permissionsByResource[resourceId]) {
          permissionsByResource[resourceId].permissions[combinedKey] = false;
        }
      });

      // Set role-based permissions to true (filtering already done in query)
      rolePermissionsList.forEach(perm => {
        const resourceId = perm.resource_id;
        const resourceName = perm.resource_name;
        const permissionName = perm.permission_name;
        const combinedKey = `${resourceName}${permissionName}`;
        
        if (permissionsByResource[resourceId]) {
          permissionsByResource[resourceId].permissions[combinedKey] = true;
        }
      });

      // Set extra permissions to true (filtering already done in query)
      extraPermissionsList.forEach(perm => {
        const resourceId = perm.resource_id;
        const resourceName = perm.resource_name;
        const permissionName = perm.permission_name;
        const combinedKey = `${resourceName}${permissionName}`;
        
        if (permissionsByResource[resourceId]) {
          permissionsByResource[resourceId].permissions[combinedKey] = true;
        }
      });

      // Combine all permissions into a single object
      const combinedPermissions = {};
      Object.values(permissionsByResource).forEach((resource: any) => {
        Object.assign(combinedPermissions, resource.permissions);
      });

      return {
        permissions: combinedPermissions
      };
    } catch (err) {
      this.logger.error(`Error getting user permissions for multiple resources for user ${userId}:`, err);
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
}
