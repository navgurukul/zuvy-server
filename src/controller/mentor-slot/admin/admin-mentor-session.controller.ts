import {
  Controller,
  Get,
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
}
