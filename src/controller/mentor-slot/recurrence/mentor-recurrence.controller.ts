import {
  Controller,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MentorRecurrenceService } from './mentor-recurrence.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RecurrenceDto } from './dto/recurrence.dto';
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';
import { TrackActionInterceptor } from 'src/trackinglog/interceptors/track-action.interceptor';

@ApiTags('Mentor Recurrence')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('mentor-slots/recurrence')
export class MentorRecurrenceController {
  constructor(private readonly recurrenceService: MentorRecurrenceService) {}

  /* ==========================================================================
     GENERATE RECURRING SLOTS
  ========================================================================== */

  @Post()
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'create_recurrence',
    resourceType: 'mentor_dashboard',
    displayType: 'recurring mentor slots',
  })
  async generateRecurringSlots(@Req() req, @Body() dto: RecurrenceDto) {
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
