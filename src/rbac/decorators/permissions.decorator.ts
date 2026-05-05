import { SetMetadata } from '@nestjs/common';
import { ResourceList } from '../utility';

export const RequirePermission = (resource: string, action: string) => {
  const resourceKey = resource.toLowerCase();
  const normalizedAction = action.toLowerCase() === 'view' ? 'read' : action;
  const formattedPermission = ResourceList[resourceKey]?.[normalizedAction];

  return SetMetadata('permissions', [
    formattedPermission || `${resourceKey}:${action}`,
  ]);
};

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
