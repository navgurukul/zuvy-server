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
import { OverviewQueryDto } from './dto/overview.dto';
import { AdminCancelSessionDto } from './dto/cancel-session.dto';
import { AdminMentorSessionExportService } from './admin-mentor-session-export.service';
import { ExportSessionsQueryDto } from './dto/export-sessions.dto';
import { SessionsListQueryDto } from './dto/sessions-list.dto';

// Do NOT add @SkipOrgCheck() here: orgId must always go through the org guard.
@ApiTags('Admin Mentor Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
@Controller('admin/mentor-sessions')
export class AdminMentorSessionController {
  constructor(
    private readonly service: AdminMentorSessionService,
    private readonly exportService: AdminMentorSessionExportService,
  ) {}

  @Get('today')
  @ApiOperation({
    summary:
      'Sessions table (today / course Bookings tab): filter by date range, status tab, search, mentor, batch and has-recording; returns tab counts, credits, status, attendance, ratings, recording and canCancel. Times are IST days.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Other organisation, not an admin, or mentorship off for the course',
  })
  async getDaySessions(@Req() req, @Query() query: SessionsListQueryDto) {
    const user = Array.isArray(req.user) ? req.user[0] : req.user;
    return this.exportService.getDaySessions(user, query);
  }

  @Get('export')
  @ApiOperation({
    summary:
      'Every mentor session matching the filters (not only the current page), as JSON rows for the CSV download. Times are IST.',
  })
  @ApiResponse({
    status: 403,
    description:
      'Other organisation, not an admin, or mentorship off for the course',
  })
  async exportSessions(@Req() req, @Query() query: ExportSessionsQueryDto) {
    const user = Array.isArray(req.user) ? req.user[0] : req.user;
    return this.exportService.exportSessions(user, query);
  }

  @Get('overview')
  @ApiOperation({
    summary:
      "Top of the Mentorship page: mentorship courses (filter chips) and the day's numbers (sessions, live now, need attention, completed, no-shows)",
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
  async getOverview(@Req() req, @Query() query: OverviewQueryDto) {
    const user = Array.isArray(req.user) ? req.user[0] : req.user;
    return this.service.getOverview(
      user,
      query.orgId,
      query.bootcampId,
      query.date,
    );
  }

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
      'Ops cancels a mentor session (any time before it ends, including live). Provide who requested it, a cancellation category, and a note of at least 10 characters. Credit goes back; student and mentor are told with the note.',
  })
  @ApiResponse({ status: 200, description: 'Session cancelled' })
  @ApiResponse({
    status: 400,
    description:
      'Missing/invalid cancellation details, note under 10 characters, session already ended, or already cancelled',
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
    return this.service.cancelSession(user, bookingId, dto);
  }
}
