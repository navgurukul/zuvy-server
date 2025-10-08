// src/modules/auditlog/strategies/assign-perm-to-role.strategy.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IAuditStrategy } from './strategy.interface';
import { users, zuvyPermissions, zuvyUserRoles } from 'drizzle/schema';
import { zuvyAuditLogs as AuditLogsTable } from 'drizzle/schema';
type AuditLogInsert = InferInsertModel<typeof AuditLogsTable>;
import { db } from 'src/db';
import { eq, InferInsertModel } from 'drizzle-orm';
@Injectable()
export class AssignPermToRoleStrategy implements IAuditStrategy<any> {

    async execute(dto: { actorUserId: number | string | bigint; roleId: number; permissions: Record<string, boolean>; }): Promise<void> {
        const { actorUserId, roleId, permissions } = dto ?? {};
        if (!actorUserId || !roleId || !permissions) throw new BadRequestException('actorUserId, roleId, permissions required');

        await db.transaction(async (tx) => {
            const [actor] = await tx.select({ id: users.id }).from(users).where(eq(users.id, BigInt(actorUserId)));
            if (!actor) throw new NotFoundException('actor not found');

            const [role] = await tx.select({ id: zuvyUserRoles.id }).from(zuvyUserRoles).where(eq(zuvyUserRoles.id, roleId));
            if (!role) throw new NotFoundException('role not found');

            // for (const [permissionId, isGranted] of Object.entries(permissions)) {
            //     await tx.insert(AuditLogsTable).values({
            //         actorId: BigInt(actorUserId),
            //         targetUserId: null,
            //         action: isGranted ? 'assign' : 'revoke',
            //         roleId,
            //         permissionId: Number(permissionId),
            //         scopeId: null,
            //     } satisfies AuditLogInsert);
            // }
        });
    }
}
