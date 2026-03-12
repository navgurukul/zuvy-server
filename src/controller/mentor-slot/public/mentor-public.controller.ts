import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MentorPublicService } from './mentor-public.service';

@ApiTags('Public Mentors')
@Controller('mentors')
export class MentorPublicController {
  constructor(private readonly service: MentorPublicService) {}

  @Get()
  async getMentors(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('role') role?: string,
    @Query('expertise') expertise?: string,
    @Query('title') title?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getAllMentors(
      Number(page),
      Number(limit),
      role,
      expertise,
      title,
      search,
    );
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
