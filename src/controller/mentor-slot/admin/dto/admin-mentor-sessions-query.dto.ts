import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export const MENTOR_SESSION_LIFECYCLE_STATES = [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'CANCELLED',
  'RESCHEDULE_PENDING',
] as const;

export const MENTOR_SESSION_ATTENDANCE_FILTERS = [
  'BOTH_JOINED',
  'STUDENT_NO_SHOW',
  'MENTOR_NO_SHOW',
  'SCHEDULED',
  'JOINED_LATE',
] as const;

export type MentorSessionAttendanceFilter =
  (typeof MENTOR_SESSION_ATTENDANCE_FILTERS)[number];

const toTrimmedString = ({ value }) =>
  typeof value === 'string' ? value.trim() : value;

/** Filters shared by the listing and metrics endpoints (no pagination). */
export class AdminMentorSessionsFilterDto {
  @ApiPropertyOptional({
    description:
      'Organisation ID. Super Admins: selects the organisation to view (omit to see all). Org Admins: optional, must equal their own organisation.',
    example: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  orgId?: number;

  @ApiPropertyOptional({ description: 'Course (bootcamp) ID', example: 34 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  bootcampId?: number;

  @ApiPropertyOptional({ description: 'Mentor user ID', example: 101 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mentorId?: number;

  @ApiPropertyOptional({
    description: "Batch ID (resolved from the student's batch enrollment)",
    example: 56,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  batchId?: number;

  @ApiPropertyOptional({
    description: 'Booking status (e.g. confirmed, cancelled)',
    example: 'confirmed',
  })
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(50)
  status?: string;

  @ApiPropertyOptional({
    description: 'Session lifecycle state',
    enum: MENTOR_SESSION_LIFECYCLE_STATES,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(MENTOR_SESSION_LIFECYCLE_STATES)
  lifecycleState?: (typeof MENTOR_SESSION_LIFECYCLE_STATES)[number];

  @ApiPropertyOptional({
    description: 'Slot start lower bound (ISO 8601, inclusive)',
    example: '2026-01-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description: 'Slot start upper bound (ISO 8601, inclusive)',
    example: '2026-12-31T23:59:59.999Z',
  })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({
    description: 'Search by student or mentor name/email',
  })
  @IsOptional()
  @Transform(toTrimmedString)
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description:
      'true = only sessions with a final uploaded recording; false = only sessions without one',
    type: Boolean,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean()
  hasRecording?: boolean;

  @ApiPropertyOptional({
    description: 'Filter mentor sessions by attendance status.',
    enum: MENTOR_SESSION_ATTENDANCE_FILTERS,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(MENTOR_SESSION_ATTENDANCE_FILTERS)
  attendanceStatus?: MentorSessionAttendanceFilter;
}

export class AdminMentorSessionsQueryDto extends AdminMentorSessionsFilterDto {
  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}
