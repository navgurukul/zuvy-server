import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  Res,
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
import { Response } from 'express';
// import { PermissionsGuard } from 'src/rbac/guards/permissions.guard';
// import { RequirePermissions } from 'src/rbac/decorators/require-permissions.decorator';
import { AdminMentorSessionsService } from './admin-mentor-sessions.service';
import {
  AdminMentorSessionsFilterDto,
  AdminMentorSessionsQueryDto,
  AdminMentorsQueryDto,
} from './dto/admin-mentor-sessions-query.dto';

@ApiTags('Admin Mentor Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminMentorSessionsController {
  constructor(
    private readonly adminMentorSessionsService: AdminMentorSessionsService,
  ) {}

  @Get('mentor-sessions')
  @ApiOperation({
    summary:
      'List mentorship sessions for the Admin Dashboard (paginated, server-side filters)',
  })
  @ApiResponse({ status: 200, description: 'Paginated mentorship sessions' })
  @ApiResponse({ status: 403, description: 'Not an admin of the organization' })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async listMentorSessions(
    @Req() req,
    @Query() query: AdminMentorSessionsQueryDto,
  ) {
    return this.adminMentorSessionsService.listMentorSessions(
      req.user[0],
      query,
    );
  }

  @Get('mentor-sessions/export')
  @ApiOperation({ summary: 'Export matching mentorship sessions as CSV' })
  @ApiResponse({ status: 200, description: 'Mentorship sessions CSV export' })
  @ApiResponse({ status: 403, description: 'Not an admin of the organization' })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async exportSessionsData(
    @Req() req,
    @Query() query: AdminMentorSessionsFilterDto,
    @Res() res: Response,
  ) {
    const csv = await this.adminMentorSessionsService.exportSessionsData(
      req.user[0],
      query,
    );
    res
      .type('text/csv')
      .setHeader(
        'Content-Disposition',
        'attachment; filename="mentor-sessions.csv"',
      )
      .send(csv);
  }

  @Get('mentor-sessions/metrics')
  @ApiOperation({
    summary:
      'Aggregate mentorship session metrics for the Admin Dashboard (same filters as the listing, no pagination)',
  })
  @ApiResponse({ status: 200, description: 'Mentorship session metrics' })
  @ApiResponse({ status: 403, description: 'Not an admin of the organization' })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async getMentorSessionMetrics(
    @Req() req,
    @Query() query: AdminMentorSessionsFilterDto,
  ) {
    return this.adminMentorSessionsService.getMentorSessionMetrics(
      req.user[0],
      query,
    );
  }

  @Get('mentors')
  @ApiOperation({
    summary: 'List mentors available to the Admin Mentor Sessions filters',
  })
  @ApiResponse({ status: 200, description: 'Mentors in the organisation' })
  @ApiResponse({ status: 403, description: 'Not an admin of the organization' })
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  )
  async listAllMentors(@Req() req, @Query() query: AdminMentorsQueryDto) {
    return this.adminMentorSessionsService.listAllMentors(req.user[0], query);
  }

  @Get('mentor-sessions/:bookingId')
  // @UseGuards(PermissionsGuard)
  // @RequirePermissions('viewMentorship')
  @ApiOperation({ summary: 'Get complete details for a mentorship session' })
  @ApiResponse({ status: 200, description: 'Mentorship session details' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or mentorship disabled',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getMentorSessionBookingDetails(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.adminMentorSessionsService.getMentorSessionBookingDetails(
      req.user[0],
      bookingId,
    );
  }
}
