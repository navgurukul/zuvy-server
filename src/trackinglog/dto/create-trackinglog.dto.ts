import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  MaxLength,
} from 'class-validator';

export class CreateTrackinglogDto {
  @ApiPropertyOptional({
    description: 'Organization ID for multi-tenant isolation',
    example: 1,
  })
  @IsOptional()
  @IsNumber()
  orgId?: number;

  @ApiPropertyOptional({
    description: 'Bootcamp ID for tracking bootcamp-specific actions',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  bootcampId?: number;

  @ApiPropertyOptional({
    description: 'Chapter ID for chapter-related tracking logs',
    example: 12,
  })
  @IsOptional()
  @IsNumber()
  chapterId?: number;

  @ApiPropertyOptional({
    description: 'Module ID for module-related tracking logs',
    example: 7,
  })
  @IsOptional()
  @IsNumber()
  moduleId?: number;

  @ApiPropertyOptional({
    description: 'Module name for chapter/module tracking logs',
    example: 'React Basics',
  })
  @IsOptional()
  @IsString()
  moduleName?: string;

  @ApiProperty({
    description: 'User ID who performed the action',
    example: 123,
  })
  @IsNotEmpty()
  @IsNumber()
  actorUserId: number;

  @ApiPropertyOptional({
    description: 'Associated permission ID if applicable',
    example: 5,
  })
  @IsOptional()
  @IsNumber()
  permissionId?: number;

  @ApiPropertyOptional({
    description: 'Associated resource ID from zuvy_resources table',
    example: 3,
  })
  @IsOptional()
  @IsNumber()
  resourceId?: number;

  @ApiProperty({
    description: 'Action type (e.g., create_course, assign_role)',
    example: 'create_course',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  action: string;

  @ApiProperty({
    description: 'Resource type (e.g., course, user, role)',
    example: 'course',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  resourceType: string;

  @ApiProperty({
    description: 'Human-readable description of the action',
    example: 'Arunesh Dhar has created a new course named: JavaScript Course',
  })
  @IsNotEmpty()
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Status of the action (success, failed, pending)',
    example: 'success',
    maxLength: 50,
    default: 'success',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;
}
