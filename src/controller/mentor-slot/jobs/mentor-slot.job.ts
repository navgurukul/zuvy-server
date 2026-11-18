import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { db } from 'src/db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
  zuvyStudentBookingMetrics,
} from '../../../../drizzle/schema';

import { and, eq, lt, gte, ne, inArray, isNull } from 'drizzle-orm';

@Injectable()
export class MentorSlotJob {
  /* ==========================================================================
       RUN EVERY MINUTE — HANDLE SESSION STATE TRANSITIONS
    ========================================================================== */

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSessionTransitions() {
    const now = new Date();

    // Only SCHEDULED/IN_PROGRESS bookings can transition at all — every other
    // state (COMPLETED/CANCELLED/MISSED/RESCHEDULE_PENDING) is a dead end for
    // this job, so there's no reason to ever load them.
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
      )
      .where(
        inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
          'SCHEDULED',
          'IN_PROGRESS',
        ]),
      );

    // Each booking lands in at most one group (the branches below are
    // mutually exclusive), so one bulk UPDATE per target state replaces the
    // old one-UPDATE-per-row loop: O(3) queries instead of O(bookings).
    const toInProgress: number[] = [];
    const toCompleted: number[] = [];
    const toMissed: number[] = [];

    // Note on attendance: joinedAt is only written by the manual
    // markAttendance endpoint and is null on almost every booking, so it
    // can't decide COMPLETED vs MISSED here — requiring it would mark every
    // real session MISSED. This job closes an IN_PROGRESS session as
    // COMPLETED when its slot ends; MentorAttendanceJob then reads Zoom's
    // participant report and corrects it to MISSED if either side didn't
    // join. MISSED is set here only for a booking the cron never saw in
    // progress (still SCHEDULED when the slot ended) with no attendance.
    for (const b of bookings) {
      const start = new Date(b.slotStart);
      const end = new Date(b.slotEnd);

      if (b.lifecycle === 'SCHEDULED' && now >= start && now < end) {
        toInProgress.push(b.bookingId);
      } else if (b.lifecycle === 'IN_PROGRESS' && now >= end) {
        toCompleted.push(b.bookingId);
      } else if (b.lifecycle === 'SCHEDULED' && now >= end) {
        // Still SCHEDULED after the slot ended (the cron didn't tick during
        // the slot, e.g. a deploy or a slot shorter than a minute). If
        // attendance was recorded it happened; otherwise it's a no-show.
        // Before, a SCHEDULED booking with joinedAt set matched no branch
        // and stayed "upcoming" forever.
        if (b.joinedAt) toCompleted.push(b.bookingId);
        else toMissed.push(b.bookingId);
      }
    }

    // Each bulk UPDATE's WHERE re-checks the exact prior lifecycle state
    // (not just the id list) so a booking that changed state between the
    // SELECT above and this UPDATE running (e.g. it was cancelled in the
    // meantime) can never be stomped back into a transition it no longer
    // qualifies for.
    if (toInProgress.length > 0) {
      await db
        .update(zuvyMentorSlotBooking)
        .set({
          sessionLifecycleState: 'IN_PROGRESS',
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(
          and(
            inArray(zuvyMentorSlotBooking.id, toInProgress),
            eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
          ),
        );
    }

    if (toCompleted.length > 0) {
      await db
        .update(zuvyMentorSlotBooking)
        .set({
          sessionLifecycleState: 'COMPLETED',
          completedAt: now,
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(
          and(
            inArray(zuvyMentorSlotBooking.id, toCompleted),
            inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
              'SCHEDULED',
              'IN_PROGRESS',
            ]),
          ),
        );
    }

    // joined_at IS NULL is re-checked here too: attendance recorded between
    // the SELECT and this UPDATE means the session happened, so it must not
    // be stored as MISSED.
    if (toMissed.length > 0) {
      await db
        .update(zuvyMentorSlotBooking)
        .set({
          sessionLifecycleState: 'MISSED',
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(
          and(
            inArray(zuvyMentorSlotBooking.id, toMissed),
            eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
            isNull(zuvyMentorSlotBooking.joinedAt),
          ),
        );
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

    // Excluding cancelled bookings here is defense in depth: cancelBooking
    // already clears rescheduleStatus to null on cancel, so a cancelled
    // booking's row shouldn't match `rescheduleStatus = 'pending'` at all —
    // but re-checking status != 'cancelled' means this job can never revive
    // a cancelled booking even if that invariant is ever violated elsewhere.
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
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
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
