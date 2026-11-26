import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Matches, Min } from 'class-validator';

/** Status filter values, as shown in the admin dashboard. */
export const EXPORT_STATUS_FILTERS = [
  'scheduled',
  'in_progress',
  'completed',
  'missed',
  'cancelled',
  'reschedule_pending',
] as const;
export type ExportStatusFilter = (typeof EXPORT_STATUS_FILTERS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class ExportSessionsQueryDto {
  @ApiProperty({
    description: 'Organisation ID (required, also for super admins)',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orgId: number;

  @ApiPropertyOptional({ description: 'Only sessions of this course' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bootcampId?: number;

  @ApiPropertyOptional({
    description: 'Only sessions of this mentor (user id)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mentorId?: number;

  @ApiPropertyOptional({ description: 'Only students in this batch' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({ enum: EXPORT_STATUS_FILTERS })
  @IsOptional()
  @IsIn(EXPORT_STATUS_FILTERS)
  status?: ExportStatusFilter;

  @ApiPropertyOptional({
    description:
      'First session day, YYYY-MM-DD in IST, inclusive. Default: 30 days before `to`.',
    example: '2026-09-19',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description:
      'Last session day, YYYY-MM-DD in IST, inclusive. Default: today.',
    example: '2026-10-19',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'to must be YYYY-MM-DD' })
  to?: string;
}
