import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class QueryTrackinglogDto {
  @ApiProperty({ description: 'Organization ID' })
  @Type(() => Number)
  @IsNumber()
  orgId: number;

  @ApiPropertyOptional({
    description: 'Filter by user who performed the action',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  actorUserId?: number;

  @ApiPropertyOptional({
    description:
      'Filter by action type. Use generic verbs (create, edit, delete) or specific (create_course, edit_batch)',
    example: 'create',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({
    description:
      'Filter by user role (e.g., admin, instructor, ops_team, support, content)',
    example: 'admin',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  role?: string;

  @ApiPropertyOptional({
    description: 'Filter by action status (success, failed, pending)',
    example: 'success',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional({
    description: 'Number of records to skip',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description:
      'Time range filter dropdown: all | today | yesterday | past7days | past30days',
    example: 'today',
    enum: ['all', 'today', 'yesterday', 'past7days', 'past30days'],
  })
  @IsOptional()
  @IsString()
  timeRange?: string;

  @ApiPropertyOptional({
    description:
      'Full-text search across action, resourceType, description and actor name.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}
