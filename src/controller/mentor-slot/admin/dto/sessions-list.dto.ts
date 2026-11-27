import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { OverviewQueryDto } from './overview.dto';

/** Status tabs: All / Upcoming / Completed / No-shows / Cancelled. */
export const SESSION_LIST_TABS = [
  'upcoming',
  'completed',
  'no_show',
  'cancelled',
] as const;
export type SessionListTab = (typeof SESSION_LIST_TABS)[number];

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export class SessionsListQueryDto extends OverviewQueryDto {
  @ApiPropertyOptional({
    description:
      'First session day, YYYY-MM-DD in IST. With `to`, replaces `date` (e.g. last 30 days).',
    example: '2026-10-21',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    description: 'Last session day, YYYY-MM-DD in IST. Default: `from`.',
    example: '2026-11-20',
  })
  @IsOptional()
  @Matches(DATE_ONLY, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  @ApiPropertyOptional({ enum: SESSION_LIST_TABS, description: 'Status tab' })
  @IsOptional()
  @IsIn(SESSION_LIST_TABS)
  status?: SessionListTab;

  @ApiPropertyOptional({ description: 'Student or mentor name / email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ description: 'Only this mentor (user id)' })
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

  @ApiPropertyOptional({ description: 'true: only sessions with a recording' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  hasRecording?: boolean;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
