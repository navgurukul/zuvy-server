import { Injectable, Logger } from '@nestjs/common';
import { db } from 'src/db/index';
import { sql } from 'drizzle-orm';
import { CreateUserRoleDto } from './dto/user-role.dto';

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
}


