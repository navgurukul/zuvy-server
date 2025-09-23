import { Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql, eq, and, asc, ilike, or } from 'drizzle-orm';
import { CreatePermissionDto, AssignUserPermissionDto, AssignPermissionsToUserDto } from './dto/permission.dto';
import { zuvyPermissions, zuvyResources, zuvyRolePermissions, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';

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

  async getAllPermissions(
    resourceId?: number,
    search?: string,
    page: any = 1,
    limit: any = 10
  ): Promise<[any, any]> {
    try {
      // Convert to numbers (handle string query parameters)
      const pageNum = typeof page === 'number' ? page : parseInt(page, 10) || 1;
      const limitNum = typeof limit === 'number' ? limit : parseInt(limit, 10) || 10;

      const offset = (pageNum - 1) * limitNum;

      // Build the where conditions
      const conditions = [];

      if (resourceId) {
        conditions.push(eq(zuvyPermissions.resourcesId, resourceId));
      }

      if (search) {
        conditions.push(
          or(
            ilike(zuvyPermissions.name, `%${search}%`),
            ilike(zuvyPermissions.description, `%${search}%`),
            ilike(zuvyResources.name, `%${search}%`)
          )
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      // Execute data query
      const dataResult = await db
        .select({
          id: zuvyPermissions.id,
          name: zuvyPermissions.name,
          resourceId: zuvyPermissions.resourcesId,
          description: zuvyPermissions.description,
          resourceName: zuvyResources.name
        })
        .from(zuvyPermissions)
        .leftJoin(zuvyResources, eq(zuvyPermissions.resourcesId, zuvyResources.id))
        .where(whereClause)
        .limit(limitNum)
        .offset(offset)
        .orderBy(asc(zuvyPermissions.id));

      // Execute count query
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyPermissions)
        .leftJoin(zuvyResources, eq(zuvyPermissions.resourcesId, zuvyResources.id))
        .where(whereClause);

      const total = countResult[0].count;
      const totalPages = Math.ceil(total / limitNum);

      // Build message with filters info
      let message = 'All permissions retrieved successfully';
      if (resourceId && search) {
        message = `Permissions for resource ${resourceId} matching "${search}" retrieved successfully`;
      } else if (resourceId) {
        message = `Permissions for resource ${resourceId} retrieved successfully`;
      } else if (search) {
        message = `Permissions matching "${search}" retrieved successfully`;
      }

      return [
        null,
        {
          status: 'success',
          message,
          code: 200,
          data: dataResult,
          currentPage: pageNum,
          itemsPerPage: limitNum,
          totalItems: total,
          totalPages: dataResult.length,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        }
      ];
    } catch (err) {
      this.logger.error('Error retrieving permissions:', err);
      return [err, null];
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

  // rbac-permission.service.ts
  async assignPermissionsToUser(assignPermissionsDto: AssignPermissionsToUserDto): Promise<any> {
    try {
      const { userId, roleId, permissions } = assignPermissionsDto;

      // Check if user exists
      const userExists = await db.execute(sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`);
      if (!(userExists as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      // Check if role exists
      const roleExists = await db
        .select({ id: zuvyUserRoles.id })
        .from(zuvyUserRoles)
        .where(eq(zuvyUserRoles.id, roleId))
        .limit(1);

      if (!roleExists.length) {
        throw new NotFoundException('Role not found');
      }

      // Assign role to user (if not already assigned)
      try {
        let assignData = {
          userId,
          roleId
        }
        await db.insert(zuvyUserRolesAssigned).values(assignData);
      } catch (error) {
        // Ignore duplicate key error (role already assigned)
        if (error.code !== '23505') {
          throw error;
        }
      }

      const assignedPermissions = [];
      const alreadyAssigned = [];

      for (const permission of permissions) {
        try {
          // Check if permission exists
          const permissionExists = await db
            .select({
              id: zuvyPermissions.id,
              name: zuvyPermissions.name,
              resourcesId: zuvyPermissions.resourcesId,
              resourceName: zuvyResources.name
            })
            .from(zuvyPermissions)
            .innerJoin(zuvyResources, eq(zuvyPermissions.resourcesId, zuvyResources.id))
            .where(eq(zuvyPermissions.id, permission.permissionId))
            .limit(1);

          if (!permissionExists.length) {
            throw new NotFoundException(`Permission with ID ${permission.permissionId} not found`);
          }

          const permissionDetail = permissionExists[0];

          // Check if permission is already assigned to this role
          const existingPermission = await db
            .select({ id: zuvyRolePermissions.id })
            .from(zuvyRolePermissions)
            .where(and(
              eq(zuvyRolePermissions.roleId, roleId),
              eq(zuvyRolePermissions.permissionId, permission.permissionId)
            ))
            .limit(1);

          if (existingPermission.length) {
            alreadyAssigned.push({
              permissionId: permission.permissionId,
              permissionName: permissionDetail.name,
              resourceId: permissionDetail.resourcesId,
              resourceName: permissionDetail.resourceName
            });
            continue;
          }

          // Assign permission to role
          await db.insert(zuvyRolePermissions).values({
            roleId,
            permissionId: permission.permissionId
          });

          assignedPermissions.push({
            permissionId: permission.permissionId,
            permissionName: permissionDetail.name,
            resourceId: permissionDetail.resourcesId,
            resourceName: permissionDetail.resourceName
          });

        } catch (error) {
          if (error instanceof NotFoundException) {
            throw error;
          }
          // Ignore duplicate permission assignments
          if (error.code !== '23505') {
            throw error;
          }
        }
      }

      let message = 'Permissions assigned to role successfully';
      if (alreadyAssigned.length > 0) {
        if (assignedPermissions.length > 0) {
          message = `Some permissions were already assigned to this role. ${assignedPermissions.length} new permissions assigned.`;
        } else {
          message = 'All permissions were already assigned to this role';
        }
      }

      return {
        userId,
        roleId,
        assignedPermissions,
        alreadyAssigned,
        message
      };

    } catch (error) {
      this.logger.error('Error assigning permissions to user role:', error);
      throw error;
    }
  }
}


