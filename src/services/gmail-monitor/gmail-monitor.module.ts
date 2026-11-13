import { Module } from '@nestjs/common';
import { GmailMonitorService } from './gmail-monitor.service';
import { GmailMonitorController } from './gmail-monitor.controller';
import { RecordingWorkerModule } from '../recording-worker/recording-worker.module';

@Module({
  imports: [RecordingWorkerModule],
  controllers: [GmailMonitorController],
  providers: [GmailMonitorService],
  exports: [GmailMonitorService],
})
export class GmailMonitorModule {}
