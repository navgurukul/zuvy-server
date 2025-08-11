import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { SubmissionModule } from '../controller/submissions/submission.module';
import { ClassesModule } from '../controller/classes/classes.module';

@Module({
  imports: [SubmissionModule, ClassesModule],
  providers: [ScheduleService],
  exports: [ScheduleService]
})
export class ScheduleModule {} 