// src/modules/auditlog/auditlog.service.ts (delegate)
import { Injectable } from '@nestjs/common';
import { AssignPermToRoleStrategy } from './strategies/permToRole.strategy';
import { AssignRoleToUserStrategy } from './strategies/roleToUser.strategy';
@Injectable()
export class AuditlogService {
  constructor(
    private readonly permToRole: AssignPermToRoleStrategy,
    private readonly roleToUser: AssignRoleToUserStrategy,
  ) {}
  async log(action: 'perm_to_role' | 'role_to_user', dto: any) {
    const map = {
      perm_to_role: this.permToRole,
      role_to_user: this.roleToUser,
    } as const;
    await map[action].execute(dto);
  }
}

// import { Injectable, InternalServerErrorException } from '@nestjs/common';
// import { db } from 'src/db/index';
// import { users, zuvyAuditLogs, zuvyPermissions, zuvyScopes, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';
// import { sql, eq, and, asc, ilike, or, inArray, count, desc } from 'drizzle-orm';
// type AuditLogInsert = typeof zuvyAuditLogs.$inferInsert;

// @Injectable()
// export class AuditlogService {
//   async createAudit(createAuditlogDto): Promise<any> {

//   }

//   async getAllAudit(limit: number = 10, offset: number = 0): Promise<any> {
//     try {
//       // Get all audit logs data with LEFT JOINs
//       const auditLogs = await db
//         .select({
//           id: zuvyAuditLogs.id,
//           actorUserId: zuvyAuditLogs.actorUserId,
//           actorUserName: users.name,
//           actorUserEmail: users.email,
//           targetUserId: zuvyAuditLogs.targetUserId,
//           targetUserName: users.name,
//           targetUserEmail: users.email,
//           action: zuvyAuditLogs.action,
//           roleId: zuvyAuditLogs.roleId,
//           roleName: zuvyUserRoles.name,
//           permissionId: zuvyAuditLogs.permissionId,
//           permissionName: zuvyPermissions.name,
//           scopeId: zuvyAuditLogs.scopeId,
//           scopeName: zuvyScopes.name,
//           createdAt: zuvyAuditLogs.createdAt,
//           updatedAt: zuvyAuditLogs.updatedAt,
//         })
//         .from(zuvyAuditLogs)
//         .leftJoin(users, eq(zuvyAuditLogs.actorUserId, users.id))
//         .leftJoin(users, eq(zuvyAuditLogs.targetUserId, users.id))
//         .leftJoin(zuvyUserRoles, eq(zuvyAuditLogs.roleId, zuvyUserRoles.id))
//         .leftJoin(zuvyPermissions, eq(zuvyAuditLogs.permissionId, zuvyPermissions.id))
//         .leftJoin(zuvyScopes, eq(zuvyAuditLogs.scopeId, zuvyScopes.id))
//         .orderBy(desc(zuvyAuditLogs.createdAt)) // Changed to desc to show latest first
//         .limit(limit)
//         .offset(offset);

//       // Get total count
//       const totalCountResult = await db
//         .select({ count: count() })
//         .from(zuvyAuditLogs);

//       const totalCount = totalCountResult[0]?.count || 0;

//       return {
//         status: 'success',
//         statusCode: 200,
//         message: 'Successfully retrieved audit log entries',
//         data: auditLogs,
//         totalCount,
//         limit,
//         offset,
//       };
//     } catch (error) {
//       console.error('Error getting all audit logs:', error);
//       throw error;
//     }
//   }

//   findOne(id: number) {
//     return `This action returns a #${id} auditlog`;
//   }

//   remove(id: number) {
//     return `This action removes a #${id} auditlog`;
//   }
// }
