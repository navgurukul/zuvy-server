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
} from '../../../drizzle/schema';

import { and, eq, lt, sql, desc } from 'drizzle-orm';
import { CreateSlotDto } from './dto/create-slot.dto';
import { GoogleCalendarService } from 'src/integrations/google/google-calendar.service';
import { NotificationService } from '../notification/notification.service';
import { NotificationType } from '../notification/notification.types';

@Injectable()
export class MentorSlotService {
  constructor(
    private readonly googleCalendarService: GoogleCalendarService,
    private readonly notificationService: NotificationService,
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
      .where(eq(zuvyUserRolesAssigned.userId, userIdBigInt))
      .limit(1);

    if (!role) {
      throw new ForbiddenException('User is not allowed to act as mentor');
    }
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
        'Complete your mentor profile (bio, skills, experiences) before creating slots.',
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

  /* ==========================================================================
     VALIDATE LEARNER QUOTA + COOLDOWN
  ========================================================================== */

  private async validateLearnerBookingEligibility(studentUserId: bigint) {
    const { quotaStart, quotaEnd } = this.getQuotaWindow();

    /* ===============================
       ANNUAL QUOTA CHECK
    =============================== */

    const [{ count }] = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(zuvyMentorSlotBooking)
      .where(
        and(
          eq(zuvyMentorSlotBooking.studentUserId, studentUserId),
          sql`${zuvyMentorSlotBooking.confirmedAt} >= ${quotaStart}`,
          sql`${zuvyMentorSlotBooking.confirmedAt} <= ${quotaEnd}`,
        ),
      );

    if (count >= 3) {
      const resetYear = quotaEnd.getUTCFullYear();

      throw new ForbiddenException(
        `You have used all 3 sessions for this year. Your quota resets on April 15, ${resetYear}.`,
      );
    }

    /* ===============================
       COOLDOWN CHECK (21 DAYS)
    =============================== */

    const [lastBooking] = await db
      .select({
        confirmedAt: zuvyMentorSlotBooking.confirmedAt,
      })
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, studentUserId))
      .orderBy(desc(zuvyMentorSlotBooking.confirmedAt))
      .limit(1);

    if (lastBooking?.confirmedAt) {
      const cooldownEnd = new Date(lastBooking.confirmedAt);
      cooldownEnd.setDate(cooldownEnd.getDate() + 21);

      if (new Date() < cooldownEnd) {
        throw new ForbiddenException(
          `You can book your next session from ${cooldownEnd.toDateString()}.`,
        );
      }
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

      // if (!refreshToken) {
      //   throw new BadRequestException(
      //     'Mentor has not connected Google Calendar',
      //   );
      // }

      let meeting: { meetLink?: string; eventId?: string } = {};

      if (refreshToken) {
        /* Check mentor Google Calendar conflicts */

        const hasConflict =
          await this.googleCalendarService.checkCalendarConflict(
            slot.slotStartDateTime,
            slot.slotEndDateTime,
            refreshToken,
          );

        if (hasConflict) {
          throw new BadRequestException(
            'Mentor already has a meeting scheduled during this time.',
          );
        }

        /* Create Google Meet */
        try {
          meeting = await this.googleCalendarService.createMeeting(
            slot.slotStartDateTime,
            slot.slotEndDateTime,
            mentorEmail,
            studentEmail,
            refreshToken,
          );
        } catch (error) {
          console.error(
            'Google Meet creation failed:',
            error.response?.data || error.message,
          );

          throw new BadRequestException(
            'Failed to create Google Meet. Please reconnect Google account.',
          );
        }
      }
      /* Save meeting info */

      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          meetingLink: meeting?.meetLink ?? null,
          googleEventId: meeting?.eventId ?? null,
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(eq(zuvyMentorSlotBooking.id, createdBooking.id));

      return {
        ...createdBooking,
        meetingLink: meeting.meetLink,
      };
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

  async getStudentBookings(userId: number) {
    const userIdBigInt = BigInt(userId);

    return db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, userIdBigInt));
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
    const userIdBigInt = BigInt(userId);
    const updatePayload: Partial<typeof zuvyMentorSlotManagement.$inferSelect> =
      {};

    if (dto.bio !== undefined) updatePayload.bio = dto.bio;
    if (dto.expertise !== undefined) updatePayload.expertise = dto.expertise;
    if (dto.title !== undefined) updatePayload.title = dto.title;
    if (dto.pastExperiences !== undefined)
      updatePayload.pastExperiences = dto.pastExperiences;

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
}
