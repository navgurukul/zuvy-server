import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

/**
 * Leaderboard Controller
 *
 * Handles all leaderboard-related endpoints for bootcamp learners.
 * Leaderboard is bootcamp-based and stores aggregated performance points.
 */
@Controller('leaderboard')
@ApiTags('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  /**
   * Update Main Leaderboard
   *
   * Processes all submissions (assessments, coding, quiz, etc.) and updates leaderboard points.
   * Calculates and combines all point types for each learner-bootcamp combination.
   * Then updates the leaderboard table once with combined totalPoints.
   * This endpoint should typically be called periodically (e.g., via cron job).
   *
   * POST /leaderboard/update
   *
   * @returns {
   *   success: boolean,
   *   message: string,
   *   updated: number,
   *   error?: string
   * }
   */
  @Post('update')
  @ApiOperation({
    summary: 'Update main leaderboard with all point types',
    description:
      'Processes all submissions (assessments, coding, quiz, etc.) and updates learner leaderboard with combined points',
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard updated successfully',
    schema: {
      example: {
        success: true,
        message: 'Leaderboard updated successfully with all point types',
        updated: 150,
      },
    },
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error',
  })
  async updateLeaderboard() {
    try {
      const result = await this.leaderboardService.updateLeaderboard();

      if (!result.success) {
        throw new InternalServerErrorException(result.error || result.message);
      }

      return {
        success: result.success,
        message: result.message,
        updated: result.updated,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        error?.message || 'Failed to update leaderboard',
      );
    }
  }

  /**
   * Get Bootcamp Leaderboard
   *
   * Retrieves the ranked leaderboard for a specific bootcamp.
   * Learners are sorted by total points in descending order.
   *
   * GET /leaderboard/bootcamp/:bootcampId?limit=100
   *
   * @param bootcampId - The ID of the bootcamp
   * @param limit - Maximum number of learners to return (default: 100)
   * @returns Array of ranked learners with their points
   */
  @Get('bootcamp/:bootcampId')
  @ApiOperation({
    summary: 'Get bootcamp leaderboard',
    description: 'Retrieves the ranked leaderboard for a specific bootcamp',
  })
  @ApiParam({
    name: 'bootcampId',
    type: Number,
    description: 'The bootcamp ID',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Maximum number of learners to return',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Bootcamp leaderboard retrieved successfully',
    schema: {
      example: [
        {
          rank: 1,
          learnerId: 101,
          assessmentPoints: 30,
          codingPoints: 20,
          quizPoints: 10,
          attendancePoints: 5,
          recordingPoints: 0,
          openEndedPoints: 0,
          totalPoints: 65,
          lastActivityAt: '2026-05-23T10:30:00Z',
        },
        {
          rank: 2,
          learnerId: 102,
          assessmentPoints: 20,
          codingPoints: 15,
          quizPoints: 8,
          attendancePoints: 3,
          recordingPoints: 0,
          openEndedPoints: 0,
          totalPoints: 46,
          lastActivityAt: '2026-05-23T10:25:00Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bootcamp ID',
  })
  async getBootcampLeaderboard(
    @Param('bootcampId') bootcampIdParam: string,
    @Query('limit') limitParam?: string,
  ) {
    try {
      // Validate and parse bootcampId
      const bootcampId = parseInt(bootcampIdParam, 10);
      if (isNaN(bootcampId) || bootcampId <= 0) {
        throw new BadRequestException(
          'Invalid bootcamp ID. Must be a positive number.',
        );
      }

      // Validate and parse limit (if provided)
      let limit = 100; // Default limit
      if (limitParam) {
        limit = parseInt(limitParam, 10);
        if (isNaN(limit) || limit <= 0) {
          throw new BadRequestException(
            'Invalid limit. Must be a positive number.',
          );
        }
      }

      const leaderboard = await this.leaderboardService.getBootcampLeaderboard(
        bootcampId,
        limit,
      );

      return {
        success: true,
        bootcampId,
        count: leaderboard.length,
        data: leaderboard,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to fetch bootcamp leaderboard',
      );
    }
  }

  /**
   * Get Learner Position in Bootcamp
   *
   * Retrieves a specific learner's rank and points in a bootcamp leaderboard.
   *
   * GET /leaderboard/bootcamp/:bootcampId/learner/:learnerId
   *
   * @param bootcampId - The ID of the bootcamp
   * @param learnerId - The ID of the learner
   * @returns Learner's position, rank, and points
   */
  @Get('bootcamp/:bootcampId/learner/:learnerId')
  @ApiOperation({
    summary: "Get learner's leaderboard position",
    description:
      'Retrieves a specific learner rank and points in a bootcamp leaderboard',
  })
  @ApiParam({
    name: 'bootcampId',
    type: Number,
    description: 'The bootcamp ID',
  })
  @ApiParam({
    name: 'learnerId',
    type: Number,
    description: 'The learner ID',
  })
  @ApiResponse({
    status: 200,
    description: 'Learner position retrieved successfully',
    schema: {
      example: {
        success: true,
        data: {
          rank: 1,
          assessmentPoints: 30,
          codingPoints: 20,
          quizPoints: 10,
          attendancePoints: 5,
          recordingPoints: 0,
          openEndedPoints: 0,
          totalPoints: 65,
          lastActivityAt: '2026-05-23T10:30:00Z',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid bootcamp ID or learner ID',
  })
  @ApiResponse({
    status: 404,
    description: 'Learner not found in bootcamp leaderboard',
  })
  async getLearnerPosition(
    @Param('bootcampId') bootcampIdParam: string,
    @Param('learnerId') learnerIdParam: string,
  ) {
    try {
      // Validate and parse bootcampId
      const bootcampId = parseInt(bootcampIdParam, 10);
      if (isNaN(bootcampId) || bootcampId <= 0) {
        throw new BadRequestException(
          'Invalid bootcamp ID. Must be a positive number.',
        );
      }

      // Validate and parse learnerId
      const learnerId = parseInt(learnerIdParam, 10);
      if (isNaN(learnerId) || learnerId <= 0) {
        throw new BadRequestException(
          'Invalid learner ID. Must be a positive number.',
        );
      }

      const learnerPosition = await this.leaderboardService.getLearnerPosition(
        learnerId,
        bootcampId,
      );

      if (!learnerPosition) {
        return {
          success: false,
          message: `Learner ${learnerId} not found in bootcamp ${bootcampId} leaderboard`,
          data: null,
        };
      }

      return {
        success: true,
        bootcampId,
        learnerId,
        data: learnerPosition,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error?.message || 'Failed to fetch learner position',
      );
    }
  }
}
