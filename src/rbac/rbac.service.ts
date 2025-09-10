import { Injectable, Logger, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql } from 'drizzle-orm';
import { CreateUserRoleDto, UserRoleResponseDto } from './dto/user-role.dto';
import { CreatePermissionDto, PermissionResponseDto } from './dto/permission.dto';

@Injectable()
export class RbacService {
  private readonly logger = new Logger(RbacService.name);

  async createUserRole(createUserRoleDto: CreateUserRoleDto): Promise<any> {
    try {
      const { name, description } = createUserRoleDto;
      const result = await db.execute(
        sql`INSERT INTO main.zuvy_user_roles (name, description) VALUES (${name}, ${description ?? null}) RETURNING *`
      );
      if ((result as any).rows.length > 0) {
        return {
          status: 'success',
          message: 'User role created successfully',
          code: 200,
          data: (result as any).rows[0]
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: 'User role creation failed. Please try again'
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllUserRoles(): Promise<any> {
    try {
      const result = await db.execute(sql`SELECT * FROM main.zuvy_user_roles`);
      return {
        status: 'success',
        message: 'User roles retrieved successfully',
        code: 200,
        data: (result as any).rows
      };
    } catch (err) {
      throw err;
    }
  }

  async createPermission(createPermissionDto: CreatePermissionDto): Promise<any> {
    try {
      const { name, description } = createPermissionDto;

      const result = await db.execute(
        sql`INSERT INTO main.zuvy_permissions (name, description) VALUES (${name}, ${description ?? null}) RETURNING *`
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
      throw err;
    }
  }

  async getAllPermissions(): Promise<any> {
    try {
      const result = await db.execute(sql`SELECT * FROM main.zuvy_permissions ORDER BY id ASC`);
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

  /**
   * Get all permissions for a specific user
   * @param userId - The user ID to get permissions for
   * @returns Array of permission names
   */
  async getUserPermissions(userId: number): Promise<string[]> {
    try {
      // Query to get user permissions through user roles
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

  /**
   * Check if a user has all the required permissions
   * @param userId - The user ID to check
   * @param requiredPermissions - Array of permission names required
   * @returns boolean indicating if user has all required permissions
   */
  async userHasPermissions(userId: number, requiredPermissions: string[]): Promise<boolean> {
    try {
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }

      const userPermissions = await this.getUserPermissions(userId);
      
      // Check if user has ALL required permissions
      const hasAllPermissions = requiredPermissions.every(permission => 
        userPermissions.includes(permission)
      );

      return hasAllPermissions;
    } catch (err) {
      this.logger.error(`Error checking permissions for user ${userId}:`, err);
      return false;
    }
  }
}
