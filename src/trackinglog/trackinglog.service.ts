import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { CreateTrackinglogDto } from './dto/create-trackinglog.dto';
import { QueryTrackinglogDto } from './dto/query-trackinglog.dto';
import { db } from '../db';
import {
  zuvyTrackingLogs,
  users,
  zuvyPermissions,
  zuvyResources,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  zuvyUserOrganizations,
  zuvyBatches,
  zuvyCourseModules,
} from '../../drizzle/schema';
import { eq, and, desc, sql, lt, isNull, or } from 'drizzle-orm';

@Injectable()
export class TrackinglogService {
  /**
   * Returns both permission ID and the resource ID from zuvy_resources table
   */
  private async getPermissionAndResourceId(
    permissionName: string,
  ): Promise<{ permissionId: number | null; resourceId: number | null }> {
    try {
      // Permission name format: "createCourse", "editBootcamp", "enrollStudent", "createChapter" etc.
      // Extract action and resource from permission name
      const match = permissionName.match(
        /^(create|edit|delete|view|publish|lock|assign|download|reattempt|enroll|unenroll|mark|submit|grade|approve|reject)(.+)$/i,
      );
      if (!match) {
        return { permissionId: null, resourceId: null };
      }

      const [, actionRaw, resourceName] = match;
      const action = actionRaw.toLowerCase(); // Normalize action to lowercase
      const resourceKey = resourceName.toLowerCase(); // "chapter", "course", "bootcamp", etc.
      // Convert camelCase to space-separated for keys like "mentor dashboard"
      const resourceKeySpaced = resourceName
        .replace(/([A-Z])/g, ' $1')
        .trim()
        .toLowerCase();

      // First, find the resource by key (e.g., "chapter")
      // Try both lowercase and space-separated camelCase versions (e.g. "mentordashboard" and "mentor dashboard")
      // Note: only select 'id' to avoid selecting columns (like org_id) that may not exist in the DB
      const resource = await db
        .select({ id: zuvyResources.id })
        .from(zuvyResources)
        .where(
          sql`LOWER(${zuvyResources.key}) = ${resourceKey} OR LOWER(${zuvyResources.key}) = ${resourceKeySpaced}`,
        )
        .limit(1);

      if (resource.length === 0) {
        // Try alternative names
        const alternativeKeys = ['content', 'module', 'topic'];

        for (const altKey of alternativeKeys) {
          const altResource = await db
            .select({ id: zuvyResources.id })
            .from(zuvyResources)
            .where(sql`LOWER(${zuvyResources.key}) = ${altKey.toLowerCase()}`)
            .limit(1);

          if (altResource.length > 0) {
            const resourceId = altResource[0].id;

            // Now find permission with this resource
            const permission = await db
              .select()
              .from(zuvyPermissions)
              .where(
                and(
                  sql`LOWER(${zuvyPermissions.name}) = ${action}`,
                  eq(zuvyPermissions.resourcesId, resourceId),
                ),
              )
              .limit(1);

            if (permission.length > 0) {
              return {
                permissionId: permission[0].id,
                resourceId: resourceId,
              };
            }
          }
        }
        return { permissionId: null, resourceId: null };
      }

      const resourceId = resource[0].id;

      // Now find the permission with action + resourceId
      const permission = await db
        .select()
        .from(zuvyPermissions)
        .where(
          and(
            sql`LOWER(${zuvyPermissions.name}) = ${action}`,
            eq(zuvyPermissions.resourcesId, resourceId),
          ),
        )
        .limit(1);

      if (permission.length > 0) {
        return {
          permissionId: permission[0].id,
          resourceId: resourceId,
        };
      } else {
        return {
          permissionId: null,
          resourceId: resourceId, // Return resource ID even if permission not found
        };
      }
    } catch (error) {
      console.error('[DEBUG] Error in getPermissionAndResourceId:', error);
      return { permissionId: null, resourceId: null };
    }
  }
  /**
   * Create a new tracking log entry
   */
  async create(createTrackinglogDto: CreateTrackinglogDto) {
    try {
      const [trackingLog] = await db
        .insert(zuvyTrackingLogs)
        .values({
          actorUserId: createTrackinglogDto.actorUserId,
          action: createTrackinglogDto.action,
          resourceType: createTrackinglogDto.resourceType
            ? createTrackinglogDto.resourceType.charAt(0).toUpperCase() +
              createTrackinglogDto.resourceType.slice(1)
            : createTrackinglogDto.resourceType,
          description: createTrackinglogDto.description,
          orgId: createTrackinglogDto.orgId,
          bootcampId: createTrackinglogDto.bootcampId,
          chapterId: createTrackinglogDto.chapterId,
          moduleId: createTrackinglogDto.moduleId,
          moduleName: createTrackinglogDto.moduleName,
          permissionId: createTrackinglogDto.permissionId,
          resourceId: createTrackinglogDto.resourceId,
          status: createTrackinglogDto.status || 'success', // Default to 'success' if not provided
        } as any)
        .returning();

      return {
        success: true,
        message: 'Tracking log created successfully',
        data: trackingLog,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to create tracking log',
        (error as Error).message,
      );
    }
  }

