import { Injectable } from '@nestjs/common';
import { db } from '../../../db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
} from '../../../../drizzle/schema';
import { and, eq, sql, gte } from 'drizzle-orm';

@Injectable()
export class MentorMetricsService {
  private getDateFilter(filter: '30days' | '3months' | 'all') {
    const now = new Date();

    switch (filter) {
      case '30days':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      case '3months':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

      default:
        return null;
    }
  }

  async getMentorMetrics(
    mentorUserId: bigint,
    organizationId?: number,
    filter: '30days' | '3months' | 'all' = 'all',
  ) {
    const bookingConditions = [
      eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
    ];

    if (organizationId !== undefined) {
      bookingConditions.push(
        eq(zuvyMentorSlotBooking.organizationId, organizationId),
      );
    }

    const since = this.getDateFilter(filter);
    if (since) {
      bookingConditions.push(gte(zuvyMentorSlotBooking.confirmedAt, since));
    }

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
      .where(and(...bookingConditions));

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
      .where(and(...bookingConditions));

    /* ==========================================================
       UPCOMING SESSIONS - Show ALL future sessions (no date filter)
    ========================================================== */

    const upcomingConditions = [
      eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
    ];

    if (organizationId !== undefined) {
      upcomingConditions.push(
        eq(zuvyMentorSlotBooking.organizationId, organizationId),
      );
    }

    upcomingConditions.push(
      eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
      sql`${zuvyMentorSlotBooking.slotAvailabilityId} IN (
        SELECT ${zuvyMentorSlotAvailability.id}
        FROM ${zuvyMentorSlotAvailability}
        WHERE ${zuvyMentorSlotAvailability.slotStartDateTime} > NOW()
      )`,
    );

    const [upcoming] = await db
      .select({
        upcomingCount: sql<number>`COUNT(*)`,
      })
      .from(zuvyMentorSlotBooking)
      .where(and(...upcomingConditions));

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
        organizationId !== undefined
          ? sql`${zuvyMentorSlotAvailability.mentorSlotManagementId} IN (
    SELECT id FROM zuvy_mentor_slot_management
    WHERE mentor_user_id = ${mentorUserId}
      AND organization_id = ${organizationId}
  )`
          : sql`${zuvyMentorSlotAvailability.mentorSlotManagementId} IN (
    SELECT id FROM zuvy_mentor_slot_management
    WHERE mentor_user_id = ${mentorUserId}
  )`,
      );

    const utilizationRate =
      slotUtilization.totalSlots > 0
        ? (slotUtilization.usedSlots / slotUtilization.totalSlots) * 100
        : 0;

    return {
      filter,
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
