import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateUserRoleDto {
  @ApiProperty({
    description: 'Name of the user role',
    example: 'Administrator'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    description: 'Description of the user role',
    example: 'Full access to all system features',
    required: false
  })
  @IsString()
  @IsOptional()
  description?: string;
}

export class UserRoleResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the user role',
    example: 1
  })
  id: number;

  @ApiProperty({
    description: 'Name of the user role',
    example: 'Administrator'
  })
  name: string;

  @ApiProperty({
    description: 'Description of the user role',
    example: 'Full access to all system features'
  })
  description: string;
}

export class AssignUserRoleDto {
  @ApiProperty({ 
    description: 'User ID to assign the role to', 
    example: 123 
  })
  @IsNumber()
  userId: number;

  @ApiProperty({ 
    description: 'Role ID to assign to the user', 
    example: 2 
  })
  @IsNumber()
  roleId: number;
}
