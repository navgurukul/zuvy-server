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

import { and, eq, lt, sql } from 'drizzle-orm';
import { CreateSlotDto } from './dto/create-slot.dto';

@Injectable()
export class MentorSlotService {
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
    return db.transaction(async (trx) => {
      const result = await trx.execute(
        sql`
    SELECT *
    FROM zuvy_mentor_slot_availability
    WHERE id = ${slotId}
    FOR UPDATE
  `,
      );

      const slot = result
        .rows[0] as typeof zuvyMentorSlotAvailability.$inferSelect;

      if (!slot) throw new NotFoundException('Slot not found.');

      if (slot.status !== 'available')
        throw new BadRequestException('Slot not available.');

      this.enforceMinimumNotice(slot.slotStartDateTime);

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

      return booking[0];
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
    if (!reason || reason.length < 10)
      throw new BadRequestException(
        'Reschedule reason must be at least 10 characters.',
      );

    return db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: 'pending',
        rescheduleRequestedAt: new Date(),
        rescheduleProposedSlotId: newSlotId,
        sessionLifecycleState: 'RESCHEDULE_PENDING',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
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

    return { message: 'Reschedule declined.' };
  }

  async createSlot(userId: number, dto: any) {
    await this.ensureUserIsMentor(userId);

    const mentorProfile = await this.getMentorProfile(userId);

    const start = new Date(dto.slotStartDateTime);
    const end = new Date(dto.slotEndDateTime);

    if (end <= start) {
      throw new BadRequestException('Invalid time range.');
    }

    if (start.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot create past slot.');
    }

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

  async getMySlots(userId: number) {
    const mentorProfile = await this.getMentorProfile(userId);

    if (!mentorProfile) {
      throw new NotFoundException('Mentor profile not found.');
    }

    return db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(
        eq(zuvyMentorSlotAvailability.mentorSlotManagementId, mentorProfile.id),
      );
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

    return db
      .update(zuvyMentorSlotManagement)
      .set(updatePayload)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, userIdBigInt));
  }
}
