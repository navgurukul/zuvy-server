import { Controller, Get, Post, HttpStatus, HttpException, Body, Res, Query, Req, } from '@nestjs/common';
import { UsersService } from './users.service';
import { ApiTags, ApiBody, ApiOperation, ApiQuery, ApiBearerAuth, ApiParam } from '@nestjs/swagger';


@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Fetch all users and store them in a JSON file
   * @returns Status message with count of users fetched
   */
  @Get('export-to-json')
  async exportUsersToJson() {
    try {
      const result = await this.usersService.fetchAllUsersAndStoreToJson();
      return result;
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to export users: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Import users from the JSON file into the database
   * @returns Status message with count of users imported
   */
  @Post('import-from-json')
  async importUsersFromJson() {
    try {
      const result = await this.usersService.insertUsersFromJson();
      return result;
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to import users: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Verify JWT token and check if user exists, if not create a new user
   * @param verifyTokenDto DTO containing email
   * @returns User information
   */
  @Post('verify-token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify JWT token and manage user' })
  @ApiQuery({
    name: 'authToken',
    type: String,
    description: 'authToken of the user to verify',
  })
  async verifyToken(@Query('authToken') authToken: string) {
    try {
      const result = await this.usersService.verifyTokenAndManageUser(authToken);
      return result;
    } catch (error) {
      throw new HttpException(
        {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          error: `Failed to verify token: ${error.message}`,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}