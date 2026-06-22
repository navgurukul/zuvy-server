import { Module } from '@nestjs/common';
import { RecordingWorkerService } from './recording-worker.service';
import { RecordingWorkerTriggerService } from './recording-worker-trigger.service';
import { ZoomService } from '../zoom/zoom.service';

@Module({
  providers: [
    RecordingWorkerService,
    RecordingWorkerTriggerService,
    ZoomService,
  ],
  exports: [RecordingWorkerService, RecordingWorkerTriggerService],
})
export class RecordingWorkerModule {}
