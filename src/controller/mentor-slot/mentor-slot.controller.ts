import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Req,
  UseGuards,
  UseInterceptors,
  Query,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { MentorSlotService } from './mentor-slot.service';
import { TrackAction } from 'src/trackinglog/decorators/track-action.decorator';
import { TrackActionInterceptor } from 'src/trackinglog/interceptors/track-action.interceptor';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { BookSlotDto } from './dto/book-slot.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ProposeRescheduleDto } from './dto/reschedule.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { AttendanceDto } from './dto/attendance.dto';
import { UpdateMentorProfileDto } from './dto/update-mentor-profile.dto';

@ApiTags('Mentor Slots')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('mentor-slots')
export class MentorSlotController {
  constructor(private readonly mentorSlotService: MentorSlotService) {}

  /* ==========================================================================
     BOOK SLOT (student from JWT)
  ========================================================================== */

  @Post('book')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'book_slot',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor slot',
    permissionName: 'createMentorDashboard',
    getResourceName: (result) => result?.data?.slotId?.toString() || '',
  })
  async bookSlot(@Req() req, @Body() dto: BookSlotDto) {
    return this.mentorSlotService.bookSlot(Number(req.user[0].id), dto.slotId);
  }

  /* ==========================================================================
     CANCEL BOOKING
  ========================================================================== */

  @Post(':bookingId/cancel')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'cancel_booking',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor booking',
    permissionName: 'deleteMentorDashboard',
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

  /* ==========================================================================
     PROPOSE RESCHEDULE
  ========================================================================== */

  @Post(':bookingId/reschedule')
  @ApiBody({ type: ProposeRescheduleDto })
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'propose_reschedule',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor booking reschedule',
    permissionName: 'editMentorDashboard',
  })
  async proposeReschedule(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Query('slotId') slotId: number,
    @Body() body: ProposeRescheduleDto,
  ) {
    return this.mentorSlotService.proposeReschedule(
      bookingId,
      slotId,
      body.reason,
      Number(req.user[0].id),
    );
  }

  /* ==========================================================================
     ACCEPT RESCHEDULE
  ========================================================================== */

  @Post(':bookingId/reschedule/accept')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'accept_reschedule',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor booking reschedule',
    permissionName: 'editMentorDashboard',
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

  /* ==========================================================================
     DECLINE RESCHEDULE
  ========================================================================== */

  @Post(':bookingId/reschedule/decline')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'decline_reschedule',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor booking reschedule',
    permissionName: 'editMentorDashboard',
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

  /* ==========================================================================
     SUBMIT FEEDBACK
  ========================================================================== */

  @Post(':bookingId/feedback')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'submit_feedback',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor session feedback',
    permissionName: 'editMentorDashboard',
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

  /* ==========================================================================
     CREATE SLOT
  ========================================================================== */
  @Post('create')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'create_slot',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor slot',
  })
  async createSlot(@Req() req, @Body() dto: CreateSlotDto) {
    return this.mentorSlotService.createSlot(
      Number(req.user[0].id),
      dto,
      Number(req.user[0].orgId),
    );
  }

  /* ==========================================================================
     REMOVE SLOT
  ========================================================================== */

  @Delete(':slotId')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'delete_slot',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor slot',
  })
  async removeSlot(@Req() req, @Param('slotId', ParseIntPipe) slotId: number) {
    return this.mentorSlotService.removeSlot(
      Number(req.user[0].id),
      slotId,
      Number(req.user[0].orgId),
    );
  }

  /* ==========================================================================  
    GET MY SLOTS (for mentor) 
========================================================================== */
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['asc', 'desc'],
  })
  @Get('my')
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

  /* ==========================================================================
      GET SLOT DETAILS (for mentor or student) 
  ========================================================================== */
  @Get(':slotId/details')
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

  @Get(':bookingId/recordings')
  @ApiOperation({
    summary: 'Get YouTube recordings and session info for a mentor booking',
  })
  async getBookingRecordings(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.getBookingRecordings(
      Number(req.user[0].id),
      bookingId,
    );
  }

  /* ==========================================================================  
      GET STUDENT BOOKINGS (for student) 
  ========================================================================== */
  @Get('student/my')
  async getStudentBookings(@Req() req) {
    return this.mentorSlotService.getStudentBookings(Number(req.user[0].id));
  }

  @Get('student/metrics')
  async getStudentMetrics(@Req() req) {
    return this.mentorSlotService.getStudentMetrics(Number(req.user[0].id));
  }

  /* ==========================================================================  
      MARK ATTENDANCE (for mentor) 
  ========================================================================== */
  @Post(':bookingId/attendance')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'mark_attendance',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor session attendance',
    permissionName: 'editMentorDashboard',
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

  /* ==========================================================================  
      COMPLETE SESSION (for mentor) 
  ========================================================================== */
  @Post(':bookingId/complete')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'complete_session',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor session',
    permissionName: 'editMentorDashboard',
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

  /* ==========================================================================  
      UPDATE MENTOR PROFILE (for mentor) 
  ========================================================================== */
  @Patch('mentor/profile')
  @UseInterceptors(TrackActionInterceptor)
  @TrackAction({
    action: 'edit_profile',
    resourceType: 'mentor_dashboard',
    displayType: 'mentor profile',
  })
  async updateProfile(@Req() req, @Body() dto: UpdateMentorProfileDto) {
    return this.mentorSlotService.updateMentorProfile(
      Number(req.user[0].id),
      dto,
      Number(req.user[0].orgId),
    );
  }

  /* ==========================================================================  
   GET MY MENTOR PROFILE
========================================================================== */

  @Get('mentor/profile')
  @ApiOperation({ summary: 'Get logged-in mentor profile' })
  async getMyProfile(@Req() req) {
    return this.mentorSlotService.getMyMentorProfile(
      Number(req.user[0].id),
      Number(req.user[0].orgId),
    );
  }

  /* ==========================================================================  
   CREATE OR UPDATE MENTOR PROFILE
========================================================================== */

  @Post('mentor/profile')
  async createOrUpdateProfile(@Req() req, @Body() dto: UpdateMentorProfileDto) {
    const user = req.user?.[0];

    if (!user?.id) {
      throw new BadRequestException('Invalid user in token');
    }

    const userId = Number(user.id);

    if (Number.isNaN(userId)) {
      throw new BadRequestException('Invalid userId');
    }

    return this.mentorSlotService.createOrUpdateMentorProfile(
      userId,
      dto,
      Number(req.user[0].orgId),
    );
  }
}
