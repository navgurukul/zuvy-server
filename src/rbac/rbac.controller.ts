import { Controller, Post, Get, Body, HttpStatus, HttpException, UsePipes, ValidationPipe, UseGuards, Delete, Param, ParseIntPipe, Query, Put } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { RbacPermissionService } from './rbac.permission.service';
import { RbacAllocPermsService } from './rbac.alloc-perms.service';
import { CreatePermissionDto, PermissionResponseDto, AssignUserPermissionDto, GetUserPermissionsByResourceDto, UserPermissionResponseDto, AssignPermissionsToUserDto, PermissionAssignmentResponseDto, AssignPermissionsToRoleDto } from './dto/permission.dto';
import { RbacResourcesService } from './rbac.resources.service';
import { CreateResourceDto } from './dto/resources.dto';
import { bigint } from 'drizzle-orm/mysql-core';
import { RbacService } from './rbac.service';
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
    private readonly rbacPermissionService: RbacPermissionService,
    private readonly rbacService: RbacService,
    private readonly resourcesService: RbacResourcesService,
  ) { }

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
      const result = await this.rbacService.getUserPermissionsByResource(userId, resourceId);
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
      const result = await this.rbacService.getUserPermissionsForMultipleResources(userId);
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

  @Delete('deleteResource/:id')
  @ApiOperation({
    summary: 'Delete a resource',
    description: 'Deletes a specific resource by its ID'
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
      throw error;
    }
  }

}