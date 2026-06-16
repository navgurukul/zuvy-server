import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
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
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', 'upcoming', 'completed', 'cancelled'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  @Get('my')
  async getMySessions(
    @Req() req,
    @Query('filter') filter?: string,
    @Query('limit') limit = 10,
    @Query('offset') offset = 0,
  ) {
    return this.sessionService.getStudentSessions(
      BigInt(req.user[0].id),
      filter,
      Number(limit),
      Number(offset),
    );
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
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', 'upcoming', 'reschedule', 'completed', 'cancelled'],
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['asc', 'desc'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  @Get('mentor/my')
  async getMentorSessions(
    @Req() req,
    @Query('filter') filter?: string,
    @Query('limit') limit = 10,
    @Query('offset') offset = 0,
    @Query('sort') sort: 'asc' | 'desc' = 'desc',
  ) {
    return this.sessionService.getMentorSessions(
      BigInt(req.user[0].id),
      req.user[0].orgId,
      filter,
      Number(limit),
      Number(offset),
      sort,
    );
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
