import { Module } from '@nestjs/common';
import { MentorSlotController } from './mentor-slot.controller';
import { MentorSlotService } from './mentor-slot.service';
import { MentorSlotJob } from './jobs/mentor-slot.job';
import { MentorRecurrenceService } from './recurrence/mentor-recurrence.service';
import { MentorMetricsService } from './metrics/mentor-metrics.service';
import { MentorMetricsController } from './metrics/mentor-metrics.controller';
import { MentorRecurrenceController } from './recurrence/mentor-recurrence.controller';

@Module({
  controllers: [
    MentorSlotController,
    MentorRecurrenceController,
    MentorMetricsController,
  ],
  providers: [
    MentorSlotService,
    MentorRecurrenceService,
    MentorMetricsService,
    MentorSlotJob,
  ],
  exports: [MentorSlotService],
})
export class MentorSlotModule {}
