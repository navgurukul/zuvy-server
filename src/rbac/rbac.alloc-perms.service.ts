import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import { inArray, sql, eq, and, isNull, or } from 'drizzle-orm';
import {
  users,
  userRoles,
  zuvyPermissions,
  zuvyPermissionsRoles,
  zuvyResources,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
  zuvyExtraPermissions,
} from 'drizzle/schema';
import { ResourceList } from './utility';
import { PermissionsAllocationService } from 'src/permissions/permissions.alloc.service';

@Injectable()
export class RbacAllocPermsService {
  constructor(
    private readonly permissionAllocationService: PermissionsAllocationService,
  ) {}
  private readonly logger = new Logger(RbacAllocPermsService.name);

  async getUserPermissionsByResource(
    userId: bigint,
    resourceId: number,
    orgId: number | null,
  ): Promise<any> {
    try {
      await this.permissionAllocationService.getUserPermissionsByResource(
        userId,
        resourceId,
        orgId,
      );
    } catch (err) {
      this.logger.error(
        `Error getting user permissions for user ${userId} and resource ${resourceId}:`,
        err,
      );
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Failed to retrieve user permissions',
      );
    }
  }

  async getUserPermissionsForMultipleResources(
    userId: bigint,
    orgId: number | null,
  ): Promise<any> {
    try {
      return await this.permissionAllocationService.getUserPermissionsForMultipleResources(
        userId,
        orgId,
      );
    } catch (err) {
      this.logger.error(
        `Error in getUserPermissionsForMultipleResources for user ${userId}:`,
        err,
      );
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        'Failed to retrieve user permissions',
      );
    }
  }

  async checkUserPermission(
    userId: number,
    resourceId: number,
    permissionName: string,
    orgId: number | null,
  ): Promise<any> {
    try {
      // First check if user exists
      const userCheck = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, BigInt(userId)))
        .limit(1);
      if (!userCheck.length) {
        throw new NotFoundException('User not found');
      }

      // Check if resource exists
      const resourceCheck = await db
        .select({ id: zuvyResources.id, name: zuvyResources.name })
        .from(zuvyResources)
        .where(eq(zuvyResources.id, Number(resourceId)))
        .limit(1);
      if (!resourceCheck.length) {
        throw new NotFoundException('Resource not found');
      }

      // Check role-based permission
      const rolePermission = await db
        .selectDistinct({
          permission_id: zuvyPermissions.id,
          permission_name: zuvyPermissions.name,
          resource_name: zuvyResources.name,
          role_name: zuvyUserRoles.name,
          permission_type: sql`'role_based'`.as('permission_type'),
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
          eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
        )
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
            orgId !== null
              ? or(
                  eq(zuvyUserRolesAssigned.organizationId, orgId),
                  isNull(zuvyUserRolesAssigned.organizationId),
                )
              : isNull(zuvyUserRolesAssigned.organizationId),
            orgId !== null
              ? or(
                  eq(zuvyPermissionsRoles.orgId, orgId),
                  isNull(zuvyPermissionsRoles.orgId),
                )
              : isNull(zuvyPermissionsRoles.orgId),
            eq(zuvyResources.id, Number(resourceId)),
            eq(zuvyPermissions.name, permissionName),
          ),
        );

      // Check extra permission
      const extraPermission = await db
        .selectDistinct({
          extra_permission_id: zuvyExtraPermissions.id,
          permission_name: zuvyPermissions.name,
          resource_name: zuvyResources.name,
          action: zuvyExtraPermissions.action,
          course_name: zuvyExtraPermissions.courseName,
          permission_type: sql`'extra'`.as('permission_type'),
          granted_by_email: users.email,
        })
        .from(zuvyExtraPermissions)
        .innerJoin(
          zuvyPermissions,
          eq(zuvyExtraPermissions.permissionId, zuvyPermissions.id),
        )
        .innerJoin(
          zuvyResources,
          eq(zuvyExtraPermissions.resourceId, zuvyResources.id),
        )
        .innerJoin(users, eq(zuvyExtraPermissions.grantedBy, users.id))
        .where(
          and(
            eq(zuvyExtraPermissions.userId, BigInt(userId)),
            eq(zuvyExtraPermissions.resourceId, Number(resourceId)),
            eq(zuvyPermissions.name, permissionName),
          ),
        );

      const hasRolePermission = rolePermission.length > 0;
      const hasExtraPermission = extraPermission.length > 0;
      const hasPermission = hasRolePermission || hasExtraPermission;

      return {
        status: 'success',
        message: 'Permission check completed',
        code: 200,
        data: {
          userId,
          resourceId,
          resourceName: resourceCheck[0].name,
          permissionName,
          hasPermission,
          permissionSources: {
            roleBased: hasRolePermission,
            extra: hasExtraPermission,
          },
          details: {
            roleBased: hasRolePermission ? rolePermission : [],
            extra: hasExtraPermission ? extraPermission : [],
          },
        },
      };
    } catch (err) {
      this.logger.error(
        `Error checking permission for user ${userId}, resource ${resourceId}, permission ${permissionName}:`,
        err,
      );
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to check user permission');
    }
  }

  async formatPermissionsAndCompare(
    rolePermissions: string[],
    targetPermissions: string[],
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

  async getAllPermissions(
    roleName: string[],
    targetPermissions: string[],
    orgId: number | null,
  ): Promise<any> {
    try {
      return await this.permissionAllocationService.getAllPermissions(
        roleName,
        targetPermissions,
        orgId,
      );
    } catch (err) {
      this.logger.error('Error retrieving all permissions:', err);
      throw err;
    }
  }
}
