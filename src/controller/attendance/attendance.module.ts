import { Module, Global } from '@nestjs/common';
import { AttendanceService } from './attendance.service';

@Global()
@Module({
  providers: [AttendanceService],
  exports: [AttendanceService],
})
export class AttendanceModule {}
