import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Min } from 'class-validator';

export class OverviewQueryDto {
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
    description: 'Day to count, YYYY-MM-DD in IST. Default: today.',
    example: '2026-11-20',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
