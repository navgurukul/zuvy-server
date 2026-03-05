import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MentorPublicService } from './mentor-public.service';

@ApiTags('Public Mentors')
@Controller('mentors')
export class MentorPublicController {
  constructor(private readonly service: MentorPublicService) {}

  @Get()
  getAllMentors() {
    return this.service.getAllMentors();
  }

  @Get(':mentorUserId')
  getMentorProfile(@Param('mentorUserId') mentorUserId: number) {
    return this.service.getMentorProfile(mentorUserId);
  }

  @Get(':mentorId/availability')
  getAvailableSlots(@Param('mentorId', ParseIntPipe) mentorId: number) {
    return this.service.getAvailableSlots(mentorId);
  }
}
