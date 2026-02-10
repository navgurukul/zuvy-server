import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsNumber,
  IsString,
  Min,
  MaxLength,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';

// Note: ActionType and ResourceType enums removed - these are now dynamically managed in database tables:
// - Actions come from zuvy_permissions table (name column: create, edit, delete, view, etc.)
// - Resources come from zuvy_resources table (display_name column)
// No need to maintain hardcoded enums when database already has this data

export class QueryTrackinglogDto {
  @ApiPropertyOptional({
    description: 'Organization ID filter (optional)',
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  orgId?: number;

  @ApiPropertyOptional({ description: 'Filter by actor user ID', example: 123 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  actorUserId?: number;

  @ApiPropertyOptional({
    description:
      'Filter by action type (e.g., create_bootcamp, update_course, delete_class, etc.)',
    example: 'create_bootcamp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  action?: string;

  @ApiPropertyOptional({
    description:
      'Filter by resource type (e.g., bootcamp, course, class, batch, user, etc.)',
    example: 'bootcamp',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  resourceType?: string;

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
    example: 0,
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  offset?: number = 0;

  @ApiPropertyOptional({
    description: 'Maximum number of items to return',
    example: 100,
    default: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 100;

  @ApiPropertyOptional({
    description: 'Filter logs from this date (ISO 8601 format)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter logs until this date (ISO 8601 format)',
    example: '2026-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
