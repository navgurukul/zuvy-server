import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import {
  users,
  zuvyUserRoles,
  zuvyUserRolesAssigned,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { and, eq, ilike, inArray, or, sql, asc } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { JwtService } from '@nestjs/jwt';
import { parseInt } from 'lodash';
import {
  AssignUserRoleDto,
  CreateUserDto,
  CreateUserRoleDto,
  UpdateUserDto,
} from './dto/user-role.dto';
import { STATUS_CODES } from 'src/helpers';
import { ResourceList } from 'src/rbac/utility';
import { RbacAllocPermsService } from 'src/rbac/rbac.alloc-perms.service';
import { RbacService } from 'src/rbac/rbac.service';
import { CreateAuditlogDto } from 'src/auditlog/dto/create-auditlog.dto';
import { AuditlogService } from 'src/auditlog/auditlog.service';
import { AuthService } from 'src/auth/auth.service';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly usersJsonPath = path.join(process.cwd(), 'users.json');

  constructor(
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
    private readonly auditlogService: AuditlogService,
    private readonly authService: AuthService,
  ) {}

  /**
   * Fetch all users from the database and store them in a JSON file
   */
  async fetchAllUsersAndStoreToJson() {
    try {
      // Fetch all users from the database
      const allUsers = await db.select().from(users);

      // Convert to JSON string with pretty formatting
      const jsonData = JSON.stringify(allUsers, null, 2);

      // Write to file
      fs.writeFileSync(this.usersJsonPath, jsonData);

      return {
        status: 'success',
        message: 'All users fetched and stored in users.json',
        count: allUsers.length,
        filePath: this.usersJsonPath,
      };
    } catch (error) {
      this.logger.error(`Error fetching users: ${error.message}`, error.stack);
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
  }

  /**
   * Insert users from the JSON file into the database
   */
  async insertUsersFromJson() {
    try {
      // Check if the file exists
      if (!fs.existsSync(this.usersJsonPath)) {
        return {
          status: 'error',
          message: 'users.json file not found. Please fetch users first.',
        };
      }

      // Read the JSON file
      const jsonData = fs.readFileSync(this.usersJsonPath, 'utf8');
      const usersData = JSON.parse(jsonData);

      // Validate that the data is an array
      if (!Array.isArray(usersData)) {
        return {
          status: 'error',
          message: 'Invalid JSON format. Expected an array of users.',
        };
      }

      // Insert users into the database
      const insertedUsers = [];
      const errors = [];

      for (const userData of usersData) {
        try {
          // Remove the id field to avoid conflicts with existing records
          const { id, ...userWithoutId } = userData;

          // Check if user with this email already exists
          const existingUser = userData.email
            ? await db
                .select()
                .from(users)
                .where(eq(users.email, userData.email))
            : [];

          if (existingUser.length > 0) {
            // Update existing user
            const updatedUser = await db
              .update(users)
              .set(userWithoutId)
              .where(eq(users.email, userData.email))
              .returning();

            insertedUsers.push(updatedUser[0]);
          } else {
            // Insert new user
            const newUser = await db
              .insert(users)
              .values(userWithoutId)
              .returning();

            insertedUsers.push(newUser[0]);
          }
        } catch (error) {
          errors.push({
            user: userData,
            error: error.message,
          });
        }
      }

      return {
        status: 'success',
        message: 'Users inserted/updated from users.json',
        inserted: insertedUsers.length,
        errors: errors.length > 0 ? errors : null,
      };
    } catch (error) {
      this.logger.error(`Error inserting users: ${error.message}`, error.stack);
      throw new Error(`Failed to insert users: ${error.message}`);
    }
  }

  /**
   * Verify JWT token and check if user exists, if not create user
   * @param email Email of the user to check/create
   * @returns User information
   */
  async verifyTokenAndManageUser(token) {
    try {
      const decoded: any = await this.jwtService.decode(token);
      if (!decoded) {
        throw new UnauthorizedException('Invalid token');
      }

      const user: any[] = await db
        .select()
        .from(users)
        .where(
          sql`${users.id} = ${decoded.id} AND ${users.email} = ${decoded.email}`,
        );
      if (user.length > 0) {
        user[0].id = parseInt(user[0].id); // Assign default role

        return {
          status: 'success',
          message: 'User already exists in the database',
          user: user[0],
        };
      } else {
        // User doesn't exist, create new user
        let userInset: any = {
          id: decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.email.split('@')[0], // Use email as fallback for name
        };
        const newUser: any = await db
          .insert(users)
          .values(userInset)
          .returning();
        newUser[0].id = parseInt(newUser[0].id); // Assign default role
        return {
          status: 'success',
          message: 'New user created in the database',
          user: newUser[0],
        };
      }
    } catch (error) {
      this.logger.error(`Error verifying user: ${error.message}`, error.stack);
      throw new Error(`Failed to verify user: ${error.message}`);
    }
  }

  private async getRoleNameById(tx, roleId: number) {
    const [role] = await tx
      .select({ name: zuvyUserRoles.name })
      .from(zuvyUserRoles)
      .where(eq(zuvyUserRoles.id, roleId));
    return role?.name ?? '';
  }

  async createUserRole(createUserRoleDto: CreateUserRoleDto): Promise<any> {
    try {
      const { name, description } = createUserRoleDto;
      const result = await db.execute(
        sql`INSERT INTO main.zuvy_user_roles (name, description) VALUES (${name}, ${description ?? null}) RETURNING *`,
      );
      if ((result as any).rows.length > 0) {
        return {
          status: 'success',
          message: 'User role created successfully',
          code: 200,
          data: (result as any).rows[0],
        };
      } else {
        return {
          status: 'error',
          code: 400,
          message: 'User role creation failed. Please try again',
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
        data: (result as any).rows,
      };
    } catch (err) {
      throw err;
    }
  }

  async roleCheck(roleId: number) {
    const roleDetails = await db.execute(
      sql`SELECT id, name FROM main.zuvy_user_roles WHERE id = ${roleId} LIMIT 1`,
    );
    if (!(roleDetails as any).rows?.length) {
      return {
        status: 'error',
        code: 404,
        message: 'Role not found',
        data: null,
      };
    }
    return roleDetails;
  }

  async assignRoleToUser(
    actorUserIdString,
    payload: AssignUserRoleDto,
  ): Promise<any> {
    const { userId, roleId } = payload;
    try {
      const actorUserId = Number(actorUserIdString);
      const userCheck = await db.execute(
        sql`SELECT id, name FROM main.users WHERE id = ${userId} LIMIT 1`,
      );

      if (!(userCheck as any).rows?.length) {
        return {
          status: 'error',
          code: 404,
          message: 'User not found',
          data: null,
        };
      }

      const actorUserCheck = await db.execute(
        sql`SELECT id, name FROM main.users WHERE id = ${actorUserId} LIMIT 1`,
      );
      if (!(actorUserCheck as any).rows?.length) {
        return {
          status: 'error',
          code: 404,
          message: 'User not found',
          data: null,
        };
      }

      const roleCheck = await this.roleCheck(roleId);

      const existing = await db.execute(
        sql`SELECT role_id FROM main.zuvy_user_roles_assigned WHERE user_id = ${userId} LIMIT 1`,
      );

      const targetUserId = userId;
      const actorName = (actorUserCheck as any).rows?.[0]?.name;
      const targetName = (userCheck as any).rows?.[0]?.name;
      const roleName = (roleCheck as any).rows?.[0]?.name;

      if ((existing as any).rows?.length) {
        const currentRoleId = (existing as any).rows[0].role_id;
        if (Number(currentRoleId) === Number(roleId)) {
          return {
            status: 'success',
            code: 200,
            message: 'Role already assigned to user',
            data: { userId, roleId },
          };
        }
        await db.execute(
          sql`DELETE FROM main.zuvy_user_roles_assigned WHERE user_id = ${userId}`,
        );
        const updated = await db.execute(sql`
          INSERT INTO main.zuvy_user_roles_assigned (user_id, role_id)
          VALUES (${userId}, ${roleId})
          RETURNING *`);
        const currentRoleDetails = await this.roleCheck(currentRoleId);
        const currentRoleName = (currentRoleDetails as any).rows?.[0]?.name;
        const actionUpdate = `${actorName} updated ${targetName}'s role from ${currentRoleName} to ${roleName}`;
        const auditLog = await this.auditlogService.log('role_to_user', {
          actorUserId,
          targetUserId,
          roleId,
          action: actionUpdate,
        });
        return {
          status: 'success',
          code: 200,
          message: 'Role updated for user',
          data: (updated as any).rows[0],
        };
      }

      const inserted = await db.execute(sql`
        INSERT INTO main.zuvy_user_roles_assigned (user_id, role_id)
        VALUES (${userId}, ${roleId})
        RETURNING *`);

      const action = `${actorName} assigned role ${roleName} to ${targetName}`;
      const auditLog = await this.auditlogService.log('role_to_user', {
        actorUserId,
        targetUserId,
        roleId,
        action,
      });

      return {
        status: 'success',
        code: 200,
        message: 'Role assigned to user successfully',
        data: (inserted as any).rows[0] ?? null,
      };
    } catch (err) {
      this.logger.error('Failed to assign role to user', err as any);
      throw err;
    }
  }

  async getAllUsersWithRoles(
    roleName: string[],
    limit: number,
    offset: number,
    searchTerm: string = '',
    roleId?: number | number[],
  ): Promise<any> {
    try {
      const search = `%${searchTerm}%`;

      // Build the base conditions - name OR email se search
      const baseConditions = or(
        ilike(users.name, search),
        ilike(users.email, search),
      );

      // Add role filter if roleId is provided
      let finalCondition = baseConditions;

      if (roleId !== undefined && roleId !== null) {
        if (Array.isArray(roleId)) {
          // Multiple role IDs
          finalCondition = and(
            baseConditions,
            inArray(zuvyUserRolesAssigned.roleId, roleId),
          );
        } else {
          // Single role ID
          finalCondition = and(
            baseConditions,
            eq(zuvyUserRolesAssigned.roleId, roleId),
          );
        }
      }

      // 1. Query for filtered users
      const userData = await db
        .select({
          id: zuvyUserRolesAssigned.id,
          roleId: zuvyUserRolesAssigned.roleId,
          userId: zuvyUserRolesAssigned.userId,
          name: users.name,
          email: users.email,
          roleName: zuvyUserRoles.name,
          createdAt: zuvyUserRolesAssigned.createdAt,
        })
        .from(zuvyUserRolesAssigned)
        .leftJoin(users, eq(zuvyUserRolesAssigned.userId, users.id))
        .leftJoin(
          zuvyUserRoles,
          eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
        )
        .where(finalCondition)
        .limit(limit)
        .offset(offset)
        .orderBy(asc(users.name));

      // 2. Query for total count (same filter but without limit/offset)
      const totalCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(zuvyUserRolesAssigned)
        .leftJoin(users, eq(zuvyUserRolesAssigned.userId, users.id))
        .where(finalCondition);

      const totalRows = Number(totalCount[0]?.count ?? 0);
      const totalPages =
        !Number.isNaN(limit) && limit > 0 ? Math.ceil(totalRows / limit) : 1;

      const targetPermissions = [
        ResourceList.user.read,
        ResourceList.user.create,
        ResourceList.user.edit,
        ResourceList.user.delete,
        ResourceList.rolesandpermission.read,
        ResourceList.rolesandpermission.create,
        ResourceList.rolesandpermission.edit,
        ResourceList.rolesandpermission.delete,
      ];
      const permissionsResult = await this.rbacService.getAllPermissions(
        roleName,
        targetPermissions,
      );

      return {
        status: 'success',
        message: 'Users retrieved successfully',
        code: STATUS_CODES.OK,
        data: userData.map((u) => ({
          ...u,
          userId: Number(u.userId),
        })),
        ...permissionsResult,
        totalRows,
        totalPages,
      };
    } catch (error) {
      console.error('Error in getAllUsersWithRoles:', error);
      throw error;
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
          updatedAt: zuvyUserRolesAssigned.updatedAt,
        })
        .from(users)
        .leftJoin(
          zuvyUserRolesAssigned,
          eq(users.id, zuvyUserRolesAssigned.userId),
        )
        .leftJoin(
          zuvyUserRoles,
          eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
        )
        .where(eq(users.id, id));

      if (!userData) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return userData;
    } catch (error) {
      throw error;
    }
  }

  async createUserWithRole(createUserDto: CreateUserDto) {
    try {
      return await db.transaction(async (tx) => {
        // First check if user with email already exists
        const [existingUser] = await tx
          .select()
          .from(users)
          .where(eq(users.email, createUserDto.email));

        let user;

        if (existingUser) {
          // User exists, check if they already have this role assigned
          const existingRole = await tx
            .select()
            .from(zuvyUserRolesAssigned)
            .where(
              and(
                eq(zuvyUserRolesAssigned.userId, existingUser.id),
                eq(zuvyUserRolesAssigned.roleId, createUserDto.roleId),
              ),
            );

          if (existingRole.length > 0) {
            throw new BadRequestException(
              'User already has this role assigned',
            );
          }

          // User exists but doesn't have this role - assign the role
          user = existingUser;
        } else {
          // User doesn't exist - create new user
          const [newUser] = await tx
            .insert(users)
            .values({
              name: createUserDto.name,
              email: createUserDto.email,
            })
            .returning();

          if (!newUser) {
            throw new InternalServerErrorException('Failed to create user');
          }
          user = newUser;
        }

        let rolesAssignData = {
          userId: user.id,
          roleId: createUserDto.roleId,
        };
        // Assign role to user (whether existing or new)
        const [userRole] = await tx
          .insert(zuvyUserRolesAssigned)
          .values(rolesAssignData)
          .returning();

        if (!userRole) {
          throw new InternalServerErrorException(
            'Failed to assign role to user',
          );
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
            updatedAt: zuvyUserRolesAssigned.updatedAt,
          })
          .from(users)
          .leftJoin(
            zuvyUserRolesAssigned,
            eq(users.id, zuvyUserRolesAssigned.userId),
          )
          .leftJoin(
            zuvyUserRoles,
            eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
          )
          .where(eq(users.id, user.id));

        // Convert BigInt to Number for JSON serialization
        return {
          ...userWithRole,
          id: Number(userWithRole.id),
          roleId: userWithRole.roleId ? Number(userWithRole.roleId) : null,
        };
      });
    } catch (error) {
      throw error;
    }
  }

  async updateUser(id: bigint, updateUserDto: UpdateUserDto) {
    try {
      return await db.transaction(async (tx) => {
        const currentTime = new Date().toISOString(); // ISO string format

        // Prepare user update data (only include provided fields)
        const userUpdateData: {
          name?: string;
          email?: string;
          updatedAt?: string;
        } = {};

        if (updateUserDto.name !== undefined) {
          userUpdateData.name = updateUserDto.name;
        }
        if (updateUserDto.email !== undefined) {
          userUpdateData.email = updateUserDto.email;
        }

        // Add updatedAt timestamp if any user data is being updated
        if (Object.keys(userUpdateData).length > 0) {
          userUpdateData.updatedAt = currentTime;
        }

        // Update user details only if there are fields to update
        let user;
        if (Object.keys(userUpdateData).length > 0) {
          [user] = await tx
            .update(users)
            .set(userUpdateData)
            .where(eq(users.id, id))
            .returning();

          if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
          }
        } else {
          [user] = await tx.select().from(users).where(eq(users.id, id));

          if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
          }
        }

        // Handle role update if roleId is provided
        if (updateUserDto.roleId !== undefined) {
          const existingRole = await tx
            .select()
            .from(zuvyUserRolesAssigned)
            .where(eq(zuvyUserRolesAssigned.userId, id));

          if (existingRole.length > 0) {
            // Update existing role with updatedAt - FIXED TYPE
            const roleUpdateData = {
              roleId: updateUserDto.roleId,
              updatedAt: currentTime, // ISO string for role assignment
            };

            const [updatedRole] = await tx
              .update(zuvyUserRolesAssigned)
              .set(roleUpdateData)
              .where(eq(zuvyUserRolesAssigned.userId, id))
              .returning();
            
          } else {
            let rolesAssignData = {
              userId: id,
              roleId: updateUserDto.roleId,
              createdAt: currentTime, // ISO string
              updatedAt: currentTime, // ISO string
            };
            // Assign new role
            const [newRole] = await tx
              .insert(zuvyUserRolesAssigned)
              .values(rolesAssignData)
              .returning();
          }
          const permissionsResult = await this.authService.refreshUserToken(id);
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
            updatedAt: zuvyUserRolesAssigned.updatedAt,
          })
          .from(users)
          .leftJoin(
            zuvyUserRolesAssigned,
            eq(users.id, zuvyUserRolesAssigned.userId),
          )
          .leftJoin(
            zuvyUserRoles,
            eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
          )
          .where(eq(users.id, id));

        return userWithRole;
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id: bigint): Promise<any> {
    try {
      // delete the user by id in zuvyUserRolesAssigned table
      const deletedUser = await db
        .delete(zuvyUserRolesAssigned)
        .where(eq(zuvyUserRolesAssigned.userId, id))
        .returning();
      if (deletedUser.length === 0) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }
      // send the response
      return {
        message: 'User deleted successfully',
        code: 204,
        status: 'success',
      };
    } catch (error) {
      throw error;
    }
  }
}
