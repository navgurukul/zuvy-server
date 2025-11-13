import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { and, eq, ne, sql } from 'drizzle-orm';
import { db } from 'src/db/index';
import { zuvyUserRoles } from 'drizzle/schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);
  async create(createRoleDto: CreateRoleDto) {
    try {
      const rawName = createRoleDto.name?.trim();

      if (!rawName) {
        throw new BadRequestException('Role name is required');
      }

      const normalizedName = rawName.toLowerCase();
      const normalizedDescription = createRoleDto.description?.trim();

      const existingRole = await db
        .select({ id: zuvyUserRoles.id })
        .from(zuvyUserRoles)
        .where(eq(sql`lower(${zuvyUserRoles.name})`, normalizedName))
        .limit(1);

      if (existingRole.length > 0) {
        throw new ConflictException('Role name already exists');
      }
      const insertedRoles = {
        name: rawName,
        description: normalizedDescription ?? null,
      };

      const [role] = await db
        .insert(zuvyUserRoles)
        .values(insertedRoles)
        .returning();
      return role;
    } catch (e: any) {
      this.logger.error('Failed to create role:', e);
      if (e.code === '23505')
        throw new ConflictException('Role name already exists');
      throw new InternalServerErrorException('Failed to create role');
    }
  }

  async findAll() {
    return await db.select().from(zuvyUserRoles);
  }

  async findOne(id: number) {
    const [role] = await db
      .select()
      .from(zuvyUserRoles)
      .where(eq(zuvyUserRoles.id, id))
      .limit(1);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    if (
      !updateRoleDto ||
      (!updateRoleDto.name && updateRoleDto.description === undefined)
    ) {
      throw new BadRequestException('No fields to update');
    }
    await this.ensureExists(id);
    try {
      const updatePayload: { name?: string; description?: string | null } = {};

      if (updateRoleDto.name !== undefined) {
        const trimmedName = updateRoleDto.name.trim();

        if (!trimmedName) {
          throw new BadRequestException('Role name cannot be empty');
        }

        const normalizedName = trimmedName.toLowerCase();

        const duplicateRole = await db
          .select({ id: zuvyUserRoles.id })
          .from(zuvyUserRoles)
          .where(
            and(
              eq(sql`lower(${zuvyUserRoles.name})`, normalizedName),
              ne(zuvyUserRoles.id, id),
            ),
          )
          .limit(1);

        if (duplicateRole.length > 0) {
          throw new ConflictException('Role name already exists');
        }

        updatePayload.name = trimmedName;
      }

      if (updateRoleDto.description !== undefined) {
        updatePayload.description = updateRoleDto.description?.trim() ?? null;
      }

      if (Object.keys(updatePayload).length === 0) {
        throw new BadRequestException('No fields to update');
      }

      const [updated] = await db
        .update(zuvyUserRoles)
        .set(updatePayload)
        .where(eq(zuvyUserRoles.id, id))
        .returning();
      return updated;
    } catch (e: any) {
      this.logger.error('Failed to update role:', e);
      if (e.code === '23505')
        throw new ConflictException('Role name already exists');
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const [deleted] = await db
      .delete(zuvyUserRoles)
      .where(eq(zuvyUserRoles.id, id))
      .returning();
    return deleted;
  }

  private async ensureExists(id: number) {
    const [role] = await db
      .select({ id: zuvyUserRoles.id })
      .from(zuvyUserRoles)
      .where(eq(zuvyUserRoles.id, id))
      .limit(1);
    if (!role) throw new NotFoundException('Role not found');
  }
}
