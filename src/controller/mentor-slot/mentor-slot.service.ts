import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { db } from '../../db';
import {
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyMentorSlotManagement,
  zuvyUserRolesAssigned,
  zuvyUserRoles,
  zuvyBatchEnrollments,
  zuvyBootcampType,
  zuvyBootcamps,
  zuvyMentorSessionRecordings,
  users,
  zuvyStudentBookingMetrics,
} from '../../../drizzle/schema';

import { and, eq, lt, sql, desc } from 'drizzle-orm';
import { CreateSlotDto } from './dto/create-slot.dto';
import { GoogleCalendarService } from 'src/integrations/google/google-calendar.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';
import { ZoomService } from 'src/services/zoom/zoom.service';
import { NotificationEmailService } from 'src/notification/email/email.service';

@Injectable()
export class MentorSlotService {
  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationService: NotificationService,
    private readonly zoomService: ZoomService,
    private readonly emailService: NotificationEmailService,
  ) {}

  private async getMentorProfile(userId: number) {
    const userIdBigInt = BigInt(userId);

    let [mentorProfile] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, userIdBigInt))
      .limit(1);

    if (!mentorProfile) {
      const inserted = await db
        .insert(zuvyMentorSlotManagement)
        .values({
          mentorUserId: userIdBigInt,
          organizationId: 1,
          mentorType: 'mentor',
        } as typeof zuvyMentorSlotManagement.$inferInsert)
        .returning();

      mentorProfile = inserted[0];
    }

    return mentorProfile;
  }

  private async ensureUserIsMentor(userId: number) {
    if (!userId || Number.isNaN(userId)) {
      throw new ForbiddenException('Invalid user');
    }

    const userIdBigInt = BigInt(userId);

    const [role] = await db
      .select()
      .from(zuvyUserRolesAssigned)
      .innerJoin(
        zuvyUserRoles,
        eq(zuvyUserRolesAssigned.roleId, zuvyUserRoles.id),
      )
      .where(
        and(
          eq(zuvyUserRolesAssigned.userId, userIdBigInt),
          eq(zuvyUserRoles.name, 'instructor'),
        ),
      )
      .limit(1);

    if (!role) {
      throw new ForbiddenException(
        'User is not allowed to act as mentor. Only instructors can create mentor slots.',
      );
    }
  }

  private async ensureMentorZoomVerified(userId: number) {
    const mentorProfile = await this.getMentorProfile(userId);
    console.log(
      `Mentor profile for user ${userId}: isVerified=${mentorProfile?.isVerified}`,
    );

    if (mentorProfile?.isVerified) {
      console.log(`Mentor ${userId} already verified, skipping Zoom check`);
      return true;
    }

    const [userRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, BigInt(userId)))
      .limit(1);

    if (!userRow) {
      throw new NotFoundException('Mentor user not found');
    }

    console.log(`Checking Zoom user for email: ${userRow.email}`);

    const zoomResponse = await this.zoomService.getUser(userRow.email);
    console.log(
      `Zoom getUser response: success=${zoomResponse.success}, error=${zoomResponse.error}`,
    );

    if (!zoomResponse.success) {
      console.error(
        `Zoom user check failed for ${userRow.email}: ${zoomResponse.error}`,
      );
      throw new BadRequestException(
        'Mentor Zoom account is not available or not licensed',
      );
    }

    const userType = zoomResponse.data.type;
    const userStatus = zoomResponse.data.status;
    console.log(`Zoom user type=${userType}, status=${userStatus}`);

    if (userType !== 2 || userStatus !== 'active') {
      console.error(
        `Zoom user not licensed/active: type=${userType}, status=${userStatus}`,
      );
      throw new BadRequestException(
        'Mentor Zoom account must be an active licensed Zoom user',
      );
    }

    console.log(
      `Zoom verification successful for user ${userId}, updating profile`,
    );

    await db
      .update(zuvyMentorSlotManagement)
      .set({
        isVerified: true,
        updatedAt: new Date(),
      } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId)));

    return true;
  }

  private async validateMentorProfileComplete(userId: number) {
    const [profile] = await db
      .select({
        bio: zuvyMentorSlotManagement.bio,
        expertise: zuvyMentorSlotManagement.expertise,
        pastExperiences: zuvyMentorSlotManagement.pastExperiences,
      })
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId)))
      .limit(1);

    if (!profile) {
      throw new NotFoundException('Mentor profile not found.');
    }

    if (!profile.bio || !profile.expertise || !profile.pastExperiences) {
      throw new ForbiddenException(
        'Complete your mentor profile (bio, expertise, past experiences) before creating slots.',
      );
    }

    if (Array.isArray(profile.expertise) && profile.expertise.length === 0) {
      throw new ForbiddenException('Add at least one skill in expertise.');
    }

    if (
      Array.isArray(profile.pastExperiences) &&
      profile.pastExperiences.length === 0
    ) {
      throw new ForbiddenException(
        'Add past experiences before creating slots.',
      );
    }

    return true;
  }
  /* ==========================================================================
     UTILITY — 12 HOUR RULE ENFORCER
  ========================================================================== */

  private enforceMinimumNotice(slotStart: Date) {
    const now = new Date();
    const diffMs = slotStart.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours < 12) {
      throw new BadRequestException(
        'Booking must be made at least 12 hours in advance.',
      );
    }
  }

  /* ==========================================================================
   QUOTA YEAR WINDOW (APRIL 15 → APRIL 14)
========================================================================== */

  private getQuotaWindow() {
    const now = new Date();
    const year = now.getUTCFullYear();

    let quotaStart = new Date(Date.UTC(year, 3, 15)); // April 15
    let quotaEnd = new Date(Date.UTC(year + 1, 3, 14, 23, 59, 59));

    if (now < quotaStart) {
      quotaStart = new Date(Date.UTC(year - 1, 3, 15));
      quotaEnd = new Date(Date.UTC(year, 3, 14, 23, 59, 59));
    }

    return { quotaStart, quotaEnd };
  }

  private getQuotaResetDate() {
    const { quotaEnd } = this.getQuotaWindow();
    return new Date(Date.UTC(quotaEnd.getUTCFullYear(), 3, 15));
  }

  private async resetStudentMetrics(studentUserId: bigint) {
    const resetDate = this.getQuotaResetDate();
    await db
      .update(zuvyStudentBookingMetrics)
      .set({
        quotaUsed: 0,
        isQuotaExhausted: false,
        quotaResetDate: resetDate,
        updatedAt: new Date(),
      } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>)
      .where(eq(zuvyStudentBookingMetrics.userId, studentUserId));
  }

  /* ==========================================================================
     VALIDATE LEARNER QUOTA + COOLDOWN
  ========================================================================== */

  private async validateLearnerBookingEligibility(studentUserId: bigint) {
    const [metrics] = await db
      .select()
      .from(zuvyStudentBookingMetrics)
      .where(eq(zuvyStudentBookingMetrics.userId, studentUserId))
      .limit(1);

    if (!metrics) {
      // Initialize if missing
      await this.initializeStudentMetrics(studentUserId);
      return; // Allow first booking
    }

    const now = new Date();
    if (metrics.quotaResetDate && now >= metrics.quotaResetDate) {
      await this.resetStudentMetrics(studentUserId);
      return;
    }

    // Check quota
    if (metrics.isQuotaExhausted || metrics.quotaUsed >= 3) {
      throw new ForbiddenException(
        `You have used all 3 sessions for this year. Your quota resets on ${metrics.quotaResetDate.toDateString()}.`,
      );
    }

    // Check cooldown
    if (metrics.cooldownEndDate && now < metrics.cooldownEndDate) {
      throw new ForbiddenException(
        `You can book your next session from ${metrics.cooldownEndDate.toDateString()}.`,
      );
    }
  }

  private async initializeStudentMetrics(userId: bigint) {
    const quotaResetDate = this.getQuotaResetDate();
    await db.insert(zuvyStudentBookingMetrics).values({
      userId,
      quotaResetDate,
    } as typeof zuvyStudentBookingMetrics.$inferInsert);
  }

  /* ==========================================================================
     ENSURE MENTORSHIP IS ENABLED
  ========================================================================== */
  private async ensureMentorshipEnabled(studentUserId: bigint) {
    const enrollments = await db
      .select({
        mentorshipEnabled: zuvyBootcampType.mentorshipEnabled,
      })
      .from(zuvyBatchEnrollments)
      .innerJoin(
        zuvyBootcampType,
        eq(zuvyBatchEnrollments.bootcampId, zuvyBootcampType.bootcampId),
      )
      .where(
        and(
          eq(zuvyBatchEnrollments.userId, studentUserId),
          eq(zuvyBatchEnrollments.status, 'active'),
        ),
      );

    if (enrollments.length === 0) {
      throw new ForbiddenException(
        'You are not enrolled in a course with mentorship access.',
      );
    }

    const hasMentorship = enrollments.some((e) => e.mentorshipEnabled === true);

    if (!hasMentorship) {
      throw new ForbiddenException(
        'One-on-one mentorship is not available for your current programme.',
      );
    }
  }

  /* ==========================================================================
     DERIVE SESSION LIFECYCLE STATE
  ========================================================================== */

  private deriveLifecycleState(booking: any, slot: any): string {
    const now = new Date();
    const slotEnd = new Date(slot.slotEndDateTime);

    if (booking.status === 'cancelled') {
      throw new BadRequestException(
        'Cancelled bookings cannot be rescheduled.',
      );
    }

    if (booking.rescheduleStatus === 'pending') return 'RESCHEDULE_PENDING';

    if (booking.completedAt) return 'COMPLETED';

    if (booking.joinedAt && !booking.completedAt) return 'IN_PROGRESS';

    if (now.getTime() > slotEnd.getTime() && !booking.joinedAt) return 'MISSED';

    return 'SCHEDULED';
  }

  /* ==========================================================================
     BOOK SLOT (CONCURRENCY SAFE)
  ========================================================================== */

  async bookSlot(studentId: number, slotId: number) {
    await this.ensureMentorshipEnabled(BigInt(studentId));
    await this.validateLearnerBookingEligibility(BigInt(studentId));

    return db.transaction(async (trx) => {
      const result = await trx.execute(sql`
SELECT
  id,
  mentor_slot_management_id AS "mentorSlotManagementId",
  slot_start_date_time AS "slotStartDateTime",
  slot_end_date_time AS "slotEndDateTime",
  duration_minutes AS "durationMinutes",
  max_capacity AS "maxCapacity",
  current_booked_count AS "currentBookedCount",
  status
FROM zuvy_mentor_slot_availability
WHERE id = ${slotId}
FOR UPDATE
`);

      const slot = result
        .rows[0] as typeof zuvyMentorSlotAvailability.$inferSelect;

      if (!slot) throw new NotFoundException('Slot not found.');

      if (!slot.slotStartDateTime || !slot.slotEndDateTime) {
        throw new BadRequestException('Slot time is missing.');
      }

      if (slot.status !== 'available')
        throw new BadRequestException('Slot not available.');

      // this.enforceMinimumNotice(new Date(slot.slotStartDateTime));

      // Fetch mentor buffer settings
      const [mentorProfile] = await trx
        .select()
        .from(zuvyMentorSlotManagement)
        .where(eq(zuvyMentorSlotManagement.id, slot.mentorSlotManagementId))
        .limit(1);

      if (mentorProfile?.isBufferEnabled && mentorProfile.bufferMinutes > 0) {
        const bufferMs = mentorProfile.bufferMinutes * 60 * 1000;

        const slotStart = new Date(slot.slotStartDateTime).getTime();
        const slotEnd = new Date(slot.slotEndDateTime).getTime();

        const bufferedStart = new Date(slotStart - bufferMs);
        const bufferedEnd = new Date(slotEnd + bufferMs);

        const conflictingBookings = await trx
          .select({
            id: zuvyMentorSlotBooking.id,
          })
          .from(zuvyMentorSlotBooking)
          .innerJoin(
            zuvyMentorSlotAvailability,
            eq(
              zuvyMentorSlotBooking.slotAvailabilityId,
              zuvyMentorSlotAvailability.id,
            ),
          )
          .where(
            and(
              eq(
                zuvyMentorSlotBooking.mentorUserId,
                mentorProfile.mentorUserId,
              ),
              eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
              sql`${zuvyMentorSlotAvailability.slotStartDateTime} < ${bufferedEnd}`,
              sql`${zuvyMentorSlotAvailability.slotEndDateTime} > ${bufferedStart}`,
            ),
          );

        if (conflictingBookings.length > 0) {
          throw new BadRequestException(
            `Buffer time violation. Mentor requires ${mentorProfile.bufferMinutes} minutes between sessions.`,
          );
        }
      }

      const existingBooking = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(
          and(
            eq(zuvyMentorSlotBooking.studentUserId, BigInt(studentId)),
            eq(zuvyMentorSlotBooking.slotAvailabilityId, slotId),
            eq(zuvyMentorSlotBooking.status, 'confirmed'),
          ),
        )
        .limit(1);

      if (existingBooking.length > 0) {
        throw new BadRequestException('You already booked this slot.');
      }

      if (slot.currentBookedCount >= slot.maxCapacity)
        throw new BadRequestException('Slot is full.');

      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} + 1`,
          status: sql`
      CASE
        WHEN ${zuvyMentorSlotAvailability.currentBookedCount} + 1 >= ${zuvyMentorSlotAvailability.maxCapacity}
        THEN 'full'
        ELSE 'available'
      END
    `,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, slotId));

      const booking = await trx
        .insert(zuvyMentorSlotBooking)
        .values({
          slotAvailabilityId: slotId,
          studentUserId: BigInt(studentId),
          mentorUserId: mentorProfile.mentorUserId,
          organizationId: mentorProfile.organizationId,
          status: 'confirmed',
          confirmedAt: new Date(),
          sessionLifecycleState: 'SCHEDULED',
        } as typeof zuvyMentorSlotBooking.$inferInsert)
        .returning();

      const createdBooking = booking[0];

      // Update student booking metrics
      await trx
        .insert(zuvyStudentBookingMetrics)
        .values({
          userId: BigInt(studentId),
          totalBookings: 1,
          quotaUsed: 1,
          lastBookingDate: new Date(),
          cooldownEndDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000), // 21 days
          quotaResetDate: this.getQuotaResetDate(),
          isQuotaExhausted: false,
        } as typeof zuvyStudentBookingMetrics.$inferInsert)
        .onConflictDoUpdate({
          target: zuvyStudentBookingMetrics.userId,
          set: {
            totalBookings: sql`COALESCE(zuvy_student_booking_metrics.total_bookings, 0) + 1`,
            quotaUsed: sql`COALESCE(zuvy_student_booking_metrics.quota_used, 0) + 1`,
            lastBookingDate: new Date(),
            cooldownEndDate: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000),
            quotaResetDate: this.getQuotaResetDate(),
            isQuotaExhausted: sql`CASE WHEN COALESCE(zuvy_student_booking_metrics.quota_used, 0) + 1 >= 3 THEN true ELSE false END`,
          } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>,
        });

      await this.notificationService.createNotification({
        userId: mentorProfile.mentorUserId,
        type: NotificationType.BOOKING_CREATED,
        title: 'New mentorship booking',
        message: `A student booked your session.`,
        referenceId: createdBooking.id,
        referenceType: 'booking',
      });

      await this.notificationService.createNotification({
        userId: BigInt(studentId),
        type: NotificationType.BOOKING_CONFIRMED,
        title: 'Session confirmed',
        message: `Your mentorship session has been scheduled.`,
        referenceId: createdBooking.id,
        referenceType: 'booking',
      });

      /* Fetch mentor + student emails */

      const mentorResult = await trx.execute(
        sql`SELECT email FROM users WHERE id = ${mentorProfile.mentorUserId}`,
      );

      const studentResult = await trx.execute(
        sql`SELECT email FROM users WHERE id = ${studentId}`,
      );

      const mentorEmail = mentorResult.rows[0].email as string;
      const studentEmail = studentResult.rows[0].email as string;

      const refreshToken = mentorProfile.googleRefreshToken;

      const slotStartDateTime = new Date(slot.slotStartDateTime);
      const slotEndDateTime = new Date(slot.slotEndDateTime);

      let meeting: {
        joinUrl?: string;
        startUrl?: string;
        password?: string;
        meetingId?: string;
        uuid?: string;
      } = {};

      /* Create Zoom Meeting */
      try {
        const zoomMeetingData = {
          topic: `Mentorship Session: ${mentorEmail} & ${studentEmail}`,
          type: 2, // Scheduled meeting
          start_time: slotStartDateTime.toISOString(),
          duration: slot.durationMinutes,
          timezone: 'UTC', // Adjust as needed
          password: Math.random().toString(36).substring(2, 8), // Generate random password
          agenda: 'One-on-one mentorship session',
          settings: {
            host_video: true,
            participant_video: true,
            join_before_host: false,
            mute_upon_entry: true,
            watermark: false,
            use_pmi: false,
            approval_type: 0,
            audio: 'both',
            auto_recording: 'cloud',
            waiting_room: false,
          },
        };

        const zoomResponse = await this.zoomService.createMeetingForUser(
          mentorEmail,
          zoomMeetingData,
        );

        if (!zoomResponse.success) {
          throw new Error(
            `Failed to create Zoom meeting: ${zoomResponse.error}`,
          );
        }

        // Fetch UUID explicitly
        const meetingDetails = await this.zoomService.getMeeting(
          zoomResponse.data.id.toString(),
        );

        if (!meetingDetails.success || !meetingDetails.data?.uuid) {
          throw new Error('Failed to fetch Zoom meeting UUID');
        }

        meeting = {
          joinUrl: zoomResponse.data.join_url,
          startUrl: zoomResponse.data.start_url,
          password: zoomResponse.data.password,
          meetingId: zoomResponse.data.id.toString(),
          uuid: meetingDetails.data.uuid,
        };
      } catch (error) {
        console.error('Zoom meeting creation failed:', error.message);
        throw new BadRequestException(
          'Failed to create Zoom meeting. Please check Zoom integration.',
        );
      }
      /* Save meeting info */

      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          meetingLink: meeting?.joinUrl ?? null,
          isZoomMeet: true,
          zoomStartUrl: meeting?.startUrl ?? null,
          zoomPassword: meeting?.password ?? null,
          zoomMeetingId: meeting?.meetingId ?? null,
          zoomMeetingUuid: meeting?.uuid ?? null,
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(eq(zuvyMentorSlotBooking.id, createdBooking.id));

      // Enqueue recording job
      await this.enqueueMentorRecordingJob({
        id: createdBooking.id,
        zoomMeetingId: meeting?.meetingId ?? null,
        zoomMeetingUuid: meeting?.uuid ?? null,
        isZoomMeet: true,
      });

      // Fetch updated metrics for response
      const [updatedMetrics] = await trx
        .select()
        .from(zuvyStudentBookingMetrics)
        .where(eq(zuvyStudentBookingMetrics.userId, BigInt(studentId)))
        .limit(1);

      const bookingResponse = {
        ...createdBooking,
        meetingLink: meeting.joinUrl,
        remainingCredits: updatedMetrics ? 3 - updatedMetrics.quotaUsed : 2,
        nextEligible: updatedMetrics?.cooldownEndDate,
      };

      // Send notification email to team@zuvy after successful booking
      const slotDateOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      };
      const slotTimeOptions: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      };
      const slotDate =
        new Date(slot.slotStartDateTime).toLocaleDateString(
          'en-IN',
          slotDateOptions,
        ) +
        ', ' +
        new Date(slot.slotStartDateTime).toLocaleTimeString(
          'en-IN',
          slotTimeOptions,
        ) +
        ' - ' +
        new Date(slot.slotEndDateTime).toLocaleTimeString(
          'en-IN',
          slotTimeOptions,
        );

      this.emailService
        .sendEmail(
          'team@zuvy.org',
          '📅 New Mentorship Session Booked',
          `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f4f4f4; padding: 24px; border-radius: 8px;">
            <div style="background: #ffffff; padding: 16px 24px; border-radius: 6px 6px 0 0; border-bottom: 3px solid #4ade80;">
              <img src="https://dev.app.zuvy.org/_next/image?url=%2Fzuvy-logo-horizontal.png&w=256&q=75" alt="Zuvy" style="height: 40px; display: block;" />
            </div>
            <div style="background: #ffffff; padding: 28px 24px; border-radius: 0 0 6px 6px; border: 1px solid #e5e7eb;">
              <h3 style="color: #1a1a2e; margin: 0 0 6px;">New Session Booked</h3>
              <p style="color: #6B7280; margin: 0 0 24px; font-size: 14px;">A mentorship session has been confirmed. Here are the details:</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px 8px; color: #6B7280; font-size: 14px; width: 130px;">Student</td>
                  <td style="padding: 12px 8px; color: #1a1a2e; font-weight: 600; font-size: 14px;">{{studentEmail}}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px 8px; color: #6B7280; font-size: 14px;">Mentor</td>
                  <td style="padding: 12px 8px; color: #1a1a2e; font-weight: 600; font-size: 14px;">{{mentorEmail}}</td>
                </tr>
                <tr style="border-bottom: 1px solid #f3f4f6;">
                  <td style="padding: 12px 8px; color: #6B7280; font-size: 14px;">Session Time</td>
                  <td style="padding: 12px 8px; color: #1a1a2e; font-weight: 600; font-size: 14px;">{{slotDate}}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 8px; color: #6B7280; font-size: 14px;">Meeting Link</td>
                  <td style="padding: 12px 8px;">
                    <a href="{{meetingLink}}" style="background: #4ade80; color: #1a1a2e; padding: 8px 18px; border-radius: 4px; text-decoration: none; font-size: 14px; font-weight: 700;">Join Zoom Meeting</a>
                  </td>
                </tr>
              </table>
            </div>
            <p style="text-align: center; color: #9CA3AF; font-size: 12px; margin-top: 16px;">© Zuvy by NavGurukul</p>
          </div>`,
          {
            studentEmail,
            mentorEmail,
            slotDate,
            meetingLink: meeting.joinUrl ?? 'N/A',
          },
        )
        .catch((err) => console.error(`team email failed: ${err.message}`));

      return bookingResponse;
    });
  }

  /* ==========================================================================
     CANCEL SESSION (PRD — MANDATORY REASON)
  ========================================================================== */

  async cancelBooking(
    bookingId: number,
    reason: string,
    cancelledBy: 'mentor' | 'student',
  ) {
    if (!reason || reason.length < 10) {
      throw new BadRequestException(
        'Cancellation reason must be at least 10 characters.',
      );
    }

    return db.transaction(async (trx) => {
      const [booking] = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(eq(zuvyMentorSlotBooking.id, bookingId))
        .limit(1);

      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      /* Prevent double cancellation */

      if (booking.status === 'cancelled') {
        throw new BadRequestException('Booking already cancelled.');
      }

      /* Release slot capacity */

      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`GREATEST(${zuvyMentorSlotAvailability.currentBookedCount} - 1, 0)`,
          status: 'available',
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId));

      /* Cancel booking */

      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          status: 'cancelled',
          sessionLifecycleState: 'CANCELLED',
          cancellationReason: reason,
          cancelledBy,
          cancelledAt: new Date(),
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(eq(zuvyMentorSlotBooking.id, bookingId));

      await this.notificationService.createNotification({
        userId: booking.studentUserId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Session cancelled',
        message: `Your mentorship session was cancelled.`,
        referenceId: bookingId,
        referenceType: 'booking',
      });

      await this.notificationService.createNotification({
        userId: booking.mentorUserId,
        type: NotificationType.BOOKING_CANCELLED,
        title: 'Session cancelled',
        message: `A mentorship session was cancelled.`,
        referenceId: bookingId,
        referenceType: 'booking',
      });

      const [mentorProfile] = await trx
        .select()
        .from(zuvyMentorSlotManagement)
        .where(eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId))
        .limit(1);

      const refreshToken = mentorProfile?.googleRefreshToken;

      if (booking.googleEventId && refreshToken) {
        await this.googleCalendarService.deleteMeeting(
          booking.googleEventId,
          refreshToken,
        );
      }

      const { quotaStart, quotaEnd } = this.getQuotaWindow();

      const [{ count: totalBookings }] = await trx
        .select({ count: sql<number>`COUNT(*)` })
        .from(zuvyMentorSlotBooking)
        .where(
          and(
            eq(zuvyMentorSlotBooking.studentUserId, booking.studentUserId),
            sql`${zuvyMentorSlotBooking.status} != 'cancelled'`,
          ),
        );

      if (Number(totalBookings) === 0) {
        await trx
          .delete(zuvyStudentBookingMetrics)
          .where(eq(zuvyStudentBookingMetrics.userId, booking.studentUserId));
      } else {
        const [{ count: quotaUsed }] = await trx
          .select({ count: sql<number>`COUNT(*)` })
          .from(zuvyMentorSlotBooking)
          .where(
            and(
              eq(zuvyMentorSlotBooking.studentUserId, booking.studentUserId),
              sql`${zuvyMentorSlotBooking.status} != 'cancelled'`,
              sql`${zuvyMentorSlotBooking.confirmedAt} >= ${quotaStart}`,
              sql`${zuvyMentorSlotBooking.confirmedAt} <= ${quotaEnd}`,
            ),
          );

        const [lastBooking] = await trx
          .select({ confirmedAt: zuvyMentorSlotBooking.confirmedAt })
          .from(zuvyMentorSlotBooking)
          .where(
            and(
              eq(zuvyMentorSlotBooking.studentUserId, booking.studentUserId),
              sql`${zuvyMentorSlotBooking.status} != 'cancelled'`,
            ),
          )
          .orderBy(sql`${zuvyMentorSlotBooking.confirmedAt} DESC`)
          .limit(1);

        const lastBookingDate = lastBooking?.confirmedAt;
        const cooldownEndDate = lastBookingDate
          ? new Date(lastBookingDate.getTime() + 21 * 24 * 60 * 60 * 1000)
          : null;

        await trx
          .insert(zuvyStudentBookingMetrics)
          .values({
            userId: booking.studentUserId,
            totalBookings: Number(totalBookings),
            quotaUsed: Number(quotaUsed),
            lastBookingDate,
            cooldownEndDate,
            quotaResetDate: this.getQuotaResetDate(),
            isQuotaExhausted: Number(quotaUsed) >= 3,
          } as typeof zuvyStudentBookingMetrics.$inferInsert)
          .onConflictDoUpdate({
            target: zuvyStudentBookingMetrics.userId,
            set: {
              totalBookings: Number(totalBookings),
              quotaUsed: Number(quotaUsed),
              lastBookingDate,
              cooldownEndDate,
              isQuotaExhausted: Number(quotaUsed) >= 3,
              updatedAt: new Date(),
            } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>,
          });
      }

      return {
        message: 'Booking cancelled successfully.',
      };
    });
  }

  /* ==========================================================================
     RESCHEDULE WORKFLOW (PROPOSE)
  ========================================================================== */

  async proposeReschedule(
    bookingId: number,
    newSlotId: number,
    reason: string,
  ) {
    if (!reason || reason.length < 10) {
      throw new BadRequestException(
        'Reschedule reason must be at least 10 characters.',
      );
    }

    /* ================================
       FETCH BOOKING
    ================================= */

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found.');
    }

    if (booking.status === 'cancelled') {
      throw new BadRequestException('Cancelled booking cannot be rescheduled.');
    }

    if (booking.rescheduleStatus === 'pending') {
      throw new BadRequestException('Reschedule already requested.');
    }

    if (booking.slotAvailabilityId === newSlotId) {
      throw new BadRequestException('Cannot reschedule to the same slot.');
    }

    /* ================================
       FETCH SLOT
    ================================= */

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, newSlotId))
      .limit(1);

    if (!slot) {
      throw new BadRequestException('Proposed slot not found.');
    }

    /* ================================
    SLOT VALIDATIONS
    ================================= */

    if (slot.status !== 'available') {
      throw new BadRequestException('Proposed slot is not available.');
    }

    if (slot.currentBookedCount >= slot.maxCapacity) {
      throw new BadRequestException('Proposed slot is full.');
    }

    this.enforceMinimumNotice(new Date(slot.slotStartDateTime));

    if (new Date(slot.slotStartDateTime) <= new Date()) {
      throw new BadRequestException('Cannot reschedule to past slot.');
    }

    /* ================================
       ENSURE SAME MENTOR
    ================================= */

    const [mentorProfile] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId))
      .limit(1);

    if (!mentorProfile || slot.mentorSlotManagementId !== mentorProfile.id) {
      throw new BadRequestException(
        'Cannot reschedule to a slot belonging to another mentor.',
      );
    }

    /* ================================
       UPDATE BOOKING
    ================================= */

    await db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: 'pending',
        rescheduleRequestedAt: new Date(),
        rescheduleProposedSlotId: newSlotId,
        sessionLifecycleState: 'RESCHEDULE_PENDING',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));

    /* ================================
       SEND NOTIFICATION
    ================================= */

    await this.notificationService.createNotification({
      userId: booking.mentorUserId,
      type: NotificationType.RESCHEDULE_REQUEST,
      title: 'Reschedule request',
      message: 'A student requested to reschedule the session.',
      referenceId: bookingId,
      referenceType: 'booking',
    });

    return {
      message: 'Reschedule request submitted successfully.',
    };
  }

  /* ==========================================================================
     SUBMIT MENTOR FEEDBACK (PRD COMPLIANT)
  ========================================================================== */

  async submitMentorFeedback(
    bookingId: number,
    feedback: any,
    rating?: number,
  ) {
    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException('Booking not found.');

    if (booking.mentorFeedbackLocked)
      throw new ForbiddenException('Feedback is locked after 24 hours.');

    return db
      .update(zuvyMentorSlotBooking)
      .set({
        mentorFeedback: feedback,
        mentorRating: rating,
        mentorFeedbackSubmittedAt: new Date(),
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
  }

  /* ==========================================================================
     AUTO LOCK FEEDBACK (CALLED BY JOB)
  ========================================================================== */

  async lockExpiredFeedback() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    return db
      .update(zuvyMentorSlotBooking)
      .set({ mentorFeedbackLocked: true } as Partial<
        typeof zuvyMentorSlotBooking.$inferInsert
      >)
      .where(
        and(
          lt(zuvyMentorSlotBooking.mentorFeedbackSubmittedAt, cutoff),
          eq(zuvyMentorSlotBooking.mentorFeedbackLocked, false),
        ),
      );
  }

  /* ==========================================================================
     ENFORCE 12-HOUR SLOT DELETION RULE
  ========================================================================== */

  async removeSlot(userId: number, slotId: number) {
    await this.ensureUserIsMentor(userId);

    const mentorProfile = await this.getMentorProfile(userId);

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId))
      .limit(1);

    if (!slot) {
      throw new NotFoundException('Slot not found.');
    }

    if (slot.mentorSlotManagementId !== mentorProfile.id) {
      throw new ForbiddenException('You do not own this slot.');
    }

    this.enforceMinimumNotice(slot.slotStartDateTime);

    return db
      .delete(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId));
  }

  async acceptReschedule(bookingId: number) {
    return db.transaction(async (trx) => {
      const [booking] = await trx
        .select()
        .from(zuvyMentorSlotBooking)
        .where(eq(zuvyMentorSlotBooking.id, bookingId))
        .limit(1);

      if (!booking) {
        throw new NotFoundException('Booking not found.');
      }

      if (booking.rescheduleStatus !== 'pending') {
        throw new BadRequestException('No pending reschedule.');
      }

      if (!booking.rescheduleProposedSlotId) {
        throw new BadRequestException('Invalid proposed slot.');
      }

      /* Atomic capacity check + increment */

      const updated = await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} + 1`,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(
          and(
            eq(zuvyMentorSlotAvailability.id, booking.rescheduleProposedSlotId),
            sql`${zuvyMentorSlotAvailability.currentBookedCount} < ${zuvyMentorSlotAvailability.maxCapacity}`,
          ),
        )
        .returning();

      if (updated.length === 0) {
        throw new BadRequestException('Proposed slot is full.');
      }

      /* Release old slot */

      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} - 1`,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId));

      /* Move booking */

      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          slotAvailabilityId: booking.rescheduleProposedSlotId,
          rescheduleStatus: null,
          rescheduleRequestedAt: null,
          rescheduleProposedSlotId: null,
          sessionLifecycleState: 'SCHEDULED',
          updatedAt: new Date(),
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(eq(zuvyMentorSlotBooking.id, bookingId));

      await this.notificationService.createNotification({
        userId: booking.studentUserId,
        type: NotificationType.RESCHEDULE_ACCEPTED,
        title: 'Reschedule accepted',
        message: 'Your session reschedule request was accepted.',
        referenceId: bookingId,
        referenceType: 'booking',
      });

      /* Update Google meeting time */

      if (booking.googleEventId) {
        const [newSlot] = await trx
          .select()
          .from(zuvyMentorSlotAvailability)
          .where(
            eq(zuvyMentorSlotAvailability.id, booking.rescheduleProposedSlotId),
          )
          .limit(1);

        const [mentorProfile] = await trx
          .select()
          .from(zuvyMentorSlotManagement)
          .where(
            eq(zuvyMentorSlotManagement.mentorUserId, booking.mentorUserId),
          )
          .limit(1);

        const refreshToken = mentorProfile?.googleRefreshToken;

        if (booking.googleEventId && refreshToken) {
          await this.googleCalendarService.updateMeeting(
            booking.googleEventId,
            newSlot.slotStartDateTime,
            newSlot.slotEndDateTime,
            refreshToken,
          );
        }
      }
      return { message: 'Reschedule accepted successfully.' };
    });
  }

  async declineReschedule(bookingId: number) {
    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException('Booking not found.');

    if (booking.rescheduleStatus !== 'pending')
      throw new BadRequestException('No pending reschedule.');

    await db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: null,
        rescheduleRequestedAt: null,
        rescheduleProposedSlotId: null,
        sessionLifecycleState: 'SCHEDULED',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));

    await this.notificationService.createNotification({
      userId: booking.studentUserId,
      type: NotificationType.RESCHEDULE_DECLINED,
      title: 'Reschedule declined',
      message: 'Your session reschedule request was declined.',
      referenceId: bookingId,
      referenceType: 'booking',
    });

    return { message: 'Reschedule declined.' };
  }

  async createSlot(userId: number, dto: any) {
    await this.ensureUserIsMentor(userId);
    await this.validateMentorProfileComplete(userId);
    await this.ensureMentorZoomVerified(userId);

    const mentorProfile = await this.getMentorProfile(userId);

    /* ================================
    GOOGLE CALENDAR CONNECTION CHECK
 ================================= */

    if (!mentorProfile.googleRefreshToken) {
      throw new BadRequestException(
        'Please connect your Google Calendar before creating sessions.',
      );
    }

    const start = new Date(dto.slotStartDateTime);
    const end = new Date(dto.slotEndDateTime);

    if (end <= start) {
      throw new BadRequestException('Invalid time range.');
    }

    if (start.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot create past slot.');
    }

    /* ================================
        GOOGLE CALENDAR CONFLICT CHECK
     ================================= */

    if (mentorProfile.googleRefreshToken) {
      const hasConflict =
        await this.googleCalendarService.checkCalendarConflict(
          start,
          end,
          mentorProfile.googleRefreshToken,
        );

      if (hasConflict) {
        throw new BadRequestException(
          'You already have a Google Calendar event during this time.',
        );
      }
    }

    /* ================================
       PLATFORM SLOT OVERLAP CHECK
    ================================= */

    const overlap = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          eq(
            zuvyMentorSlotAvailability.mentorSlotManagementId,
            mentorProfile.id,
          ),
          sql`${start} < ${zuvyMentorSlotAvailability.slotEndDateTime}`,
          sql`${end} > ${zuvyMentorSlotAvailability.slotStartDateTime}`,
        ),
      );

    if (overlap.length > 0) {
      throw new BadRequestException('Slot overlaps existing slot.');
    }

    return db
      .insert(zuvyMentorSlotAvailability)
      .values({
        mentorSlotManagementId: mentorProfile.id,
        slotStartDateTime: start,
        slotEndDateTime: end,
        durationMinutes: dto.durationMinutes,
      } as typeof zuvyMentorSlotAvailability.$inferInsert)
      .returning();
  }

  async getMySlots(
    userId: number,
    weekOffset = 0,
    sort: 'asc' | 'desc' = 'desc',
  ) {
    await this.ensureUserIsMentor(userId);

    const mentorProfile = await this.getMentorProfile(userId);

    if (!mentorProfile) {
      throw new NotFoundException('Mentor profile not found.');
    }

    const now = new Date();

    /* ============================
       WEEK RANGE (MONDAY → SUNDAY)
    ============================ */

    const today = new Date();
    const day = today.getDay();

    const diffToMonday = day === 0 ? -6 : 1 - day;

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday + weekOffset * 7);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    /* ============================
       FETCH SLOTS
    ============================ */

    const slots = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          eq(
            zuvyMentorSlotAvailability.mentorSlotManagementId,
            mentorProfile.id,
          ),
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} >= ${startOfWeek}`,
          sql`${zuvyMentorSlotAvailability.slotStartDateTime} < ${endOfWeek}`,
        ),
      )
      .orderBy(
        sort === 'asc'
          ? zuvyMentorSlotAvailability.slotStartDateTime
          : desc(zuvyMentorSlotAvailability.slotStartDateTime),
      );

    /* ============================
       PROCESS STATUS + METRICS
    ============================ */

    let available = 0;
    let full = 0;
    let completed = 0;
    let closed = 0;
    let totalMinutes = 0;

    const processedSlots = slots.map((slot) => {
      const slotStart = new Date(slot.slotStartDateTime);

      let status: 'available' | 'full' | 'completed' | 'closed';

      if (slotStart < now) {
        if (slot.currentBookedCount > 0) {
          status = 'completed';
          completed++;
        } else {
          status = 'closed';
          closed++;
        }
      } else {
        if (slot.currentBookedCount >= slot.maxCapacity) {
          status = 'full';
          full++;
        } else {
          status = 'available';
          available++;
        }
      }

      totalMinutes += slot.durationMinutes;

      return {
        ...slot,
        status,
      };
    });

    /* ============================
       METRICS
    ============================ */

    const metrics = {
      totalSlots: slots.length,
      available,
      full,
      completed,
      closed,
      hours: Number((totalMinutes / 60).toFixed(2)),
    };

    return {
      weekStart: startOfWeek,
      weekEnd: endOfWeek,
      metrics,
      slots: processedSlots,
    };
  }

  async getSlotDetails(userId: number, slotId: number) {
    await this.ensureUserIsMentor(userId);

    const mentorProfile = await this.getMentorProfile(userId);

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId))
      .limit(1);

    if (!slot) throw new NotFoundException('Slot not found.');

    if (slot.mentorSlotManagementId !== mentorProfile.id) {
      throw new ForbiddenException('You do not own this slot');
    }

    const bookings = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.slotAvailabilityId, slotId));

    return {
      slot,
      bookings,
    };
  }

  async getBookingRecordings(userId: number, bookingId: number) {
    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    const userIdBigInt = BigInt(userId);

    if (
      booking.mentorUserId !== userIdBigInt &&
      booking.studentUserId !== userIdBigInt
    ) {
      throw new ForbiddenException(
        'You do not have permission to view recordings for this booking.',
      );
    }

    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId))
      .limit(1);

    const recordings = await db
      .select()
      .from(zuvyMentorSessionRecordings)
      .where(eq(zuvyMentorSessionRecordings.mentorBookingId, bookingId))
      .orderBy(desc(zuvyMentorSessionRecordings.createdAt));

    return {
      booking,
      slot,
      recordings: recordings.map((recording) => ({
        ...recording,
        youtubeVideoId: recording.driveFileId,
        youtubeUrl: recording.driveLink,
      })),
    };
  }

  async getStudentBookings(userId: number) {
    const userIdBigInt = BigInt(userId);

    return db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, userIdBigInt));
  }

  async getStudentMetrics(userId: number) {
    const userIdBigInt = BigInt(userId);
    let [metrics] = await db
      .select()
      .from(zuvyStudentBookingMetrics)
      .where(eq(zuvyStudentBookingMetrics.userId, userIdBigInt))
      .limit(1);

    if (!metrics) {
      await this.initializeStudentMetrics(userIdBigInt);
      [metrics] = await db
        .select()
        .from(zuvyStudentBookingMetrics)
        .where(eq(zuvyStudentBookingMetrics.userId, userIdBigInt))
        .limit(1);
    }

    const remainingCredits = Math.max(0, 3 - (metrics?.quotaUsed ?? 0));
    const now = new Date();
    const canBook =
      !metrics?.isQuotaExhausted &&
      (!metrics?.cooldownEndDate || now >= metrics.cooldownEndDate);

    return {
      ...metrics,
      remainingCredits,
      canBook,
      nextEligible: metrics?.cooldownEndDate || null,
    };
  }

  async markAttendance(
    bookingId: number,
    joinedAtStr: string,
    leftAtStr: string,
  ) {
    const joinedAt = new Date(joinedAtStr);
    const leftAt = new Date(leftAtStr);

    if (leftAt <= joinedAt) {
      throw new BadRequestException('Invalid attendance range.');
    }

    const duration = Math.floor(
      (leftAt.getTime() - joinedAt.getTime()) / (1000 * 60),
    );

    return db
      .update(zuvyMentorSlotBooking)
      .set({
        joinedAt,
        leftAt,
        durationAttended: duration,
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
  }

  async completeSession(bookingId: number) {
    return db
      .update(zuvyMentorSlotBooking)
      .set({
        completedAt: new Date(),
        sessionLifecycleState: 'COMPLETED',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
  }

  async updateMentorProfile(userId: number, dto: any) {
    await this.ensureUserIsMentor(userId);

    const userIdBigInt = BigInt(userId);
    const updatePayload: Partial<typeof zuvyMentorSlotManagement.$inferSelect> =
      {};

    if (dto.bio !== undefined) updatePayload.bio = dto.bio;
    if (dto.expertise !== undefined) updatePayload.expertise = dto.expertise;
    if (dto.title !== undefined) updatePayload.title = dto.title;
    if (dto.pastExperiences !== undefined)
      updatePayload.pastExperiences = dto.pastExperiences;

    if (dto.bootcampId !== undefined) {
      const [bootcamp] = await db
        .select()
        .from(zuvyBootcamps)
        .where(eq(zuvyBootcamps.id, dto.bootcampId))
        .limit(1);

      if (!bootcamp) {
        throw new BadRequestException('Invalid bootcampId');
      }

      updatePayload.bootcampId = dto.bootcampId;
    }

    // prevent empty update
    if (Object.keys(updatePayload).length === 0) {
      throw new BadRequestException('No fields provided for update');
    }

    await db
      .update(zuvyMentorSlotManagement)
      .set({
        ...updatePayload,
        updatedAt: new Date(),
      } as Partial<typeof zuvyMentorSlotManagement.$inferInsert>)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, userIdBigInt));
    return { message: ' Mentor profile updated successfully' };
  }

  async getMyMentorProfile(userId: number) {
    await this.ensureUserIsMentor(userId);

    const userIdBigInt = BigInt(userId);

    const [profile] = await db
      .select({
        mentorProfileId: zuvyMentorSlotManagement.id,
        mentorUserId: zuvyMentorSlotManagement.mentorUserId,
        organizationId: zuvyMentorSlotManagement.organizationId,

        mentorType: zuvyMentorSlotManagement.mentorType,
        timezone: zuvyMentorSlotManagement.timezone,

        title: zuvyMentorSlotManagement.title,
        bio: zuvyMentorSlotManagement.bio,
        expertise: zuvyMentorSlotManagement.expertise,
        pastExperiences: zuvyMentorSlotManagement.pastExperiences,

        status: zuvyMentorSlotManagement.status,
        isVerified: zuvyMentorSlotManagement.isVerified,
        acceptsNewMentees: zuvyMentorSlotManagement.acceptsNewMentees,

        createdAt: zuvyMentorSlotManagement.createdAt,
        updatedAt: zuvyMentorSlotManagement.updatedAt,
      })
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, userIdBigInt))
      .limit(1);

    if (!profile) {
      throw new NotFoundException('Mentor profile not found');
    }

    return profile;
  }

  private async enqueueMentorRecordingJob(booking: {
    id: number;
    zoomMeetingId: string | null;
    zoomMeetingUuid?: string | null;
    isZoomMeet: boolean;
  }) {
    if (!booking.isZoomMeet || !booking.zoomMeetingId) return;

    try {
      const recordingData = {
        mentorBookingId: booking.id,
        zoomMeetingId: booking.zoomMeetingId,
        zoomMeetingUuid: booking.zoomMeetingUuid ?? null,
        status: 'DISCOVERED',
      } as const;

      await db
        .insert(zuvyMentorSessionRecordings)
        .values(recordingData)
        .onConflictDoNothing();

      console.log(
        `Recording job enqueued for mentor booking ${booking.id}, meetingId: ${booking.zoomMeetingId}`,
      );
    } catch (error) {
      console.error(
        `Failed to enqueue recording job for mentor booking ${booking.id}: ${error.message}`,
      );
    }
  }
}
