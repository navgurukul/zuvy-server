// src/modules/auditlog/auditlog.service.ts (delegate)
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AssignPermToRoleStrategy } from './strategies/permToRole.strategy';
import { AssignRoleToUserStrategy } from './strategies/roleToUser.strategy';
import { zuvyAuditLogs } from 'drizzle/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { db } from 'src/db';
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

  async getAllAudit(limit: number, offset: number) {
    try {
      const [rows, totalRes] = await Promise.all([
        db
          .select()
          .from(zuvyAuditLogs)
          .orderBy(desc(zuvyAuditLogs.createdAt))
          .limit(limit)
          .offset(offset),
        db.select({ count: sql<number>`count(*)` }).from(zuvyAuditLogs),
      ]);

      const total = Number(totalRes?.[0]?.count ?? 0);

      return {
        success: true,
        message: 'audit logs fetched',
        data: { rows, pagination: { limit, offset, total } },
      };
    } catch (e) {
      throw new InternalServerErrorException('failed to fetch audit logs', e);
    }
  }

  async findOne(id: number) {
    try {
      const [row] = await db
        .select()
        .from(zuvyAuditLogs)
        .where(eq(zuvyAuditLogs.id, id));

      if (!row) throw new NotFoundException('audit log not found');

      return { success: true, message: 'audit log fetched', data: row };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      throw new InternalServerErrorException('failed to fetch audit log', e);
    }
  }
}
