import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { SessionService } from './session.service';

@ApiTags('Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mentor-sessions')
export class SessionController {
  constructor(private readonly sessionService: SessionService) {}

  @Get('my')
  async getMySessions(@Req() req) {
    return this.sessionService.getStudentSessions(req.user.id);
  }

  @Get('mentor/my')
  async getMentorSessions(@Req() req) {
    return this.sessionService.getMentorSessions(req.user.id);
  }

  @Get(':sessionId')
  async getSessionDetail(@Param('sessionId', ParseIntPipe) sessionId: number) {
    return this.sessionService.getSessionDetail(sessionId);
  }
}
