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
  UseInterceptors,
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
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';
import { TrackActionInterceptor } from 'src/trackinglog/interceptors/track-action.interceptor';

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
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'create_slot',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor slot',
    permissionName: 'createMentorDashboard',
  })
  @ApiOperation({
    summary: 'Create a mentor availability slot',
    description:
      'Creates an availability slot for the authenticated instructor and records the action in the tracking log.',
  })
  async createSlot(@Req() req, @Body() dto: CreateSlotDto) {
    return this.mentorSlotService.createSlot(
      Number(req.user[0].id),
      dto,
      Number(req.user[0].orgId),
    );
  }

  @Delete('mentor-slots/:slotId')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'delete_slot',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor slot',
    permissionName: 'deleteMentorDashboard',
  })
  @ApiOperation({
    summary: 'Delete an instructor-owned mentor slot',
    description:
      'Deletes the specified availability slot owned by the authenticated instructor and records the action in the tracking log.',
  })
  async removeSlot(@Req() req, @Param('slotId', ParseIntPipe) slotId: number) {
    return this.mentorSlotService.removeSlot(
      Number(req.user[0].id),
      slotId,
      Number(req.user[0].orgId),
    );
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
      Number(req.user[0].orgId),
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
      Number(req.user[0].orgId),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/reschedule/accept')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'accept_reschedule',
    resourceType: 'mentor_dashboard',
    displayType: 'the mentor booking reschedule',
    permissionName: 'editMentorDashboard',
  })
  @ApiOperation({
    summary: 'Accept a pending booking reschedule as instructor',
    description:
      'Accepts the student’s pending reschedule request for this booking and records the decision in the tracking log.',
  })
  async acceptReschedule(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.acceptReschedule(
      bookingId,
      Number(req.user[0].id),
      Number(req.user[0].orgId),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/reschedule/decline')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'decline_reschedule',
    resourceType: 'mentor_dashboard',
    displayType: 'the mentor booking reschedule',
    permissionName: 'editMentorDashboard',
  })
  @ApiOperation({
    summary: 'Decline a pending booking reschedule as instructor',
    description:
      'Declines the student’s pending reschedule request for this booking and records the decision in the tracking log.',
  })
  async declineReschedule(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.declineReschedule(
      bookingId,
      Number(req.user[0].id),
      Number(req.user[0].orgId),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/feedback')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'submit_feedback',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor session feedback',
    permissionName: 'createMentorDashboard',
  })
  @ApiOperation({
    summary: 'Submit mentor feedback for an instructor session',
    description:
      'Submits the instructor’s feedback and rating for the specified session and records the action in the tracking log.',
  })
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

  @Get('mentor-slots/bookings/:bookingId/student-feedback')
  @ApiOperation({ summary: 'Get student feedback for an instructor session' })
  async getStudentFeedback(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.sessionService.getMentorFeedback(
      bookingId,
      BigInt(req.user[0].id),
    );
  }

  @Get('mentor-slots/feedbacks')
  @ApiOperation({
    summary: 'Get all feedback received by the mentor',
  })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['30days', '3months', 'all'],
  })
  async getReceivedFeedbacks(
    @Req() req,
    @Query('filter') filter: '30days' | '3months' | 'all' = 'all',
  ) {
    return this.mentorSlotService.getMentorReceivedFeedbacks(
      Number(req.user[0].id),
      filter,
      Number(req.user[0].orgId),
    );
  }

  @Post('mentor-slots/bookings/:bookingId/attendance')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'mark_attendance',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor session attendance',
    permissionName: 'editMentorDashboard',
  })
  @ApiOperation({
    summary: 'Mark attendance for an instructor session',
    description:
      'Stores the instructor’s join and leave times for the specified session and records the attendance update in the tracking log.',
  })
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
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'complete_session',
    resourceType: 'mentor_dashboard',
    displayType: 'the mentor session',
    permissionName: 'editMentorDashboard',
  })
  @ApiOperation({
    summary: 'Mark an instructor mentor session as completed',
    description:
      'Marks the specified instructor session as completed and records the status change in the tracking log.',
  })
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
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'cancel_booking',
    resourceType: 'mentor_dashboard',
    displayType: 'the mentor booking',
    permissionName: 'deleteMentorDashboard',
  })
  @ApiOperation({
    summary: 'Cancel an instructor mentor booking',
    description:
      'Cancels the specified booking using the supplied reason and cancellation actor, then records the action in the tracking log.',
  })
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
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'update_profile',
    resourceType: 'mentor_dashboard',
    displayType: 'the instructor mentor profile',
    permissionName: 'editMentorDashboard',
  })
  @ApiOperation({
    summary: 'Update the instructor mentor profile',
    description:
      'Updates the authenticated instructor’s mentor profile with the supplied fields and records the update in the tracking log.',
  })
  async updateProfile(@Req() req, @Body() dto: UpdateMentorProfileDto) {
    return this.mentorSlotService.updateMentorProfile(
      Number(req.user[0].id),
      dto,
      Number(req.user[0].orgId),
    );
  }

  @Get('mentor-slots/profile')
  @ApiOperation({ summary: 'Get the instructor mentor profile' })
  async getMyProfile(@Req() req) {
    return this.mentorSlotService.getMyMentorProfile(
      Number(req.user[0].id),
      Number(req.user[0].orgId),
    );
  }

  @Post('mentor-slots/profile')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'create_or_update_profile',
    resourceType: 'mentor_dashboard',
    displayType: 'the instructor mentor profile',
    permissionName: 'createMentorDashboard',
  })
  @ApiOperation({
    summary: 'Create or update the instructor mentor profile',
    description:
      'Creates the authenticated instructor’s mentor profile when none exists, or updates the existing profile, and records the action in the tracking log.',
  })
  async createOrUpdateProfile(@Req() req, @Body() dto: UpdateMentorProfileDto) {
    return this.mentorSlotService.createOrUpdateMentorProfile(
      Number(req.user[0].id),
      dto,
      Number(req.user[0].orgId),
    );
  }

  @Get('mentor-slots/metrics')
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', '30d', '3m'],
  })
  async getMyMetrics(
    @Req() req,
    @Query('filter') filter: 'all' | '30d' | '3m' = 'all',
  ) {
    return this.metricsService.getMentorMetrics(
      BigInt(req.user[0].id),
      Number(req.user[0].orgId),
      filter,
    );
  }

  @Post('mentor-slots/recurrence')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'create_recurrence',
    resourceType: 'mentor_dashboard',
    displayType: 'recurring mentor slots',
    permissionName: 'createMentorDashboard',
  })
  @ApiOperation({
    summary: 'Generate recurring mentor slots',
    description:
      'Generates mentor availability slots from the supplied recurrence rule for the authenticated instructor and records the request in the tracking log.',
  })
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
    enum: ['all', 'upcoming', 'reschedule', 'completed', 'cancelled'],
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
