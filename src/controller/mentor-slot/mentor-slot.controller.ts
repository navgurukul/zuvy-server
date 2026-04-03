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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiTags } from '@nestjs/swagger';
import { MentorSlotService } from './mentor-slot.service';
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
  async bookSlot(@Req() req, @Body() dto: BookSlotDto) {
    return this.mentorSlotService.bookSlot(Number(req.user[0].id), dto.slotId);
  }

  /* ==========================================================================
     CANCEL BOOKING
  ========================================================================== */

  @Post(':bookingId/cancel')
  async cancelBooking(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: CancelBookingDto,
  ) {
    return this.mentorSlotService.cancelBooking(
      bookingId,
      dto.reason,
      dto.cancelledBy,
    );
  }

  /* ==========================================================================
     PROPOSE RESCHEDULE
  ========================================================================== */

  @Post(':bookingId/reschedule')
  @ApiBody({ type: ProposeRescheduleDto })
  async proposeReschedule(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Query('slotId') slotId: number,
    @Body() body: ProposeRescheduleDto,
  ) {
    return this.mentorSlotService.proposeReschedule(
      bookingId,
      slotId,
      body.reason,
    );
  }

  /* ==========================================================================
     ACCEPT RESCHEDULE
  ========================================================================== */

  @Post(':bookingId/reschedule/accept')
  async acceptReschedule(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.mentorSlotService.acceptReschedule(bookingId);
  }

  /* ==========================================================================
     DECLINE RESCHEDULE
  ========================================================================== */

  @Post(':bookingId/reschedule/decline')
  async declineReschedule(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.mentorSlotService.declineReschedule(bookingId);
  }

  /* ==========================================================================
     SUBMIT FEEDBACK
  ========================================================================== */

  @Post(':bookingId/feedback')
  async submitMentorFeedback(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: FeedbackDto,
  ) {
    return this.mentorSlotService.submitMentorFeedback(
      bookingId,
      dto.feedback,
      dto.rating,
    );
  }

  /* ==========================================================================
     CREATE SLOT
  ========================================================================== */
  @Post('create')
  async createSlot(@Req() req, @Body() dto: CreateSlotDto) {
    return this.mentorSlotService.createSlot(Number(req.user[0].id), dto);
  }

  /* ==========================================================================
     REMOVE SLOT
  ========================================================================== */

  @Delete(':slotId')
  async removeSlot(@Req() req, @Param('slotId', ParseIntPipe) slotId: number) {
    return this.mentorSlotService.removeSlot(Number(req.user[0].id), slotId);
  }

  /* ==========================================================================  
    GET MY SLOTS (for mentor) 
========================================================================== */

  @Get('my')
  async getMySlots(@Req() req, @Query('weekOffset') weekOffset: number = 0) {
    return this.mentorSlotService.getMySlots(
      Number(req.user[0].id),
      Number(weekOffset),
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
    );
  }

  /* ==========================================================================  
      GET STUDENT BOOKINGS (for student) 
  ========================================================================== */
  @Get('student/my')
  async getStudentBookings(@Req() req) {
    return this.mentorSlotService.getStudentBookings(Number(req.user[0].id));
  }

  /* ==========================================================================  
      MARK ATTENDANCE (for mentor) 
  ========================================================================== */
  @Post(':bookingId/attendance')
  async markAttendance(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: AttendanceDto,
  ) {
    return this.mentorSlotService.markAttendance(
      bookingId,
      dto.joinedAt,
      dto.leftAt,
    );
  }

  /* ==========================================================================  
      COMPLETE SESSION (for mentor) 
  ========================================================================== */
  @Post(':bookingId/complete')
  async completeSession(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.mentorSlotService.completeSession(bookingId);
  }

  /* ==========================================================================  
      UPDATE MENTOR PROFILE (for mentor) 
  ========================================================================== */
  @Patch('mentor/profile')
  async updateProfile(@Req() req, @Body() dto: UpdateMentorProfileDto) {
    return this.mentorSlotService.updateMentorProfile(
      Number(req.user[0].id),
      dto,
    );
  }
}
