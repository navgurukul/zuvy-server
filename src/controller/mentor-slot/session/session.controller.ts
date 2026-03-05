import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';

import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SessionService } from './session.service';

@ApiTags('Mentor Sessions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('mentor-sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  /* ==========================================================================
     STUDENT SESSIONS
  ========================================================================== */

  @ApiOperation({
    summary: 'Get sessions booked by the current student',
  })
  @ApiResponse({
    status: 200,
    description: 'List of student sessions',
  })
  @Get('my')
  async getMySessions(@Req() req) {
    return this.sessionService.getStudentSessions(BigInt(req.user[0].id));
  }

  /* ==========================================================================
     MENTOR SESSIONS
  ========================================================================== */

  @ApiOperation({
    summary: 'Get sessions hosted by the current mentor',
  })
  @ApiResponse({
    status: 200,
    description: 'List of mentor sessions',
  })
  @Get('mentor/my')
  async getMentorSessions(@Req() req) {
    return this.sessionService.getMentorSessions(BigInt(req.user[0].id));
  }

  /* ==========================================================================
     SESSION DETAIL
  ========================================================================== */

  @ApiOperation({
    summary: 'Get a specific session detail',
  })
  @ApiParam({
    name: 'sessionId',
    type: Number,
  })
  @ApiResponse({
    status: 200,
    description: 'Session detail',
  })
  @Get(':sessionId')
  async getSessionDetail(
    @Req() req,
    @Param('sessionId', ParseIntPipe)
    sessionId: number,
  ) {
    return this.sessionService.getSessionDetail(
      sessionId,
      BigInt(req.user[0].id),
    );
  }
}
