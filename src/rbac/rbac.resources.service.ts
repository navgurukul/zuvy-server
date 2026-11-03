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
import { eq, asc, getTableColumns } from 'drizzle-orm';
import { permissions } from 'src/helpers';

type ResourceRow = typeof zuvyResources.$inferSelect & {
  parentName: string | null;
};
type PermissionRow = {
  id: number;
  name: string;
  description: string | null;
  resourceId: number;
};

// Shapes the resource list for Role Management. Every entry is a
// zuvy_resources row, so every `id` is unique and is what the permission
// endpoints take, for parents and children alike.
//   parent:  the row a zuvy_parent_resources record keeps its own permissions
//            on (is_parent); title is the parent's name, parentId is null.
//   child:   any other row; parentId is its parent's `id`.
// parentResourceId is the zuvy_parent_resources ID in both. Parents come first.
export function buildResourceHierarchy(
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
  const parentIdByParentResourceId = new Map(
    resources.filter((r) => r.isParent).map((r) => [r.parentResourceId, r.id]),
  );

  const entries = resources.map(({ parentName, ...resource }) => ({
    ...resource,
    title: resource.isParent ? (parentName ?? resource.name) : resource.name,
    parentId: resource.isParent
      ? null
      : (parentIdByParentResourceId.get(resource.parentResourceId) ?? null),
    parentResourceId: resource.parentResourceId ?? null,
    permissions: permissionsByResource.get(resource.id) ?? [],
  }));
  return [
    ...entries.filter((r) => r.isParent),
    ...entries.filter((r) => !r.isParent),
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
      const resources = await db
        .select({
          ...getTableColumns(zuvyResources),
          parentName: zuvyParentResources.name,
        })
        .from(zuvyResources)
        .leftJoin(
          zuvyParentResources,
          eq(zuvyResources.parentResourceId, zuvyParentResources.id),
        )
        .orderBy(asc(zuvyResources.name));

      const resourcePermissions = await db
        .select({
          id: zuvyPermissions.id,
          name: zuvyPermissions.name,
          description: zuvyPermissions.description,
          resourceId: zuvyPermissions.resourcesId,
        })
        .from(zuvyPermissions)
        .orderBy(asc(zuvyPermissions.id));

      // let pascalResources = convertToPascalCaseWithSpaces(resources);
      return {
        status: 'success',
        message: 'Resources fetched successfully',
        code: 200,
        data: buildResourceHierarchy(resources, resourcePermissions),
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