  /**
   * Find all tracking logs with filtering and pagination
   */
  async findAll(query: QueryTrackinglogDto, userRole?: string) {
    try {
      let {
        orgId,
        actorUserId,
        action,
        role,
        status,
        offset,
        limit,
        timeRange,
        search,
      } = query;

      // Convert to numbers with defaults
      offset = Number(offset) || 0;
      limit = Number(limit) || 100;

      // Clean up action - remove invalid values
      if (action === '--' || action === '' || !action || action.trim() === '') {
        action = undefined;
      }

      // Build filter conditions
      const conditions: any[] = [];

      if (orgId !== undefined && orgId !== null) {
        const numericOrgId = Number(orgId);
        // Also include logs where orgId is NULL (super_admin actions stored without org context)
        conditions.push(
          or(
            eq(zuvyTrackingLogs.orgId, numericOrgId),
            isNull(zuvyTrackingLogs.orgId),
          ),
        );
      }

      if (actorUserId !== undefined && actorUserId !== null) {
        const numericActorUserId = Number(actorUserId);
        conditions.push(eq(zuvyTrackingLogs.actorUserId, numericActorUserId));
      }

      if (
        action !== undefined &&
        action !== null &&
        action !== '' &&
        action !== '--'
      ) {
        // Support both exact match and prefix match:
        // "login"  → matches exact "login" OR prefix "login_*"
        // "create" → matches exact "create" OR prefix "create_*" (create_course etc.)
        // "create_course" → exact match only
        if (action.includes('_')) {
          conditions.push(eq(zuvyTrackingLogs.action, action));
        } else {
          const a = action.toLowerCase();
          conditions.push(
            sql`(LOWER(${zuvyTrackingLogs.action}) = ${a} OR LOWER(${zuvyTrackingLogs.action}) LIKE ${a + '_%'})`,
          );
        }
      }

      // Role filter - filter by user role from zuvyUserRolesAssigned table
      if (role !== undefined && role !== null && role !== '' && role !== '--') {
        // Get all role IDs with this name (each org has its own role record)
        const roleRecords = await db
          .select({ id: zuvyUserRoles.id })
          .from(zuvyUserRoles)
          .where(eq(zuvyUserRoles.name, role));

        if (roleRecords.length > 0) {
          const roleIds = roleRecords.map((r) => r.id);

          // Get all user IDs assigned to any of these role IDs
          const usersWithRole = await db
            .select({ userId: zuvyUserRolesAssigned.userId })
            .from(zuvyUserRolesAssigned)
            .where(
              sql`${zuvyUserRolesAssigned.roleId} IN (${sql.join(
                roleIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            );

          const userIds = [
            ...new Set(usersWithRole.map((u) => Number(u.userId))),
          ];

          if (userIds.length > 0) {
            conditions.push(
              sql`${zuvyTrackingLogs.actorUserId} IN (${sql.join(
                userIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            );
          } else {
            conditions.push(sql`1 = 0`);
          }
        } else {
          conditions.push(sql`1 = 0`);
        }
      }

      // Status filter - filter by status (success, failed, pending, or all)
      if (
        status !== undefined &&
        status !== null &&
        status !== '' &&
        status !== '--' &&
        status.toLowerCase() !== 'all'
      ) {
        conditions.push(eq(zuvyTrackingLogs.status, status));
      }

      // ── timeRange dropdown — overrides manual startDate/endDate ─────────────
      if (timeRange && timeRange !== 'all') {
        const now = new Date();
        let from: Date | null = null;
        if (timeRange === 'today') {
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        } else if (timeRange === 'yesterday') {
          const start = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1,
          );
          const end = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          conditions.push(
            sql`${zuvyTrackingLogs.createdAt} >= ${start.toISOString()}`,
          );
          conditions.push(
            sql`${zuvyTrackingLogs.createdAt} < ${end.toISOString()}`,
          );
        } else if (timeRange === 'past7days') {
          from = new Date(now);
          from.setDate(now.getDate() - 7);
        } else if (timeRange === 'past30days') {
          from = new Date(now);
          from.setDate(now.getDate() - 30);
        }
        if (from) {
          conditions.push(
            sql`${zuvyTrackingLogs.createdAt} >= ${from.toISOString()}`,
          );
        }
      }

      // ── Full-text search — split by spaces/underscores so "create_chapter",
      // "create chapter", or even "creat chapt" all return relevant results.
      // Each word is matched independently (AND between words, OR across fields).
      if (search && search.trim() !== '') {
        const words = search
          .trim()
          .toLowerCase()
          .split(/[\s_]+/) // split on space or underscore
          .map((w) => w.trim())
          .filter((w) => w.length > 0);

        for (const word of words) {
          const term = `%${word}%`;
          conditions.push(
            sql`(
              LOWER(${zuvyTrackingLogs.action}) LIKE ${term} OR
              LOWER(${zuvyTrackingLogs.resourceType}) LIKE ${term} OR
              LOWER(${zuvyTrackingLogs.description}) LIKE ${term} OR
              LOWER(${users.name}) LIKE ${term}
            )`,
          );
        }
      }

      // Build where clause
      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      // Fetch logs with pagination
      const [logs, totalResult] = await Promise.all([
        db
          .select({
            id: zuvyTrackingLogs.id,
            orgId: zuvyTrackingLogs.orgId,
            actorUserId: zuvyTrackingLogs.actorUserId,
            actorName: users.name,
            actorEmail: users.email,
            bootcampId: zuvyTrackingLogs.bootcampId,
            chapterId: zuvyTrackingLogs.chapterId,
            moduleId: zuvyTrackingLogs.moduleId,
            moduleName: zuvyTrackingLogs.moduleName,
            permissionId: zuvyTrackingLogs.permissionId,
            resourceId: zuvyTrackingLogs.resourceId,
            action: zuvyTrackingLogs.action,
            resourceType: zuvyTrackingLogs.resourceType,
            description: zuvyTrackingLogs.description,
            createdAt: zuvyTrackingLogs.createdAt,
            status: zuvyTrackingLogs.status,
          })
          .from(zuvyTrackingLogs)
          .leftJoin(users, eq(zuvyTrackingLogs.actorUserId, users.id))
          .where(whereClause)
          .orderBy(desc(zuvyTrackingLogs.createdAt))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(zuvyTrackingLogs)
          .leftJoin(users, eq(zuvyTrackingLogs.actorUserId, users.id))
          .where(whereClause),
      ]);

      // Fetch roles for each actor in the logs
      const logsWithRoles = await Promise.all(
        logs.map(async (log) => {
          const userRoles = await db
            .select({
              roleName: zuvyUserRoles.name,
              roleId: zuvyUserRoles.id,
            })
            .from(zuvyUserRolesAssigned)
            .leftJoin(
              zuvyUserRoles,
              eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
            )
            .where(sql`${zuvyUserRolesAssigned.userId} = ${log.actorUserId}`);

          return {
            ...log,
            actorRoles: userRoles.map((r) => r.roleName).filter(Boolean),
          };
        }),
      );

      const total = Number(totalResult?.[0]?.count ?? 0);

      return {
        success: true,
        message: 'Tracking logs fetched successfully',
        data: {
          logs: logsWithRoles,
          pagination: {
            offset,
            limit,
            total,
          },
        },
      };
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch tracking logs',
        (error as Error).message,
      );
    }
  }

