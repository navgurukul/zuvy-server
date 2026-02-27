import { Controller, Post, Body } from '@nestjs/common';
import { MentorRecurrenceService } from './mentor-recurrence.service';
import { RecurrenceDto } from './dto/recurrence.dto';
import { ApiTags } from '@nestjs/swagger';

@Controller('mentor-slots/recurrence')
@ApiTags('Mentor Slots')
export class MentorRecurrenceController {
  constructor(private readonly recurrenceService: MentorRecurrenceService) {}

  /* ==========================================================================
     GENERATE RECURRING SLOTS
  ========================================================================== */

  @Post()
  async generateRecurringSlots(@Body() dto: RecurrenceDto) {
    return this.recurrenceService.generateRecurringSlots({
      mentorSlotManagementId: dto.mentorSlotManagementId,
      slotStart: new Date(dto.slotStart),
      slotEnd: new Date(dto.slotEnd),
      recurrenceRule: dto.recurrenceRule,
      recurrenceEndDate: new Date(dto.recurrenceEndDate),
      previewOnly: dto.previewOnly,
    });
  }
}
