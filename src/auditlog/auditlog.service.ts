import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { db } from 'src/db/index';
import { CreateAuditlogDto } from './dto/create-auditlog.dto';
import { UpdateAuditlogDto } from './dto/update-auditlog.dto';
import { users, zuvyAuditLogs, zuvyPermissions, zuvyScopes, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';
import { sql, eq, and, asc, ilike, or, inArray, count, desc } from 'drizzle-orm';
type AuditLogInsert = typeof zuvyAuditLogs.$inferInsert;

@Injectable()
export class AuditlogService {
  async createAudit(createAuditlogDto: CreateAuditlogDto): Promise<any> {
    try {
      const { actorUserId, targetUserId, action, roleId, permissionIds, scopeId } = createAuditlogDto;

      console.log('Creating audit log with data:', createAuditlogDto);

      // Validate required fields
      if (!actorUserId) {
        throw new Error('Actor user ID is required');
      }

      if (!action) {
        throw new Error('Action is required');
      }

      // Check if actorUserId is a valid user
      const actorUser = await db.select().from(users).where(eq(users.id, BigInt(actorUserId)));
      if (actorUser.length === 0) {
        throw new Error('Actor user not found');
      }

      // Check if targetUserId is provided and valid
      if (targetUserId) {
        const targetUser = await db.select().from(users).where(eq(users.id, BigInt(targetUserId)));
        if (targetUser.length === 0) {
          throw new Error('Target user not found');
        }
      }

      // Check if roleId is provided and valid
      if (roleId) {
        const role = await db.select().from(zuvyUserRoles).where(eq(zuvyUserRoles.id, roleId));
        if (role.length === 0) {
          throw new Error('Role not found');
        }
      }

      // Check if permissionIds are provided and valid
      if (permissionIds && permissionIds.length > 0) {
        const permissions = await db.select().from(zuvyPermissions).where(inArray(zuvyPermissions.id, permissionIds));

        // Check if all permission IDs are valid
        if (permissions.length !== permissionIds.length) {
          const foundPermissionIds = permissions.map(p => p.id);
          const invalidPermissionIds = permissionIds.filter(id => !foundPermissionIds.includes(id));
          throw new Error(`Invalid permission IDs: ${invalidPermissionIds.join(', ')}`);
        }
      }

      // Check if scopeId is provided and valid
      if (scopeId) {
        const scope = await db.select().from(zuvyScopes).where(eq(zuvyScopes.id, scopeId));
        if (scope.length === 0) {
          throw new Error('Scope not found');
        }
      }
      await db.transaction(async (tx) => {
        const rows: AuditLogInsert[] =
          permissionIds.length
            ? permissionIds.map(pid => ({
              actorUserId, targetUserId: targetUserId ?? null, action,
              roleId: roleId ?? null, permissionId: pid, scopeId: scopeId ?? null,
            }))
            : [{
              actorUserId, targetUserId: targetUserId ?? null, action,
              roleId: roleId ?? null, permissionId: null, scopeId: scopeId ?? null,
            }];

        const inserted = await tx.insert(zuvyAuditLogs).values(rows).returning();

        if (!inserted.length) throw new InternalServerErrorException('insert failed');
        return {
          success: true,
          message: 'Successfully created audit log entry',
          entry: inserted
        };
      })
    } catch (error) {
      console.error('Error creating audit log:', error);
      throw error;
    }
  }

  async getAllAudit(limit: number = 10, offset: number = 0): Promise<any> {
    try {
      // Get all audit logs data with LEFT JOINs
      const auditLogs = await db
        .select({
          id: zuvyAuditLogs.id,
          actorUserId: zuvyAuditLogs.actorUserId,
          actorUserName: users.name,
          actorUserEmail: users.email,
          targetUserId: zuvyAuditLogs.targetUserId,
          targetUserName: users.name,
          targetUserEmail: users.email,
          action: zuvyAuditLogs.action,
          roleId: zuvyAuditLogs.roleId,
          roleName: zuvyUserRoles.name,
          permissionId: zuvyAuditLogs.permissionId,
          permissionName: zuvyPermissions.name,
          scopeId: zuvyAuditLogs.scopeId,
          scopeName: zuvyScopes.name,
          createdAt: zuvyAuditLogs.createdAt,
          updatedAt: zuvyAuditLogs.updatedAt,
        })
        .from(zuvyAuditLogs)
        .leftJoin(users, eq(zuvyAuditLogs.actorUserId, users.id))
        .leftJoin(users, eq(zuvyAuditLogs.targetUserId, users.id))
        .leftJoin(zuvyUserRoles, eq(zuvyAuditLogs.roleId, zuvyUserRoles.id))
        .leftJoin(zuvyPermissions, eq(zuvyAuditLogs.permissionId, zuvyPermissions.id))
        .leftJoin(zuvyScopes, eq(zuvyAuditLogs.scopeId, zuvyScopes.id))
        .orderBy(desc(zuvyAuditLogs.createdAt)) // Changed to desc to show latest first
        .limit(limit)
        .offset(offset);

      // Get total count
      const totalCountResult = await db
        .select({ count: count() })
        .from(zuvyAuditLogs);

      const totalCount = totalCountResult[0]?.count || 0;

      return {
        status: 'success',
        statusCode: 200,
        message: 'Successfully retrieved audit log entries',
        data: auditLogs,
        totalCount,
        limit,
        offset,
      };
    } catch (error) {
      console.error('Error getting all audit logs:', error);
      throw error;
    }
  }

  findOne(id: number) {
    return `This action returns a #${id} auditlog`;
  }

  update(id: number, updateAuditlogDto: UpdateAuditlogDto) {
    return `This action updates a #${id} auditlog`;
  }

  remove(id: number) {
    return `This action removes a #${id} auditlog`;
  }
}
