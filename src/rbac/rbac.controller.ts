import { Controller, Post, Get, Body, HttpStatus, HttpException, UsePipes, ValidationPipe, UseGuards, Delete, Param, ParseIntPipe, Query, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { RbacUserService } from './rbac.user.service';
import { RbacPermissionService } from './rbac.permission.service';
import { RbacAllocPermsService } from './rbac.alloc-perms.service';
import { CreateUserRoleDto, UserRoleResponseDto, AssignUserRoleDto, CreateUserDto, UpdateUserDto } from './dto/user-role.dto';
import { CreatePermissionDto, PermissionResponseDto, AssignUserPermissionDto, GetUserPermissionsByResourceDto, UserPermissionResponseDto, AssignPermissionsToUserDto, PermissionAssignmentResponseDto, AssignPermissionsToRoleDto } from './dto/permission.dto';
import { RbacResourcesService } from './rbac.resources.service';
import { CreateResourceDto } from './dto/resources.dto';
import { bigint } from 'drizzle-orm/mysql-core';
// import { PermissionsGuard } from './guards/permissions.guard';
// import { RequirePermissions } from './decorators/require-permissions.decorator';

@ApiTags('RBAC - User Roles')
@Controller('rbac')
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }),
)
// @UseGuards(PermissionsGuard)
@ApiBearerAuth('JWT-auth')
export class RbacController {
  constructor(
    private readonly rbacUserService: RbacUserService,
    private readonly rbacPermissionService: RbacPermissionService,
    private readonly rbacAllocPermsService: RbacAllocPermsService,
    private readonly resourcesService: RbacResourcesService,
  ) { }

