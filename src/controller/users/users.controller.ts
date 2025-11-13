import {
  Controller,
  Get,
  Post,
  HttpStatus,
  HttpException,
  Body,
  Res,
  Query,
  Req,
  ParseIntPipe,
  Param,
  Put,
  Delete,
} from '@nestjs/common';
import { UsersService } from './users.service';
import {
  ApiTags,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiBearerAuth,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import {
  AssignUserRoleDto,
  CreateUserDto,
  CreateUserRoleDto,
  UpdateUserDto,
  UserRoleResponseDto,
} from './dto/user-role.dto';

@ApiTags('Users')
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
      const result =
        await this.usersService.verifyTokenAndManageUser(authToken);
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

  @Post('create/user/role')
  //   @RequirePermissions('create_user_role')
  @ApiOperation({
    summary: 'Create a new user role',
    description:
      'Adds a new user role to the system with the specified id, name, and description',
  })
  @ApiBody({
    type: CreateUserRoleDto,
    description: 'User role data to create',
  })
  @ApiResponse({
    status: 201,
    description: 'User role created successfully',
    type: UserRoleResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiBearerAuth('JWT-auth')
  async createUserRole(
    @Body() createUserRoleDto: CreateUserRoleDto,
  ): Promise<any> {
    try {
      const result = await this.usersService.createUserRole(createUserRoleDto);
      return result;
    } catch (error) {
      if (error.code === '23505') {
        // PostgreSQL unique constraint violation
        throw new HttpException(
          'User role with this ID already exists',
          HttpStatus.BAD_REQUEST,
        );
      }
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('get/roles')
  //   @RequirePermissions('read_user_roles')
  @ApiOperation({
    summary: 'Get all user roles',
    description: 'Retrieves all user roles from the system',
  })
  @ApiResponse({
    status: 200,
    description: 'User roles retrieved successfully',
    type: [UserRoleResponseDto],
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiBearerAuth('JWT-auth')
  async getAllUserRoles(@Req() req): Promise<any> {
    try {
      const roleName = req.user[0]?.roles;
      const result = await this.usersService.getAllUserRoles(roleName);
      return result;
    } catch (error) {
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('users/assign-role')
  @ApiOperation({
    summary: 'Assign a role to a user',
    description:
      'Assigns an existing role to an existing user; idempotent if already assigned',
  })
  @ApiBody({
    type: AssignUserRoleDto,
    description: 'User ID and Role ID to assign',
  })
  @ApiResponse({
    status: 200,
    description: 'Role assigned to user successfully',
  })
  @ApiResponse({ status: 404, description: 'User or Role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiBearerAuth('JWT-auth')
  async assignRoleToUser(
    @Body() body: AssignUserRoleDto,
    @Req() req,
  ): Promise<any> {
    try {
      const actorUserId = req.user[0]?.id;
      const result = await this.usersService.assignRoleToUser(
        actorUserId,
        body,
      );
      return result;
    } catch (error) {
      throw new HttpException(
        'Internal Server Error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('get/all/users')
  @ApiOperation({
    summary: 'Get all users with their roles',
    description: 'Retrieves a list of all users with their role information',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'limit',
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
    description: 'offset',
  })
  @ApiQuery({
    name: 'searchTerm',
    required: false,
    type: String,
    description: 'Filter by user name or email (default empty = all users)',
  })
  @ApiQuery({
    name: 'roleId',
    required: false,
    type: [Number],
    description: 'roleId',
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: '1' },
          name: { type: 'string', example: 'John Doe' },
          email: { type: 'string', example: 'john@example.com' },
          roleId: { type: 'number', example: 1 },
          roleName: { type: 'string', example: 'admin' },
          roleDescription: {
            type: 'string',
            example: 'Administrator role',
            nullable: true,
          },
          createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
          updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        },
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async getAllUsers(
    @Query('limit') limit: number,
    @Query('offset') offSet: number,
    @Query('searchTerm') searchTerm: string,
    @Query('roleId') roleId: number[],
    @Req() req,
  ) {
    const roleName = req.user[0]?.roles;
    return this.usersService.getAllUsersWithRoles(
      roleName,
      limit,
      offSet,
      searchTerm,
      roleId,
    );
  }

  @Get('/getUser/:id')
  @ApiOperation({
    summary: 'Get user by ID with role',
    description: 'Retrieves a specific user with their role information',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    type: BigInt,
  })
  @ApiResponse({
    status: 200,
    description: 'User retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'bigint', example: 1 },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
        roleId: { type: 'number', example: 1 },
        roleName: { type: 'string', example: 'admin' },
        roleDescription: {
          type: 'string',
          example: 'Administrator role',
          nullable: true,
        },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiBearerAuth('JWT-auth')
  async getUserById(@Param('id', ParseIntPipe) id: bigint) {
    return this.usersService.getUserByIdWithRole(id);
  }

  @Post('/addUsers')
  @ApiOperation({
    summary: 'Create a new user with role',
    description: 'Creates a new user and assigns them a role',
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User data with role assignment',
  })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
        roleId: { type: 'number', example: 1 },
        roleName: { type: 'string', example: 'admin' },
        roleDescription: {
          type: 'string',
          example: 'Administrator role',
          nullable: true,
        },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Invalid input data, duplicate email, or invalid role',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiBearerAuth('JWT-auth')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.usersService.createUserWithRole(createUserDto);
  }

  @Put('/updateUser/:id')
  @ApiOperation({
    summary: 'Update user and role',
    description: 'Updates user details and/or their role assignment',
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to update',
    type: Number,
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Updated user data',
  })
  @ApiResponse({
    status: 200,
    description: 'User updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'bigint', example: 1 },
        name: { type: 'string', example: 'John Doe' },
        email: { type: 'string', example: 'john@example.com' },
        roleId: { type: 'number', example: 1 },
        roleName: { type: 'string', example: 'admin' },
        roleDescription: {
          type: 'string',
          example: 'Administrator role',
          nullable: true,
        },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description:
      'Bad request - Invalid input data, duplicate email, or invalid role',
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiBearerAuth('JWT-auth')
  async updateUser(
    @Param('id', ParseIntPipe) id: bigint,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(id, updateUserDto);
  }

  @Delete('/deleteUser/:id')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Deletes a user and their role assignments',
  })
  @ApiResponse({
    status: 200,
    description: 'User deleted successfully and all associated content removed',
    schema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          example:
            'User has been deleted and all content has been removed for the user',
        },
        code: { type: 'number', example: 200 },
        status: { type: 'string', example: 'success' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  @ApiBearerAuth('JWT-auth')
  async deleteUser(@Param('id', ParseIntPipe) id: bigint) {
    return this.usersService.deleteUser(id);
  }
}
