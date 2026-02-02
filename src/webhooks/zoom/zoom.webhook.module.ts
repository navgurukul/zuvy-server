import { Module } from '@nestjs/common';
import { ZoomWebhookController } from './zoom.webhook.controller';
import { ZoomWebhookService } from './zoom.webhook.service';
import { ZoomModule } from '../../services/zoom/zoom.module';
import { RecordingWorkerModule } from '../../services/recording-worker/recording-worker.module';

@Module({
  imports: [ZoomModule, RecordingWorkerModule],
  providers: [ZoomWebhookService],
  controllers: [ZoomWebhookController],
})
export class ZoomWebhookModule {}
