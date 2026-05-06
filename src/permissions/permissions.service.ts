import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import { sql, eq, and, asc, ilike, or, inArray } from 'drizzle-orm';
import {
  CreatePermissionDto,
  AssignPermissionsToRoleDto,
  AssignPermissionsToUserDto,
  AssignUserPermissionDto,
} from './dto/create-permission.dto';
import {
  users,
  zuvyPermissions,
  zuvyResources,
  zuvyPermissionsRoles,
  zuvyUserPermissions,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
  zuvyAuditLogs,
} from 'drizzle/schema';
import { AuditlogService } from 'src/auditlog/auditlog.service';
import { alias } from 'drizzle-orm/pg-core';

@Injectable()
export class PermissionsService {
  constructor(private auditLogService: AuditlogService) {}
  private readonly logger = new Logger(PermissionsService.name);

  async createPermission(
    createPermissionDto: CreatePermissionDto,
  ): Promise<any> {
    try {
      const { name, resourceId, description } = createPermissionDto;

      // ✅ Check if resource exists
      const resourceCheck = await db
        .select({ id: zuvyResources.id })
        .from(zuvyResources)
        .where(eq(zuvyResources.id, resourceId))
        .limit(1);

      if (!resourceCheck.length) {
        throw new NotFoundException('Resource not found');
      }

      // ✅ Check duplicate permission
      const permissionCheck = await db
        .select({ id: zuvyPermissions.id })
        .from(zuvyPermissions)
        .where(
          and(
            eq(zuvyPermissions.name, name),
            eq(zuvyPermissions.resourcesId, resourceId),
          ),
        )
        .limit(1);

      if (permissionCheck.length) {
        throw new BadRequestException(
          'Permission with this name already exists for the specified resource',
        );
      }

      // ✅ Insert new permission
      const insertedPermission = await db
        .insert(zuvyPermissions)
        .values({
          name,
          resourcesId: resourceId,
          description: description ?? null,
        } as unknown as typeof zuvyPermissions.$inferInsert)
        .returning();

      if (!insertedPermission.length) {
        return {
          status: 'error',
          code: 400,
          message: 'Permission creation failed. Please try again',
        };
      }

      // ✅ Fetch all permissions for this resource
      const allPermissions = await db
        .select({
          id: zuvyPermissions.id,
          name: zuvyPermissions.name,
          resourceId: zuvyPermissions.resourcesId,
          description: zuvyPermissions.description,
          resourceName: zuvyResources.name,
        })
        .from(zuvyPermissions)
        .leftJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
        .where(eq(zuvyPermissions.resourcesId, resourceId))
        .orderBy(asc(zuvyPermissions.id));

      return {
        status: 'success',
        message: 'Permission created successfully',
        code: 200,
        data: {
          rows: allPermissions,
          rowCount: allPermissions.length,
        },
      };
    } catch (err) {
      this.logger.error('Error creating permission:', err);
      if (err instanceof NotFoundException) throw err;
      throw err;
    }
  }

