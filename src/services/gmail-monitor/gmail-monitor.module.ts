import { Module } from '@nestjs/common';
import { GmailMonitorService } from './gmail-monitor.service';
import { GmailMonitorController } from './gmail-monitor.controller';

@Module({
  controllers: [GmailMonitorController],
  providers: [GmailMonitorService],
  exports: [GmailMonitorService],
})
export class GmailMonitorModule {}