  /**
   * Helper method to log actions with human-readable descriptions
   * Examples:
   * - "Arunesh Dhar has created a new course named: JavaScript Course"
   * - "John has assigned instructor role to Sarah"
   */
  async logAction(params: {
    actorUserId: number;
    actorName: string;
    action: string;
    resourceType: string;
    resourceName?: string;
    targetUserName?: string;
    orgId?: number;
    bootcampId?: number;
    batchId?: number;
    permissionId?: number;
    permissionName?: string;
    chapterId?: number;
    moduleId?: number;
    moduleName?: string;
    customDescription?: string;
    status?: string;
  }): Promise<void> {
    const maxRetries = 2;
    let lastError: any;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        await this.performLogAction(params);
        return; // Success - exit early
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          // Wait before retry: 100ms, 200ms
          await new Promise((resolve) =>
            setTimeout(resolve, 100 * (attempt + 1)),
          );
        }
      }
    }

    // After all retries failed, log but DON'T throw
    // This ensures logging failures never break API responses
    console.error(
      '[TrackingLog] Failed to save log after retries:',
      lastError?.message || lastError,
    );
  }

  /**
   * Internal method to perform the actual log action
   */
  private async performLogAction(params: {
    actorUserId: number;
    actorName: string;
    action: string;
    resourceType: string;
    resourceName?: string;
    targetUserName?: string;
    orgId?: number;
    bootcampId?: number;
    batchId?: number;
    permissionId?: number;
    permissionName?: string;
    chapterId?: number;
    moduleId?: number;
    moduleName?: string;
    customDescription?: string;
    status?: string;
  }): Promise<void> {
    try {
      const {
        actorUserId,
        actorName,
        action,
        resourceType,
        resourceName,
        targetUserName,
        orgId,
        bootcampId,
        batchId,
        permissionId,
        permissionName,
        chapterId,
        moduleId,
        moduleName,
        customDescription,
        status,
      } = params;

      // Get permission ID and resource ID if not provided but permissionName is provided
      let finalPermissionId = permissionId;
      let finalResourceId = null;

      // If orgId is missing but actorUserId is known, resolve it from the DB.
      // This handles @Public() routes where request.user is null and the JWT
      // decode fallback in the interceptor couldn't get an orgId.
      let resolvedOrgId = orgId;
      if (
        (resolvedOrgId === null || resolvedOrgId === undefined) &&
        actorUserId
      ) {
        try {
          const orgRow = await db
            .select({ organizationId: zuvyUserOrganizations.organizationId })
            .from(zuvyUserOrganizations)
            .where(eq(zuvyUserOrganizations.userId, actorUserId))
            .limit(1);
          if (orgRow.length > 0) {
            resolvedOrgId = orgRow[0].organizationId;
          }
        } catch {
          // ignore — orgId stays null
        }
      }

      // If bootcampId is missing but batchId is known, resolve it from the DB.
      // Covers cases where the service fails early before returning data (e.g.
      // validation errors) so result.data is never populated.
      let resolvedBootcampId = bootcampId;
      if (
        (resolvedBootcampId === null || resolvedBootcampId === undefined) &&
        batchId
      ) {
        try {
          const batchRow = await db
            .select({ bootcampId: zuvyBatches.bootcampId })
            .from(zuvyBatches)
            .where(eq(zuvyBatches.id, batchId))
            .limit(1);
          if (batchRow.length > 0) {
            resolvedBootcampId = batchRow[0].bootcampId;
          }
        } catch {
          // ignore — bootcampId stays null
        }
      }

      if (!finalPermissionId && permissionName) {
        const result = await this.getPermissionAndResourceId(permissionName);
        finalPermissionId = result.permissionId;
        finalResourceId = result.resourceId;
      }

      let resolvedModuleName = moduleName;
      if (!resolvedModuleName && moduleId) {
        try {
          const moduleRow = await db
            .select({ name: zuvyCourseModules.name })
            .from(zuvyCourseModules)
            .where(eq(zuvyCourseModules.id, moduleId))
            .limit(1);
          if (moduleRow.length > 0) {
            resolvedModuleName = moduleRow[0].name;
          }
        } catch {
          // ignore — moduleName stays null
        }
      }

      // Use custom description if provided (always sent by TrackActionInterceptor via buildSmartDescription)
      // Fallback is a simple generic sentence for direct service calls (rare edge case)
      const baseDescription =
        customDescription ||
        `${actorName} performed ${action} on ${resourceType}${resourceName ? ': ' + resourceName : ''}`;
      const description =
        resolvedModuleName && resourceType?.toLowerCase() === 'chapter'
          ? `${baseDescription} | Module: ${resolvedModuleName}`
          : baseDescription;

      const createDto: CreateTrackinglogDto = {
        actorUserId,
        action,
        resourceType,
        description,
        orgId: resolvedOrgId,
        bootcampId: resolvedBootcampId,
        chapterId,
        moduleId,
        moduleName: resolvedModuleName,
        permissionId: finalPermissionId,
        resourceId: finalResourceId,
        status: status || 'success',
      };

      await this.create(createDto);
    } catch (error) {
      // Re-throw to be caught by retry logic
      throw error;
    }
  }

  /**
   * Scheduled task to delete tracking logs older than 30 days
   * Runs every 6 hours
   */
  @Cron('0 */6 * * *') // Runs every 6 hours
  async deleteOldLogs() {
    try {
      // Calculate date 30 days ago
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Delete logs older than 30 days
      const result = await db
        .delete(zuvyTrackingLogs)
        .where(lt(zuvyTrackingLogs.createdAt, thirtyDaysAgo.toISOString()))
        .returning({ id: zuvyTrackingLogs.id });

      const deletedCount = result.length;

      return {
        success: true,
        message: `Deleted ${deletedCount} tracking logs older than 30 days`,
        deletedCount,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to delete old tracking logs',
        (error as Error).message,
      );
    }
  }
}
