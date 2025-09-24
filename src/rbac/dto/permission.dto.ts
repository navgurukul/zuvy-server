import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsNotEmpty, IsNotEmptyObject, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Name of the permission (e.g., view, create, delete)',
    example: 'view'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Resource ID that this permission belongs to',
    example: 1
  })
  @IsNumber()
  @IsNotEmpty()
  resourceId: number;

  @ApiProperty({
    description: 'Indicates if this permission can be granted by users who have it',
    example: false,
    required: false
  })
  @IsOptional()
  @Transform(({ value }) => (value === 'true' || value === true))
  @IsNotEmpty()
  grantable: boolean;

  @ApiProperty({
    description: 'Optional human readable description',
    example: 'Allows viewing course details',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class PermissionResponseDto {
  @ApiProperty({ description: 'Numeric identifier', example: 1 })
  id: number;

  @ApiProperty({ description: 'Permission name', example: 'view' })
  name: string;

  @ApiProperty({ description: 'Resource ID', example: 1 })
  resourceId: number;

  @ApiProperty({ description: 'Permission description', example: 'Allows viewing course details', required: false })
  description?: string;
}

export class AssignUserPermissionDto {
  @ApiProperty({
    description: 'Admin (actor) user ID performing the assignment',
    example: 1
  })
  @IsNumber()
  actorUserId: number;

  @ApiProperty({
    description: 'Target user ID receiving the extra permission',
    example: 123
  })
  @IsNumber()
  targetUserId: number;

  @ApiProperty({
    description: 'Permission ID being assigned to the user',
    example: 42
  })
  @IsNumber()
  permissionId: number;

  @ApiProperty({
    description: 'Optional scope ID if scoping is used',
    required: false,
    example: 3
  })
  @IsOptional()
  @IsNumber()
  scopeId?: number;
}

export class GetUserPermissionsByResourceDto {
  @ApiProperty({
    description: 'User ID to get permissions for',
    example: 123
  })
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: 'Resource ID to filter permissions by',
    example: 5
  })
  @IsNumber()
  resourceId: number;
}

export class UserPermissionResponseDto {
  @ApiProperty({ description: 'User ID', example: 123 })
  userId: number;

  @ApiProperty({ description: 'Resource ID', example: 5 })
  resourceId: number;

  @ApiProperty({ description: 'Resource name', example: 'course' })
  resourceName: string;

  @ApiProperty({
    description: 'Permissions breakdown',
    type: 'object',
    properties: {
      roleBased: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            permission_id: { type: 'number', example: 1 },
            permission_name: { type: 'string', example: 'course.view' },
            resource_name: { type: 'string', example: 'course' },
            role_name: { type: 'string', example: 'instructor' },
            permission_type: { type: 'string', example: 'role_based' }
          }
        }
      },
      extra: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            extra_permission_id: { type: 'number', example: 1 },
            permission_name: { type: 'string', example: 'course.edit' },
            resource_name: { type: 'string', example: 'course' },
            action: { type: 'string', example: 'edit' },
            course_name: { type: 'string', example: 'React Bootcamp' },
            permission_type: { type: 'string', example: 'extra' },
            granted_by_email: { type: 'string', example: 'admin@example.com' }
          }
        }
      },
      total: { type: 'number', example: 5 }
    }
  })
  permissions: {
    roleBased: any[];
    extra: any[];
    total: number;
  };

  @ApiProperty({
    description: 'Permission summary',
    type: 'object',
    properties: {
      totalPermissions: { type: 'number', example: 5 },
      roleBasedCount: { type: 'number', example: 3 },
      extraPermissionsCount: { type: 'number', example: 2 },
      uniquePermissions: {
        type: 'array',
        items: { type: 'string' },
        example: ['course.view', 'course.edit', 'course.delete']
      }
    }
  })
  summary: {
    totalPermissions: number;
    roleBasedCount: number;
    extraPermissionsCount: number;
    uniquePermissions: string[];
  };
}


export class AssignPermissionsToUserDto {
  @ApiProperty({
    description: 'User ID to assign the role to',
    example: 123
  })
  @IsNumber()
  userId: number;

  @ApiProperty({
    type: [Number],
    example: [1, 2],
  })
  @IsArray()
  permissions: number[];
}

// permission-assignment-response.dto.ts
export class PermissionAssignmentResponseDto {
  userId: number;
  roleId: number;
  assignedPermissions: {
    permissionId: number;
    permissionName: string;
    resourceId: number;
    resourceName: string;
  }[];
  alreadyAssigned: {
    permissionId: number;
    permissionName: string;
    resourceId: number;
    resourceName: string;
  }[];
  message: string;
}


export class AssignPermissionsToRoleDto {
  @ApiProperty({
    description: 'Role ID to assign the permissions to',
    example: 123
  })
  @IsNumber()
  resourceId: number;
  
  @IsNotEmptyObject()
  @Transform(({ value }) => {
    // ensure keys are numbers and values are booleans
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [Number(key), Boolean(val)])
    );
  })
  permissions: Record<number, boolean>;
}