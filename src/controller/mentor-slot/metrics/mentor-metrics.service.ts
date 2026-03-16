import { Injectable } from '@nestjs/common';
import { db } from '../../../db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
} from '../../../../drizzle/schema';
import { eq, sql } from 'drizzle-orm';

@Injectable()
export class MentorMetricsService {
  async getMentorMetrics(mentorUserId: bigint) {
    /* ==========================================================
       SESSION COUNTS
    ========================================================== */

    const [sessionCounts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'COMPLETED')`,
        cancelled: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'CANCELLED')`,
        missed: sql<number>`COUNT(*) FILTER (WHERE session_lifecycle_state = 'MISSED')`,
      })
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId));

    const total = sessionCounts.total || 0;
    const completed = sessionCounts.completed || 0;
    const cancelled = sessionCounts.cancelled || 0;
    const missed = sessionCounts.missed || 0;

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;

    /* ==========================================================
       AVERAGE RATING
    ========================================================== */

    const [ratingData] = await db
      .select({
        avgRating: sql<number>`AVG(mentor_rating)`,
        ratingCount: sql<number>`COUNT(mentor_rating)`,
      })
      .from(zuvyMentorSlotBooking)
      .where(eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId));

    /* ==========================================================
       UPCOMING SESSIONS
    ========================================================== */

    const [upcoming] = await db
      .select({
        upcomingCount: sql<number>`COUNT(*)`,
      })
      .from(zuvyMentorSlotBooking)
      .where(
        sql`mentor_user_id = ${mentorUserId}
            AND session_lifecycle_state = 'SCHEDULED'
            AND slot_availability_id IN (
              SELECT id FROM zuvy_mentor_slot_availability
              WHERE slot_start_date_time > NOW()
            )`,
      );

    /* ==========================================================
       SLOT UTILIZATION
    ========================================================== */

    const [slotUtilization] = await db
      .select({
        totalSlots: sql<number>`COUNT(*)`,
        usedSlots: sql<number>`COUNT(*) FILTER (WHERE current_booked_count > 0)`,
      })
      .from(zuvyMentorSlotAvailability)
      .where(
        sql`mentor_slot_management_id IN (
          SELECT id FROM zuvy_mentor_slot_management
          WHERE mentor_user_id = ${mentorUserId}
        )`,
      );

    const utilizationRate =
      slotUtilization.totalSlots > 0
        ? (slotUtilization.usedSlots / slotUtilization.totalSlots) * 100
        : 0;

    return {
      sessions: {
        total,
        completed,
        cancelled,
        missed,
        completionRate: completionRate.toFixed(2),
        cancellationRate: cancellationRate.toFixed(2),
      },
      ratings: {
        averageRating: Number(ratingData.avgRating || 0).toFixed(2),
        totalRatings: ratingData.ratingCount || 0,
      },
      upcomingSessions: upcoming.upcomingCount || 0,
      utilization: {
        totalSlots: slotUtilization.totalSlots || 0,
        usedSlots: slotUtilization.usedSlots || 0,
        utilizationRate: utilizationRate.toFixed(2),
      },
    };
  }
}
