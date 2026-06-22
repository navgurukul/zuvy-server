import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from 'src/db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
  zuvyStudentBookingMetrics,
} from '../../../../drizzle/schema';

import { and, eq, lt, gte } from 'drizzle-orm';

@Injectable()
export class MentorSlotJob {
  /* ==========================================================================
       RUN EVERY MINUTE — HANDLE SESSION STATE TRANSITIONS
    ========================================================================== */

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSessionTransitions() {
    const now = new Date();

    const bookings = await db
      .select({
        bookingId: zuvyMentorSlotBooking.id,
        lifecycle: zuvyMentorSlotBooking.sessionLifecycleState,
        joinedAt: zuvyMentorSlotBooking.joinedAt,
        slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
        slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
      })
      .from(zuvyMentorSlotBooking)
      .innerJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotBooking.slotAvailabilityId,
          zuvyMentorSlotAvailability.id,
        ),
      );

    for (const b of bookings) {
      const start = new Date(b.slotStart);
      const end = new Date(b.slotEnd);

      // SCHEDULED → IN_PROGRESS
      if (b.lifecycle === 'SCHEDULED' && now >= start && now < end) {
        await db
          .update(zuvyMentorSlotBooking)
          .set({
            sessionLifecycleState: 'IN_PROGRESS',
          } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
          .where(eq(zuvyMentorSlotBooking.id, b.bookingId));
      }

      // IN_PROGRESS → COMPLETED
      if (b.lifecycle === 'IN_PROGRESS' && now >= end) {
        await db
          .update(zuvyMentorSlotBooking)
          .set({
            sessionLifecycleState: 'COMPLETED',
            completedAt: now,
          } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
          .where(eq(zuvyMentorSlotBooking.id, b.bookingId));
      }

      // SCHEDULED → MISSED
      if (b.lifecycle === 'SCHEDULED' && now >= end && !b.joinedAt) {
        await db
          .update(zuvyMentorSlotBooking)
          .set({
            sessionLifecycleState: 'MISSED',
          } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
          .where(eq(zuvyMentorSlotBooking.id, b.bookingId));
      }
    }
  }

  /* ==========================================================================
       RUN EVERY 10 MINUTES — LOCK EXPIRED FEEDBACK
    ========================================================================== */

  @Cron(CronExpression.EVERY_10_MINUTES)
  async lockExpiredFeedback() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    await db
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
       RUN EVERY 5 MINUTES — EXPIRE RESCHEDULE REQUESTS (24H WINDOW)
    ========================================================================== */

  @Cron(CronExpression.EVERY_5_MINUTES)
  async expireRescheduleRequests() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    await db
      .update(zuvyMentorSlotBooking)
      .set({
        rescheduleStatus: 'declined',
        sessionLifecycleState: 'SCHEDULED',
      } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
      .where(
        and(
          eq(zuvyMentorSlotBooking.rescheduleStatus, 'pending'),
          lt(zuvyMentorSlotBooking.rescheduleRequestedAt, cutoff),
        ),
      );
  }

  /* ==========================================================================
       RUN DAILY AT MIDNIGHT — RESET STUDENT QUOTAS
    ========================================================================== */

  @Cron('0 0 * * *') // Daily at midnight
  async resetStudentQuotas() {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const nextQuotaStart = new Date(Date.UTC(currentYear, 3, 15)); // April 15

    // Only reset if today is April 15
    if (now.getUTCMonth() === 3 && now.getUTCDate() === 15) {
      const nextQuotaReset = new Date(Date.UTC(currentYear + 1, 3, 15));

      await db
        .update(zuvyStudentBookingMetrics)
        .set({
          quotaUsed: 0,
          isQuotaExhausted: false,
          quotaResetDate: nextQuotaReset,
        } as Partial<typeof zuvyStudentBookingMetrics.$inferInsert>)
        .where(lt(zuvyStudentBookingMetrics.quotaResetDate, now));

      console.log('Student booking quotas reset for the new year');
    }
  }
}
