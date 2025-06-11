import { Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException, Logger} from '@nestjs/common';
import { users } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql, not, and } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { JwtService } from '@nestjs/jwt';
import { parseInt } from 'lodash';


@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);
  private readonly usersJsonPath = path.join(process.cwd(), 'users.json');
  constructor(private readonly jwtService: JwtService) { }

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
        filePath: this.usersJsonPath
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
          message: 'users.json file not found. Please fetch users first.'
        };
      }
      
      // Read the JSON file
      const jsonData = fs.readFileSync(this.usersJsonPath, 'utf8');
      const usersData = JSON.parse(jsonData);
      
      // Validate that the data is an array
      if (!Array.isArray(usersData)) {
        return {
          status: 'error',
          message: 'Invalid JSON format. Expected an array of users.'
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
            ? await db.select().from(users).where(eq(users.email, userData.email))
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
            error: error.message
          });
        }
      }
      
      return {
        status: 'success',
        message: 'Users inserted/updated from users.json',
        inserted: insertedUsers.length,
        errors: errors.length > 0 ? errors : null
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
        .where(sql`${users.id} = ${decoded.id} AND ${users.email} = ${decoded.email}`);
      // Log the decoded JWT and user from DB for debugging
      this.logger.debug(`Decoded JWT: ${JSON.stringify(decoded)}`);
      this.logger.debug(`User from DB: ${JSON.stringify(user)}`);
      if (user.length > 0) {
        user[0].id = parseInt(user[0].id) ; 
        await db.delete(users).where(and( eq(users.email, decoded.email), not(eq(users.id, decoded.id)))); 
        return {
          status: 'success',
          message: 'User already exists in the database',
          user: user[0]
        };
      } else {
        await db.delete(users).where(eq(users.email, decoded.email)); 
        // User doesn't exist, create new user
        let userInset: any = {
          id:  decoded.id,
          email: decoded.email,
          name: decoded.name || decoded.email.split('@')[0], // Use email as fallback for name
        }
        const newUser:any = await db
          .insert(users)
          .values(userInset)
          .returning();
        newUser[0].id = parseInt(newUser[0].id) ; // Assign default role
        return {
          status: 'success',
          message: 'New user created in the database',
          user: newUser[0]
        };
      }
    } catch (error) {
      this.logger.error(`Error verifying user: ${error.message}`, error.stack);
      throw new Error(`Failed to verify user: ${error.message}`);
    }
  }
}