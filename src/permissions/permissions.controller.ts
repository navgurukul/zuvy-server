import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, Query, ParseIntPipe, Req } from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AssignPermissionsToRoleDto, AssignPermissionsToUserDto, PermissionAssignmentResponseDto, PermissionResponseDto, UserPermissionResponseDto } from 'src/rbac/dto/permission.dto';
import { PermissionsAllocationService } from './permissions.alloc.service';

@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly permissionsAllocationService: PermissionsAllocationService
  ) {}

  @Post()
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
      const result = await this.permissionsService.createPermission(createPermissionDto);
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

  @Get()
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
      const result = await this.permissionsService.getAllPermissions(resourceId, searchPermission);
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
  //     const result = await this.permissionsService.assignExtraPermissionToUser(body);
  //     return result;
  //   } catch (error) {
  //     if (error instanceof HttpException) {
  //       throw error;
  //     }
  //     throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
  //   }
  // }


  @Post('assign/toRole')
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
  async assignPermissionsToRole(
    @Body() assignPermissionsDto: AssignPermissionsToRoleDto,
    @Req() req
  ): Promise<any> {
    try {
      const userIdString = req.user[0].id;
      const result = await this.permissionsService.assignPermissionsToRole(userIdString, assignPermissionsDto);
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

  @Post('assign/to/user')
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
      const result = await this.permissionsService.assignPermissionsToUser(assignPermissionsDto);
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
      const result = await this.permissionsAllocationService.getUserPermissionsByResource(userId, resourceId);
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
      const result = await this.permissionsAllocationService.getUserPermissionsForMultipleResources(userId);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
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
      const result = await this.permissionsService.deletePermission(id);
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
