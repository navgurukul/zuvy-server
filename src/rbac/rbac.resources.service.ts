import { Injectable, Inject, NotFoundException, Logger, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { db } from 'src/db/index';
import { CreateResourceDto } from './dto/resources.dto';
import { zuvyResources } from 'drizzle/schema';
import { eq, asc } from 'drizzle-orm';
import { convertToPascalCaseWithSpaces } from './utility';

@Injectable()
export class RbacResourcesService {
   private readonly logger = new Logger(RbacResourcesService.name);

   async createResource(createResourceDto: CreateResourceDto) {
    try {
      const [resource] = await db
        .insert(zuvyResources)
        .values(createResourceDto)
        .returning();

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
        .orderBy(asc(zuvyResources.name));

      let pascalResources = convertToPascalCaseWithSpaces(resources);
      return {
          status: 'success',
          message: 'Resources fetched successfully',
          code: 200, 
          data: pascalResources
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
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve resource');
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
      if (error instanceof NotFoundException) {
        throw error;
      }
      if (error.code === '23505') {
        throw new BadRequestException('Resource with this name already exists');
      }
      throw new InternalServerErrorException('Failed to update resource');
    }
  }

    async deleteResource(id: number): Promise<void> {
    try {
      const result = await db
        .delete(zuvyResources)
        .where(eq(zuvyResources.id, id));

      if (result.rowCount === 0) {
        throw new NotFoundException(`Resource with ID ${id} not found`);
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete resource');
    }
  }
}