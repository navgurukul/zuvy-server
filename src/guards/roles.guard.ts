import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>(
      'roles',
      context.getHandler(),
    );
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // If user has no roles array, they are a student
    if (!user.roles) {
      return false;
    }

    const userRolesSet = new Set(user.roles);

    // Super Admin bypass
    if (userRolesSet.has('super_admin')) {
      return true;
    }

    // Check if user has any of the required roles
    return requiredRoles.some((role) => userRolesSet.has(role));
  }
}
