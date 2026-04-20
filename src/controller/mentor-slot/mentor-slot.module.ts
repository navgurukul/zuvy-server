import { Module } from '@nestjs/common';
import { MentorSlotController } from './mentor-slot.controller';
import { MentorSlotService } from './mentor-slot.service';
import { MentorSlotJob } from './jobs/mentor-slot.job';
import { MentorRecurrenceService } from './recurrence/mentor-recurrence.service';
import { MentorMetricsService } from './metrics/mentor-metrics.service';
import { MentorMetricsController } from './metrics/mentor-metrics.controller';
import { MentorRecurrenceController } from './recurrence/mentor-recurrence.controller';
import { SessionController } from './session/session.controller';
import { SessionService } from './session/session.service';
import { MentorPublicController } from './public/mentor-public.controller';
import { MentorPublicService } from './public/mentor-public.service';
import { GoogleModule } from 'src/integrations/google/google.module';
import { NewNotificationModule } from '../notification/notification.module';
import { ZoomModule } from 'src/services/zoom/zoom.module';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    GoogleModule,
    NewNotificationModule,
    ZoomModule,
    NotificationModule,
  ],
  controllers: [
    MentorSlotController,
    MentorRecurrenceController,
    MentorMetricsController,
    MentorPublicController,
    SessionController,
  ],
  providers: [
    MentorSlotService,
    MentorRecurrenceService,
    MentorMetricsService,
    MentorSlotJob,
    MentorPublicService,
    SessionService,
  ],
  exports: [MentorSlotService],
})
export class MentorSlotModule {}
