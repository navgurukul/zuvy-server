import { Module } from '@nestjs/common';
import { AttendanceCalculationService } from './attendance-calculation.service';

@Module({
  providers: [AttendanceCalculationService],
  exports: [AttendanceCalculationService],
})
export class AttendanceCalculationModule {}
