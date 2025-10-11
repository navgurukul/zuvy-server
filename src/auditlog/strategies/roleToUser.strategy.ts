// src/modules/auditlog/strategies/assign-role-to-user.strategy.ts
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { IAuditStrategy } from './strategy.interface';
import { db } from 'src/db';
import {
  users,
  zuvyUserRoles,
  zuvyAuditLogs as AuditLogsTable,
} from 'drizzle/schema';
import { eq } from 'drizzle-orm';

@Injectable()
export class AssignRoleToUserStrategy implements IAuditStrategy<any> {
  async execute(dto: {
    actorUserId: number | string | bigint;
    targetUserId: number | string | bigint;
    roleId: number;
    action: string;
    permissions?: null; // will always be null for this strategy
  }): Promise<void> {
    const { actorUserId, targetUserId, roleId, action } = dto ?? {};
    if (!actorUserId || !targetUserId || !roleId) {
      throw new BadRequestException(
        'actorUserId, targetUserId, roleId required',
      );
    }

    try {
      await db.transaction(async (tx) => {
        const [actor] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, BigInt(actorUserId)));
        if (!actor) throw new NotFoundException('actor not found');

        const [target] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.id, BigInt(targetUserId)));
        if (!target) throw new NotFoundException('target user not found');

        const [role] = await tx
          .select({ id: zuvyUserRoles.id })
          .from(zuvyUserRoles)
          .where(eq(zuvyUserRoles.id, roleId));
        if (!role) throw new NotFoundException('role not found');

        const payload = {
          actorUserId: BigInt(actorUserId),
          targetUserId: BigInt(targetUserId),
          action,
          roleId,
          permissionId: null,
          scopeId: null,
        };

        await tx.insert(AuditLogsTable).values(payload);
      });
    } catch (error) {
      throw new InternalServerErrorException(
        'Failed to execute role-to-user assignment',
        error,
      );
    }
  }
}
