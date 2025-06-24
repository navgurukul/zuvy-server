import { Module } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { SubmissionModule } from '../controller/submissions/submission.module';
import { AttendanceModule } from '../controller/attendance/attendance.module';

@Module({
  imports: [SubmissionModule, AttendanceModule],
  providers: [ScheduleService],
  exports: [ScheduleService]
})
export class ScheduleModule {}