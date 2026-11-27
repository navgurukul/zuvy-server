import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export const MENTOR_DASHBOARD_RANGES = ['today', 'week', 'month'] as const;
export type MentorDashboardRange = (typeof MENTOR_DASHBOARD_RANGES)[number];

export class OverviewQueryDto {
  @ApiProperty({
    description: 'Organisation ID (required, also for super admins)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orgId: number;

  @ApiPropertyOptional({
    description: 'Filter sessions by course ID. Use this or bootcampName.',
    example: 674,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bootcampId?: number;

  @ApiPropertyOptional({
    description:
      'Filter sessions by exact course name, case-insensitive. Use this or bootcampId.',
    example: 'AFE Bootcamp - Data Structures & Algorithm',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  bootcampName?: string;

  @ApiPropertyOptional({
    enum: MENTOR_DASHBOARD_RANGES,
    description:
      'Dashboard date preset in IST. Week is Monday through Sunday. Explicit date/from/to values take precedence.',
    default: 'today',
  })
  @IsOptional()
  @IsIn(MENTOR_DASHBOARD_RANGES)
  range?: MentorDashboardRange;

  @ApiPropertyOptional({
    description: 'Day to count, YYYY-MM-DD in IST. Default: today.',
    example: '2026-11-20',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
