import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
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
import { MentorPublicService } from './public/mentor-public.service';
import { BookSlotDto } from './dto/book-slot.dto';
import { CancelBookingDto } from './dto/cancel-booking.dto';
import { ProposeRescheduleDto } from './dto/reschedule.dto';
import { MentorSearchDto } from './public/dto/mentor-search.dto';
import { SkipOrgCheck } from 'src/rbac/decorators/skip-org-check.decorator';
import { FeedbackDto } from './dto/feedback.dto';

// Class-level validation for every DTO in this controller — see the note on
// MentorSlotController for why `transform` is off and what `whitelist` needs.
@ApiTags('Student Mentor APIs')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true }))
@SkipOrgCheck()
@Controller('student')
export class StudentMentorSlotController {
  constructor(
    private readonly mentorSlotService: MentorSlotService,
    private readonly sessionService: SessionService,
    private readonly mentorPublicService: MentorPublicService,
  ) {}

  @Get('mentors')
  @ApiOperation({ summary: 'Search mentors available to students' })
  async getMentors(@Query() query: MentorSearchDto) {
    return this.mentorPublicService.getAllMentors(
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

  // Declared before mentors/:mentorUserId so "skills" isn't taken for an id.
  @Get('mentors/skills')
  @ApiOperation({
    summary: 'The skill chips: the fixed skill list with mentor counts',
    description:
      "Every active skill with mentorCount: mentors who have it among those matching search, organizationId and available (the same filters as GET /student/mentors). Use a skill's slug in ?expertise=.",
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'organizationId', required: false, type: Number })
  @ApiQuery({ name: 'available', required: false, enum: ['true', 'false'] })
  @ApiQuery({
    name: 'inUse',
    required: false,
    enum: ['true', 'false'],
    description:
      'true = only skills at least one matching mentor has (for the filter dropdown). Default: the whole list (for the mentor profile form).',
  })
  getSkillChips(
    @Query('search') search?: string,
    @Query('organizationId') organizationId?: string,
    @Query('available') available?: string,
    @Query('inUse') inUse?: string,
  ) {
    return this.mentorPublicService.getSkillChips(
      search || undefined,
      organizationId ? Number(organizationId) : undefined,
      available === 'true',
      inUse === 'true',
    );
  }

  @Get('mentors/:mentorUserId')
  @ApiOperation({ summary: 'Get a mentor profile for students' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    type: Number,
  })
  getMentorProfile(
    @Param('mentorUserId', ParseIntPipe) mentorUserId: number,
    @Query('organizationId') organizationId?: number,
  ) {
    return this.mentorPublicService.getMentorProfile(
      mentorUserId,
      organizationId ? Number(organizationId) : undefined,
    );
  }

  @Get('mentors/:mentorId/availability')
  @ApiOperation({ summary: 'Get available slots for a mentor' })
  @ApiQuery({
    name: 'organizationId',
    required: false,
    type: Number,
  })
  getAvailableSlots(
    @Param('mentorId', ParseIntPipe) mentorId: number,
    @Query('organizationId') organizationId?: number,
  ) {
    return this.mentorPublicService.getAvailableSlots(
      mentorId,
      organizationId ? Number(organizationId) : undefined,
    );
  }

  @Get('mentor-slots/:slotId/booking-preview')
  @ApiOperation({
    summary: 'Booking drawer: what booking this slot would do (ST2)',
    description:
      'canBook, and when not, blocked: { code, message } (SLOT_TOO_SOON, NO_CREDITS, GAP_ACTIVE, SLOT_TAKEN) exactly as booking would refuse. impact: creditsLeftAfter, nextBookingOpensAt, summary ("Uses 1 credit, 1 left after this"), detail. goodToKnow: the rule lines. Reserves nothing.',
  })
  getBookingPreview(@Req() req, @Param('slotId', ParseIntPipe) slotId: number) {
    return this.mentorSlotService.getBookingPreview(
      Number(req.user[0].id),
      slotId,
    );
  }

  @Post('mentor-slots/book')
  @ApiOperation({ summary: 'Book an available mentor slot as a student' })
  async bookSlot(@Req() req, @Body() dto: BookSlotDto) {
    return this.mentorSlotService.bookSlot(Number(req.user[0].id), dto.slotId);
  }

  @Get('mentorship/eligibility')
  @ApiOperation({
    summary: "The student's mentorship credits and the booking rules",
    description:
      'credits: creditsAssigned, creditsUsed, creditsLeft, nextEligibleDate (when the 2-week gap ends, null when the student can book now or has no credits left), canBook, blockReason (NO_CREDITS | GAP_ACTIVE | null). rules: the numbers in force. earliestBookableStart: slots starting before this cannot be booked. serverTime: use it instead of the device clock.',
  })
  async getBookingEligibility(@Req() req) {
    return this.mentorSlotService.getBookingEligibility(Number(req.user[0].id));
  }

  @Get('mentor-slots/my')
  @ApiOperation({ summary: 'Get all mentor slot bookings for the student' })
  async getStudentBookings(@Req() req) {
    return this.mentorSlotService.getStudentBookings(Number(req.user[0].id));
  }

  @Get('mentor-slots/metrics')
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', '30d', '3m'],
  })
  async getStudentMetrics(
    @Req() req,
    @Query('filter') filter: 'all' | '30d' | '3m' = 'all',
  ) {
    return this.mentorSlotService.getStudentMetrics(
      Number(req.user[0].id),
      filter,
    );
  }

