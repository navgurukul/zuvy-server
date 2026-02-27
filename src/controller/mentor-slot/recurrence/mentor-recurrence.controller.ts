import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MentorRecurrenceService } from './mentor-recurrence.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RecurrenceDto } from './dto/recurrence.dto';

@ApiTags('Mentor Recurrence')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mentor-slots/recurrence')
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
