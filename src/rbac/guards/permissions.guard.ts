import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacPermissionService } from '../rbac.permission.service';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacPermissionService: RbacPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user[0]; // Assuming user is an array as seen in controllers

    // Check if user exists and has an ID
    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super Admin bypass
    if (user.roles && user.roles.includes('super_admin')) {
      return true;
    }

    const orgId = user.orgId;
    if (!orgId) {
      throw new ForbiddenException('Organization context missing');
    }

    try {
      // Check if user has all required permissions
      const hasPermissions =
        await this.rbacPermissionService.userHasPermissions(
          user.id,
          requiredPermissions,
          orgId,
        );

      if (!hasPermissions) {
        throw new ForbiddenException('Insufficient permissions');
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException('Permission check failed');
    }
  }
}
