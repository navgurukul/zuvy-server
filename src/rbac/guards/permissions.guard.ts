import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RbacPermissionService } from '../rbac.permission.service';
import { SKIP_ORG_CHECK_KEY } from '../decorators/skip-org-check.decorator';
import { IS_PUBLIC_KEY } from 'src/auth/decorators/public.decorator';
import { db } from 'src/db/index';
import {
  zuvyBatches,
  zuvyBootcamps,
  zuvyUserRolesAssigned,
} from 'drizzle/schema';
import { and, eq } from 'drizzle-orm';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacPermissionService: RbacPermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Public routes skip JWT entirely — request.user is never set, so exit early
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user?.[0] || request.user;

    if (!user || !user.id) {
      throw new ForbiddenException('User not authenticated');
    }

    // Super Admin bypass
    if (user.roles && user.roles.includes('super_admin')) {
      return true;
    }

    const requestOrgId = await this.resolveRequestOrgId(request);
    const bootcampId = this.extractBootcampId(request);
    const batchId = this.extractBatchId(request);

    // Check whether this handler/controller opted out of the org check
    const skipOrgCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_ORG_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isInstructor =
      user.roles?.includes('instructor') &&
      !user.roles?.includes('admin') &&
      !user.roles?.includes('ops');

    // 1. Org-level check — applies to ALL roles except on @SkipOrgCheck() routes
    if (!skipOrgCheck && requestOrgId) {
      await this.ensureUserBelongsToOrg(
        user.id,
        requestOrgId,
        'No permission to access this organization',
      );
    }

    // 2. Course-level check for Instructor
    if (isInstructor && (bootcampId || batchId)) {
      await this.ensureInstructorHasBootcampAccess(
        user.id,
        bootcampId,
        requestOrgId,
        batchId,
      );
    }

    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    // If no permissions are required, allow access
    if (!requiredPermissions || requiredPermissions.length === 0) {
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

  private async resolveRequestOrgId(request: any): Promise<number | null> {
    const explicitOrgId = this.extractOrgId(request);
    if (explicitOrgId) {
      return explicitOrgId;
    }

    const bootcampId = this.extractBootcampId(request);
    if (!bootcampId) {
      return null;
    }

    const [bootcamp] = await db
      .select({ organizationId: zuvyBootcamps.organizationId })
      .from(zuvyBootcamps)
      .where(eq(zuvyBootcamps.id, bootcampId))
      .limit(1);

    return bootcamp?.organizationId ? Number(bootcamp.organizationId) : null;
  }

  private extractOrgId(request: any): number | null {
    const rawOrgId =
      request.params?.orgId ??
      request.params?.organizationId ??
      request.query?.orgId ??
      request.query?.organizationId ??
      request.body?.orgId ??
      request.body?.organizationId;

    const orgId = Number(rawOrgId);
    return Number.isFinite(orgId) && orgId > 0 ? orgId : null;
  }

  private extractBootcampId(request: any): number | null {
    const rawBootcampId =
      request.params?.bootcampId ??
      request.params?.bootcamp_id ??
      request.query?.bootcampId ??
      request.query?.bootcamp_id ??
      request.body?.bootcampId ??
      request.body?.bootcamp_id ??
      (this.isBootcampRoute(request) ? request.params?.id : undefined);

    const bootcampId = Number(rawBootcampId);
    return Number.isFinite(bootcampId) && bootcampId > 0 ? bootcampId : null;
  }

  private isBootcampRoute(request: any): boolean {
    return request.baseUrl?.split('/').includes('bootcamp');
  }

  private extractBatchId(request: any): number | null {
    const rawBatchId =
      request.params?.batchId ??
      request.params?.batch_id ??
      request.query?.batchId ??
      request.query?.batch_id ??
      request.body?.batchId ??
      request.body?.batch_id;

    const batchId = Number(rawBatchId);
    return Number.isFinite(batchId) && batchId > 0 ? batchId : null;
  }

  private async ensureUserBelongsToOrg(
    userId: number | string | bigint,
    orgId: number,
    message = 'No permission to access this organization',
  ): Promise<void> {
    const [membership] = await db
      .select({ id: zuvyUserRolesAssigned.id })
      .from(zuvyUserRolesAssigned)
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, this.toBigIntId(userId)),
          eq(zuvyUserRolesAssigned.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!membership) {
      throw new ForbiddenException(message);
    }
  }

  private toBigIntId(userId: number | string | bigint): bigint {
    return typeof userId === 'bigint' ? userId : BigInt(userId);
  }

  private async ensureInstructorHasBootcampAccess(
    userId: number | string | bigint,
    bootcampId: number | null,
    requestOrgId: number | null,
    batchId: number | null = null,
  ): Promise<void> {
    let resolvedBootcampId = bootcampId;
    let resolvedOrgId: number | null = null;

    if (batchId) {
      // Resolve bootcampId and instructorId directly from the batch
      const [batch] = await db
        .select({
          id: zuvyBatches.id,
          bootcampId: zuvyBatches.bootcampId,
          instructorId: zuvyBatches.instructorId,
        })
        .from(zuvyBatches)
        .where(eq(zuvyBatches.id, batchId))
        .limit(1);

      if (!batch) {
        // Batch not found — nothing to enforce
        return;
      }

      // If a bootcampId is also in the request, make sure it matches the batch's bootcamp
      if (resolvedBootcampId && batch.bootcampId !== resolvedBootcampId) {
        throw new ForbiddenException('Unauthorized access');
      }

      resolvedBootcampId = batch.bootcampId;

      // Check: is this instructor assigned to this specific batch?
      if (Number(batch.instructorId) !== Number(userId)) {
        throw new ForbiddenException('Unauthorized access');
      }
    }

    if (!resolvedBootcampId) {
      // Nothing to validate against
      return;
    }

    // Resolve the org from the bootcamp
    const [bootcamp] = await db
      .select({ organizationId: zuvyBootcamps.organizationId })
      .from(zuvyBootcamps)
      .where(eq(zuvyBootcamps.id, resolvedBootcampId))
      .limit(1);

    if (!bootcamp) {
      // Bootcamp not found — nothing to enforce
      return;
    }

    resolvedOrgId = Number(bootcamp.organizationId);

    // If the request carries an explicit orgId, make sure it matches the bootcamp's org
    if (requestOrgId && resolvedOrgId !== Number(requestOrgId)) {
      throw new ForbiddenException('No permission to access this organization');
    }

    // Step 1: verify instructor belongs to the bootcamp's org
    await this.ensureUserBelongsToOrg(
      userId,
      resolvedOrgId,
      'No permission to access this organization',
    );

    // Step 2: if no specific batchId was given, verify instructor has at least one batch in this bootcamp
    if (!batchId) {
      const [assignedBatch] = await db
        .select({ id: zuvyBatches.id })
        .from(zuvyBatches)
        .where(
          and(
            eq(zuvyBatches.bootcampId, resolvedBootcampId),
            eq(zuvyBatches.instructorId, Number(userId)),
          ),
        )
        .limit(1);

      if (!assignedBatch) {
        throw new ForbiddenException('Unauthorized access');
      }
    }
  }
}
