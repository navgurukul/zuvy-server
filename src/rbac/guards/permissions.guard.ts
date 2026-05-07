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

    const orgId = user.orgId;

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

      const hasResourceAccess =
        await this.rbacPermissionService.validateAssignedResourceAccess(
          user,
          this.extractResourceIds(request),
        );

      if (!hasResourceAccess) {
        throw new ForbiddenException(
          'You are not allowed to access this resource',
        );
      }

      return true;
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
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

  private extractResourceIds(request: any): {
    orgId?: number | null;
    bootcampId?: number;
    batchId?: number;
  } {
    const source = {
      ...(request.params || {}),
      ...(request.query || {}),
      ...(request.body || {}),
    };

    const controller = this.getControllerName(request);
    const canUseGenericIdAsBootcampId = [
      'bootcamp',
      'classes',
      'content',
      'instructor',
      'tracking',
    ].includes(controller);

    return {
      orgId: this.toNumber(source.orgId ?? source.organizationId),
      bootcampId: this.toNumber(
        source.bootcampId ??
          source.bootcamp_id ??
          (canUseGenericIdAsBootcampId ? source.id : undefined) ??
          source.bootcamp_id,
      ),
      batchId: this.toNumber(source.batchId ?? source.batch_id),
    };
  }

  private getControllerName(request: any): string {
    const path = String(request.route?.path || request.path || '')
      .replace(/^\/+/, '')
      .split('/')[0];
    return String(request.baseUrl || '').replace(/^\/+/, '') || path;
  }

  private toNumber(value: any): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const numericValue = Number(value);
    return Number.isNaN(numericValue) ? undefined : numericValue;
  }
}
