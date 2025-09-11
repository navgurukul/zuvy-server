import { Controller, Post, Get, Body, HttpStatus, HttpException, UsePipes, ValidationPipe, UseGuards, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { RbacUserService } from './rbac.user.service';
import { RbacPermissionService } from './rbac.permission.service';
import { CreateUserRoleDto, UserRoleResponseDto } from './dto/user-role.dto';
import { CreatePermissionDto, PermissionResponseDto } from './dto/permission.dto';
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
  ) {}

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

  @Get('users')
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
    description: 'Adds a new permission with name and optional description'
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
    description: 'Bad request - Invalid input data or duplicate name'
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
      if (error.code === '23505') {
        throw new HttpException('Permission with this name already exists', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('permissions')
//   @RequirePermissions('read_permissions')
  @ApiOperation({
    summary: 'Get all permissions',
    description: 'Retrieves all permissions from the system'
  })
  @ApiResponse({
    status: 200,
    description: 'Permissions retrieved successfully',
    type: [PermissionResponseDto]
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getAllPermissions(): Promise<any> {
    try {
      const result = await this.rbacPermissionService.getAllPermissions();
      return result;
    } catch (error) {
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
}
