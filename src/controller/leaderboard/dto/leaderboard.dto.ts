import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO for POST /leaderboard/update-assessment
 *
 * This endpoint doesn't require a request body,
 * but the empty DTO can be used for consistency.
 */
export class UpdateAssessmentLeaderboardDto {}

/**
 * DTO for GET /leaderboard/bootcamp/:bootcampId
 *
 * Used for validating bootcamp ID and optional limit query parameter.
 *
 * Query parameters:
 * - limit: Optional, must be a positive integer (default: 100)
 */
export class GetBootcampLeaderboardDto {
  /**
   * Bootcamp ID (required)
   * Must be a positive integer
   */
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'bootcampId must be a valid number' },
  )
  @Min(1, { message: 'bootcampId must be at least 1' })
  bootcampId: number;

  /**
   * Maximum number of learners to return (optional)
   * Default: 100
   * Must be a positive integer if provided
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'limit must be a valid number' },
  )
  @Min(1, { message: 'limit must be at least 1' })
  limit?: number;
}

/**
 * DTO for GET /leaderboard/bootcamp/:bootcampId/learner/:learnerId
 *
 * Used for validating bootcamp ID and learner ID route parameters.
 * Both IDs must be positive integers.
 */
export class GetLearnerPositionDto {
  /**
   * Bootcamp ID (required)
   * Must be a positive integer
   */
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'bootcampId must be a valid number' },
  )
  @Min(1, { message: 'bootcampId must be at least 1' })
  bootcampId: number;

  /**
   * Learner ID (required)
   * Must be a positive integer
   */
  @Type(() => Number)
  @IsNumber(
    { allowNaN: false, allowInfinity: false },
    { message: 'learnerId must be a valid number' },
  )
  @Min(1, { message: 'learnerId must be at least 1' })
  learnerId: number;
}
