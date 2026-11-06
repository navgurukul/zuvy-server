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

type ResourceNode = Omit<ResourceRow, 'parentId'> & {
  title: string;
  isParent: false;
  parentId: number | null;
  resourceId: number;
  permissions: Omit<PermissionRow, 'resourceId'>[];
  children: ResourceNode[];
};

// Shapes the resource list for Role Management as a tree: one entry per parent
// (zuvy_parent_resources) with its resources nested in `children` to any
// depth (zuvy_resources.parent_id), followed by the resources in no group.
//   parent:      id/name from zuvy_parent_resources, parentId null. Its own
//                permissions live on its is_parent zuvy_resources row, whose ID
//                is `resourceId`.
//   resource:    a zuvy_resources row. parentId is the node above it: the
//                resource it is nested under, else its parent's id, else null.
//                parentResourceId is always its group.
// Every node has `children` (empty for a leaf) and `resourceId`, the ID the
// permission endpoints take.
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

  const ownRowByParent = new Map<number, ResourceRow>();
  const rows = new Map<number, ResourceRow>();
  for (const resource of resources) {
    if (resource.isParent)
      ownRowByParent.set(resource.parentResourceId, resource);
    else rows.set(resource.id, resource);
  }

  // Resources nested under another resource, and the top of each group.
  const nestedUnder = new Map<number, ResourceRow[]>();
  const topOfGroup = new Map<number, ResourceRow[]>();
  const standalone: ResourceRow[] = [];
  const push = (
    map: Map<number, ResourceRow[]>,
    key: number,
    row: ResourceRow,
  ) => map.set(key, [...(map.get(key) ?? []), row]);
  for (const row of rows.values()) {
    if (row.parentId != null && rows.has(row.parentId))
      push(nestedUnder, row.parentId, row);
    else if (row.parentResourceId != null)
      push(topOfGroup, row.parentResourceId, row);
    else standalone.push(row);
  }

  const placed = new Set<number>();
  const toNode = (row: ResourceRow, parentId: number | null): ResourceNode => {
    placed.add(row.id);
    const { parentId: _nestedUnder, ...fields } = row;
    return {
      ...fields,
      title: row.name,
      isParent: false,
      parentId,
      resourceId: row.id,
      permissions: permissionsByResource.get(row.id) ?? [],
      children: (nestedUnder.get(row.id) ?? [])
        .filter((child) => !placed.has(child.id)) // never loop on a cycle
        .map((child) => toNode(child, row.id)),
    };
  };

  const parentEntries = parents.map((parent) => {
    const ownRow = ownRowByParent.get(parent.id);
    return {
      id: parent.id,
      name: parent.name,
      title: parent.name,
      isParent: true,
      parentId: null,
      resourceId: ownRow?.id ?? null,
      permissions: ownRow ? (permissionsByResource.get(ownRow.id) ?? []) : [],
      createdAt: parent.createdAt,
      updatedAt: parent.updatedAt,
      children: (topOfGroup.get(parent.id) ?? []).map((row) =>
        toNode(row, parent.id),
      ),
    };
  });
  const standaloneEntries = standalone.map((row) => toNode(row, null));
  // Rows only reachable through a cycle of parent_id links still get listed,
  // each once.
  const unplaced: ResourceNode[] = [];
  for (const row of rows.values()) {
    if (!placed.has(row.id)) unplaced.push(toNode(row, null));
  }

  return [...parentEntries, ...standaloneEntries, ...unplaced];
}

@Injectable()
export class RbacResourcesService {
  private readonly logger = new Logger(RbacResourcesService.name);

  async createResource(createResourceDto: CreateResourceDto) {
    try {
      const values = await this.withNestedGroup(createResourceDto);
      await this.assertValidParent(values.parentResourceId);

      // Create the resource first
      const [resource] = await db
        .insert(zuvyResources)
        .values(values)
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
      const values = await this.withNestedGroup(updateData, id);
      await this.assertValidParent(values.parentResourceId, id);

      const [resource] = await db
        .update(zuvyResources)
        .set(values)
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

  // A resource can be nested under another resource (never a parent's own
  // permission row, itself, or anything nested under it). It then joins that
  // resource's group, so parentResourceId is filled in or must agree.
  private async withNestedGroup<T extends Partial<CreateResourceDto>>(
    data: T,
    selfId?: number,
  ): Promise<T> {
    const { parentId } = data;
    if (parentId === undefined || parentId === null) return data;
    if (parentId === selfId) {
      throw new BadRequestException('A resource cannot be nested under itself');
    }

    const [parent] = await db
      .select({
        isParent: zuvyResources.isParent,
        parentResourceId: zuvyResources.parentResourceId,
      })
      .from(zuvyResources)
      .where(eq(zuvyResources.id, parentId))
      .limit(1);
    if (!parent) {
      throw new NotFoundException(`Resource with ID ${parentId} not found`);
    }
    if (parent.isParent) {
      throw new BadRequestException(
        'Use parentResourceId to put a resource directly under a parent',
      );
    }

    if (selfId !== undefined) {
      // Walk up from the new parent; reaching this resource would be a cycle.
      let ancestorId: number | null = parentId;
      for (let depth = 0; ancestorId !== null && depth < 50; depth++) {
        if (ancestorId === selfId) {
          throw new BadRequestException(
            'A resource cannot be nested under one of its own children',
          );
        }
        const [ancestor] = await db
          .select({ parentId: zuvyResources.parentId })
          .from(zuvyResources)
          .where(eq(zuvyResources.id, ancestorId))
          .limit(1);
        ancestorId = ancestor?.parentId ?? null;
      }
    }

    if (
      data.parentResourceId !== undefined &&
      data.parentResourceId !== parent.parentResourceId
    ) {
      throw new BadRequestException(
        'parentResourceId must match the group of the resource in parentId',
      );
    }
    return { ...data, parentResourceId: parent.parentResourceId };
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
