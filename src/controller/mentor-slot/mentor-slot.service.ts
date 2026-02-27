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
} from '../../../drizzle/schema';

import { and, eq, lt, sql } from 'drizzle-orm';
import { CreateSlotDto } from './dto/create-slot.dto';

@Injectable()
export class MentorSlotService {
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

    if (booking.status === 'cancelled') return 'CANCELLED';

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
      const [slot] = await trx
        .select()
        .from(zuvyMentorSlotAvailability)
        .where(eq(zuvyMentorSlotAvailability.id, slotId))
        .limit(1);

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

      if (slot.currentBookedCount >= slot.maxCapacity)
        throw new BadRequestException('Slot is full.');

      /* Lock row */
      await trx.execute(
        sql`SELECT id FROM zuvy_mentor_slot_availability WHERE id = ${slotId} FOR UPDATE`,
      );

      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} + 1`,
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

    const [booking] = await db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.id, bookingId))
      .limit(1);

    if (!booking) throw new NotFoundException('Booking not found.');

    return db
      .update(zuvyMentorSlotBooking)
      .set({
        status: 'cancelled',
        sessionLifecycleState: 'CANCELLED',
        cancellationReason: reason,
        cancelledBy,
        cancelledAt: new Date(),
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(eq(zuvyMentorSlotBooking.id, bookingId));
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

  async removeSlot(slotId: number) {
    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId))
      .limit(1);

    if (!slot) throw new NotFoundException('Slot not found.');

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

      if (!booking) throw new NotFoundException('Booking not found.');

      if (booking.rescheduleStatus !== 'pending')
        throw new BadRequestException('No pending reschedule.');

      if (!booking.rescheduleProposedSlotId)
        throw new BadRequestException('Invalid proposed slot.');

      const [newSlot] = await trx
        .select()
        .from(zuvyMentorSlotAvailability)
        .where(
          eq(zuvyMentorSlotAvailability.id, booking.rescheduleProposedSlotId),
        )
        .limit(1);

      if (!newSlot) throw new NotFoundException('Proposed slot not found.');

      if (newSlot.currentBookedCount >= newSlot.maxCapacity)
        throw new BadRequestException('Proposed slot is full.');

      /* Lock both slots */
      await trx.execute(
        sql`SELECT id FROM zuvy_mentor_slot_availability WHERE id IN (${booking.slotAvailabilityId}, ${booking.rescheduleProposedSlotId}) FOR UPDATE`,
      );

      /* Decrement old slot capacity */
      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} - 1`,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(eq(zuvyMentorSlotAvailability.id, booking.slotAvailabilityId));

      /* Increment new slot capacity */
      await trx
        .update(zuvyMentorSlotAvailability)
        .set({
          currentBookedCount: sql`${zuvyMentorSlotAvailability.currentBookedCount} + 1`,
        } as Partial<typeof zuvyMentorSlotAvailability.$inferInsert>)
        .where(
          eq(zuvyMentorSlotAvailability.id, booking.rescheduleProposedSlotId),
        );

      /* Update booking */
      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          slotAvailabilityId: booking.rescheduleProposedSlotId,
          rescheduleStatus: null,
          rescheduleRequestedAt: null,
          rescheduleProposedSlotId: null,
          sessionLifecycleState: 'SCHEDULED',
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

  async createSlot(userId: number, dto: CreateSlotDto) {
    const start = new Date(dto.slotStartDateTime);
    const end = new Date(dto.slotEndDateTime);

    if (end <= start) {
      throw new BadRequestException('Invalid time range.');
    }

    if (start.getTime() <= Date.now()) {
      throw new BadRequestException('Cannot create past slot.');
    }

    const durationMinutes = Math.floor(
      (end.getTime() - start.getTime()) / (1000 * 60),
    );

    if (durationMinutes <= 0) {
      throw new BadRequestException('Invalid duration.');
    }

    const [mentorProfile] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId)))
      .limit(1);

    if (!mentorProfile) {
      throw new NotFoundException('Mentor profile not found.');
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

    return db.insert(zuvyMentorSlotAvailability).values({
      mentorSlotManagementId: mentorProfile.id,
      slotStartDateTime: start,
      slotEndDateTime: end,
      durationMinutes,
      maxCapacity: dto.maxCapacity || 1,
      topic: dto.topic,
    } as typeof zuvyMentorSlotAvailability.$inferInsert);
  }

  async getMySlots(userId: number) {
    const [mentorProfile] = await db
      .select()
      .from(zuvyMentorSlotManagement)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId)))
      .limit(1);

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
    const [slot] = await db
      .select()
      .from(zuvyMentorSlotAvailability)
      .where(eq(zuvyMentorSlotAvailability.id, slotId))
      .limit(1);

    if (!slot) throw new NotFoundException('Slot not found.');

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
    return db
      .select()
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.studentUserId, BigInt(userId)));
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
    const updatePayload: Partial<typeof zuvyMentorSlotManagement.$inferSelect> =
      {};

    if (dto.bio !== undefined) updatePayload.bio = dto.bio;
    if (dto.expertise !== undefined) updatePayload.expertise = dto.expertise;
    if (dto.title !== undefined) updatePayload.title = dto.title;

    return db
      .update(zuvyMentorSlotManagement)
      .set(updatePayload)
      .where(eq(zuvyMentorSlotManagement.mentorUserId, BigInt(userId)));
  }
}
