import { Injectable, Inject, NotFoundException, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { db } from 'src/db/index';
import { CreateResourceDto } from './dto/create-resource.dto';
import { zuvyResources, zuvyPermissions } from 'drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { permissions } from 'src/helpers';

@Injectable()
export class ResourcesService {
  private readonly logger = new Logger(ResourcesService.name);

  async createResource(createResourceDto: CreateResourceDto) {
    try {
      // Create the resource first
      const [resource] = await db
        .insert(zuvyResources)
        .values(createResourceDto)
        .returning();

      // Create default permissions for this resource
      const defaultPermissions = [
        { name: permissions.CREATE, resourcesId: resource.id, description: `Create ${createResourceDto.name}` },
        { name: permissions.READ, resourcesId: resource.id, description: `Read ${createResourceDto.name}` },
        { name: permissions.EDIT, resourcesId: resource.id, description: `Update ${createResourceDto.name}` },
        { name: permissions.DELETE, resourcesId: resource.id, description: `Delete ${createResourceDto.name}` },
      ];

      await db
        .insert(zuvyPermissions)
        .values(defaultPermissions);

      return resource;
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        throw new BadRequestException('Resource with this name already exists');
      }
      throw new InternalServerErrorException('Failed to create resource');
    }
  }

  async getAllResources() {
    try {
      const resources = await db
        .select()
        .from(zuvyResources)
        .orderBy(asc(zuvyResources.key));

      return {
        status: 'success',
        message: 'Resources fetched successfully',
        code: 200,
        data: resources
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
        throw new BadRequestException('Cannot delete resource with associated permissions. Please delete associated permissions first.');
      }
      // If there are no associated permissions, the resource is deleted successfully
      const deletedResource = await db
        .delete(zuvyResources)
        .where(eq(zuvyResources.id, id));
      if (deletedResource.rowCount === 0) {
        throw new NotFoundException(`Resource with ID ${id} not found`);
      } 
      // Resource deleted successfully then return the resurce details
      return { message: 'Resource deleted successfully', code: 200, status: 'success'};
    } catch (error) {
      throw error;
    }
  }
}