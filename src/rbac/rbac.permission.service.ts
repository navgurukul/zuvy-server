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
  blacklistedTokens,
  zuvyPermissions,
  zuvyResources,
  zuvyPermissionsRoles,
  zuvyUserPermissions,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
  zuvyAuditLogs,
  zuvyUserOrganizations,
  zuvyBatches,
  zuvyBootcamps,
} from 'drizzle/schema';
import { JwtService } from '@nestjs/jwt';
import { ResourceList } from './utility';

@Injectable()
export class RbacPermissionService {
  private readonly logger = new Logger(RbacPermissionService.name);

  constructor(private readonly jwtService: JwtService) {}

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
  ): Promise<{ permission: string; resource: string; resourceKey?: string }[]> {
    try {
      // Drizzle ORM equivalent for the above SQL
      const rolePermissions = await db
        .selectDistinct({
          permission: zuvyPermissions.name,
          resource: zuvyResources.name,
          resourceKey: zuvyResources.key,
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
            eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
            orgId !== null
              ? eq(zuvyUserRolesAssigned.organizationId, orgId)
              : isNull(zuvyUserRolesAssigned.organizationId),
            orgId !== null
              ? eq(zuvyPermissionsRoles.orgId, orgId)
              : isNull(zuvyPermissionsRoles.orgId),
          ),
        );

      const directPermissions = await db
        .selectDistinct({
          permission: zuvyPermissions.name,
          resource: zuvyResources.name,
          resourceKey: zuvyResources.key,
        })
        .from(zuvyUserPermissions)
        .innerJoin(
          zuvyPermissions,
          eq(zuvyUserPermissions.permissionId, zuvyPermissions.id),
        )
        .innerJoin(
          zuvyResources,
          eq(zuvyPermissions.resourcesId, zuvyResources.id),
        )
        .where(eq(zuvyUserPermissions.userId, BigInt(userId)));

      const seen = new Set<string>();
      return [...rolePermissions, ...directPermissions].filter((permission) => {
        const key = `${permission.resourceKey}:${permission.permission}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
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
      const permissionSet = new Set<string>();

      userPermissions.forEach((userPermission) => {
        permissionSet.add(userPermission.permission);
        permissionSet.add(
          `${userPermission.resourceKey}:${userPermission.permission}`,
        );

        const resourceKey = userPermission.resourceKey?.toLowerCase();
        let action = userPermission.permission.toLowerCase();
        if (action === 'view') action = 'read';

        const formattedPermission =
          resourceKey && ResourceList[resourceKey]
            ? ResourceList[resourceKey][action]
            : undefined;
        if (formattedPermission) {
          permissionSet.add(formattedPermission);
        }
      });

      const hasAllPermissions = requiredPermissions.every((requiredPerm) =>
        permissionSet.has(requiredPerm),
      );

      return hasAllPermissions;
    } catch (err) {
      this.logger.error(`Error checking permissions for user ${userId}:`, err);
      return false;
    }
  }

  private async invalidateStoredTokens(
    sessions: { accessToken: string | null; refreshToken: string | null }[],
    userId: number,
  ) {
    const tokens = sessions
      .flatMap((session) => [session.accessToken, session.refreshToken])
      .filter(Boolean) as string[];

    for (const token of tokens) {
      try {
        const decoded = this.jwtService.decode(token) as { exp?: number };
        const expiresAt = decoded?.exp
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await db
          .insert(blacklistedTokens)
          .values({
            token,
            userId: BigInt(userId),
            expiresAt,
          } as typeof blacklistedTokens.$inferInsert)
          .onConflictDoNothing();
      } catch (error: any) {
        this.logger.warn(
          `Failed to blacklist token for user ${userId}: ${error?.message ?? error}`,
        );
      }
    }
  }

  private async invalidateSessionRows(userId: number, orgId?: number | null) {
    const conditions = [eq(zuvyUserOrganizations.userId, userId)];
    if (orgId !== undefined) {
      conditions.push(
        orgId === null
          ? isNull(zuvyUserOrganizations.organizationId)
          : eq(zuvyUserOrganizations.organizationId, orgId),
      );
    }

    const sessions = await db
      .select({
        accessToken: zuvyUserOrganizations.accessToken,
        refreshToken: zuvyUserOrganizations.refreshToken,
      })
      .from(zuvyUserOrganizations)
      .where(and(...conditions));

    if (sessions.length) {
      await this.invalidateStoredTokens(sessions, userId);
    }

    await db
      .update(zuvyUserOrganizations)
      .set({ accessToken: null, refreshToken: null } as any)
      .where(and(...conditions));
  }

  private async invalidateSpecificUserSession(userId: number) {
    await this.invalidateSessionRows(userId);
  }

  private async invalidateSessionsForRoleUsers(roleId: number, orgId: number) {
    const assignedUsers = await db
      .selectDistinct({ userId: zuvyUserRolesAssigned.userId })
      .from(zuvyUserRolesAssigned)
      .where(
        and(
          eq(zuvyUserRolesAssigned.roleId, roleId),
          eq(zuvyUserRolesAssigned.organizationId, orgId),
        ),
      );

    for (const assignedUser of assignedUsers) {
      await this.invalidateSessionRows(Number(assignedUser.userId), orgId);
    }
  }

  async validateAssignedResourceAccess(
    user: { id: number | string; roles?: string[]; orgId?: number | string },
    resourceIds: {
      orgId?: number | null;
      bootcampId?: number;
      batchId?: number;
    },
  ): Promise<boolean> {
    const roles = user.roles || [];
    if (
      roles.includes('super_admin') ||
      roles.includes('admin') ||
      (!roles.includes('instructor') && !roles.includes('ops'))
    ) {
      return true;
    }

    const tokenOrgId = user.orgId ? Number(user.orgId) : null;
    if (
      resourceIds.orgId !== undefined &&
      resourceIds.orgId !== null &&
      tokenOrgId !== Number(resourceIds.orgId)
    ) {
      return false;
    }

    let bootcampId = resourceIds.bootcampId;
    if (!bootcampId && resourceIds.batchId) {
      const [batch] = await db
        .select({ bootcampId: zuvyBatches.bootcampId })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.id, resourceIds.batchId))
        .limit(1);
      bootcampId = batch?.bootcampId ? Number(batch.bootcampId) : undefined;
    }

    if (!bootcampId) return true;

    const [bootcamp] = await db
      .select({ organizationId: zuvyBootcamps.organizationId })
      .from(zuvyBootcamps)
      .where(eq(zuvyBootcamps.id, bootcampId))
      .limit(1);

    if (
      bootcamp?.organizationId &&
      tokenOrgId &&
      Number(bootcamp.organizationId) !== tokenOrgId
    ) {
      return false;
    }

    const assignedBatches = await db
      .select({ id: zuvyBatches.id })
      .from(zuvyBatches)
      .where(
        and(
          eq(zuvyBatches.bootcampId, bootcampId),
          eq(zuvyBatches.instructorId, Number(user.id)),
        ),
      )
      .limit(1);

    return assignedBatches.length > 0;
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
        .where(eq(users.id, BigInt(userId)))
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
        const [exists] = await db
          .select({ id: zuvyUserPermissions.id })
          .from(zuvyUserPermissions)
          .where(
            and(
              eq(
                zuvyUserPermissions.userId,
                BigInt(assignPermissionsDto.userId),
              ),
              eq(zuvyUserPermissions.permissionId, permissionId),
            ),
          )
          .limit(1);

        if (!exists) {
          const insertData = {
            userId: BigInt(assignPermissionsDto.userId),
            permissionId,
          };
          insertUserPermission = await db
            .insert(zuvyUserPermissions)
            .values(insertData)
            .returning();
        }
      }
      await this.invalidateSpecificUserSession(userId);

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
      if (
        orgId === undefined ||
        orgId === null ||
        Number.isNaN(Number(orgId))
      ) {
        throw new BadRequestException('Organization context missing');
      }

      const response = await db.transaction(async (tx) => {
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
                eq(zuvyPermissionsRoles.orgId, orgId),
              ),
            );
        }

        const assigned = await tx
          .select({ permissionId: zuvyPermissionsRoles.permissionId })
          .from(zuvyPermissionsRoles)
          .where(
            and(
              eq(zuvyPermissionsRoles.roleId, roleId),
              eq(zuvyPermissionsRoles.orgId, orgId),
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
      await this.invalidateSessionsForRoleUsers(roleId, orgId);
      return response;
    } catch (error) {
      this.logger.error('Error in assignPermissionsToRole:', error);
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Failed to assign permissions');
    }
  }
}
