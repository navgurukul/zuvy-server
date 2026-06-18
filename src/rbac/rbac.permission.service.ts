import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import { sql, eq, and, asc, ilike, or, inArray, isNull } from 'drizzle-orm';
import {
  CreatePermissionDto,
  AssignUserPermissionDto,
  AssignPermissionsToUserDto,
  AssignPermissionsToRoleDto,
} from './dto/permission.dto';
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
import { AuthService } from 'src/auth/auth.service';
import { UserTokensService } from 'src/user-tokens/user-tokens.service';

@Injectable()
export class RbacPermissionService {
  constructor(
    private authService: AuthService,
    private userTokenService: UserTokensService,
  ) {}

  private readonly logger = new Logger(RbacPermissionService.name);

  async createPermission(
    createPermissionDto: CreatePermissionDto,
  ): Promise<any> {
    try {
      const { name, resourceId, description } = createPermissionDto;

      // Check if resource exists
      const resourceCheck = await db
        .select({ id: zuvyResources.id })
        .from(zuvyResources)
        .where(eq(zuvyResources.id, resourceId))
        .limit(1);
      if (!resourceCheck.length) {
        throw new NotFoundException('Resource not found');
      }

      // Check if permission with the same name already exists for this resource
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
      // Create new permission
      const result = await db
        .insert(zuvyPermissions)
        .values({
          name,
          resourcesId: resourceId,
          description: description ?? null,
        } as unknown as typeof zuvyPermissions.$inferInsert)
        .returning();

      if (result.length > 0) {
        // Get all permissions for this resource (including the newly created one)

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

        const allPermissionsResult = {
          rows: allPermissions,
          rowCount: allPermissions.length,
        };

        return {
          status: 'success',
          message: 'Permission created successfully',
          code: 200,
          data: allPermissionsResult,
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: 'Permission creation failed. Please try again',
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
      throw err;
    }
  }

  async getUserPermissions(
    userId: number,
    orgId: number | null,
  ): Promise<{ permission: string; resource: string }[]> {
    try {
      // Drizzle ORM equivalent for the above SQL
      const result = await db
        .selectDistinct({
          permission: zuvyPermissions.name,
          resource: zuvyResources.name,
        })
        .from(zuvyPermissions)
        .innerJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
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
          eq(zuvyUserRoles.id, zuvyUserRolesAssigned.roleId),
        )
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, userId),
            orgId !== null
              ? eq(zuvyUserRolesAssigned.organizationId, orgId)
              : isNull(zuvyUserRolesAssigned.organizationId),
            orgId !== null
              ? eq(zuvyPermissionsRoles.orgId, orgId)
              : isNull(zuvyPermissionsRoles.orgId),
          ),
        );

