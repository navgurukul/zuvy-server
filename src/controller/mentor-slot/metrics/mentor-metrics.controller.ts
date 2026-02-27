import { Controller, Get, Param } from '@nestjs/common';
import { MentorMetricsService } from './mentor-metrics.service';
import { ApiTags } from '@nestjs/swagger';

@Controller('mentor-slots/metrics')
@ApiTags('Mentor Slots')
export class MentorMetricsController {
  constructor(private readonly metricsService: MentorMetricsService) {}

  @Get(':mentorUserId')
  async getMentorMetrics(@Param('mentorUserId') mentorUserId: string) {
    return this.metricsService.getMentorMetrics(BigInt(mentorUserId));
  }
}
