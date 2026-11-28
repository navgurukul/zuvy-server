import { Injectable } from '@nestjs/common';
import { and, eq, ne, notExists, sql } from 'drizzle-orm';
import { db } from '../../../db';
import {
  zuvyMentorSessionAttendance,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
  zuvyStudentBookingMetrics,
} from '../../../../drizzle/schema';
import { MentorshipConfig } from './mentorship-config.service';
import {
  CreditState,
  CreditUsage,
  computeCreditState,
} from './mentorship-rules';

/**
 * A student's credits and gap, worked out from their bookings every time:
 *
 * - A booking uses a credit when it isn't cancelled, its credit wasn't
 *   refunded after a no-show (MentorAttendanceJob), and it was made on or
 *   after `credits_counted_from`. Credits are per student, across courses.
 * - The gap runs from the start of the latest such session, so cancelling
 *   it, a refund or a reschedule moves the gap with no extra code.
 *
 * zuvy_student_booking_metrics is only a cache of this (written by
 * MentorSlotService.recomputeStudentBookingMetrics) and the per-student lock.
 */
@Injectable()
export class CreditService {
  /**
   * Takes the student's credit lock until the transaction ends (creating the
   * student's metrics row if there is none). Every booking, cancel and
   * recount for one student takes it, so they run one after the other: two
   * bookings sent at the same moment can't both see a free credit.
   *
   * Lock order: take it after the slot row and the licence-pool lock, never
   * before them (cancelBooking takes the booking, then the slot, then the
   * pool, then this).
   */
  async lockStudent(trx: any, studentUserId: bigint, countedFrom: Date) {
    await trx
      .insert(zuvyStudentBookingMetrics)
      .values({
        userId: studentUserId,
        quotaResetDate: countedFrom,
      } as typeof zuvyStudentBookingMetrics.$inferInsert)
      .onConflictDoNothing({ target: zuvyStudentBookingMetrics.userId });
    await trx
      .select({ id: zuvyStudentBookingMetrics.id })
      .from(zuvyStudentBookingMetrics)
      .where(eq(zuvyStudentBookingMetrics.userId, studentUserId))
      .for('update');
  }

  /** How many credits the student has used, and their latest session. */
  async loadUsage(
    executor: any,
    studentUserId: bigint,
    config: MentorshipConfig,
    // Leave this booking out: "what would the credits be after cancelling it?"
    excludeBookingId?: number,
  ): Promise<CreditUsage> {
    const [row] = await executor
      .select({
        used: sql<number>`count(*)::int`,
        latestMs: sql<
          string | null
        >`(extract(epoch from max(${zuvyMentorSlotAvailability.slotStartDateTime})) * 1000)::bigint`,
      })
      .from(zuvyMentorSlotBooking)
      .innerJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .where(
        and(
          eq(zuvyMentorSlotBooking.studentUserId, studentUserId),
          ne(zuvyMentorSlotBooking.status, 'cancelled'),
          excludeBookingId !== undefined
            ? ne(zuvyMentorSlotBooking.id, excludeBookingId)
            : undefined,
          // When the booking was made (confirmedAt; older rows may only have
          // the other two).
          sql`coalesce(${zuvyMentorSlotBooking.confirmedAt}, ${zuvyMentorSlotBooking.bookedAt}, ${zuvyMentorSlotBooking.createdAt}) >= ${config.creditsCountedFrom.toISOString()}::timestamptz`,
          notExists(
            executor
              .select({ id: zuvyMentorSessionAttendance.id })
              .from(zuvyMentorSessionAttendance)
              .where(
                and(
                  eq(
                    zuvyMentorSessionAttendance.mentorBookingId,
                    zuvyMentorSlotBooking.id,
                  ),
                  eq(zuvyMentorSessionAttendance.creditRefunded, true),
                ),
              ),
          ),
        ),
      );

    return {
      creditsUsed: Number(row?.used ?? 0),
      latestSessionStart:
        row?.latestMs != null ? new Date(Number(row.latestMs)) : null,
    };
  }

  /** The student's credit position now (read only; takes no lock). */
  async getState(
    studentUserId: bigint,
    config: MentorshipConfig,
    executor: any = db,
    now = new Date(),
  ): Promise<CreditState> {
    const usage = await this.loadUsage(executor, studentUserId, config);
    return computeCreditState(usage, config, now);
  }
}
