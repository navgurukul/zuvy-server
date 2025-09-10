import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({
    description: 'Unique name of the permission (e.g., course.view)',
    example: 'course.view'
  })
  @IsString()
  @IsNotEmpty()
  name: string;

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

  @ApiProperty({ description: 'Permission name', example: 'course.view' })
  name: string;

  @ApiProperty({ description: 'Permission description', example: 'Allows viewing course details', required: false })
  description?: string;
}

