import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacPermissionService } from '../rbac.permission.service';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { ResourceList } from '../utility';

const ROUTE_RESOURCE_ALIASES: Record<string, keyof typeof ResourceList> = {
  admin: 'submission',
  'ai-assessment': 'submission',
  auditlog: 'rolesandpermission',
  batch: 'batch',
  batches: 'batch',
  bootcamp: 'course',
  classes: 'batch',
  codingPlatform: 'codingquestion',
  content: 'course',
  instructor: 'course',
  level: 'student',
  org: 'organization',
  permissions: 'rolesandpermission',
  questions: 'question',
  'questions-by-llm': 'question',
  resources: 'rolesandpermission',
  rbac: 'rolesandpermission',
  roles: 'rolesandpermission',
  student: 'student',
  submission: 'submission',
  'super-admin': 'organization',
  tracking: 'course',
  trackinglog: 'rolesandpermission',
  users: 'user',
};

const WRITE_WORDS = [
  'assign',
  'approve',
  'book',
  'cancel',
  'complete',
  'create',
  'edit',
  'mark',
  'merge',
  'process',
  'reassign',
  'reschedule',
  'submit',
  'update',
  'upload',
];

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacPermissionService: RbacPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    if (request.originalUrl?.startsWith('/webhooks/zoom')) {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.getRequiredPermissions(context, request);

    if (!requiredPermissions.length) {
      return true;
    }

    const user = Array.isArray(request.user) ? request.user[0] : request.user;

    // Check if user exists and has an ID
    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super Admin bypass
    if (user.roles && user.roles.includes('super_admin')) {
      return true;
    }

    // Allow users to see their own organizations
    const path = String(request.originalUrl || request.url || '').toLowerCase();
    if (
      path.includes('getorgbyuserid') &&
      request.params.userId &&
      Number(request.params.userId) === Number(user.id)
    ) {
      return true;
    }

    const requestOrgId = this.extractOrgId(request);
    const orgId = requestOrgId !== null ? requestOrgId : user.orgId;

    try {
      // Check if user has all required permissions
      const hasPermissions =
        await this.rbacPermissionService.userHasPermissions(
          Number(user.id),
          requiredPermissions,
          orgId ? Number(orgId) : null,
        );

      if (!hasPermissions) {
        throw new ForbiddenException(
          'You do not have permission to perform this action',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw error;
    }
  }

  private getRequiredPermissions(
    context: ExecutionContext,
    request: any,
  ): string[] {
    const decoratedPermissions =
      this.reflector.getAllAndOverride<string[]>('permissions', [
        context.getHandler(),
        context.getClass(),
      ]) || [];

    if (decoratedPermissions.length) {
      return decoratedPermissions;
    }

    const resourceKey = this.inferResourceKey(request);
    if (!resourceKey) return [];

    const action = this.inferAction(request);
    const permission =
      ResourceList[resourceKey]?.[action] ||
      (action === 'assign' ? ResourceList[resourceKey]?.edit : undefined);
    return permission ? [permission] : [];
  }

  private inferResourceKey(request: any): keyof typeof ResourceList | null {
    const path = String(request.route?.path || request.path || '')
      .replace(/^\/+/, '')
      .split('/')[0];
    const basePath = String(request.baseUrl || '').replace(/^\/+/, '');
    const controller = basePath || path;
    return ROUTE_RESOURCE_ALIASES[controller] || null;
  }

  private inferAction(
    request: any,
  ): 'read' | 'create' | 'edit' | 'delete' | 'assign' {
    const path = String(request.originalUrl || request.url || '').toLowerCase();
    if (path.includes('assign') || path.includes('reassign')) return 'assign';
    if (request.method === 'GET') return 'read';
    if (request.method === 'DELETE') return 'delete';
    if (request.method === 'PUT' || request.method === 'PATCH') return 'edit';
    if (WRITE_WORDS.some((word) => path.includes(word))) return 'edit';
    return 'create';
  }

  private extractOrgId(request: any): number | null {
    if (request.params?.orgId) {
      return Number(request.params.orgId);
    }
    if (request.query?.orgId) {
      return Number(request.query.orgId);
    }
    if (request.body?.organizationId) {
      return Number(request.body.organizationId);
    }
    if (request.body?.orgId) {
      return Number(request.body.orgId);
    }
    return null;
  }
}