  async getAllPermissions(
    resourceId?: number,
    search?: string,
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
            ilike(zuvyResources.name, `%${search}%`),
          ),
        );
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const dataResult = await db
        .select({
          id: zuvyPermissions.id,
          name: zuvyPermissions.name,
          resourceId: zuvyPermissions.resourcesId,
          description: zuvyPermissions.description,
          resourceName: zuvyResources.name,
          granted:
            sql<boolean>`EXISTS (SELECT 1 FROM ${zuvyPermissionsRoles} pr WHERE pr.permission_id = ${zuvyPermissions.id})`.as(
              'granted',
            ),
        })
        .from(zuvyPermissions)
        .leftJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
        .where(whereClause)
        .orderBy(asc(zuvyPermissions.id));

      // Execute count query
      const countResult = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyPermissions)
        .leftJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
        .where(whereClause);

      return [
        null,
        {
          status: 'success',
          message: 'All permissions retrieved successfully',
          code: 200,
          data: dataResult,
          totalPages: dataResult.length,
        },
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
        throw new BadRequestException(
          'Cannot delete permission associated with roles. Please remove associations first.',
        );
      }
      // If there are no associated roles, the permission is deleted successfully
      const deletedPermission = await db
        .delete(zuvyPermissions)
        .where(eq(zuvyPermissions.id, id));
      if (deletedPermission.rowCount === 0) {
        throw new NotFoundException(`Permission with ID ${id} not found`);
      }
      // Permission deleted successfully then return the permission details
      return {
        message: 'Permission deleted successfully',
        code: 200,
        status: 'success',
      };
    } catch (err) {
      this.logger.error('Error deleting permission:', err);
      throw err;
    }
  }

  async getUserPermissions(userId: number, orgId: number): Promise<string[]> {
    try {
      const result = await db
        .selectDistinct({
          name: zuvyPermissions.name,
        })
        .from(zuvyPermissions)
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
          eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
        )
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
            or(
              eq(zuvyUserRolesAssigned.organizationId, orgId),
              isNull(zuvyUserRolesAssigned.organizationId),
            ),
            or(
              eq(zuvyPermissionsRoles.orgId, orgId),
              isNull(zuvyPermissionsRoles.orgId),
            ),
          ),
        );

      // ✅ Drizzle returns array directly
      return result.map((row) => row.name);
    } catch (err) {
      this.logger.error(
        `Error getting user permissions for user ${userId}:`,
        err,
      );
      throw new InternalServerErrorException(
        'Failed to retrieve user permissions',
      );
    }
  }

  async userHasPermissions(
    userId: number,
    requiredPermissions: string[],
    orgId: number,
  ): Promise<boolean> {
    try {
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }

      const userPermissions = await this.getUserPermissions(userId, orgId);
      const hasAllPermissions = requiredPermissions.every((permission) =>
        userPermissions.includes(permission),
      );

      return hasAllPermissions;
    } catch (err) {
      this.logger.error(`Error checking permissions for user ${userId}:`, err);
      return false;
    }
  }

  async assignExtraPermissionToUser(
    payload: AssignUserPermissionDto,
  ): Promise<any> {
    const { actorUserId, targetUserId, permissionId, scopeId } = payload;

    try {
      // ✅ Check target user
      const targetUser = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, BigInt(targetUserId)))
        .limit(1);

      if (!targetUser.length) {
        throw new NotFoundException('Target user not found');
      }

      // ✅ Check actor user (if provided)
      if (actorUserId) {
        const actorUser = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, BigInt(actorUserId)))
          .limit(1);

        if (!actorUser.length) {
          throw new NotFoundException('Actor user not found');
        }
      }

      // ✅ Check permission
      const permission = await db
        .select({ id: zuvyPermissions.id })
        .from(zuvyPermissions)
        .where(eq(zuvyPermissions.id, permissionId))
        .limit(1);

      if (!permission.length) {
        throw new NotFoundException('Permission not found');
      }

      // ✅ Insert audit log
      const insertAudit = await db
        .insert(zuvyAuditLogs)
        .values({
          userId: actorUserId ?? null,
          targetUserId,
          action: 'assign_extra_permission',
          permissionId,
          scopeId: scopeId ?? null,
        } as unknown as typeof zuvyAuditLogs.$inferInsert)
        .returning();

      return {
        status: 'success',
        code: 200,
        message: 'Extra permission assignment recorded in audit log',
        data: insertAudit[0], // ✅ no .rows
      };
    } catch (err) {
      this.logger.error(
        'Failed to assign extra permission to user',
        err as any,
      );
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Failed to assign extra permission',
      );
    }
  }

  async assignPermissionsToUser(
    assignPermissionsDto: AssignPermissionsToUserDto,
  ): Promise<any> {
    try {
      const { userId, permissions } = assignPermissionsDto;

      // ✅ Check if user exists
      const userExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, BigInt(userId)))
        .limit(1);

      if (!userExists.length) {
        throw new NotFoundException('User not found');
      }

      // ✅ Check permissions exist
      const permissionsExists = await db
        .select({ id: zuvyPermissions.id })
        .from(zuvyPermissions)
        .where(inArray(zuvyPermissions.id, permissions));

      if (!permissionsExists.length) {
        throw new NotFoundException('Permissions not found');
      }

      // ✅ Check already assigned permissions
      const alreadyAssigned = await db
        .select({ permissionId: zuvyUserPermissions.permissionId })
        .from(zuvyUserPermissions)
        .where(
          and(
            eq(zuvyUserPermissions.userId, BigInt(userId)),
            inArray(zuvyUserPermissions.permissionId, permissions),
          ),
        );

      if (alreadyAssigned.length) {
        throw new BadRequestException(
          'Some permissions are already assigned to user',
        );
      }

      // ✅ Bulk insert (no loop 🚀)
      const insertData = permissions.map((permissionId) => ({
        userId,
        permissionId,
      }));

      const insertedPermissions = await db
        .insert(zuvyUserPermissions)
        .values(insertData)
        .returning();

      return {
        status: 'success',
        code: 200,
        message: 'Permissions assigned successfully',
        data: insertedPermissions,
      };
    } catch (error) {
      this.logger.error('Error assigning permissions to user role:', error);
      throw error;
    }
  }

  async assignPermissionsToRole(
    userIdString,
    dto: AssignPermissionsToRoleDto,
    orgId: number,
  ) {
    try {
      const { resourceId, roleId, permissions } = dto;
      const actorUserId = Number(userIdString);
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

        // const current = await tx.select({ permissionId: zuvyPermissionsRoles.permissionId })
        //   .from(zuvyPermissionsRoles).where(eq(zuvyPermissionsRoles.roleId, roleId));
        // const have = new Set(current.map(r => r.permissionId));
        // const auditPermissions: Record<string, boolean> = {};
        // for (const [idStr, val] of Object.entries(permissions)) {
        //   const id = Number(idStr);
        //   if (val === true && !have.has(id)) auditPermissions[idStr] = true;
        //   if (val === false && have.has(id)) auditPermissions[idStr] = false;
        // }

        const validIds = new Set(resourcePerms.map((p) => p.id));
        const incomingIds = Object.keys(permissions).map(Number);
        const invalid = incomingIds.filter((id) => !validIds.has(id));
        if (invalid.length)
          throw new BadRequestException(
            `Invalid permission ids for resource: ${invalid.join(', ')}`,
          );

        const enableIds = incomingIds.filter((id) => permissions[id] === true);
        const disableIds = incomingIds.filter(
          (id) => permissions[id] === false,
        );

        if (enableIds.length) {
          await tx
            .insert(zuvyPermissionsRoles)
            .values(
              enableIds.map((permissionId) => ({
                roleId,
                permissionId,
                orgId,
              })),
            )
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
                inArray(zuvyPermissionsRoles.permissionId, disableIds),
              ),
            );
        }

        const assigned = await tx
          .select({ permissionId: zuvyPermissionsRoles.permissionId })
          .from(zuvyPermissionsRoles)
          .where(eq(zuvyPermissionsRoles.roleId, roleId));

        const auditLog = await this.auditLogService.log('perm_to_role', {
          actorUserId,
          roleId,
          permissions,
        });

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

  async ensureExists(id: number) {
    const [role] = await db
      .select({ id: zuvyUserRoles.id })
      .from(zuvyUserRoles)
      .where(eq(zuvyUserRoles.id, id))
      .limit(1);
    if (!role) throw new NotFoundException('Role not found');
  }

  async getPermissionsByRoleAndResource(roleId: number, resourceId: number) {
    try {
      // Ensure role exists
      await this.ensureExists(roleId);

      // Ensure resource exists
      const resource = await db
        .select()
        .from(zuvyResources)
        .where(eq(zuvyResources.id, resourceId))
        .limit(1)
        .then((res) => res[0]);
      if (!resource) throw new NotFoundException('Resource not found');

      const pr = alias(zuvyPermissionsRoles, 'pr');
      const permissions = await db
        .select({
          id: zuvyPermissions.id,
          name: zuvyPermissions.name,
          description: zuvyPermissions.description,
          resourceId: zuvyPermissions.resourcesId,
          createdAt: zuvyPermissions.createdAt,
          updatedAt: zuvyPermissions.updatedAt,
          granted: sql<boolean>`(${pr.permissionId} IS NOT NULL)`.as('granted'),
        })
        .from(zuvyPermissions)
        .leftJoin(
          pr,
          and(eq(pr.permissionId, zuvyPermissions.id), eq(pr.roleId, roleId)),
        )
        .where(eq(zuvyPermissions.resourcesId, resourceId))
        .orderBy(zuvyPermissions.id);

      return permissions;
    } catch (error) {
      this.logger.error(
        'Error getting permissions for role and resource:',
        error,
      );
      if (error.status == 404) throw error;
      throw new InternalServerErrorException(
        'Failed to get permissions for role and resource',
        error,
      );
    }
  }
}
