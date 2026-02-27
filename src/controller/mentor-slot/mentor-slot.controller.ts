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
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MentorSlotService } from './mentor-slot.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { BookSlotDto } from './dto/book-slot.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ProposeRescheduleDto } from './dto/reschedule.dto';
import { FeedbackDto } from './dto/feedback.dto';
import { CreateSlotDto } from './dto/create-slot.dto';
import { AttendanceDto } from './dto/attendance.dto';

@ApiTags('Mentor Slots')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mentor-slots')
export class MentorSlotController {
  constructor(private readonly mentorSlotService: MentorSlotService) {}

  /* ==========================================================================
     BOOK SLOT (student from JWT)
  ========================================================================== */

  @Post('book')
  async bookSlot(@Req() req, @Body() dto: BookSlotDto) {
    return this.mentorSlotService.bookSlot(req.user.id, dto.slotId);
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
  async proposeReschedule(
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: ProposeRescheduleDto,
  ) {
    return this.mentorSlotService.proposeReschedule(
      bookingId,
      dto.newSlotId,
      dto.reason,
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
     REMOVE SLOT
  ========================================================================== */

  @Delete(':slotId')
  async removeSlot(@Param('slotId', ParseIntPipe) slotId: number) {
    return this.mentorSlotService.removeSlot(slotId);
  }

  @Post()
  async createSlot(@Req() req, @Body() dto: CreateSlotDto) {
    return this.mentorSlotService.createSlot(req.user.id, dto);
  }

  @Get('my')
  async getMySlots(@Req() req) {
    return this.mentorSlotService.getMySlots(req.user.id);
  }

  @Get(':slotId/details')
  async getSlotDetails(
    @Req() req,
    @Param('slotId', ParseIntPipe) slotId: number,
  ) {
    return this.mentorSlotService.getSlotDetails(req.user.id, slotId);
  }

  @Get('student/my')
  async getStudentBookings(@Req() req) {
    return this.mentorSlotService.getStudentBookings(req.user.id);
  }

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

  @Post(':bookingId/complete')
  async completeSession(@Param('bookingId', ParseIntPipe) bookingId: number) {
    return this.mentorSlotService.completeSession(bookingId);
  }

  @Patch('mentor/profile')
  async updateProfile(@Req() req, @Body() body: any) {
    return this.mentorSlotService.updateMentorProfile(req.user.id, body);
  }
}
