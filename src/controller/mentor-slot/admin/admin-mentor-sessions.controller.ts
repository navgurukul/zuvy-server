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
import { AdminMentorSessionsService } from './admin-mentor-sessions.service';
import { AdminMentorSessionsQueryDto } from './dto/admin-mentor-sessions-query.dto';

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
}
