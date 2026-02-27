import {
  Controller,
  Post,
  Delete,
  Body,
  Param,
  Req,
  ParseIntPipe,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags, ApiBody, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MentorSlotService } from './mentor-slot.service';
import { BookSlotDto } from './dto/book-slot.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ProposeRescheduleDto } from './dto/reschedule.dto';
import { FeedbackDto } from './dto/feedback.dto';

@Controller('mentor-slots')
@ApiTags('Mentor Slots')
export class MentorSlotController {
  constructor(private readonly mentorSlotService: MentorSlotService) {}

  /* ==========================================================================
     BOOK SLOT
  ========================================================================== */

  @Post('book')
  bookSlot(@Req() req, @Body() dto: BookSlotDto) {
    return this.mentorSlotService.bookSlot(req.user.id, dto.slotId);
  }

  /* ==========================================================================
     CANCEL BOOKING
  ========================================================================== */

  @Post(':bookingId/cancel')
  async cancelBooking(
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
     SUBMIT MENTOR FEEDBACK
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
}
