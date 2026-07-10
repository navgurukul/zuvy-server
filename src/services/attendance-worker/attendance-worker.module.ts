import { Module } from '@nestjs/common';
import { AttendanceWorkerService } from './attendance-worker.service';
import { AttendanceWorkerTriggerService } from './attendance-worker-trigger.service';
import { ZoomService } from '../zoom/zoom.service';
import { TrackingModule } from '../../controller/progress/tracking.module';

@Module({
  imports: [TrackingModule],
  providers: [
    AttendanceWorkerService,
    AttendanceWorkerTriggerService,
    ZoomService,
  ],
  exports: [AttendanceWorkerService, AttendanceWorkerTriggerService],
})
export class AttendanceWorkerModule {}
