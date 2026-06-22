import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MentorMetricsService } from './mentor-metrics.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';

@ApiTags('Mentor Metrics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('mentor-slots/metrics')
export class MentorMetricsController {
  constructor(private readonly metricsService: MentorMetricsService) {}

  @Get('me')
  async getMyMetrics(@Req() req) {
    return this.metricsService.getMentorMetrics(
      BigInt(req.user[0].id),
      Number(req.user[0].orgId),
    );
  }
}
