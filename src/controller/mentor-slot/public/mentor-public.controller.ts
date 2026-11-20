import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { MentorPublicService } from './mentor-public.service';
import { MentorSearchDto } from './dto/mentor-search.dto';

@ApiTags('Public Mentors')
@Controller('mentors')
export class MentorPublicController {
  constructor(private readonly service: MentorPublicService) {}

  @Get()
  async getMentors(@Req() req: any, @Query() query: MentorSearchDto) {
    return this.service.getAllMentors(
      query.limit,
      query.offset,
      query.role,
      query.expertise,
      query.title,
      query.search,
      query.organizationId ? Number(query.organizationId) : undefined,
      query.available === 'true',
    );
  }

  // Declared before :mentorUserId so "skills" isn't taken for an id.
  @Get('skills')
  getSkillChips(
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
    @Query('available') available?: string,
    @Query('inUse') inUse?: string,
  ) {
    return this.service.getSkillChips(
      search || undefined,
      organizationId ? Number(organizationId) : undefined,
      available === 'true',
      inUse === 'true',
    );
  }

  @Get(':mentorUserId')
  getMentorProfile(
    @Param('mentorUserId', ParseIntPipe) mentorUserId: number,
    @Query('organizationId') organizationId?: number,
  ) {
    return this.service.getMentorProfile(
      mentorUserId,
      organizationId ? Number(organizationId) : undefined,
    );
  }

  @Get(':mentorId/availability')
  getAvailableSlots(
    @Param('mentorId', ParseIntPipe) mentorId: number,
    @Query('organizationId') organizationId?: number,
  ) {
    return this.service.getAvailableSlots(
      mentorId,
      organizationId ? Number(organizationId) : undefined,
    );
  }
}
