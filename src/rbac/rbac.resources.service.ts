import {
  Injectable,
  Inject,
  NotFoundException,
  Logger,
  InternalServerErrorException,
  BadRequestException,
  HttpException,
} from '@nestjs/common';
import { db } from 'src/db/index';
import { CreateResourceDto } from './dto/resources.dto';
import {
  zuvyResources,
  zuvyPermissions,
  zuvyParentResources,
} from 'drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { permissions } from 'src/helpers';

type ResourceRow = typeof zuvyResources.$inferSelect;
type ParentRow = typeof zuvyParentResources.$inferSelect;
type PermissionRow = {
  id: number;
  name: string;
  description: string | null;
  resourceId: number;
};

// Shapes the resource list for Role Management: one entry per parent
// (zuvy_parent_resources) with its resources nested in `children`, followed by
// the resources that belong to no parent.
//   parent:      id/name from zuvy_parent_resources, parentId null. Its own
//                permissions live on its is_parent zuvy_resources row, whose ID
//                is `resourceId`.
//   child:       the zuvy_resources row with parentId = its parent's id.
//   standalone:  a zuvy_resources row with no parent, parentId null.
// Every entry has `resourceId`, the ID the permission endpoints take.
export function buildResourceHierarchy(
  parents: ParentRow[],
  resources: ResourceRow[],
  resourcePermissions: PermissionRow[],
) {
  const permissionsByResource = new Map<
    number,
    Omit<PermissionRow, 'resourceId'>[]
  >();
  for (const { resourceId, ...permission } of resourcePermissions) {
    const list = permissionsByResource.get(resourceId) ?? [];
    list.push(permission);
    permissionsByResource.set(resourceId, list);
  }
  const permissionsOf = (resourceId: number) =>
    permissionsByResource.get(resourceId) ?? [];

  const ownRowByParent = new Map<number, ResourceRow>();
  const childrenByParent = new Map<number, ResourceRow[]>();
  const standalone: ResourceRow[] = [];
  for (const resource of resources) {
    if (resource.isParent) {
      ownRowByParent.set(resource.parentResourceId, resource);
    } else if (resource.parentResourceId == null) {
      standalone.push(resource);
    } else {
      const list = childrenByParent.get(resource.parentResourceId) ?? [];
      list.push(resource);
      childrenByParent.set(resource.parentResourceId, list);
    }
  }

  const resourceEntry = (resource: ResourceRow, parentId: number | null) => ({
    ...resource,
    title: resource.name,
    isParent: false,
    parentId,
    resourceId: resource.id,
    permissions: permissionsOf(resource.id),
  });

  const parentEntries = parents.map((parent) => {
    const ownRow = ownRowByParent.get(parent.id);
    return {
      id: parent.id,
      name: parent.name,
      title: parent.name,
      isParent: true,
      parentId: null,
      resourceId: ownRow?.id ?? null,
      permissions: ownRow ? permissionsOf(ownRow.id) : [],
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      children: (childrenByParent.get(parent.id) ?? []).map((child) =>
        resourceEntry(child, parent.id),
      ),
    };
  });

  return [
    ...parentEntries,
    ...standalone.map((resource) => resourceEntry(resource, null)),
  ];
}

@Injectable()
export class RbacResourcesService {
  private readonly logger = new Logger(RbacResourcesService.name);

