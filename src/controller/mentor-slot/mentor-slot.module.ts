import { Module } from '@nestjs/common';
import { MentorSlotController } from './mentor-slot.controller';
import { MentorSlotService } from './mentor-slot.service';

@Module({
  controllers: [MentorSlotController],
  providers: [MentorSlotService],
  exports: [MentorSlotService],
})
export class MentorSlotModule {}
