import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { helperVariable } from 'src/constants/helper';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user || !user[0].roles || !user[0].roles.includes(helperVariable.admin)) {
      throw new ForbiddenException('Access restricted to admins');
    }

    return true;
  }
}
