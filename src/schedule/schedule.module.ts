import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { SubmissionModule } from '../controller/submissions/submission.module';

@Module({
  imports: [SubmissionModule],
  providers: [ScheduleService],
  exports: [ScheduleService]
})

export class ScheduleModule {}