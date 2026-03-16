import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MentorPublicService } from './mentor-public.service';
import { MentorSearchDto } from './dto/mentor-search.dto';

@ApiTags('Public Mentors')
@Controller('mentors')
export class MentorPublicController {
  constructor(private readonly service: MentorPublicService) {}

  @Get()
  async getMentors(@Query() query: MentorSearchDto) {
    return this.service.getAllMentors(
      query.page,
      query.limit,
      query.role,
      query.expertise,
      query.title,
      query.search,
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
