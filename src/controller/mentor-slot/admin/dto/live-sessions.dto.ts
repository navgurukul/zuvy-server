import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class LiveSessionsQueryDto {
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
    description:
      'true returns only { needsAttentionCount, hasMentorshipCourses } for the nav badge',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  summary?: boolean;
}
