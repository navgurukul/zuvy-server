import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { NotificationJob } from './notification.job';

@Module({
  controllers: [NotificationController],
  providers: [NotificationService, NotificationJob],
  exports: [NotificationService],
})
export class NotificationModule {}
