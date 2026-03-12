import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { db } from '../db/index';
import { eq, and } from 'drizzle-orm';
import { zuvyUserOrganizations, zuvyOrganizations } from '../../drizzle/schema';

@Injectable()
export class OrgAuthorizationGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user?.[0] || request.user;

    // If no user (unauthenticated/public route), skip org check
    if (!user || !user.id) {
      return true;
    }

    // Super Admin bypass - super admins can access any org
    if (user.roles && user.roles.includes('super_admin')) {
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

    // Check 1: Compare request orgId against the user's JWT orgId
    if (userOrgId !== null && requestOrgId !== userOrgId) {
      throw new UnauthorizedException(
        `Access denied: Your current session belongs to "${userOrgName}", but you are trying to access data of "${targetOrgName}"`,
      );
    }

    // Check 2: Verify user actually belongs to the target org in the database
    const userId = Number(user.id);
    const membership = await db
      .select({ id: zuvyUserOrganizations.id })
      .from(zuvyUserOrganizations)
      .where(
        and(
          eq(zuvyUserOrganizations.userId, userId),
          eq(zuvyUserOrganizations.organizationId, requestOrgId),
        ),
      )
      .limit(1);

    if (membership.length === 0) {
      throw new UnauthorizedException(
        `Access denied: You are not a member of "${targetOrgName}". You do not have permission to access its data.`,
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
}
