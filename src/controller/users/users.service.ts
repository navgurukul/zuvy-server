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
  zuvyUserOrganizations,
  zuvyOrganizations,
  zuvyPermissions,
  zuvyPermissionsRoles,
  blacklistedTokens,
} from '../../../drizzle/schema';
import { db } from '../../db/index';
import { and, eq, ilike, inArray, or, sql, asc, not } from 'drizzle-orm';
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

      //Normalize name (case-insensitive handling)
      const normalizedName = name.trim().toLowerCase();

      // Fetch all roles with same name
      const existingRole = await db.query.zuvyUserRoles.findFirst({
        where: (roles, { eq }) => eq(roles.name, normalizedName),
      });

      if (existingRole) {
        return {
          status: 'error',
          code: 400,
          message: 'User role with this name already exists',
        };
      }

      // Create new role data
      const newRoleData = {
        name: normalizedName,
        description: description ?? null,
        orgId: createUserRoleDto.orgId, // Default orgId to 1 if not provided
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const [createdRole] = await db
        .insert(zuvyUserRoles)
        .values(newRoleData)
        .returning();

      return {
        status: 'success',
        message: 'User role created successfully',
        code: 200,
        data: createdRole,
      };
    } catch (err) {
      throw err;
    }
  }

  async getAllUserRoles(
    orgId: number,
    roleName: string,
    duplicate?: boolean,
  ): Promise<any> {
    orgId = Number(orgId);
    try {
      if (duplicate) {
        try {
          const result = await db
            .select()
            .from(zuvyUserRoles)
            .where(eq(zuvyUserRoles.orgId, orgId));

          return {
            status: 'success',
            message: 'User roles retrieved successfully',
            code: 200,
            data: result,
          };
        } catch (err) {
          throw err;
        }
      }

      let result;

      if (roleName[0] === 'super admin') {
        result = await db
          .select()
          .from(zuvyUserRoles)
          .where(
            and(
              not(eq(zuvyUserRoles.name, 'super_admin')),
              eq(zuvyUserRoles.orgId, orgId),
            ),
          );
      } else {
        result = await db
          .select()
          .from(zuvyUserRoles)
          .where(
            and(
              not(inArray(zuvyUserRoles.name, ['admin', 'super_admin'])),
              eq(zuvyUserRoles.orgId, orgId),
            ),
          );
      }

      return {
        status: 'success',
        message: 'User roles retrieved successfully',
        code: 200,
        data: result,
      };
    } catch (err) {
      throw err;
    }
  }

  async roleCheck(roleId: number) {
    const [roleDetails] = await db
      .select({
        id: zuvyUserRoles.id,
        name: zuvyUserRoles.name,
      })
      .from(zuvyUserRoles)
      .where(eq(zuvyUserRoles.id, roleId))
      .limit(1);

    if (!roleDetails) {
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
    orgId: number,
    tx?: any,
  ): Promise<any> {
    try {
      const executor = tx ?? db;

      const [existingPermissions] = await executor
        .select({ count: sql<number>`count(*)` })
        .from(zuvyPermissionsRoles)
        .where(
          and(
            eq(zuvyPermissionsRoles.roleId, roleId),
            eq(zuvyPermissionsRoles.orgId, orgId),
          ),
        );

      const alreadyAssigned = Number(existingPermissions?.count ?? 0);

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

      let defaultPermissions: string[] = [];

      if (roleName?.toLowerCase() === 'admin') {
        for (const resource of Object.values(ResourceList)) {
          defaultPermissions.push(resource.read, resource.create);
        }
      } else {
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

      for (const permission of defaultPermissions) {
        const [permissionDetails] = await executor
          .select({ id: zuvyPermissions.id })
          .from(zuvyPermissions)
          .where(eq(zuvyPermissions.name, permission))
          .limit(1);

        if (!permissionDetails) {
          this.logger.warn(
            `Permission not found in DB, skipping: ${permission}`,
          );
          continue;
        }

        await executor
          .insert(zuvyPermissionsRoles)
          .values({
            roleId,
            permissionId: permissionDetails.id,
            orgId,
          } as unknown as typeof zuvyPermissionsRoles.$inferInsert)
          .onConflictDoNothing();
      }

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
    const { userId, roleId, orgId } = payload;
    try {
      const actorUserId = Number(actorUserIdString);
      const [userCheck] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, BigInt(userId)))
        .limit(1);

      if (!userCheck) {
        return {
          status: 'error',
          code: 404,
          message: 'User not found',
          data: null,
        };
      }

      const [actorUserCheck] = await db
        .select({
          id: users.id,
          name: users.name,
        })
        .from(users)
        .where(eq(users.id, BigInt(actorUserId)))
        .limit(1);

      if (!actorUserCheck) {
        return {
          status: 'error',
          code: 404,
          message: 'User not found',
          data: null,
        };
      }

      const roleCheck = await this.roleCheck(roleId);

      if (!roleCheck) {
        return {
          status: 'error',
          code: 404,
          message: 'Role not found',
          data: null,
        };
      }

      const [existing] = await db
        .select({ roleId: zuvyUserRolesAssigned.roleId })
        .from(zuvyUserRolesAssigned)
        .where(
          and(
            eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
            eq(zuvyUserRolesAssigned.organizationId, orgId),
          ),
        )
        .limit(1);

      const targetUserId = userId;
      const actorName = actorUserCheck.name;
      const targetName = userCheck.name;
      const targetEmail = userCheck.email || '';
      const roleName = roleCheck['name'];

      if (existing) {
        const currentRoleId = existing.roleId;
        if (Number(currentRoleId) === Number(roleId)) {
          return {
            status: 'success',
            code: 200,
            message: 'Role already assigned to user',
            data: { userId, roleId },
          };
        }

        const updatedAssignment = await db.transaction(async (tx) => {
          await tx
            .delete(zuvyUserRolesAssigned)
            .where(
              and(
                eq(zuvyUserRolesAssigned.userId, BigInt(userId)),
                eq(zuvyUserRolesAssigned.organizationId, orgId),
              ),
            );

          const [updated] = await tx
            .insert(zuvyUserRolesAssigned)
            .values({
              userId: BigInt(userId),
              roleId,
              organizationId: orgId,
            } as any)
            .returning();

          await this.assignDefaultPermissionsToRole(
            roleId,
            roleName,
            orgId,
            tx,
          );

          const [existingUserOrgUpdate] = await tx
            .select()
            .from(zuvyUserOrganizations)
            .where(
              and(
                eq(zuvyUserOrganizations.userId, Number(userId)),
                eq(zuvyUserOrganizations.organizationId, orgId),
              ),
            );
          if (!existingUserOrgUpdate) {
            await tx.insert(zuvyUserOrganizations).values({
              userId: Number(userId),
              userEmail: targetEmail,
              organizationId: orgId,
            } as unknown as typeof zuvyUserOrganizations.$inferInsert);
          }

          return updated;
        });

        const currentRoleDetails = await this.roleCheck(currentRoleId);
        const currentRoleName = currentRoleDetails
          ? currentRoleDetails['name']
          : 'Unknown';
        const actionUpdate = `${actorName} updated ${targetName}'s role from ${currentRoleName} to ${roleName}`;

        const { data, success } = await this.userTokenService.getUserTokens(
          BigInt(targetUserId),
          orgId,
        );

        if (!success) {
          this.logger.warn(
            `No tokens found for user ${targetUserId} after role update; skipping logout/delete.`,
          );
        }

        await this.logoutAndDeleteUserTokens(targetUserId, data, orgId);

        await this.auditlogService.log('role_to_user', {
          actorUserId,
          targetUserId,
          roleId,
          action: actionUpdate,
        });
        return {
          status: 'success',
          code: 200,
          message: 'Role updated for user',
          data: updatedAssignment,
          descriptionPrefix: 'a role to a user',
          userEmail: targetEmail,
        };
      }

      const insertedAssignment = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(zuvyUserRolesAssigned)
          .values({
            userId: BigInt(userId),
            roleId,
            organizationId: orgId,
          } as unknown as typeof zuvyUserRolesAssigned.$inferInsert)
          .returning();

        await this.assignDefaultPermissionsToRole(roleId, roleName, orgId, tx);

        const [existingUserOrgInsert] = await tx
          .select()
          .from(zuvyUserOrganizations)
          .where(
            and(
              eq(zuvyUserOrganizations.userId, Number(userId)),
              eq(zuvyUserOrganizations.organizationId, orgId),
            ),
          );
        if (!existingUserOrgInsert) {
          await tx.insert(zuvyUserOrganizations).values({
            userId: Number(userId),
            userEmail: targetEmail,
            organizationId: orgId,
          } as unknown as typeof zuvyUserOrganizations.$inferInsert);
        }

        return inserted;
      });

      const action = `${actorName} assigned role ${roleName} to ${targetName}`;

      const { data, success } = await this.userTokenService.getUserTokens(
        BigInt(targetUserId),
        orgId,
      );

      if (!success) {
        this.logger.warn(
          `No tokens found for user ${targetUserId} after role assignment; skipping logout/delete.`,
        );
      }

      await this.logoutAndDeleteUserTokens(targetUserId, data, orgId);

      await this.auditlogService.log('role_to_user', {
        actorUserId,
        targetUserId,
        roleId,
        action,
      });

      return {
        status: 'success',
        code: 200,
        message: 'Role assigned to user successfully',
        data: insertedAssignment ?? null,
        descriptionPrefix: 'a role to a user',
        userEmail: targetEmail,
      };
    } catch (err) {
      this.logger.error('Failed to assign role to user', err as any);
      throw err;
    }
  }

  private async logoutAndDeleteUserTokens(
    targetUserId: number,
    tokenData: any,
    orgId: number,
  ): Promise<void> {
    if (!tokenData?.accessToken || !tokenData?.refreshToken) {
      this.logger.warn(
        `Skipping logout for user ${targetUserId}; accessToken or refreshToken missing.`,
      );
      return;
    }

    try {
      await this.authService.updateUserlogout(
        targetUserId,
        tokenData.accessToken,
        tokenData.refreshToken,
      );
    } catch (error) {
      this.logger.warn(
        `Failed to logout user ${targetUserId} during role assignment. Continuing without failing.`,
        error,
      );
    }
  }

  async getAllUsersWithRoles(
    orgId: number,
    roleName: string[],
    limit: number,
    offset: number,
    searchTerm: string = '',
    roleId?: number | number[],
  ): Promise<any> {
    orgId = Number(orgId);
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

      if (orgId) {
        finalCondition = and(
          finalCondition,
          eq(zuvyUserRolesAssigned.organizationId, orgId),
        );
      }

      // Fetch org to get POC emails
      const [orgDetails] = await db
        .select({
          pocEmail: zuvyOrganizations.pocEmail,
          zuvyPocEmail: zuvyOrganizations.zuvyPocEmail,
        })
        .from(zuvyOrganizations)
        .where(eq(zuvyOrganizations.id, orgId));

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
        orgId,
      );

      return {
        status: 'success',
        message: 'Users retrieved successfully',
        code: STATUS_CODES.OK,
        data: userData.map((u) => ({
          ...u,
          userId: Number(u.userId),
          isPoc:
            orgDetails?.pocEmail && orgDetails.pocEmail === u.email
              ? true
              : false,
          isZuvyPoc:
            orgDetails?.zuvyPocEmail && orgDetails.zuvyPocEmail === u.email
              ? true
              : false,
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
            .where(
              and(
                eq(zuvyUserRolesAssigned.userId, existingUser.id),
                eq(zuvyUserRolesAssigned.organizationId, createUserDto.orgId),
              ),
            );

          // If the same email is being re-used after a delete, refresh the name
          if (
            createUserDto.name &&
            createUserDto.name.trim() !== '' &&
            createUserDto.name !== existingUser.name
          ) {
            const [updatedUser] = await tx
              .update(users)
              .set({
                name: createUserDto.name,
                updatedAt: new Date().toISOString(),
              })
              .where(eq(users.id, existingUser.id))
              .returning();

            if (updatedUser) {
              user = updatedUser;
            }
          }

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
            organizationId: createUserDto.orgId,
          };

          const [newUserRole] = await tx
            .insert(zuvyUserRolesAssigned)
            .values(
              rolesAssignData as unknown as typeof zuvyUserRolesAssigned.$inferInsert,
            )
            .returning();

          // Check if user is already in the organization
          const [existingUserOrg] = await tx
            .select()
            .from(zuvyUserOrganizations)
            .where(
              and(
                eq(zuvyUserOrganizations.userId, user.id),
                eq(zuvyUserOrganizations.organizationId, createUserDto.orgId),
              ),
            );

          if (!existingUserOrg) {
            await tx.insert(zuvyUserOrganizations).values({
              userId: Number(user.id),
              userEmail: user.email,
              organizationId: createUserDto.orgId,
            } as unknown as typeof zuvyUserOrganizations.$inferInsert);
          }

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
          descriptionPrefix: 'a user with new role',
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
          orgId: zuvyUserRolesAssigned.organizationId,
          orgName: zuvyOrganizations.title,
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
        .leftJoin(
          zuvyOrganizations,
          eq(zuvyUserRolesAssigned.organizationId, zuvyOrganizations.id),
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

      const result = await db.transaction(async (tx) => {
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

          // Handle POC name/email sync in zuvyOrganizations
          const pocUpdateData: any = {};
          if (updateUserDto.name !== undefined)
            pocUpdateData.pocName = updateUserDto.name;
          if (userUpdateData.email !== undefined)
            pocUpdateData.pocEmail = userUpdateData.email;

          if (Object.keys(pocUpdateData).length > 0) {
            await tx
              .update(zuvyOrganizations)
              .set(pocUpdateData)
              .where(eq(zuvyOrganizations.pocEmail, existingUser.email));
          }

          const zuvyPocUpdateData: any = {};
          if (updateUserDto.name !== undefined)
            zuvyPocUpdateData.zuvyPocName = updateUserDto.name;
          if (userUpdateData.email !== undefined)
            zuvyPocUpdateData.zuvyPocEmail = userUpdateData.email;

          if (Object.keys(zuvyPocUpdateData).length > 0) {
            await tx
              .update(zuvyOrganizations)
              .set(zuvyPocUpdateData)
              .where(eq(zuvyOrganizations.zuvyPocEmail, existingUser.email));
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
          if (!updateUserDto.orgId) {
            throw new BadRequestException(
              'Organization ID is required when updating role',
            );
          }
          const existingRole = await tx
            .select()
            .from(zuvyUserRolesAssigned)
            .where(
              and(
                eq(zuvyUserRolesAssigned.userId, targetUserId),
                eq(zuvyUserRolesAssigned.organizationId, updateUserDto.orgId),
              ),
            );

          if (existingRole.length > 0) {
            // Update existing role with updatedAt
            const roleUpdateData = {
              roleId: updateUserDto.roleId,
              updatedAt: currentTime, // ISO string for role assignment
            };

            const [updatedRole] = await tx
              .update(zuvyUserRolesAssigned)
              .set(roleUpdateData)
              .where(
                and(
                  eq(zuvyUserRolesAssigned.userId, targetUserId),
                  eq(zuvyUserRolesAssigned.organizationId, updateUserDto.orgId),
                ),
              )
              .returning();
          } else {
            let rolesAssignData = {
              userId: targetUserId,
              roleId: updateUserDto.roleId,
              organizationId: updateUserDto.orgId,
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

        return userWithRole;
      });

      // Invalidate tokens OUTSIDE transaction for the target user (person being updated)
      const { data, success } = await this.userTokenService.getUserTokens(
        targetUserId,
        updateUserDto.orgId,
      );

      if (success && data?.accessToken) {
        await this.authService.logout(BigInt(targetUserId), data.accessToken);
      }

      // Return the final response
      return {
        ...result,
        id: Number(result.id),
        roleId: result.roleId ? Number(result.roleId) : null,
        before: {
          name: existingUser.name,
          email: existingUser.email,
        },
        data: result,
        descriptionPrefix: 'user details',
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id: bigint, orgId: number): Promise<any> {
    try {
      const [userToDelete] = await db
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, id));
      const deletedUserEmail = userToDelete?.email || '';

      const { data: existingTokens, success: hasTokens } =
        await this.userTokenService.getUserTokens(id, orgId);

      await db.transaction(async (tx) => {
        // delete the user by id in zuvyUserRolesAssigned table
        const deletedUser = await tx
          .delete(zuvyUserRolesAssigned)
          .where(
            and(
              eq(zuvyUserRolesAssigned.userId, id),
              eq(zuvyUserRolesAssigned.organizationId, orgId),
            ),
          )
          .returning();
        if (deletedUser.length === 0) {
          throw new NotFoundException(
            `User with ID ${id} not found in this organization`,
          );
        }

        // delete from zuvyUserOrganizations
        await tx
          .delete(zuvyUserOrganizations)
          .where(
            and(
              eq(zuvyUserOrganizations.userId, Number(id)),
              eq(zuvyUserOrganizations.organizationId, orgId),
            ),
          );
      });

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
        organizationId: orgId,
      });

      return {
        message:
          'User has been deleted and all content has been removed for the user',
        code: 200,
        status: 'success',
        descriptionPrefix: 'an user',
        userEmail: deletedUserEmail,
      };
    } catch (error) {
      throw error;
    }
  }

  private isValidEmail(email: string): boolean {
    return this.emailRegex.test(email);
  }
}
