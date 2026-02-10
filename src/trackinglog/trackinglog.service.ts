import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
} from '../../drizzle/schema';
import { eq, and, desc, sql, lt, inArray } from 'drizzle-orm';

@Injectable()
export class TrackinglogService {
  /**
   * Get permission ID and resource ID from permission name
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
        console.log(`[DEBUG] No match for permission name: ${permissionName}`);
        return { permissionId: null, resourceId: null };
      }

      const [, actionRaw, resourceName] = match;
      const action = actionRaw.toLowerCase(); // Normalize action to lowercase
      const resourceKey = resourceName.toLowerCase(); // "chapter", "course", "bootcamp", etc.

      console.log(
        `[DEBUG] Searching - action: "${action}", resourceKey: "${resourceKey}"`,
      );

      // First, find the resource by key (e.g., "chapter")
      // Try both lowercase and capitalized versions since DB might store with different casing
      const resource = await db
        .select()
        .from(zuvyResources)
        .where(sql`LOWER(${zuvyResources.key}) = ${resourceKey}`)
        .limit(1);

      console.log(
        `[DEBUG] Resource search result for "${resourceKey}":`,
        resource.length > 0 ? `Found ID: ${resource[0].id}` : 'NOT FOUND',
      );

      if (resource.length === 0) {
        // Try alternative names
        const alternativeKeys = ['content', 'module', 'topic'];
        console.log(`[DEBUG] Trying alternatives:`, alternativeKeys);

        for (const altKey of alternativeKeys) {
          const altResource = await db
            .select()
            .from(zuvyResources)
            .where(sql`LOWER(${zuvyResources.key}) = ${altKey.toLowerCase()}`)
            .limit(1);

          console.log(
            `[DEBUG] Alternative "${altKey}":`,
            altResource.length > 0
              ? `Found ID: ${altResource[0].id}`
              : 'NOT FOUND',
          );

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

            console.log(
              `[DEBUG] Permission for action="${action}" + resourceId=${resourceId}:`,
              permission.length > 0
                ? `Found ID: ${permission[0].id}`
                : 'NOT FOUND',
            );

            if (permission.length > 0) {
              return {
                permissionId: permission[0].id,
                resourceId: resourceId,
              };
            }
          }
        }
        console.log(`[DEBUG] No alternatives worked, returning null`);
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

      console.log(
        `[DEBUG] Permission for action="${action}" + resourceId=${resourceId}:`,
        permission.length > 0 ? `Found ID: ${permission[0].id}` : 'NOT FOUND',
      );

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
          resourceType: createTrackinglogDto.resourceType,
          description: createTrackinglogDto.description,
          orgId: createTrackinglogDto.orgId,
          bootcampId: createTrackinglogDto.bootcampId,
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
        error.message,
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
        resourceType,
        role,
        status,
        startDate,
        endDate,
        offset,
        limit,
      } = query;

      // Convert to numbers with defaults
      offset = Number(offset) || 0;
      limit = Number(limit) || 100;

      // Clean up action and resourceType - remove invalid values
      if (action === '--' || action === '' || !action || action.trim() === '') {
        action = undefined;
      }
      if (
        resourceType === '--' ||
        resourceType === '' ||
        !resourceType ||
        resourceType.trim() === ''
      ) {
        resourceType = undefined;
      }

      // Build filter conditions
      const conditions: any[] = [];

      if (orgId !== undefined && orgId !== null) {
        const numericOrgId = Number(orgId);
        conditions.push(eq(zuvyTrackingLogs.orgId, numericOrgId));
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
        // Support both exact match and partial match
        // If action contains underscore, use exact match (e.g., "create_course")
        // Otherwise use LIKE pattern (e.g., "create" matches "create_*")
        if (action.includes('_')) {
          conditions.push(eq(zuvyTrackingLogs.action, action));
        } else {
          // Lowercase action names stored in DB like "create_course", so match prefix
          conditions.push(
            sql`LOWER(${zuvyTrackingLogs.action}) LIKE ${action.toLowerCase() + '_%'}`,
          );
        }
      }

      if (
        resourceType !== undefined &&
        resourceType !== null &&
        resourceType !== '' &&
        resourceType !== '--'
      ) {
        conditions.push(eq(zuvyTrackingLogs.resourceType, resourceType));
      }

      // Role filter - filter by user role from zuvyUserRolesAssigned table
      if (role !== undefined && role !== null && role !== '' && role !== '--') {
        // First, get the role ID from role name
        const roleRecord = await db
          .select({ id: zuvyUserRoles.id })
          .from(zuvyUserRoles)
          .where(eq(zuvyUserRoles.name, role))
          .limit(1);

        if (roleRecord.length > 0) {
          const roleId = roleRecord[0].id;

          // Get all user IDs with this role
          const usersWithRole = await db
            .select({ userId: zuvyUserRolesAssigned.userId })
            .from(zuvyUserRolesAssigned)
            .where(eq(zuvyUserRolesAssigned.roleId, roleId));

          const userIds = usersWithRole.map((u) => Number(u.userId));

          if (userIds.length > 0) {
            // Filter tracking logs by these user IDs using SQL IN clause
            conditions.push(
              sql`${zuvyTrackingLogs.actorUserId} IN (${sql.join(
                userIds.map((id) => sql`${id}`),
                sql`, `,
              )})`,
            );
          } else {
            // No users found with this role - return empty result
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

      if (startDate) {
        conditions.push(sql`${zuvyTrackingLogs.createdAt} >= ${startDate}`);
      }

      if (endDate) {
        // Add one day to endDate to include the entire end date
        const endDateTime = new Date(endDate);
        endDateTime.setDate(endDateTime.getDate() + 1);
        conditions.push(
          sql`${zuvyTrackingLogs.createdAt} < ${endDateTime.toISOString()}`,
        );
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
        error.message,
      );
    }
  }

  /**
   * Find a single tracking log by ID
   */
  async findOne(id: number, orgId?: number, userRole?: string) {
    try {
      const isAdmin = userRole === 'admin' || userRole === 'super_admin';

      const conditions: any[] = [eq(zuvyTrackingLogs.id, id)];

      // Non-admins can only view logs from their org
      if (!isAdmin && orgId) {
        conditions.push(eq(zuvyTrackingLogs.orgId, orgId));
      }

      const [log] = await db
        .select({
          id: zuvyTrackingLogs.id,
          orgId: zuvyTrackingLogs.orgId,
          actorUserId: zuvyTrackingLogs.actorUserId,
          actorName: users.name,
          actorEmail: users.email,
          permissionId: zuvyTrackingLogs.permissionId,
          resourceId: zuvyTrackingLogs.resourceId,
          action: zuvyTrackingLogs.action,
          resourceType: zuvyTrackingLogs.resourceType,
          createdAt: zuvyTrackingLogs.createdAt,
        })
        .from(zuvyTrackingLogs)
        .leftJoin(users, eq(zuvyTrackingLogs.actorUserId, users.id))
        .where(and(...conditions));

      if (!log) {
        throw new NotFoundException(`Tracking log with ID ${id} not found`);
      }

      return {
        success: true,
        message: 'Tracking log fetched successfully',
        data: log,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Failed to fetch tracking log',
        error.message,
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
    permissionId?: number;
    permissionName?: string; // e.g., "createCourse", "editBootcamp"
    customDescription?: string; // Custom description for specific changes
    status?: string; // Status: 'success', 'failed', 'pending'
  }) {
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
        permissionId,
        permissionName,
        customDescription,
        status,
      } = params;

      // Get permission ID and resource ID if not provided but permissionName is provided
      let finalPermissionId = permissionId;
      let finalResourceId = null;

      if (!finalPermissionId && permissionName) {
        const result = await this.getPermissionAndResourceId(permissionName);
        finalPermissionId = result.permissionId;
        finalResourceId = result.resourceId;
      }

      // Use custom description if provided, otherwise generate default
      const description =
        customDescription ||
        this.generateDescription(
          actorName,
          action,
          resourceType,
          resourceName,
          targetUserName,
        );

      const createDto: CreateTrackinglogDto = {
        actorUserId,
        action,
        resourceType,
        description,
        orgId,
        bootcampId,
        permissionId: finalPermissionId,
        resourceId: finalResourceId,
        status: status || 'success', // Default to success if not provided
      };

      return await this.create(createDto);
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to log action',
        error.message,
      );
    }
  }

  /**
   * Generate human-readable descriptions for various actions
   */
  private generateDescription(
    actorName: string,
    action: string,
    resourceType: string,
    resourceName?: string,
    targetUserName?: string,
  ): string {
    const actionMap: Record<
      string,
      (name: string, resource?: string, target?: string) => string
    > = {
      create_bootcamp: (actor, resource) =>
        `${actor} has created a new bootcamp named: ${resource}`,
      update_bootcamp: (actor, resource) =>
        `${actor} has updated the bootcamp: ${resource}`,
      delete_bootcamp: (actor, resource) =>
        `${actor} has deleted the bootcamp: ${resource}`,
      create_chapter: (actor, resource) =>
        `${actor} has created a new chapter named: ${resource}`,
      update_chapter: (actor, resource) =>
        `${actor} has updated the chapter: ${resource}`,
      delete_chapter: (actor, resource) =>
        `${actor} has deleted the chapter: ${resource}`,
      create_course: (actor, resource) =>
        `${actor} has created a new course named: ${resource}`,
      update_course: (actor, resource) =>
        `${actor} has updated the course: ${resource}`,
      delete_course: (actor, resource) =>
        `${actor} has deleted the course: ${resource}`,
      assign_role: (actor, resource, target) =>
        `${actor} has assigned ${resource} role to ${target}`,
      remove_role: (actor, resource, target) =>
        `${actor} has removed ${resource} role from ${target}`,
      create_user: (actor, resource) =>
        `${actor} has created a new user: ${resource}`,
      update_user: (actor, resource) =>
        `${actor} has updated user: ${resource}`,
      delete_user: (actor, resource) =>
        `${actor} has deleted user: ${resource}`,
      enroll_student: (actor, resource, target) =>
        `${actor} has enrolled ${target} in ${resource}`,
      unenroll_student: (actor, resource, target) =>
        `${actor} has unenrolled ${target} from ${resource}`,
      create_batch: (actor, resource) =>
        `${actor} has created a new batch: ${resource}`,
      update_batch: (actor, resource) =>
        `${actor} has updated the batch: ${resource}`,
      delete_batch: (actor, resource) =>
        `${actor} has deleted the batch: ${resource}`,
      create_class: (actor, resource) =>
        `${actor} has created a new class: ${resource}`,
      update_class: (actor, resource) =>
        `${actor} has updated the class: ${resource}`,
      delete_class: (actor, resource) =>
        `${actor} has deleted the class: ${resource}`,
      submit_assessment: (actor, resource) =>
        `${actor} has submitted assessment: ${resource}`,
      grade_submission: (actor, resource, target) =>
        `${actor} has graded submission for ${target}`,
    };

    const generator = actionMap[action];
    if (generator) {
      return generator(actorName, resourceName, targetUserName);
    }

    // Fallback generic description
    const resourcePart = resourceName
      ? ` on ${resourceType}: ${resourceName}`
      : ` on ${resourceType}`;
    const targetPart = targetUserName ? ` for ${targetUserName}` : '';
    return `${actorName} has performed ${action}${resourcePart}${targetPart}`;
  }

  /**
   * Detect changes between old and new data for any resource
   * Returns array of human-readable change descriptions
   */
  detectChanges(oldData: any, newData: any, updatedFields: any): string[] {
    const changes: string[] = [];

    // Common field labels for all resources
    const fieldLabels = {
      // Common fields
      name: 'name',
      title: 'title',
      description: 'description',

      // Bootcamp fields
      startTime: 'start time',
      endTime: 'end time',
      duration: 'duration',
      coverImage: 'cover image',
      collaborator: 'collaborator',
      bootcampTopic: 'bootcamp topic',
      language: 'language',

      // Module fields
      moduleId: 'module',
      order: 'order',
      timeAlloted: 'time alloted',

      // Chapter fields
      chapterId: 'chapter',
      topicId: 'topic',
      content: 'content',

      // Batch fields
      capEnrollment: 'enrollment capacity',
      instructorId: 'instructor',

      // Class fields
      recurringId: 'recurring schedule',
      bootcampId: 'bootcamp',
      batchId: 'batch',

      // User fields
      email: 'email',
      phone: 'phone number',
      role: 'role',
      status: 'status',

      // Generic fields
      isActive: 'active status',
      isPublished: 'published status',
      isLocked: 'locked status',
    };

    // Check all fields that were provided in updatedFields
    for (const [key, value] of Object.entries(updatedFields)) {
      // Skip certain fields
      if (key === 'instructorId' || key === 'updatedAt' || key === 'createdAt')
        continue;

      const oldValue = oldData?.[key];
      const newValue = newData?.[key];

      // Only track if value actually changed
      if (oldValue !== newValue) {
        const fieldLabel =
          fieldLabels[key] ||
          key
            .replace(/([A-Z])/g, ' $1')
            .toLowerCase()
            .trim();

        // Handle different types of changes
        if (key === 'name' || key === 'title') {
          changes.push(`${fieldLabel} from "${oldValue}" to "${newValue}"`);
        } else if (key === 'language' || key === 'email') {
          changes.push(`${fieldLabel} from "${oldValue}" to "${newValue}"`);
        } else if (typeof newValue === 'number') {
          changes.push(`${fieldLabel} from ${oldValue} to ${newValue}`);
        } else if (typeof newValue === 'boolean') {
          changes.push(`${fieldLabel} to ${newValue ? 'enabled' : 'disabled'}`);
        } else if (key.includes('Time') || key.includes('Date')) {
          changes.push(`${fieldLabel} to ${newValue}`);
        } else if (newValue === null || newValue === undefined) {
          changes.push(`removed ${fieldLabel}`);
        } else if (oldValue === null || oldValue === undefined) {
          changes.push(`added ${fieldLabel}`);
        } else {
          // For other fields, just mention the field name
          changes.push(fieldLabel);
        }
      }
    }

    return changes;
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
        error.message,
      );
    }
  }

  /**
   * Get available filter options from database
   * Returns distinct actions and resource types from trackingLogs and zuvy_resources table
   */
  async getAvailableFilters() {
    try {
      // Get distinct actions from trackingLogs
      const actionsResult = await db
        .selectDistinct({ action: zuvyTrackingLogs.action })
        .from(zuvyTrackingLogs)
        .where(sql`${zuvyTrackingLogs.action} IS NOT NULL`)
        .orderBy(zuvyTrackingLogs.action);

      const actions = actionsResult.map((row) => row.action).filter(Boolean);

      // Get resource types from zuvy_resources table
      const resourcesResult = await db
        .select({
          key: zuvyResources.key,
          name: zuvyResources.name,
        })
        .from(zuvyResources)
        .orderBy(zuvyResources.name);

      const resourceTypes = resourcesResult.map((row) => ({
        key: row.key,
        name: row.name,
      }));

      // Get all available roles from zuvyUserRoles table
      const rolesResult = await db
        .select({
          id: zuvyUserRoles.id,
          name: zuvyUserRoles.name,
          description: zuvyUserRoles.description,
        })
        .from(zuvyUserRoles)
        .orderBy(zuvyUserRoles.name);

      const roles = rolesResult.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
      }));

      return {
        success: true,
        data: {
          actions,
          resourceTypes,
          roles, // Added roles for filtering
        },
      };
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to fetch available filters',
        error.message,
      );
    }
  }
}
