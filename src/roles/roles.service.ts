import { Injectable, ConflictException, InternalServerErrorException, NotFoundException, BadRequestException } from '@nestjs/common';
import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { db } from 'src/db/index';
import { zuvyUserRoles } from 'drizzle/schema';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InferInsertModel } from 'drizzle-orm';
type ZuvyInsert = InferInsertModel<typeof zuvyUserRoles>

@Injectable()
export class RolesService {
  async create(createRoleDto: CreateRoleDto) {
    try {
      const [role] = await db
        .insert(zuvyUserRoles)
        .values(createRoleDto)
        .returning();
      return role;
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('Role name already exists');
      throw new InternalServerErrorException('Failed to create role');
    }
  }

async findAll() {
    return await db.select().from(zuvyUserRoles);
  }

  async findOne(id: number) {
    const [role] = await db.select().from(zuvyUserRoles).where(eq(zuvyUserRoles.id, id)).limit(1);
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async update(id: number, updateRoleDto: UpdateRoleDto) {
    if (!updateRoleDto || (!updateRoleDto.name && updateRoleDto.description === undefined)) {
      throw new BadRequestException('No fields to update');
    }
    await this.ensureExists(id);
    try {
      const [updated] = await db
        .update(zuvyUserRoles)
        .set({
          ...(updateRoleDto.name !== undefined ? { name: updateRoleDto.name.trim() } : {}),
          ...(updateRoleDto.description !== undefined ? { description: updateRoleDto.description?.trim() ?? null } : {}),
        })
        .where(eq(zuvyUserRoles.id, id))
        .returning();
      return updated;
    } catch (e: any) {
      if (e.code === '23505') throw new ConflictException('Role name already exists');
      throw new InternalServerErrorException('Failed to update role');
    }
  }

  async remove(id: number) {
    await this.ensureExists(id);
    const [deleted] = await db.delete(zuvyUserRoles).where(eq(zuvyUserRoles.id, id)).returning();
    return deleted;
  }

  private async ensureExists(id: number) {
    const [role] = await db.select({ id: zuvyUserRoles.id }).from(zuvyUserRoles).where(eq(zuvyUserRoles.id, id)).limit(1);
    if (!role) throw new NotFoundException('Role not found');
  }
}
