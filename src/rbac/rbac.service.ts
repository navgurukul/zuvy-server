import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import { inArray, sql, eq, and } from 'drizzle-orm';
import {
  userRoles,
  zuvyPermissions,
  zuvyPermissionsRoles,
  zuvyResources,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
} from 'drizzle/schema';
import { ResourceList } from './utility';
import { PermissionsAllocationService } from 'src/permissions/permissions.alloc.service';

@Injectable()
export class RbacService {
  constructor(
    private readonly permissionAllocationService: PermissionsAllocationService,
  ) {}
  private readonly logger = new Logger(RbacService.name);

  async getAllPermissions(
    roleName: string[],
    targetPermissions: string[],
    orgId: number,
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

  async getUserPermissionsByResource(
    userId: bigint,
    resourceId: number,
    orgId: number,
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
    orgId: number,
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
}
