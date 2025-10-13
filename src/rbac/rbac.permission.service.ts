import { BadRequestException, ConflictException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql, eq, and, asc, ilike, or, inArray } from 'drizzle-orm';
import { CreatePermissionDto, AssignUserPermissionDto, AssignPermissionsToUserDto, AssignPermissionsToRoleDto } from './dto/permission.dto';
import { users, zuvyPermissions, zuvyResources, zuvyPermissionsRoles, zuvyRolePermissions, zuvyUserPermissions, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';

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

      // Check if permission with the same name already exists for this resource
      const permissionCheck = await db.execute(sql`SELECT id FROM main.zuvy_permissions WHERE name = ${name} AND resource_id = ${resourceId} LIMIT 1`);
      if ((permissionCheck as any).rows?.length) {
        throw new BadRequestException('Permission with this name already exists for the specified resource');
      }
      // Create new permission
      const result = await db.execute(
        sql`INSERT INTO main.zuvy_permissions (name, resource_id, description) VALUES (${name}, ${resourceId}, ${description ?? null}) RETURNING *`
      );

      if ((result as any).rows.length > 0) {
        // Get all permissions for this resource (including the newly created one)

        const allPermissions = await db
          .select({
            id: zuvyPermissions.id,
            name: zuvyPermissions.name,
            resourceId: zuvyPermissions.resourcesId,
            description: zuvyPermissions.description,
            resourceName: zuvyResources.name
          })
          .from(zuvyPermissions)
          .leftJoin(zuvyResources, eq(zuvyPermissions.resourcesId, zuvyResources.id))
          .where(eq(zuvyPermissions.resourcesId, resourceId))
          .orderBy(asc(zuvyPermissions.id));

        const allPermissionsResult = {
          rows: allPermissions,
          rowCount: allPermissions.length
        };

        return {
          status: 'success',
          message: 'Permission created successfully',
          code: 200,
          data: allPermissionsResult
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
    search?: string
  ): Promise<[any, any]> {
    try {
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

      const dataResult = await db
        .select({
          id: zuvyPermissions.id,
          name: zuvyPermissions.name,
          resourceId: zuvyPermissions.resourcesId,
          description: zuvyPermissions.description,
          resourceName: zuvyResources.name,
          granted: sql<boolean>`EXISTS (SELECT 1 FROM ${zuvyPermissionsRoles} pr WHERE pr.permission_id = ${zuvyPermissions.id})`.as('granted')
        })
        .from(zuvyPermissions)
        .leftJoin(zuvyResources, eq(zuvyPermissions.resourcesId, zuvyResources.id))
        .where(whereClause)
        .orderBy(asc(zuvyPermissions.id));

      // Execute count query
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyPermissions)
        .leftJoin(zuvyResources, eq(zuvyPermissions.resourcesId, zuvyResources.id))
        .where(whereClause);

      return [
        null,
        {
          status: 'success',
          message: 'All permissions retrieved successfully',
          code: 200,
          data: dataResult,
          totalPages: dataResult.length,
        }
      ];
    } catch (err) {
      this.logger.error('Error retrieving permissions:', err);
      return [err, null];
    }
  }

  async deletePermission(id: number): Promise<any> {
    try {
      // Check if the permission is associated with any roles
      const associatedRoles = await db
        .select()
        .from(zuvyPermissionsRoles)
        .where(eq(zuvyPermissionsRoles.permissionId, id));
      if (associatedRoles.length > 0) {
        throw new BadRequestException('Cannot delete permission associated with roles. Please remove associations first.');
      }
      // If there are no associated roles, the permission is deleted successfully
      const deletedPermission = await db
        .delete(zuvyPermissions)
        .where(eq(zuvyPermissions.id, id));
      if (deletedPermission.rowCount === 0) {
        throw new NotFoundException(`Permission with ID ${id} not found`);
      }
      // Permission deleted successfully then return the permission details
      return { message: 'Permission deleted successfully', code: 200, status: 'success'};
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

// async assignPermissionsToRole(dto: AssignPermissionsToRoleDto) {
//   try {
//     return await db.transaction(async (tx) => {
//       // Check if resource exists
//       const resource = await tx
//         .select({ 
//           id: zuvyResources.id,
//           name: zuvyResources.name 
//         })
//         .from(zuvyResources)
//         .where(eq(zuvyResources.id, dto.resourceId))
//         .limit(1);

//       if (!resource.length) {
//         throw new NotFoundException(`Resource with ID ${dto.resourceId} not found`);
//       }

//       // Get all permission IDs that should exist for this resource
//       const permissionIds = Object.keys(dto.permissions).map(Number);
      
//       const existingPermissions = await tx
//         .select({ 
//           id: zuvyPermissions.id,
//           name: zuvyPermissions.name,
//           resourcesId: zuvyPermissions.resourcesId
//         })
//         .from(zuvyPermissions)
//         .where(
//           and(
//             inArray(zuvyPermissions.id, permissionIds),
//             eq(zuvyPermissions.resourcesId, dto.resourceId)
//           )
//         );

//       // Check if all provided permission IDs exist and belong to the resource
//       const existingPermissionIds = new Set(existingPermissions.map(p => p.id));
//       const invalidPermissionIds = permissionIds.filter(id => !existingPermissionIds.has(id));

//       if (invalidPermissionIds.length > 0) {
//         throw new BadRequestException(
//           `Permission(s) with ID(s) [${invalidPermissionIds.join(', ')}] not found for resource ${dto.resourceId}`
//         );
//       }

//       // Perform updates
//       const updateResults = await Promise.allSettled(
//         Object.entries(dto.permissions).map(async ([permissionId, grantable]) => {
//           const result = await tx
//             .update(zuvyPermissions)
//             .set({
//               [zuvyPermissions.grantable.name]: grantable,
//               // [zuvyPermissions.updatedAt.name]: new Date()
//             })
//             .where(
//               and(
//                 eq(zuvyPermissions.id, Number(permissionId)),
//                 eq(zuvyPermissions.resourcesId, dto.resourceId)
//               )
//             )
//             .returning({ 
//               id: zuvyPermissions.id, 
//               grantable: zuvyPermissions.grantable 
//             });

//           if (!result.length) {
//             throw new Error(`Failed to update permission ${permissionId}`);
//           }

//           return result[0];
//         })
//       );

//       // Check for any failed updates
//       const failedUpdates = updateResults
//         .map((result, index) => ({ result, permissionId: permissionIds[index] }))
//         .filter(({ result }) => result.status === 'rejected');

//       if (failedUpdates.length > 0) {
//         const failedIds = failedUpdates.map(({ permissionId }) => permissionId);
//         throw new InternalServerErrorException(
//           `Failed to update permission(s): ${failedIds.join(', ')}`
//         );
//       }

//       // Extract successful results
//       const successfulUpdates = updateResults
//         .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
//         .map(result => result.value);

//       return {
//         success: true,
//         message: `Successfully updated ${successfulUpdates.length} permission(s) for resource ${resource[0].name}`,
//         data: {
//           resourceId: dto.resourceId,
//           resourceName: resource[0].name,
//           updatedPermissions: successfulUpdates,
//           totalUpdated: successfulUpdates.length
//         }
//       };
//     });

//   } catch (error) {
//     // Log the error for monitoring
//     this.logger.error('Error updating permissions:', {
//       resourceId: dto.resourceId,
//       permissionCount: Object.keys(dto.permissions || {}).length,
//       error: error.message,
//       stack: error.stack
//     });

//     // Re-throw known HTTP exceptions
//     if (error instanceof BadRequestException || 
//         error instanceof NotFoundException || 
//         error instanceof InternalServerErrorException) {
//       throw error;
//     }

//     // Handle database-specific errors
//     if (error.code) {
//       switch (error.code) {
//         case '23503': // Foreign key violation
//           throw new BadRequestException('Invalid reference to related data');
//         case '23505': // Unique constraint violation
//           throw new ConflictException('Duplicate permission configuration');
//         case '23514': // Check constraint violation
//           throw new BadRequestException('Invalid permission data provided');
//         default:
//           throw new InternalServerErrorException(
//             'Database error occurred while updating permissions'
//           );
//       }
//     }

//     // Generic error fallback
//     throw new InternalServerErrorException(
//       'An unexpected error occurred while updating permissions'
//     );
//   }
// }

async assignPermissionsToRole(dto: AssignPermissionsToRoleDto) {
  try {
    const { resourceId, roleId, permissions } = dto;

    return await db.transaction(async (tx) => {
      const [resource] = await tx
        .select()
        .from(zuvyResources)
        .where(eq(zuvyResources.id, resourceId))
        .limit(1);
      if (!resource) throw new NotFoundException('Resource not found');

      const [role] = await tx
        .select()
        .from(zuvyUserRoles)
        .where(eq(zuvyUserRoles.id, roleId))
        .limit(1);
      if (!role) throw new NotFoundException('Role not found');

      const resourcePerms = await tx
        .select({ id: zuvyPermissions.id })
        .from(zuvyPermissions)
        .where(eq(zuvyPermissions.resourcesId, resourceId));

      const validIds = new Set(resourcePerms.map((p) => p.id));
      const incomingIds = Object.keys(permissions).map(Number);
      const invalid = incomingIds.filter((id) => !validIds.has(id));
      if (invalid.length)
        throw new BadRequestException(
          `Invalid permission ids for resource: ${invalid.join(', ')}`
        );

      const enableIds = incomingIds.filter((id) => permissions[id] === true);
      const disableIds = incomingIds.filter((id) => permissions[id] === false);

      if (enableIds.length) {
        await tx
          .insert(zuvyPermissionsRoles)
          .values(enableIds.map((permissionId) => ({ roleId, permissionId })))
          .onConflictDoNothing({
            target: [
              zuvyPermissionsRoles.roleId,
              zuvyPermissionsRoles.permissionId,
            ],
          });
      }

      if (disableIds.length) {
        await tx
          .delete(zuvyPermissionsRoles)
          .where(
            and(
              eq(zuvyPermissionsRoles.roleId, roleId),
              inArray(zuvyPermissionsRoles.permissionId, disableIds)
            )
          );
      }

      const assigned = await tx
        .select({ permissionId: zuvyPermissionsRoles.permissionId })
        .from(zuvyPermissionsRoles)
        .where(eq(zuvyPermissionsRoles.roleId, roleId));

      return {
        status: 'success',
        message: 'Permissions updated',
        data: {
          roleId,
          resourceId,
          assignedPermissionIds: assigned.map((r) => r.permissionId),
        },
      };
    });
  } catch (error) {
    this.logger.error('Error in assignPermissionsToRole:', error);
    throw new InternalServerErrorException('Failed to assign permissions');
  }
}


}
