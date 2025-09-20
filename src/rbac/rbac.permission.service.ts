import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql } from 'drizzle-orm';
import { CreatePermissionDto, AssignUserPermissionDto } from './dto/permission.dto';

@Injectable()
export class RbacPermissionService {
  private readonly logger = new Logger(RbacPermissionService.name);

  async createPermission(createPermissionDto: CreatePermissionDto): Promise<any> {
    try {
      const { name, resourceId, description } = createPermissionDto;

      // Check if resource exists
      const resourceCheck = await db.execute(sql`SELECT id FROM main.zuvy_resources WHERE id = ${resourceId} LIMIT 1`);
      if (!(resourceCheck as any).rows?.length) {
        throw new NotFoundException('Resource not found');
      }

      const result = await db.execute(
        sql`INSERT INTO main.zuvy_permissions (name, resource_id, description) VALUES (${name}, ${resourceId}, ${description ?? null}) RETURNING *`
      );

      if ((result as any).rows.length > 0) {
        return {
          status: 'success',
          message: 'Permission created successfully',
          code: 200,
          data: (result as any).rows[0]
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: 'Permission creation failed. Please try again'
        };
      }
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw err;
    }
  }

  async getAllPermissions(): Promise<any> {
    try {
      const result = await db.execute(sql`
        SELECT 
          p.id,
          p.name,
          p.resource_id,
          p.description,
          r.name as resource_name
        FROM main.zuvy_permissions p
        LEFT JOIN main.zuvy_resources r ON p.resource_id = r.id
        ORDER BY p.id ASC
      `);
      return {
        status: 'success',
        message: 'Permissions retrieved successfully',
        code: 200,
        data: (result as any).rows
      };
    } catch (err) {
      throw err;
    }
  }

  async deletePermission(id: number): Promise<any> {
    try {
      const result = await db.execute(sql`DELETE FROM main.zuvy_permissions WHERE id = ${id}`);
      if ((result as any).rowCount > 0) {
        return {
          status: 'success',
          message: 'Permission deleted successfully',
          code: 200
        };
      } else {
        return {
          status: 'error',
          code: 404,
          message: 'Permission not found'
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getUserPermissions(userId: number): Promise<string[]> {
    try {
      const result = await db.execute(sql`
        SELECT DISTINCT p.name 
        FROM main.zuvy_permissions p
        INNER JOIN main.zuvy_role_permissions rp ON p.id = rp.permission_id
        INNER JOIN main.zuvy_user_roles ur ON rp.role_id = ur.id
        INNER JOIN main.zuvy_user_roles_assigned ura ON ura.role_id = ur.id
        WHERE ura.user_id = ${userId}
      `);

      const permissions = (result as any).rows.map(row => row.name);
      return permissions;
    } catch (err) {
      this.logger.error(`Error getting user permissions for user ${userId}:`, err);
      throw new InternalServerErrorException('Failed to retrieve user permissions');
    }
  }

  async userHasPermissions(userId: number, requiredPermissions: string[]): Promise<boolean> {
    try {
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }

      const userPermissions = await this.getUserPermissions(userId);
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      return hasAllPermissions;
    } catch (err) {
      this.logger.error(`Error checking permissions for user ${userId}:`, err);
      return false;
    }
  }

  async assignExtraPermissionToUser(payload: AssignUserPermissionDto): Promise<any> {
    const { actorUserId, targetUserId, permissionId, scopeId } = payload;
    try {
      const userCheck = await db.execute(sql`SELECT id FROM main.users WHERE id = ${targetUserId} LIMIT 1`);
      if (!(userCheck as any).rows?.length) {
        throw new NotFoundException('Target user not found');
      }

      if (actorUserId) {
        const actorCheck = await db.execute(sql`SELECT id FROM main.users WHERE id = ${actorUserId} LIMIT 1`);
        if (!(actorCheck as any).rows?.length) {
          throw new NotFoundException('Actor user not found');
        }
      }

      const permCheck = await db.execute(sql`SELECT id FROM main.zuvy_permissions WHERE id = ${permissionId} LIMIT 1`);
      if (!(permCheck as any).rows?.length) {
        throw new NotFoundException('Permission not found');
      }

      const insertAudit = await db.execute(sql`
        INSERT INTO main.zuvy_audit_logs (user_id, target_user_id, action, permission_id, scope_id)
        VALUES (${actorUserId ?? null}, ${targetUserId}, ${'assign_extra_permission'}, ${permissionId}, ${scopeId ?? null})
        RETURNING *
      `);

      return {
        status: 'success',
        code: 200,
        message: 'Extra permission assignment recorded in audit log',
        data: (insertAudit as any).rows[0]
      };
    } catch (err) {
      this.logger.error('Failed to assign extra permission to user', err as any);
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to assign extra permission');
    }
  }

  async getAllResources(): Promise<any> {
      try {
        const result = await db.execute(sql`SELECT id, name FROM main.zuvy_resources ORDER BY id ASC`);
        
        return {
          status: 'success',
          message: 'Resources retrieved successfully',
          code: 200,
          data: (result as any).rows
        };
      } catch (err) {
        this.logger.error('Error getting all resources:', err);
        throw new InternalServerErrorException('Failed to retrieve resources');
      }
    }

}


