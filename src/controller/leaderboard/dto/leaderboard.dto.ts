import { IsNumber, IsOptional, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAssessmentLeaderboardDto {}

export class GetBootcampLeaderboardDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'bootcampId must be a valid number' },
  )
  @Min(1, { message: 'bootcampId must be at least 1' })
  bootcampId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'learnerId must be a valid number' },
  )
  @Min(1, { message: 'learnerId must be at least 1' })
  learnerId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'limit must be a valid number' },
  )
  @Min(1, { message: 'limit must be at least 1' })
  limit?: number;
}

export class GetLearnerPositionDto {
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'bootcampId must be a valid number' },
  )
  @Min(1, { message: 'bootcampId must be at least 1' })
  bootcampId: number;

  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'learnerId must be a valid number' },
  )
  @Min(1, { message: 'learnerId must be at least 1' })
  learnerId: number;
}
