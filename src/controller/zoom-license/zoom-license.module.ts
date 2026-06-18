import { Module } from '@nestjs/common';
import { ZoomLicenseService } from './zoom-license.service';
import { ZoomLicenseController } from './zoom-license.controller';
import { ZoomService } from '../../services/zoom/zoom.service';

@Module({
  providers: [ZoomLicenseService, ZoomService],
  controllers: [ZoomLicenseController],
  exports: [ZoomLicenseService],
})
export class ZoomLicenseModule {}
