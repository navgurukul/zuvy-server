import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { SubmissionModule } from '../controller/submissions/submission.module';
import { ClassesModule } from '../controller/classes/classes.module';
import { ZoomModule } from '../services/zoom/zoom.module';

@Module({
  imports: [SubmissionModule, ClassesModule, ZoomModule],
  providers: [ScheduleService],
  exports: [ScheduleService]
})
export class ScheduleModule {} 