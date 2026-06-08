import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
@ApiTags('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

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
        error instanceof Error ? error.message : 'Failed to update leaderboard',
      );
    }
  }

  @Get('learners/data')
  @ApiOperation({
    summary: 'Get leaderboard across all bootcamps',
    description: 'Retrieves the leaderboard without filtering by bootcamp',
  })
  @ApiQuery({
    name: 'limit',
    type: Number,
    description: 'Maximum number of learners to return',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Leaderboard retrieved successfully',
  })
  async getAllBootcampLeaderboard(@Query('limit') limitParam?: string) {
    try {
      let limit = 100;
      if (limitParam) {
        limit = parseInt(limitParam, 10);
        if (isNaN(limit) || limit <= 0) {
          throw new BadRequestException(
            'Invalid limit. Must be a positive number.',
          );
        }
      }

      const leaderboard = await this.leaderboardService.getBootcampLeaderboard(
        undefined,
        limit,
      );

      return {
        success: true,
        count: leaderboard.length,
        data: leaderboard,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException(
        error instanceof Error ? error.message : 'Failed to fetch leaderboard',
      );
    }
  }

  @Get('bootcamp/:bootcampId')
  @ApiOperation({
    summary: 'Get bootcamp leaderboard',
    description: 'Retrieves the leaderboard for a specific bootcamp',
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
  @ApiQuery({
    name: 'learnerId',
    type: Number,
    description:
      'Optional learner ID to filter the leaderboard to a single learner',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'Bootcamp leaderboard retrieved successfully',
    schema: {
      example: [
        {
          learnerId: 101,
          assessmentPoints: 30,
          codingPoints: 20,
          quizPoints: 10,
          attendancePoints: 5,
          recordingPoints: 0,
          assignmentPoints: 0,
          totalPoints: 65,
          lastActivityAt: '2026-05-23T10:30:00Z',
        },
        {
          learnerId: 102,
          assessmentPoints: 20,
          codingPoints: 15,
          quizPoints: 8,
          attendancePoints: 3,
          recordingPoints: 0,
          assignmentPoints: 0,
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
    @Query('learnerId') learnerIdParam?: string,
  ) {
    try {
      const bootcampId = parseInt(bootcampIdParam, 10);
      if (isNaN(bootcampId) || bootcampId <= 0) {
        throw new BadRequestException(
          'Invalid bootcamp ID. Must be a positive number.',
        );
      }

      let limit = 100;
      if (limitParam) {
        limit = parseInt(limitParam, 10);
        if (isNaN(limit) || limit <= 0) {
          throw new BadRequestException(
            'Invalid limit. Must be a positive number.',
          );
        }
      }

      // If a learnerId is provided, reuse existing learner-specific logic
      if (learnerIdParam) {
        const learnerId = parseInt(learnerIdParam, 10);
        if (isNaN(learnerId) || learnerId <= 0) {
          throw new BadRequestException(
            'Invalid learner ID. Must be a positive number.',
          );
        }

        const learnerPosition =
          await this.leaderboardService.getLearnerPosition(
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
        error instanceof Error
          ? error.message
          : 'Failed to fetch bootcamp leaderboard',
      );
    }
  }
}