      return result;
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
    orgId: number | null,
  ): Promise<boolean> {
    try {
      if (!requiredPermissions || requiredPermissions.length === 0) {
        return true;
      }

      // 🔹 Super Admin Bypass: Always allow everything if they have a global super_admin role
      const globalRoles = await db
        .select({ name: zuvyUserRoles.name })
        .from(zuvyUserRolesAssigned)
        .innerJoin(
          zuvyUserRoles,
          eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
        )
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
            isNull(zuvyUserRolesAssigned.organizationId),
          ),
        );

      if (globalRoles.some((r) => r.name === 'super_admin')) {
        return true;
      }

      const userPermissions = await this.getUserPermissions(userId, orgId);
      const userPermissionsSet = new Set(
        userPermissions.map((up) => up.permission),
      );
      const hasAllPermissions = requiredPermissions.every((requiredPerm) =>
        userPermissionsSet.has(requiredPerm),
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
      const userCheck = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, BigInt(targetUserId)))
        .limit(1);
      if (!userCheck.length) {
        throw new NotFoundException('Target user not found');
      }

      if (actorUserId) {
        const actorCheck = await db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, BigInt(actorUserId)))
          .limit(1);
        if (!actorCheck.length) {
          throw new NotFoundException('Actor user not found');
        }
      }

      const permCheck = await db
        .select({ id: zuvyPermissions.id })
        .from(zuvyPermissions)
        .where(eq(zuvyPermissions.id, permissionId))
        .limit(1);
      if (!permCheck.length) {
        throw new NotFoundException('Permission not found');
      }

      const insertAudit = await db
        .insert(zuvyAuditLogs)
        .values({
          userId: actorUserId ?? null,
          targetUserId: targetUserId,
          action: 'assign_extra_permission',
          permissionId: permissionId,
          scopeId: scopeId ?? null,
        } as unknown as typeof zuvyAuditLogs.$inferInsert)
        .returning();

      return {
        status: 'success',
        code: 200,
        message: 'Extra permission assignment recorded in audit log',
        data: insertAudit[0],
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

  // rbac-permission.service.ts
  async assignPermissionsToUser(
    assignPermissionsDto: AssignPermissionsToUserDto,
  ): Promise<any> {
    try {
      const { userId, permissions } = assignPermissionsDto;
      console.log('Assigning permissions:', assignPermissionsDto);
      let insertUserPermission;
      // Check if user exists
      const userExists = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (!userExists.length) {
        throw new NotFoundException('User not found');
      }

      const permissionsExists = await db
        .select({ id: zuvyPermissions.id })
        .from(zuvyPermissions)
        .where(inArray(zuvyPermissions.id, permissions))
        .limit(1);
      if (!permissionsExists.length) {
        throw new NotFoundException('Permissions not found');
      }

      const alreadyAssignedPermissions = await db
        .select({ id: zuvyUserPermissions.id })
        .from(zuvyUserPermissions)
        .where(
          and(
            eq(zuvyUserPermissions.userId, BigInt(userId)),
            inArray(zuvyUserPermissions.permissionId, permissions),
          ),
        )
        .limit(1);
      if (alreadyAssignedPermissions.length) {
        throw new BadRequestException('Permissions already assigned to user');
      }

      for (const permissionId of assignPermissionsDto.permissions) {
        const exists = await db.query.zuvyUserPermissions.findFirst({
          where: (u, { eq, and }) =>
            and(
              eq(u.userId, BigInt(assignPermissionsDto.userId)),
              eq(u.permissionId, permissionId),
            ),
        });

        if (!exists) {
          const insertData = {
            userId: assignPermissionsDto.userId,
            permissionId,
          };
          insertUserPermission = await db
            .insert(zuvyUserPermissions)
            .values(insertData)
            .returning();
        }
      }
      return {
        status: 'success',
        code: 200,
        message: 'Permissions assigned successfully',
        data: insertUserPermission,
      };
    } catch (error) {
      this.logger.error('Error assigning permissions to user role:', error);
      throw error;
    }
  }

  async assignPermissionsToRole(
    dto: AssignPermissionsToRoleDto,
    orgId: number,
  ) {
    try {
      const { resourceId, roleId, permissions } = dto;

      const result = await db.transaction(async (tx) => {
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
            `Invalid permission ids for resource: ${invalid.join(', ')}`,
          );

        const enableIds = incomingIds.filter((id) => permissions[id] === true);
        const disableIds = incomingIds.filter(
          (id) => permissions[id] === false,
        );
        const permissionRoleOrgCondition =
          orgId !== undefined && orgId !== null
            ? eq(zuvyPermissionsRoles.orgId, orgId)
            : isNull(zuvyPermissionsRoles.orgId);

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
                permissionRoleOrgCondition,
                inArray(zuvyPermissionsRoles.permissionId, disableIds),
              ),
            );
        }

        const assigned = await tx
          .select({ permissionId: zuvyPermissionsRoles.permissionId })
          .from(zuvyPermissionsRoles)
          .where(
            and(
              eq(zuvyPermissionsRoles.roleId, roleId),
              permissionRoleOrgCondition,
            ),
          );

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

      const invalidatedSessions = await this.invalidateRoleMemberSessions(
        roleId,
        orgId,
      );

      return {
        ...result,
        data: {
          ...result.data,
          invalidatedSessions,
        },
      };
    } catch (error) {
      this.logger.error('Error in assignPermissionsToRole:', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to assign permissions');
    }
  }

  private async invalidateRoleMemberSessions(
    roleId: number,
    orgId?: number,
  ): Promise<number> {
    const orgCondition =
      orgId !== undefined && orgId !== null
        ? eq(zuvyUserRolesAssigned.organizationId, orgId)
        : isNull(zuvyUserRolesAssigned.organizationId);

    const members = await db
      .select({ userId: zuvyUserRolesAssigned.userId })
      .from(zuvyUserRolesAssigned)
      .where(and(eq(zuvyUserRolesAssigned.roleId, roleId), orgCondition));

    const uniqueUserIds = Array.from(new Set(members.map((m) => m.userId)));
    let invalidated = 0;

    for (const userId of uniqueUserIds) {
      try {
        const { data, success } = await this.userTokenService.getUserTokens(
          userId,
          orgId,
        );

        if (!success || !data?.accessToken || !data?.refreshToken) {
          continue;
        }

        await this.authService.updateUserlogout(
          Number(userId),
          data.accessToken,
          data.refreshToken,
        );
        await this.userTokenService.deleteToken({
          userId: Number(userId),
          organizationId: orgId,
        });
        invalidated += 1;
      } catch (error) {
        this.logger.warn(
          `Failed to invalidate session for user ${userId.toString()} after role permission update.`,
          error,
        );
      }
    }

    return invalidated;
  }
}
