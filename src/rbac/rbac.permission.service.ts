import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql, eq, and, asc, ilike, or } from 'drizzle-orm';
import { CreatePermissionDto, AssignUserPermissionDto, AssignPermissionsToUserDto } from './dto/permission.dto';
import { zuvyPermissions, zuvyResources, zuvyRolePermissions, zuvyUserPermissions, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';

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
      const { userId, permissions } = assignPermissionsDto;
      console.log('Assigning permissions:', assignPermissionsDto);
      let insertUserPermission;
      // Check if user exists
      const userExists = await db.execute(sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`);
      if (!(userExists as any).rows?.length) {
        throw new NotFoundException('User not found');
      }

      const permissionsExists = await db.execute(sql`SELECT id FROM main.zuvy_permissions WHERE id IN (${permissions.map(permission => permission).join(',')}) LIMIT 1`);
      if (!(permissionsExists as any).rows?.length) {
        throw new NotFoundException('Permissions not found');
      }

      // const insertAudit = await db.execute(sql`
      //   INSERT INTO main.zuvy_audit_logs (user_id, target_user_id, action, permission_id, scope_id)
      //   VALUES (${userId}, ${userId}, ${'assign_permissions'}, ${permissions.map(permission => permission.id).join(',')}, ${scopeId ?? null})
      //   RETURNING *
      // `);
      const alreadyAssignedPermissions = await db.execute(sql`SELECT id FROM main.zuvy_user_permissions WHERE user_id = ${userId} AND permission_id IN (${permissions.map(permission => permission).join(',')}) LIMIT 1`);
      if ((alreadyAssignedPermissions as any).rows?.length) {
        throw new BadRequestException('Permissions already assigned to user');
      }

      for (const permissionId of assignPermissionsDto.permissions) {
        const exists = await db.query.zuvyUserPermissions.findFirst({
          where: (u, { eq, and }) =>
            and(eq(u.userId, BigInt(assignPermissionsDto.userId)), eq(u.permissionId, permissionId)),
        });

        if (!exists) {
          const insertData = {
            userId: assignPermissionsDto.userId,
            permissionId,
          }
          insertUserPermission = await db.insert(zuvyUserPermissions).values(insertData).returning();
        }
      }
      return {
        status: 'success',
        code: 200,
        message: 'Permissions assigned successfully',
        data: insertUserPermission
      };

    } catch (error) {
      this.logger.error('Error assigning permissions to user role:', error);
      throw error;
    }
  }
}


