import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
// import { PermissionsGuard } from 'src/rbac/guards/permissions.guard';
// import { RequirePermissions } from 'src/rbac/decorators/require-permissions.decorator';
import { AdminMentorSessionsService } from './admin-mentor-sessions.service';
import {
  AdminMentorSessionsFilterDto,
  AdminMentorSessionsQueryDto,
} from './dto/admin-mentor-sessions-query.dto';

@ApiTags('Admin Mentor Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin/mentor-sessions')
export class AdminMentorSessionsController {
  constructor(
    private readonly adminMentorSessionsService: AdminMentorSessionsService,
  ) {}

  @Get()
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
  async listSessions(@Req() req, @Query() query: AdminMentorSessionsQueryDto) {
    return this.adminMentorSessionsService.listSessions(req.user[0], query);
  }

  @Get('metrics')
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
  async getMetrics(@Req() req, @Query() query: AdminMentorSessionsFilterDto) {
    return this.adminMentorSessionsService.getMetrics(req.user[0], query);
  }

  @Get(':bookingId')
  // @UseGuards(PermissionsGuard)
  // @RequirePermissions('viewMentorship')
  @ApiOperation({ summary: 'Get complete details for a mentorship session' })
  @ApiResponse({ status: 200, description: 'Mentorship session details' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions or mentorship disabled',
  })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  async getSession(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.adminMentorSessionsService.getSession(req.user[0], bookingId);
  }
}
