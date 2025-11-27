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
  blacklistedTokens,
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
import { RbacService } from 'src/rbac/rbac.service';
import { AuditlogService } from 'src/auditlog/auditlog.service';
import { AuthService } from 'src/auth/auth.service';
import { UserTokensService } from 'src/user-tokens/user-tokens.service';
import { bigint } from 'drizzle-orm/mysql-core';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly usersJsonPath = path.join(process.cwd(), 'users.json');
  private readonly emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  constructor(
    private readonly jwtService: JwtService,
    private readonly rbacService: RbacService,
    private readonly auditlogService: AuditlogService,
    private readonly authService: AuthService,
    private readonly userTokenService: UserTokensService,
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

  async getAllUserRoles(roleName: string, duplicate?: boolean): Promise<any> {
    try {
      if (duplicate) {
        try {
          const result = await db.execute(
            sql`SELECT * FROM main.zuvy_user_roles`,
          );
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

      let query;

      if (roleName[0] === 'super admin') {
        query = sql`SELECT * FROM main.zuvy_user_roles WHERE name != 'super admin'`;
      } else if (roleName[0] === 'admin') {
        query = sql`SELECT * FROM main.zuvy_user_roles WHERE name NOT IN ('admin', 'super admin')`;
      } else {
        query = sql`SELECT * FROM main.zuvy_user_roles WHERE name NOT IN ('admin', 'super admin')`;
      }

      const result = await db.execute(query);

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

  // create a function to assign defualt permissions to a role
  async assignDefaultPermissionsToRole(
    roleId: number,
    roleName: string,
  ): Promise<any> {
    try {
      // 🔍 Step 1: Check if role already has any permissions
      const existingPermissions = await db.execute(
        sql`SELECT COUNT(*) AS count FROM main.zuvy_permissions_roles WHERE role_id = ${roleId}`,
      );

      const alreadyAssigned = Number(
        (existingPermissions as any).rows?.[0]?.count ?? 0,
      );

      if (alreadyAssigned > 0) {
        this.logger.log(
          `Role ID ${roleId} (${roleName}) already has permissions assigned. Skipping default assignment.`,
        );
        return {
          status: 'skipped',
          message: `Permissions already assigned for role: ${roleName}`,
          code: 200,
        };
      }

      // 🧩 Step 2: Build list of default permissions
      let defaultPermissions: string[] = [];

      // ✅ Assign view/create for all resources only if role is 'admin'
      if (roleName.toLowerCase() === 'admin') {
        for (const resource of Object.values(ResourceList)) {
          defaultPermissions.push(resource.read, resource.create);
        }
      } else {
        // Assign limited defaults for non-admin roles
        defaultPermissions = [
          ResourceList.course.read,
          ResourceList.batch.read,
          ResourceList.module.read,
          ResourceList.chapter.read,
          ResourceList.student.read,
          ResourceList.bootcamp.read,
          ResourceList.mcq.read,
          ResourceList.codingquestion.read,
          ResourceList.opendended.read,
          ResourceList.topic.read,
        ];
      }

      // 🏗️ Step 3: Insert missing permissions
      for (const permission of defaultPermissions) {
        const permissionDetails = await db.execute(
          sql`SELECT id FROM main.zuvy_permissions WHERE name = ${permission} LIMIT 1`,
        );

        if (!(permissionDetails as any).rows?.length) {
          throw new NotFoundException(`Permission ${permission} not found`);
        }

        const permissionId = (permissionDetails as any).rows[0].id;
        await db.execute(
          sql`INSERT INTO main.zuvy_permissions_roles (role_id, permission_id)
             VALUES (${roleId}, ${permissionId})
             ON CONFLICT DO NOTHING`,
        );
      }

      // ✅ Step 4: Return success
      return {
        status: 'success',
        message: `Default permissions assigned successfully for role: ${roleName}`,
        code: 200,
      };
    } catch (err) {
      this.logger.error('Error assigning default permissions to role:', err);
      throw new InternalServerErrorException(
        'Failed to assign default permissions to role',
      );
    }
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
        // ✅ Assign default permissions for new role
        await this.assignDefaultPermissionsToRole(roleId, roleName);

        const currentRoleDetails = await this.roleCheck(currentRoleId);
        const currentRoleName = (currentRoleDetails as any).rows?.[0]?.name;
        const actionUpdate = `${actorName} updated ${targetName}'s role from ${currentRoleName} to ${roleName}`;

        const { data, success } = await this.userTokenService.getUserTokens(
          BigInt(targetUserId),
        );
        if (!success) {
          return {
            success: true,
            message:
              'User role updated. User did not login after role update. No tokens found, skipping logout and delete',
          };
        }
        await this.authService.updateUserlogout(
          BigInt(targetUserId),
          data['accessToken'],
          data['refreshToken'],
        );
        const deletedResponse = await this.userTokenService.deleteToken({
          userId: targetUserId,
        });

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

      // ✅ Assign default permissions for new role
      await this.assignDefaultPermissionsToRole(roleId, roleName);

      const action = `${actorName} assigned role ${roleName} to ${targetName}`;

      const { data } = await this.userTokenService.getUserTokens(
        BigInt(targetUserId),
      );
      await this.authService.logout(BigInt(targetUserId), data['accessToken']);

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
      const emailInput = createUserDto.email;
      const normalizedEmail =
        typeof emailInput === 'string' ? emailInput.trim() : '';

      if (!normalizedEmail || !this.isValidEmail(normalizedEmail)) {
        throw new BadRequestException('Invalid email format');
      }

      createUserDto.email = normalizedEmail;

      return await db.transaction(async (tx) => {
        const [existingUser] = await tx
          .select()
          .from(users)
          .where(eq(users.email, createUserDto.email));

        let user;
        let userRole;
        let shouldAssignRole = false;

        if (existingUser) {
          user = existingUser;

          const existingAssignments = await tx
            .select({ roleId: zuvyUserRolesAssigned.roleId })
            .from(zuvyUserRolesAssigned)
            .where(eq(zuvyUserRolesAssigned.userId, existingUser.id));

          const hasSameRole = existingAssignments.some(
            (assignment) =>
              Number(assignment.roleId) === Number(createUserDto.roleId),
          );

          if (hasSameRole) {
            throw new BadRequestException(
              'User already has this role assigned',
            );
          }

          if (existingAssignments.length > 0) {
            throw new BadRequestException(
              'User already exists, please update role of the user instead',
            );
          }

          shouldAssignRole = true;
        } else {
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
          shouldAssignRole = true;
        }

        if (shouldAssignRole) {
          const rolesAssignData = {
            userId: user.id,
            roleId: createUserDto.roleId,
          };

          const [newUserRole] = await tx
            .insert(zuvyUserRolesAssigned)
            .values(
              rolesAssignData as unknown as typeof zuvyUserRolesAssigned.$inferInsert,
            )
            .returning();

          if (!newUserRole) {
            throw new InternalServerErrorException(
              'Failed to assign role to user',
            );
          }

          userRole = newUserRole;
        }

        if (!userRole) {
          throw new InternalServerErrorException(
            'Failed to assign role to user',
          );
        }

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

        if (!userWithRole) {
          throw new InternalServerErrorException(
            'Failed to fetch user with role',
          );
        }

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

  // get user by id and innerjoin with zuvyUserRolesAssigned and zuvyUserRoles to get role details
  async getUserById(id: bigint) {
    try {
      const [user] = await db
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

      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      return user;
    } catch (error) {
      throw error;
    }
  }

  async updateUser(id: bigint, updateUserDto: UpdateUserDto) {
    try {
      const targetUserId = typeof id === 'bigint' ? id : BigInt(id);
      // compare email and roleId with existing data and update only name and return
      const existingUser = await this.getUserById(targetUserId);
      // check if email and roleId with existing data and update only name and return
      if (
        updateUserDto.email === existingUser.email &&
        updateUserDto.roleId === Number(existingUser.roleId)
      ) {
        // Only name is being updated
        return await db
          .update(users)
          .set({
            name: updateUserDto.name,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(users.id, targetUserId));
      }

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
          const emailInput = updateUserDto.email;
          const normalizedEmail =
            typeof emailInput === 'string' ? emailInput.trim() : '';

          if (!normalizedEmail || !this.isValidEmail(normalizedEmail)) {
            throw new BadRequestException('Invalid email format');
          }

          const [userWithSameEmail] = await tx
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, normalizedEmail));

          const emailOwnerId =
            userWithSameEmail &&
            (typeof userWithSameEmail.id === 'bigint'
              ? userWithSameEmail.id
              : BigInt(userWithSameEmail.id));

          if (emailOwnerId && emailOwnerId !== targetUserId) {
            throw new BadRequestException(
              'User already exists with this email id',
            );
          }

          userUpdateData.email = normalizedEmail;
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
            .where(eq(users.id, targetUserId))
            .returning();

          if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
          }
        } else {
          [user] = await tx
            .select()
            .from(users)
            .where(eq(users.id, targetUserId));

          if (!user) {
            throw new NotFoundException(`User with ID ${id} not found`);
          }
        }

        // Handle role update if roleId is provided
        if (updateUserDto.roleId !== undefined) {
          const existingRole = await tx
            .select()
            .from(zuvyUserRolesAssigned)
            .where(eq(zuvyUserRolesAssigned.userId, targetUserId));

          if (existingRole.length > 0) {
            // Update existing role with updatedAt - FIXED TYPE
            const roleUpdateData = {
              roleId: updateUserDto.roleId,
              updatedAt: currentTime, // ISO string for role assignment
            };

            const [updatedRole] = await tx
              .update(zuvyUserRolesAssigned)
              .set(roleUpdateData)
              .where(eq(zuvyUserRolesAssigned.userId, targetUserId))
              .returning();
          } else {
            let rolesAssignData = {
              userId: targetUserId,
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
          .where(eq(users.id, targetUserId));

        if (!userWithRole) {
          throw new InternalServerErrorException(
            'Failed to fetch user with role',
          );
        }

        const response = {
          ...userWithRole,
          id: Number(userWithRole.id),
          roleId: userWithRole.roleId ? Number(userWithRole.roleId) : null,
        };

        const { data, success } =
          await this.userTokenService.getUserTokens(targetUserId);

        if (success && data?.accessToken) {
          await this.authService.updateUserlogout(
            targetUserId,
            data.accessToken,
            data.refreshToken,
          );

          const deletedResponse = await this.userTokenService.deleteToken({
            userId: Number(id),
          });
        }

        return response;
      });
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id: bigint): Promise<any> {
    try {
      const { data: existingTokens, success: hasTokens } =
        await this.userTokenService.getUserTokens(id);

      // delete the user by id in zuvyUserRolesAssigned table
      const deletedUser = await db
        .delete(zuvyUserRolesAssigned)
        .where(eq(zuvyUserRolesAssigned.userId, id))
        .returning();
      if (deletedUser.length === 0) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      if (hasTokens && existingTokens?.accessToken) {
        try {
          await this.authService.logout(id, existingTokens.accessToken);
        } catch (logoutError) {
          this.logger.warn(
            `Failed to invalidate tokens for user ${id.toString()}: ${
              (logoutError as Error).message
            }`,
          );
        }
      }

      await this.userTokenService.deleteToken({
        userId: Number(id),
      });

      return {
        message:
          'User has been deleted and all content has been removed for the user',
        code: 200,
        status: 'success',
      };
    } catch (error) {
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    return this.emailRegex.test(email);
  }
}
