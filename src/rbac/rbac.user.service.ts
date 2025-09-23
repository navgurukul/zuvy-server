import { BadRequestException, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { db } from 'src/db/index';
import { asc, eq, sql } from 'drizzle-orm';
import { CreateUserRoleDto, AssignUserRoleDto, CreateUserDto, UpdateUserDto } from './dto/user-role.dto';
import { users, zuvyUserRoles, zuvyUserRolesAssigned } from 'drizzle/schema';
import { BigInt } from 'postgres';

@Injectable()
export class RbacUserService {
  private readonly logger = new Logger(RbacUserService.name);

  async createUserRole(createUserRoleDto: CreateUserRoleDto): Promise<any> {
    try {
      const { name, description } = createUserRoleDto;
      const result = await db.execute(
        sql`INSERT INTO main.zuvy_user_roles (name, description) VALUES (${name}, ${description ?? null}) RETURNING *`
      );
      if ((result as any).rows.length > 0) {
        return {
          status: 'success',
          message: 'User role created successfully',
          code: 200,
          data: (result as any).rows[0]
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: 'User role creation failed. Please try again'
        };
      }
    } catch (err) {
      throw err;
    }
  }

  async getAllUserRoles(): Promise<any> {
    try {
      const result = await db.execute(sql`SELECT * FROM main.zuvy_user_roles`);
      return {
        status: 'success',
        message: 'User roles retrieved successfully',
        code: 200,
        data: (result as any).rows
      };
    } catch (err) {
      throw err;
    }
  }

  async assignRoleToUser(payload: AssignUserRoleDto): Promise<any> {
    const { userId, roleId } = payload;
    try {
      // Ensure user exists
      const userCheck = await db.execute(
        sql`SELECT id FROM main.users WHERE id = ${userId} LIMIT 1`
      );
      if (!(userCheck as any).rows?.length) {
        return {
          status: 'error',
          code: 404,
          message: 'User not found'
        };
      }

      // Ensure role exists
      const roleCheck = await db.execute(
        sql`SELECT id FROM main.zuvy_user_roles WHERE id = ${roleId} LIMIT 1`
      );
      if (!(roleCheck as any).rows?.length) {
        return {
          status: 'error',
          code: 404,
          message: 'Role not found'
        };
      }

      // Assign role to user, ignore if already assigned
      const insertResult = await db.execute(sql`
        INSERT INTO main.zuvy_user_roles_assigned (user_id, role_id)
        VALUES (${userId}, ${roleId})
        ON CONFLICT (user_id, role_id) DO NOTHING
        RETURNING *
      `);

      if ((insertResult as any).rows?.length) {
        return {
          status: 'success',
          code: 200,
          message: 'Role assigned to user successfully',
          data: (insertResult as any).rows[0]
        };
      }

      return {
        status: 'success',
        code: 200,
        message: 'Role already assigned to user'
      };
    } catch (err) {
      this.logger.error('Failed to assign role to user', err as any);
      throw err;
    }
  }

  // Corrected code with data transformation
 // In your service
  async getAllUsersWithRoles(limit: number, offset:number) {
      try {
          const userData = await db
          .select({
            id: zuvyUserRolesAssigned.id,
            roleId: zuvyUserRolesAssigned.roleId,
            userId: zuvyUserRolesAssigned.userId,
            name: users.name,
            email: users.email,
            roleName: zuvyUserRoles.name
          })
          .from(zuvyUserRolesAssigned)
          .leftJoin(users, eq(zuvyUserRolesAssigned.userId, users.id))
          .leftJoin(zuvyUserRoles, eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id))
          .limit(limit)
          .offset(offset)
          .orderBy(asc(users.name));

        return userData.map(u => ({
          ...u,
          userId: Number(u.userId), // convert string → number
        }));
      } catch (error) {
          console.error('Error in getAllUsersWithRoles:', error);
          throw new InternalServerErrorException('Failed to retrieve users');
      }
  }

  async getUserByIdWithRole(id: bigint) {
    try {
      const [userData] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          roleId: zuvyUserRoles.id,
          roleName: zuvyUserRoles.name,
          roleDescription: zuvyUserRoles.description,
          createdAt: zuvyUserRolesAssigned.createdAt,
          updatedAt: zuvyUserRolesAssigned.updatedAt
        })
        .from(users)
        .leftJoin(zuvyUserRolesAssigned, eq(users.id, zuvyUserRolesAssigned.userId))
        .leftJoin(zuvyUserRoles, eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id))
        .where(eq(users.id, id));

      if (!userData) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return userData;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve user');
    }
  }

  async createUserWithRole(createUserDto: CreateUserDto) {
    try {
      console.log('Creating user with data:', createUserDto);
      const insertedUser = await db.insert(users).values({
        name: createUserDto.name,
        email: createUserDto.email
      }).returning();
      console.log('Inserted User:', insertedUser);
      return await db.transaction(async (tx) => {
        // First create the user
        const [user] = await tx
          .insert(users)
          .values({
            name: createUserDto.name,
            email: createUserDto.email
          })
          .returning();

        if (!user) {
          throw new InternalServerErrorException('Failed to create user');
        }

        let rolesAssignData = {
          userId: user.id,
          roleId: createUserDto.roleId
        };

        // Then assign the role
        const [userRole] = await tx
          .insert(zuvyUserRolesAssigned)
          .values(rolesAssignData)
          .returning();

        if (!userRole) {
          throw new InternalServerErrorException('Failed to assign role to user');
        }

        // Get the complete user data with role
        const [userWithRole] = await tx
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            roleId: zuvyUserRoles.id,
            roleName: zuvyUserRoles.name,
            roleDescription: zuvyUserRoles.description,
            createdAt: zuvyUserRolesAssigned.createdAt,
            updatedAt: zuvyUserRolesAssigned.updatedAt
          })
          .from(users)
          .leftJoin(zuvyUserRolesAssigned, eq(users.id, zuvyUserRolesAssigned.userId))
          .leftJoin(zuvyUserRoles, eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id))
          .where(eq(users.id, user.id));

        // Convert BigInt to Number for JSON serialization
        return {
          ...userWithRole,
          id: Number(userWithRole.id),
          roleId: userWithRole.roleId ? Number(userWithRole.roleId) : null
        };
      });
    } catch (error) {
      if (error.code === '23505') {
        throw new BadRequestException('User with this email already exists');
      }
      if (error.code === '23503') {
        throw new BadRequestException('Invalid role ID');
      }
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to create user');
    }
  }

  async updateUser(id: bigint, updateUserDto: UpdateUserDto) {
    try {
      return await db.transaction(async (tx) => {
        // Prepare user update data (only include provided fields)
        const userUpdateData: { name?: string; email?: string } = {};

        if (updateUserDto.name !== undefined) {
          userUpdateData.name = updateUserDto.name;
        }
        if (updateUserDto.email !== undefined) {
          userUpdateData.email = updateUserDto.email;
        }

        // Update user details only if there are fields to update
        let user;
        if (Object.keys(userUpdateData).length > 0) {
          [user] = await tx
            .update(users)
            .set(userUpdateData)
            .where(eq(users.id, id)) // Make sure users.id is the correct column reference
            .returning();

          if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
          }
        } else {
          [user] = await tx
            .select()
            .from(users)
            .where(eq(users.id, id));

          if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
          }
        }

        // Handle role update if roleId is provided
        if (updateUserDto.roleId !== undefined) {
          const existingRole = await tx
            .select()
            .from(zuvyUserRolesAssigned)
            .where(eq(zuvyUserRolesAssigned.userId, id)); // Make sure userId column exists

          if (existingRole.length > 0) {
            // Update existing role
            const [updatedRole] = await tx
              .update(zuvyUserRolesAssigned)
              .set({
                roleId: updateUserDto.roleId,
              })
              .where(eq(zuvyUserRolesAssigned.userId, id)) // Make sure userId column exists
              .returning();
          } else {
            let rolesAssignData = {
              userId: id,
              roleId: updateUserDto.roleId
            }
            // Assign new role
            const [newRole] = await tx
              .insert(zuvyUserRolesAssigned)
              .values(rolesAssignData)
              .returning();
          }
        }

        // Get updated user data with role
        const [userWithRole] = await tx
          .select({
            id: users.id,
            name: users.name,
            email: users.email,
            roleId: zuvyUserRoles.id,
            roleName: zuvyUserRoles.name,
            roleDescription: zuvyUserRoles.description,
            createdAt: zuvyUserRolesAssigned.createdAt,
            updatedAt: zuvyUserRolesAssigned.updatedAt
          })
          .from(users)
          .leftJoin(zuvyUserRolesAssigned, eq(users.id, zuvyUserRolesAssigned.userId)) // Make sure column names match
          .leftJoin(zuvyUserRoles, eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id)) // Make sure column names match
          .where(eq(users.id, id)); // Make sure users.id is the correct column reference

        return userWithRole;
      });
    } catch (error) {
      if (error.code === '23505') {
        throw new BadRequestException('User with this email already exists');
      }
      if (error.code === '23503') {
        throw new BadRequestException('Invalid role ID');
      }
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async deleteUser(id: bigint): Promise<void> {
    try {
      return await db.transaction(async (tx) => {
        // First delete the user role assignment
        const roleDeleteResult = await tx
          .delete(zuvyUserRolesAssigned)
          .where(eq(zuvyUserRolesAssigned.userId, id));

        // Then delete the user
        const userDeleteResult = await tx
          .delete(users)
          .where(eq(users.id, id));

        if (userDeleteResult.rowCount === 0) {
          throw new NotFoundException(`User with ID ${id} not found`);
        }
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to delete user');
    }
  }
}