  async createResource(createResourceDto: CreateResourceDto) {
    try {
      await this.assertValidParent(createResourceDto.parentResourceId);

      // Create the resource first
      const [resource] = await db
        .insert(zuvyResources)
        .values(createResourceDto)
        .returning();

      // Create default permissions for this resource
      const defaultPermissions = [
        {
          name: permissions.CREATE,
          resourcesId: resource.id,
          description: `Create ${createResourceDto.name}`,
        },
        {
          name: permissions.READ,
          resourcesId: resource.id,
          description: `Read ${createResourceDto.name}`,
        },
        {
          name: permissions.EDIT,
          resourcesId: resource.id,
          description: `Update ${createResourceDto.name}`,
        },
        {
          name: permissions.DELETE,
          resourcesId: resource.id,
          description: `Delete ${createResourceDto.name}`,
        },
      ];

      await db.insert(zuvyPermissions).values(defaultPermissions);

      return resource;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error.code === '23505') {
        // PostgreSQL unique constraint violation
        throw new BadRequestException('Resource with this name already exists');
      }
      throw new InternalServerErrorException('Failed to create resource');
    }
  }

  async getAllResources() {
    try {
      // Three queries in total, however many resources there are.
      const [parents, resources, resourcePermissions] = await Promise.all([
        db
          .select()
          .from(zuvyParentResources)
          .orderBy(asc(zuvyParentResources.id)),
        db.select().from(zuvyResources).orderBy(asc(zuvyResources.name)),
        db
          .select({
            id: zuvyPermissions.id,
            name: zuvyPermissions.name,
            description: zuvyPermissions.description,
            resourceId: zuvyPermissions.resourcesId,
          })
          .from(zuvyPermissions)
          .orderBy(asc(zuvyPermissions.id)),
      ]);

      // let pascalResources = convertToPascalCaseWithSpaces(resources);
      return {
        status: 'success',
        message: 'Resources fetched successfully',
        code: 200,
        data: buildResourceHierarchy(parents, resources, resourcePermissions),
      };
    } catch (error) {
      throw new InternalServerErrorException('Failed to retrieve resources');
    }
  }

  async getResourceById(id: number) {
    try {
      const [resource] = await db
        .select()
        .from(zuvyResources)
        .where(eq(zuvyResources.id, id));

      if (!resource) {
        throw new NotFoundException(`Resource with ID ${id} not found`);
      }

      return resource;
    } catch (error) {
      throw error;
    }
  }

  async updateResource(id: number, updateData: Partial<CreateResourceDto>) {
    try {
      await this.assertValidParent(updateData.parentResourceId, id);

      const [resource] = await db
        .update(zuvyResources)
        .set(updateData)
        .where(eq(zuvyResources.id, id))
        .returning();

      if (!resource) {
        throw new NotFoundException(`Resource with ID ${id} not found`);
      }

      return resource;
    } catch (error) {
      throw error;
    }
  }

  async deleteResource(id: number): Promise<any> {
    try {
      // check if the resourse has associated permissions
      const associatedPermissions = await db
        .select()
        .from(zuvyPermissions)
        .where(eq(zuvyPermissions.resourcesId, id));
      if (associatedPermissions.length > 0) {
        throw new BadRequestException(
          'Cannot delete resource with associated permissions. Please delete associated permissions first.',
        );
      }
      // If there are no associated permissions, the resource is deleted successfully
      const deletedResource = await db
        .delete(zuvyResources)
        .where(eq(zuvyResources.id, id));
      if (deletedResource.rowCount === 0) {
        throw new NotFoundException(`Resource with ID ${id} not found`);
      }
      // Resource deleted successfully then return the resurce details
      return {
        message: 'Resource deleted successfully',
        code: 200,
        status: 'success',
      };
    } catch (error) {
      throw error;
    }
  }

  // A resource can be put under a parent that exists, but a parent's own
  // permission row stays with its parent.
  private async assertValidParent(
    parentResourceId?: number | null,
    selfId?: number,
  ) {
    if (parentResourceId === undefined) return;

    if (selfId !== undefined) {
      const [self] = await db
        .select({ isParent: zuvyResources.isParent })
        .from(zuvyResources)
        .where(eq(zuvyResources.id, selfId))
        .limit(1);
      if (self?.isParent) {
        throw new BadRequestException(
          "A parent resource's permission row cannot be moved",
        );
      }
    }

    if (parentResourceId === null) return;
    const [parent] = await db
      .select({ id: zuvyParentResources.id })
      .from(zuvyParentResources)
      .where(eq(zuvyParentResources.id, parentResourceId))
      .limit(1);
    if (!parent) {
      throw new NotFoundException(
        `Parent resource with ID ${parentResourceId} not found`,
      );
    }
  }
}
