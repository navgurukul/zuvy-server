import { Module } from '@nestjs/common';
import { RecordingWorkerService } from './recording-worker.service';
import { RecordingWorkerTriggerService } from './recording-worker-trigger.service';
import { RecordingS3Service } from './recording-s3.service';
import { ZoomService } from '../zoom/zoom.service';

@Module({
  providers: [
    RecordingWorkerService,
    RecordingWorkerTriggerService,
    RecordingS3Service,
    ZoomService,
  ],
  exports: [
    RecordingWorkerService,
    RecordingWorkerTriggerService,
    RecordingS3Service,
  ],
})
export class RecordingWorkerModule {}