  @Post('users')
  //   @RequirePermissions('create_user_role')
  @ApiOperation({
    summary: 'Create a new user role',
    description: 'Adds a new user role to the system with the specified id, name, and description'
  })
  @ApiBody({
    type: CreateUserRoleDto,
    description: 'User role data to create'
  })
  @ApiResponse({
    status: 201,
    description: 'User role created successfully',
    type: UserRoleResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async createUserRole(@Body() createUserRoleDto: CreateUserRoleDto): Promise<any> {
    try {
      const result = await this.rbacUserService.createUserRole(createUserRoleDto);
      return result;
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        throw new HttpException('User role with this ID already exists', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('get/roles')
  //   @RequirePermissions('read_user_roles')
  @ApiOperation({
    summary: 'Get all user roles',
    description: 'Retrieves all user roles from the system'
  })
  @ApiResponse({
    status: 200,
    description: 'User roles retrieved successfully',
    type: [UserRoleResponseDto]
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getAllUserRoles(): Promise<any> {
    try {
      const result = await this.rbacUserService.getAllUserRoles();
      return result;
    } catch (error) {
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('permissions')
  //   @RequirePermissions('create_permission')
  @ApiOperation({
    summary: 'Create a new permission',
    description: 'Adds a new permission with name, resource ID and optional description'
  })
  @ApiBody({
    type: CreatePermissionDto,
    description: 'Permission data to create'
  })
  @ApiResponse({
    status: 201,
    description: 'Permission created successfully',
    type: PermissionResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async createPermission(@Body() createPermissionDto: CreatePermissionDto): Promise<any> {
    try {
      const result = await this.rbacPermissionService.createPermission(createPermissionDto);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.code === '23505') {
        throw new HttpException('Permission with this name already exists', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('get/all/permissions')
  @ApiOperation({
    summary: 'Get all permissions',
    description: 'Retrieves all permissions from the system with pagination, search, and filtering. Optional parameters for resourceId, search, page, and limit.'
  })
  @ApiQuery({
    name: 'resourceId',
    required: false,
    description: 'Optional resource ID to filter permissions by resource',
    type: Number
  })
  @ApiQuery({
    name: 'searchPermission',
    required: false,
    description: 'Optional search term to filter permissions by name or description',
    type: String
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getAllPermissions(
    @Query('resourceId') resourceId?: number,
    @Query('searchPermission') searchPermission?: string,
  ): Promise<any> {
    try {
      const result = await this.rbacPermissionService.getAllPermissions(resourceId, searchPermission);
      return result;
    } catch (error) {
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // @Post('assign/extra/permission')
  // @ApiOperation({
  //   summary: 'Assign an extra permission to a specific user',
  //   description: 'Records the assignment in the audit log table for traceability'
  // })
  // @ApiBody({ type: AssignUserPermissionDto })
  // @ApiResponse({ status: 200, description: 'Assignment recorded in audit log' })
  // @ApiResponse({ status: 404, description: 'User or permission not found' })
  // @ApiResponse({ status: 500, description: 'Internal server error' })
  // @ApiBearerAuth('JWT-auth')
  // async assignPermissionToUser(@Body() body: AssignUserPermissionDto): Promise<any> {
  //   try {
  //     const result = await this.rbacPermissionService.assignExtraPermissionToUser(body);
  //     return result;
  //   } catch (error) {
  //     if (error instanceof HttpException) {
  //       throw error;
  //     }
  //     throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }


  @Post('assign/permissionsToRole')
  @ApiOperation({
    summary: 'Assign permissions to role',
    description: 'Admin can assign specific permissions to a role'
  })
  @ApiBody({
    type: AssignPermissionsToRoleDto,
    description: 'Role ID and permissions to assign'
  })
  @ApiResponse({
    status: 201,
    description: 'Permissions assigned successfully',
    type: PermissionAssignmentResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or role not found'
  })
  @ApiResponse({
    status: 404,
    description: 'Role not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async assignPermissionsToRole(@Body() assignPermissionsDto: AssignPermissionsToRoleDto): Promise<any> {
    try {
      const result = await this.rbacPermissionService.assignPermissionsToRole(assignPermissionsDto);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.code === '23503') {
        throw new HttpException('Role not found', HttpStatus.NOT_FOUND);
      }
      if (error.code === '23505') {
        throw new HttpException('Permission already assigned to role', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('assign/permissions/to/user')
  @ApiOperation({
    summary: 'Assign permissions to user',
    description: 'Admin can assign specific permissions to a user'
  })
  @ApiBody({
    type: AssignPermissionsToUserDto,
    description: 'User ID and permissions to assign'
  })
  @ApiResponse({
    status: 201,
    description: 'Permissions assigned successfully',
    type: PermissionAssignmentResponseDto
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or user/role not found'
  })
  @ApiResponse({
    status: 404,
    description: 'User or role not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async assignPermissionsToUser(@Body() assignPermissionsDto: AssignPermissionsToUserDto): Promise<any> {
    try {
      const result = await this.rbacPermissionService.assignPermissionsToUser(assignPermissionsDto);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      if (error.code === '23503') {
        throw new HttpException('User or role not found', HttpStatus.NOT_FOUND);
      }
      if (error.code === '23505') {
        throw new HttpException('Permission already assigned to user', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('users/assign-role')
  @ApiOperation({
    summary: 'Assign a role to a user',
    description: 'Assigns an existing role to an existing user; idempotent if already assigned'
  })
  @ApiBody({
    type: AssignUserRoleDto,
    description: 'User ID and Role ID to assign'
  })
  @ApiResponse({ status: 200, description: 'Role assigned to user successfully' })
  @ApiResponse({ status: 404, description: 'User or Role not found' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiBearerAuth('JWT-auth')
  async assignRoleToUser(@Body() body: AssignUserRoleDto): Promise<any> {
    try {
      const result = await this.rbacUserService.assignRoleToUser(body);
      return result;
    } catch (error) {
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
  @Get('users/:userId/permissions/:resourceId')
  @ApiOperation({
    summary: 'Get user permissions for a specific resource',
    description: 'Retrieves all permissions (role-based and extra) that a user has for a specific resource'
  })
  @ApiResponse({
    status: 200,
    description: 'User permissions retrieved successfully',
    type: UserPermissionResponseDto
  })
  @ApiResponse({
    status: 404,
    description: 'User or resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getUserPermissionsByResource(
    @Param('userId', ParseIntPipe) userId: bigint,
    @Param('resourceId', ParseIntPipe) resourceId: number
  ): Promise<any> {
    try {
      const result = await this.rbacAllocPermsService.getUserPermissionsByResource(userId, resourceId);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('users/:userId/permissions-multiple')
  @ApiOperation({
    summary: 'Get user permissions for multiple resources',
    description: 'Retrieves permissions for course, contentBank, and roles and permissions resources'
  })
  @ApiResponse({
    status: 200,
    description: 'User permissions retrieved successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getUserPermissionsForMultipleResources(
    @Param('userId', ParseIntPipe) userId: bigint
  ): Promise<any> {
    try {
      const result = await this.rbacAllocPermsService.getUserPermissionsForMultipleResources(userId);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('permissions/:id')
  //   @RequirePermissions('delete_permission')
  @ApiOperation({
    summary: 'Delete a permission by id',
    description: 'Deletes a permission record by its numeric id'
  })
  @ApiResponse({
    status: 200,
    description: 'Permission deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Permission not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async deletePermission(@Param('id', ParseIntPipe) id: number): Promise<any> {
    try {
      const result = await this.rbacPermissionService.deletePermission(id);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }


  @Post('/newResource')
  @ApiOperation({
    summary: 'Create a new resource',
    description: 'Adds a new resource to the system with the specified name and description'
  })
  @ApiBody({
    type: CreateResourceDto,
    description: 'Resource data to create'
  })
  @ApiResponse({
    status: 201,
    description: 'Resource created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'course' },
        description: { type: 'string', example: 'Manages course-related operations', nullable: true }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or duplicate name'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async createResource(@Body() createResourceDto: CreateResourceDto) {
    try {
      const result = await this.resourcesService.createResource(createResourceDto);
      return result;
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        throw new HttpException('Resource with this name already exists', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('resources')
  @ApiOperation({
    summary: 'Get all resources',
    description: 'Retrieves all resources from the system'
  })
  @ApiResponse({
    status: 200,
    description: 'Resources retrieved successfully'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getAllResources(): Promise<any> {
    try {
      const result = await this.resourcesService.getAllResources();
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get resource by ID',
    description: 'Retrieves a specific resource by its ID'
  })
  @ApiParam({
    name: 'id',
    description: 'Resource ID',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Resource retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'course' },
        description: { type: 'string', example: 'Manages course-related operations', nullable: true }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getResourceById(@Param('id', ParseIntPipe) id: number) {
    try {
      const result = await this.resourcesService.getResourceById(id);
      return result;
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('resource/:id')
  @ApiOperation({
    summary: 'Update a resource',
    description: 'Updates an existing resource with new data'
  })
  @ApiParam({
    name: 'id',
    description: 'Resource ID to update',
    type: Number
  })
  @ApiBody({
    type: CreateResourceDto,
    description: 'Updated resource data'
  })
  @ApiResponse({
    status: 200,
    description: 'Resource updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'course' },
        description: { type: 'string', example: 'Manages course-related operations', nullable: true }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or duplicate name'
  })
  @ApiResponse({
    status: 404,
    description: 'Resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async updateResource(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateResourceDto: CreateResourceDto
  ) {
    try {
      const result = await this.resourcesService.updateResource(id, updateResourceDto);
      return result;
    } catch (error) {
      if (error.code === '23505') {
        throw new HttpException('Resource with this name already exists', HttpStatus.BAD_REQUEST);
      }
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('resource/:id')
  @ApiOperation({
    summary: 'Delete a resource',
    description: 'Deletes a specific resource by its ID'
  })
  @ApiParam({
    name: 'id',
    description: 'Resource ID to delete',
    type: bigint
  })
  @ApiResponse({
    status: 204,
    description: 'Resource deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async deleteResource(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.resourcesService.deleteResource(id);
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('get/all/users')
  @ApiOperation({
    summary: 'Get all users with their roles',
    description: 'Retrieves a list of all users with their role information'
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
    description: 'Filter by user name or email (default empty = all users)'
  })
  @ApiResponse({
    status: 200,
    description: 'Users retrieved successfully',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', example: "1" },
          name: { type: 'string', example: 'John Doe' },
          email: { type: 'string', example: 'john@example.com' },
          roleId: { type: 'number', example: 1 },
          roleName: { type: 'string', example: 'admin' },
          roleDescription: { type: 'string', example: 'Administrator role', nullable: true },
          createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
          updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' }
        }
      }
    }
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })

  async getAllUsers(
    @Query('limit') limit: number,
    @Query('offset') offSet: number,
    @Query('searchTerm') searchTerm: string,
  ) {
    return this.rbacUserService.getAllUsersWithRoles(limit, offSet, searchTerm);
  }

  @Get('/getUser/:id')
  @ApiOperation({
    summary: 'Get user by ID with role',
    description: 'Retrieves a specific user with their role information'
  })
  @ApiParam({
    name: 'id',
    description: 'User ID',
    type: BigInt
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
        roleDescription: { type: 'string', example: 'Administrator role', nullable: true },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getUserById(@Param('id', ParseIntPipe) id: bigint) {
    return this.rbacUserService.getUserByIdWithRole(id);
  }

  @Post('/addUsers')
  @ApiOperation({
    summary: 'Create a new user with role',
    description: 'Creates a new user and assigns them a role'
  })
  @ApiBody({
    type: CreateUserDto,
    description: 'User data with role assignment'
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
        roleDescription: { type: 'string', example: 'Administrator role', nullable: true },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data, duplicate email, or invalid role'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async createUser(@Body() createUserDto: CreateUserDto) {
    return this.rbacUserService.createUserWithRole(createUserDto);
  }

  @Put('/updateUser/:id')
  @ApiOperation({
    summary: 'Update user and role',
    description: 'Updates user details and/or their role assignment'
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to update',
    type: Number
  })
  @ApiBody({
    type: UpdateUserDto,
    description: 'Updated user data'
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
        roleDescription: { type: 'string', example: 'Administrator role', nullable: true },
        createdAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' },
        updatedAt: { type: 'string', example: '2023-12-01T10:00:00.000Z' }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data, duplicate email, or invalid role'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async updateUser(
    @Param('id', ParseIntPipe) id: bigint,
    @Body() updateUserDto: UpdateUserDto
  ) {
    return this.rbacUserService.updateUser(id, updateUserDto);
  }

  @Delete('/deleteUser/:id')
  @ApiOperation({
    summary: 'Delete a user',
    description: 'Deletes a user and their role assignments'
  })
  @ApiParam({
    name: 'id',
    description: 'User ID to delete',
    type: bigint
  })
  @ApiResponse({
    status: 204,
    description: 'User deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'User not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async deleteUser(@Param('id', ParseIntPipe) id: bigint) {
    await this.rbacUserService.deleteUser(id);
  }

}
