import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { MentorSlotService } from './mentor-slot.service';
import { SessionService } from './session/session.service';
import { MentorMetricsService } from './metrics/mentor-metrics.service';
import { MentorRecurrenceService } from './recurrence/mentor-recurrence.service';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { AttendanceDto } from './dto/attendance.dto';
import { UpdateMentorProfileDto } from './dto/update-mentor-profile.dto';
import { RecurrenceDto } from './recurrence/dto/recurrence.dto';
import { PermissionsGuard } from 'src/rbac/guards/permissions.guard';

@ApiTags('Instructor Mentor APIs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('instructor')
export class InstructorMentorSlotController {
  constructor(
    private readonly mentorSlotService: MentorSlotService,
    private readonly sessionService: SessionService,
    private readonly metricsService: MentorMetricsService,
    private readonly recurrenceService: MentorRecurrenceService,
  ) {}

  @Post('mentor-slots/create')
  @ApiOperation({ summary: 'Create a mentor availability slot as instructor' })
  async createSlot(@Req() req, @Body() dto: CreateSlotDto) {
    return this.mentorSlotService.createSlot(Number(req.user[0].id), dto);
  }

  @Delete('mentor-slots/:slotId')
  @ApiOperation({ summary: 'Delete an instructor-owned mentor slot' })
  async removeSlot(@Req() req, @Param('slotId', ParseIntPipe) slotId: number) {
    return this.mentorSlotService.removeSlot(Number(req.user[0].id), slotId);
  }

  @Get('mentor-slots/my')
  @ApiOperation({ summary: 'Get weekly mentor slots for the instructor' })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['asc', 'desc'],
  })
  async getMySlots(
    @Req() req,
    @Query('weekOffset') weekOffset = 0,
    @Query('sort') sort: 'asc' | 'desc' = 'desc',
  ) {
    return this.mentorSlotService.getMySlots(
      Number(req.user[0].id),
      Number(weekOffset),
      sort,
    );
  }

  @Get('mentor-slots/:slotId/details')
  @ApiOperation({ summary: 'Get instructor-owned slot details and bookings' })
  async getSlotDetails(
    @Req() req,
    @Param('slotId', ParseIntPipe) slotId: number,
  ) {
    return this.mentorSlotService.getSlotDetails(
      Number(req.user[0].id),
      slotId,
    );
  }

  @Post('mentor-slots/bookings/:bookingId/reschedule/accept')
  @ApiOperation({
    summary: 'Accept a pending booking reschedule as instructor',
  })
  async acceptReschedule(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.acceptReschedule(
      bookingId,
      Number(req.user[0].id),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/reschedule/decline')
  @ApiOperation({
    summary: 'Decline a pending booking reschedule as instructor',
  })
  async declineReschedule(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.declineReschedule(
      bookingId,
      Number(req.user[0].id),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/feedback')
  @ApiOperation({ summary: 'Submit mentor feedback for an instructor session' })
  async submitMentorFeedback(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: FeedbackDto,
  ) {
    return this.mentorSlotService.submitMentorFeedback(
      bookingId,
      dto.feedback,
      dto.rating,
      Number(req.user[0].id),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/attendance')
  @ApiOperation({ summary: 'Mark attendance for an instructor session' })
  async markAttendance(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: AttendanceDto,
  ) {
    return this.mentorSlotService.markAttendance(
      bookingId,
      dto.joinedAt,
      dto.leftAt,
      Number(req.user[0].id),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/complete')
  @ApiOperation({ summary: 'Mark an instructor mentor session as completed' })
  async completeSession(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.completeSession(
      bookingId,
      Number(req.user[0].id),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/cancel')
  @ApiOperation({ summary: 'Cancel an instructor mentor booking' })
  async cancelBooking(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: CancelBookingDto,
  ) {
    return this.mentorSlotService.cancelBooking(
      bookingId,
      dto.reason,
      dto.cancelledBy,
      Number(req.user[0].id),
    );
  }

  @Get('mentor-slots/bookings/:bookingId/recordings')
  @ApiOperation({ summary: 'Get recordings for an instructor mentor booking' })
  async getBookingRecordings(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.getBookingRecordings(
      Number(req.user[0].id),
      bookingId,
    );
  }

  @Patch('mentor-slots/profile')
  @ApiOperation({ summary: 'Update the instructor mentor profile' })
  async updateProfile(@Req() req, @Body() dto: UpdateMentorProfileDto) {
    return this.mentorSlotService.updateMentorProfile(
      Number(req.user[0].id),
      dto,
    );
  }

  @Get('mentor-slots/profile')
  @ApiOperation({ summary: 'Get the instructor mentor profile' })
  async getMyProfile(@Req() req) {
    return this.mentorSlotService.getMyMentorProfile(Number(req.user[0].id));
  }

  @Post('mentor-slots/profile')
  @ApiOperation({ summary: 'Create or update the instructor mentor profile' })
  async createOrUpdateProfile(@Req() req, @Body() dto: UpdateMentorProfileDto) {
    return this.mentorSlotService.createOrUpdateMentorProfile(
      Number(req.user[0].id),
      dto,
    );
  }

  @Get('mentor-slots/metrics')
  @ApiOperation({ summary: 'Get mentor metrics for the instructor' })
  async getMyMetrics(@Req() req) {
    return this.metricsService.getMentorMetrics(BigInt(req.user[0].id));
  }

  @Post('mentor-slots/recurrence')
  @ApiOperation({ summary: 'Generate recurring mentor slots as instructor' })
  async generateRecurringSlots(@Req() req, @Body() dto: RecurrenceDto) {
    return this.recurrenceService.generateRecurringSlots(
      {
        mentorSlotManagementId: dto.mentorSlotManagementId,
        slotStart: new Date(dto.slotStart),
        slotEnd: new Date(dto.slotEnd),
        recurrenceRule: dto.recurrenceRule,
        recurrenceEndDate: new Date(dto.recurrenceEndDate),
        previewOnly: dto.previewOnly,
      },
      Number(req.user[0].id),
    );
  }

  @Get('mentor-sessions/my')
  @ApiOperation({ summary: 'Get mentor sessions hosted by the instructor' })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', 'upcoming', 'reschedule', 'completed'],
  })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['asc', 'desc'],
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    type: Number,
  })
  async getMentorSessions(
    @Req() req,
    @Query('filter') filter?: string,
    @Query('limit') limit = 10,
    @Query('offset') offset = 0,
    @Query('sort') sort: 'asc' | 'desc' = 'desc',
  ) {
    return this.sessionService.getMentorSessions(
      BigInt(req.user[0].id),
      req.user[0].orgId,
      filter,
      Number(limit),
      Number(offset),
      sort,
    );
  }

  @Get('mentor-sessions/:sessionId')
  @ApiOperation({ summary: 'Get details for an instructor mentor session' })
  async getSessionDetail(
    @Req() req,
    @Param('sessionId', ParseIntPipe) sessionId: number,
  ) {
    return this.sessionService.getSessionDetail(
      sessionId,
      BigInt(req.user[0].id),
    );
  }
}
