import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { db } from '../db/index';
import { eq, and } from 'drizzle-orm';
import {
  zuvyBatchEnrollments,
  zuvyBootcamps,
  zuvyUserRolesAssigned,
  zuvyOrganizations,
} from '../../drizzle/schema';
import { SKIP_ORG_CHECK_KEY } from 'src/rbac/decorators/skip-org-check.decorator';

@Injectable()
export class OrgAuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const skipOrgCheck = this.reflector.getAllAndOverride<boolean>(
      SKIP_ORG_CHECK_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (skipOrgCheck) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user?.[0] || request.user;

    // If no user (unauthenticated/public route), skip org check
    if (!user || !user.id) {
      return true;
    }

    const userRoles = Array.isArray(user.roles) ? user.roles : [];
    const userRolesSet = new Set<string>(userRoles);

    // Super Admin bypass - super admins can access any org
    if (userRolesSet.has('super_admin')) {
      return true;
    }

    const assessmentBootcampId = this.extractBootcampId(request);
    if (
      this.isStudentAssessmentRequest(userRolesSet, request) &&
      (!assessmentBootcampId ||
        (await this.isStudentEnrolledInBootcamp(user, assessmentBootcampId)))
    ) {
      return true;
    }

    // Collect orgId from all possible sources in the request
    const requestOrgId = this.extractOrgId(request);

    // If no orgId found in the request, skip the check
    if (requestOrgId === null) {
      return true;
    }

    const userOrgId = user.orgId ? Number(user.orgId) : null;
    const userOrgName = user.orgName || `orgId ${userOrgId}`;

    // Fetch target org name from DB
    const [targetOrg] = await db
      .select({ title: zuvyOrganizations.title })
      .from(zuvyOrganizations)
      .where(eq(zuvyOrganizations.id, requestOrgId))
      .limit(1);
    const targetOrgName = targetOrg?.title || `orgId ${requestOrgId}`;

    // Check: Verify user actually belongs to the target org in the database
    const userId = Number(user.id);
    const membership = await db
      .select({ id: zuvyUserRolesAssigned.id })
      .from(zuvyUserRolesAssigned)
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
          eq(zuvyUserRolesAssigned.organizationId, requestOrgId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      if (await this.isStudentEnrolledInOrg(user, userRolesSet, requestOrgId)) {
        return true;
      }

      throw new ForbiddenException(
        `This page is accessible only to ${targetOrgName}. You are currently associated with the ${userOrgName} and do not have permission to view this page.`,
      );
    }

    return true;
  }

  /**
   * Extracts orgId from request params, query, or body.
   * Returns the numeric orgId if found, or null if not present.
   */
  private extractOrgId(request: any): number | null {
    // Check URL params (e.g., /bootcamp/all/:orgId)
    if (request.params?.orgId) {
      return Number(request.params.orgId);
    }

    // Check query params (e.g., ?orgId=15)
    if (request.query?.orgId) {
      return Number(request.query.orgId);
    }

    // Check request body (e.g., { organizationId: 15 })
    if (request.body?.organizationId) {
      return Number(request.body.organizationId);
    }

    // Check request body for orgId field as well
    if (request.body?.orgId) {
      return Number(request.body.orgId);
    }

    return null;
  }

  private extractBootcampId(request: any): number | null {
    const rawBootcampId =
      request.params?.bootcampId ??
      request.params?.bootcamp_id ??
      request.query?.bootcampId ??
      request.query?.bootcamp_id ??
      request.body?.bootcampId ??
      request.body?.bootcamp_id;

    const bootcampId = Number(rawBootcampId);
    return Number.isFinite(bootcampId) && bootcampId > 0 ? bootcampId : null;
  }

  private async isStudentEnrolledInOrg(
    user: any,
    userRolesSet: Set<string>,
    orgId: number,
  ): Promise<boolean> {
    const isStudent = userRolesSet.size === 0 || userRolesSet.has('student');
    const hasOrgRole = userRolesSet.has('student')
      ? userRolesSet.size > 1
      : userRolesSet.size > 0;

    if (!isStudent || hasOrgRole) {
      return false;
    }

    const [enrollment] = await db
      .select({ id: zuvyBatchEnrollments.id })
      .from(zuvyBatchEnrollments)
      .innerJoin(
        zuvyBootcamps,
        eq(zuvyBatchEnrollments.bootcampId, zuvyBootcamps.id),
      )
      .where(
        and(
          eq(zuvyBatchEnrollments.userId, BigInt(user.id)),
          eq(zuvyBootcamps.organizationId, orgId),
        ),
      )
      .limit(1);

    return Boolean(enrollment);
  }

  private async isStudentEnrolledInBootcamp(
    user: any,
    bootcampId: number,
  ): Promise<boolean> {
    const [enrollment] = await db
      .select({ id: zuvyBatchEnrollments.id })
      .from(zuvyBatchEnrollments)
      .where(
        and(
          eq(zuvyBatchEnrollments.userId, BigInt(user.id)),
          eq(zuvyBatchEnrollments.bootcampId, bootcampId),
        ),
      )
      .limit(1);

    return Boolean(enrollment);
  }

  private isStudentAssessmentRequest(
    userRolesSet: Set<string>,
    request: any,
  ): boolean {
    const isStudent = userRolesSet.size === 0 || userRolesSet.has('student');
    const hasOrgRole = userRolesSet.has('student')
      ? userRolesSet.size > 1
      : userRolesSet.size > 0;

    if (!isStudent || hasOrgRole) {
      return false;
    }

    const path = String(request.originalUrl || request.url || '')
      .split('?')[0]
      .toLowerCase();

    if (path.startsWith('/student/')) {
      return path.startsWith('/student/assessment/');
    }
    if (path.startsWith('/content/')) {
      return (
        path.startsWith('/content/students/assessmentid=') ||
        path.startsWith('/content/startassessmentforstudent/') ||
        path.startsWith('/content/assessmentdetailsofquiz/') ||
        path.startsWith('/content/assessmentdetailsofopenended/')
      );
    }
    if (path.startsWith('/submission/')) {
      return (
        path.startsWith('/submission/assessment/submit') ||
        path.startsWith('/submission/quiz/assessmentsubmissionid=') ||
        path.startsWith('/submission/openended/assessmentsubmissionid=') ||
        path.startsWith('/submission/assessment/properting')
      );
    }
    return false;
  }
}
