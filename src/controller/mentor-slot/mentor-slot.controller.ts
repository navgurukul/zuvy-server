import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  Logger,
  UsePipes,
  ValidationPipe,
  UseGuards,
} from '@nestjs/common';
import { MentorSlotService } from './mentor-slot.service';
import { CreateMentorProfileDto } from './dto/create-profile.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { CreateBookingDto } from './dto/create-booking.dto';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/guards/roles.guard';
import { Roles } from 'src/decorators/roles.decorator';
import { ApiTags } from '@nestjs/swagger';

@Controller('mentor-slot')
@ApiTags('mentor-slot')
export class MentorSlotController {
  private readonly logger = new Logger(MentorSlotController.name);

  constructor(private readonly service: MentorSlotService) {}

  @Post('profiles')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor', 'ops', 'mentor')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createProfile(@Body() body: CreateMentorProfileDto) {
    return this.service.createProfile(body);
  }

  @Get('profiles/:id')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Param('id') id: string) {
    return this.service.getProfileById(Number(id));
  }

  @Post('slots')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'instructor', 'ops', 'mentor')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createSlot(@Body() body: CreateSlotDto) {
    return this.service.createSlot(body);
  }

  @Get('slots')
  async listSlots(
    @Query('mentorUserId') mentorUserId: string,
    @Query('organizationId') organizationId: string,
  ) {
    const q: any = {};
    if (mentorUserId) q.mentorUserId = Number(mentorUserId);
    if (organizationId) q.organizationId = Number(organizationId);
    return this.service.listSlots(q);
  }

  @Post('bookings')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async bookSlot(@Body() body: CreateBookingDto) {
    return this.service.bookSlot(body);
  }
}
