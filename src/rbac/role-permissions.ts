import { BadRequestException, NotFoundException } from '@nestjs/common';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import {
  zuvyPermissions,
  zuvyPermissionsRoles,
  zuvyResources,
  zuvyUserRoles,
} from 'drizzle/schema';
import { db } from 'src/db/index';
import { AssignPermissionsToRoleDto } from './dto/permission.dto';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Saves a role's permissions on one resource, parent or child alike: only the
// permission IDs sent are touched, and they must belong to `resourceId`, so a
// save on a parent never changes a child's grants and vice versa. Shared by
// POST /rbac/assign/permissionsToRole and POST /permissions/assign/toRole.
export async function applyRolePermissions(
  tx: Tx,
  { resourceId, roleId, permissions }: AssignPermissionsToRoleDto,
  orgId: number | null | undefined,
) {
  const [resource] = await tx
    .select({ id: zuvyResources.id })
    .from(zuvyResources)
    .where(eq(zuvyResources.id, resourceId))
    .limit(1);
  if (!resource) throw new NotFoundException('Resource not found');

  const [role] = await tx
    .select({ id: zuvyUserRoles.id, orgId: zuvyUserRoles.orgId })
    .from(zuvyUserRoles)
    .where(eq(zuvyUserRoles.id, roleId))
    .limit(1);
  if (!role) throw new NotFoundException('Role not found');
  if (role.orgId !== null && orgId != null && role.orgId !== orgId) {
    throw new BadRequestException('Role does not belong to this organization');
  }

  const resourcePerms = await tx
    .select({ id: zuvyPermissions.id })
    .from(zuvyPermissions)
    .where(eq(zuvyPermissions.resourcesId, resourceId));

  const validIds = new Set(resourcePerms.map((p) => p.id));
  const incomingIds = Object.keys(permissions).map(Number);
  const invalid = incomingIds.filter((id) => !validIds.has(id));
  if (invalid.length)
    throw new BadRequestException(
      `Invalid permission ids for resource: ${invalid.join(', ')}`,
    );

  const enableIds = incomingIds.filter((id) => permissions[id] === true);
  const disableIds = incomingIds.filter((id) => permissions[id] === false);
  const permissionRoleOrgCondition =
    orgId !== undefined && orgId !== null
      ? eq(zuvyPermissionsRoles.orgId, orgId)
      : isNull(zuvyPermissionsRoles.orgId);

  if (enableIds.length) {
    await tx
      .insert(zuvyPermissionsRoles)
      .values(
        enableIds.map((permissionId) => ({ roleId, permissionId, orgId })),
      )
      .onConflictDoNothing({
        target: [
          zuvyPermissionsRoles.roleId,
          zuvyPermissionsRoles.permissionId,
        ],
      });
  }

  if (disableIds.length) {
    await tx
      .delete(zuvyPermissionsRoles)
      .where(
        and(
          eq(zuvyPermissionsRoles.roleId, roleId),
          permissionRoleOrgCondition,
          inArray(zuvyPermissionsRoles.permissionId, disableIds),
        ),
      );
  }

  const assigned = await tx
    .select({ permissionId: zuvyPermissionsRoles.permissionId })
    .from(zuvyPermissionsRoles)
    .where(
      and(eq(zuvyPermissionsRoles.roleId, roleId), permissionRoleOrgCondition),
    );

  return {
    roleId,
    resourceId,
    assignedPermissionIds: assigned.map((r) => r.permissionId),
  };
}
