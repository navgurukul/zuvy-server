import { Module } from '@nestjs/common';
import { TrackinglogService } from './trackinglog.service';
import { TrackinglogController } from './trackinglog.controller';
import { TrackActionInterceptor } from './interceptors/track-action.interceptor';

@Module({
  controllers: [TrackinglogController],
  providers: [TrackinglogService, TrackActionInterceptor],
  exports: [TrackinglogService, TrackActionInterceptor], // Export for use in other modules
})
export class TrackinglogModule {}