  @Post('mentor-slots/bookings/:bookingId/reschedule')
  @ApiOperation({ summary: 'Request a reschedule for a student booking' })
  async proposeReschedule(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Query('slotId', ParseIntPipe) slotId: number,
    @Body() body: ProposeRescheduleDto,
  ) {
    return this.mentorSlotService.proposeReschedule(
      bookingId,
      slotId,
      body.reason,
      Number(req.user[0].id),
    );
  }

  @Get('mentor-slots/bookings/:bookingId/reschedule/slots')
  @ApiOperation({
    summary:
      'Get valid replacement slots for a student booking from the same mentor and organization',
  })
  async getRescheduleSlots(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.getRescheduleSlotsForBooking(
      Number(req.user[0].id),
      bookingId,
    );
  }

  @Get('mentor-slots/bookings/:bookingId/cancel-preview')
  @ApiOperation({
    summary: 'Cancel form: what cancelling would do (ST4)',
    description:
      'canCancel, and when not, blocked: { code, message } (TOO_LATE_TO_CHANGE, RESCHEDULE_PENDING, SESSION_ENDED, ALREADY_CANCELLED). creditsAfter and message ("Your credit comes back, so you\'ll have 2 of 3 left, and you can book again straight away."). Changes nothing.',
  })
  getCancelPreview(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.getCancelPreview(
      Number(req.user[0].id),
      bookingId,
    );
  }

  @Post('mentor-slots/bookings/:bookingId/cancel')
  @ApiOperation({ summary: 'Cancel a student mentor booking' })
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
  @ApiOperation({ summary: 'Get recordings for a student mentor booking' })
  async getBookingRecordings(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.mentorSlotService.getBookingRecordings(
      Number(req.user[0].id),
      bookingId,
    );
  }

  @Post('mentor-slots/bookings/:bookingId/feedback')
  @ApiOperation({ summary: 'Submit student feedback for a mentor session' })
  async submitStudentFeedback(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
    @Body() dto: FeedbackDto,
  ) {
    return this.mentorSlotService.submitStudentFeedback(
      bookingId,
      dto.feedback,
      dto.rating,
      Number(req.user[0].id),
    );
  }

  @Get('mentor-slots/bookings/:bookingId/mentor-feedback')
  @ApiOperation({ summary: 'Get mentor feedback for a student booking' })
  async getMentorFeedback(
    @Req() req,
    @Param('bookingId', ParseIntPipe) bookingId: number,
  ) {
    return this.sessionService.getStudentFeedback(
      bookingId,
      BigInt(req.user[0].id),
    );
  }

  @Get('mentor-slots/feedbacks')
  @ApiOperation({
    summary: 'Get all mentor feedback received by the student',
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
    return this.mentorSlotService.getStudentReceivedFeedbacks(
      Number(req.user[0].id),
      filter,
    );
  }

  @Get('mentor-sessions/my')
  @ApiOperation({ summary: 'Get mentor sessions booked by the student' })
  @ApiQuery({
    name: 'filter',
    required: false,
    enum: ['all', 'upcoming', 'completed', 'cancelled', 'missed'],
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
  async getMySessions(
    @Req() req,
    @Query('filter') filter?: string,
    @Query('limit') limit = 10,
    @Query('offset') offset = 0,
  ) {
    return this.sessionService.getStudentSessions(
      BigInt(req.user[0].id),
      filter,
      Number(limit),
      Number(offset),
    );
  }

  @Get('mentor-sessions/:sessionId')
  @ApiOperation({ summary: 'Get details for a student mentor session' })
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
