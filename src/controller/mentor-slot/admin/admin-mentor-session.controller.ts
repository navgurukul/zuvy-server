import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { AdminMentorSessionService } from './admin-mentor-session.service';
import { LiveSessionsQueryDto } from './dto/live-sessions.dto';
import { AdminCancelSessionDto } from './dto/cancel-session.dto';

// Do NOT add @SkipOrgCheck() here: orgId must always go through the org guard.
@ApiTags('Admin Mentor Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('admin/mentor-sessions')
export class AdminMentorSessionController {
  constructor(private readonly service: AdminMentorSessionService) {}

  @Get('live')
  @ApiOperation({
    summary:
      'Live mentor sessions (10 min before start to 15 min after end) and how many need attention',
  })
  @ApiResponse({
    status: 403,
    description:
      'Other organisation, not an admin, or mentorship off for the course',
  })
  @ApiResponse({
    status: 404,
    description: 'Course not found in this organisation',
  })
  async getLiveSessions(@Req() req, @Query() query: LiveSessionsQueryDto) {
    const user = Array.isArray(req.user) ? req.user[0] : req.user;
    return this.service.getLiveSessions(
      user,
      query.orgId,
      query.bootcampId,
      query.summary === true,
    );
  }

  @Post(':bookingId/cancel')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Ops cancels a mentor session (any time before it ends, including live). Credit goes back; student and mentor are told with the reason.',
  })
  @ApiResponse({ status: 200, description: 'Session cancelled' })
  @ApiResponse({
    status: 400,
    description:
      'Reason under 10 characters, session already ended, or already cancelled',
  })
  @ApiResponse({
    status: 403,
    description:
      'Not an admin, booking in another organisation, or mentorship off for the course',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  @ApiResponse({
    status: 409,
    description: 'Session was rescheduled while cancelling; reload and retry',
  })
  async cancelSession(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: AdminCancelSessionDto,
  ) {
    const user = Array.isArray(req.user) ? req.user[0] : req.user;
    return this.service.cancelSession(user, bookingId, dto.reason);
  }
}
