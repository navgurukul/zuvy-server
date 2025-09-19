import { Injectable, Logger } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql } from 'drizzle-orm';
import { CreateUserRoleDto, AssignUserRoleDto } from './dto/user-role.dto';

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
}


