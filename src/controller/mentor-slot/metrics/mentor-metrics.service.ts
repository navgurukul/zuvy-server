import { Injectable } from '@nestjs/common';
import { db } from '../../../db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
} from '../../../../drizzle/schema';
import { and, eq, sql, gte, lte, inArray } from 'drizzle-orm';

@Injectable()
export class MentorMetricsService {
  async getMentorMetrics(
    mentorUserId: bigint,
    organizationId?: number,
    filter: 'all' | '30d' | '3m' = 'all',
  ) {
    const now = new Date();

    let fromDate: Date | null = null;

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    if (filter === '30d') {
      fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
    }

    if (filter === '3m') {
      fromDate = new Date();
      fromDate.setMonth(fromDate.getMonth() - 3);
    }

    /* ==========================================================
       SESSION FILTERING (ACTUAL SESSION DATE)
    ========================================================== */

    const sessionConditions: any[] = [
      eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
    ];

    if (organizationId !== undefined) {
      sessionConditions.push(
        eq(zuvyMentorSlotBooking.organizationId, organizationId),
      );
    }

    let filteredSlotIds: number[] = [];

    if (fromDate) {
      const upperBound = filter === 'all' ? null : endOfToday;

      const filteredSlots = await db
        .select({
          id: zuvyMentorSlotAvailability.id,
        })
        .from(zuvyMentorSlotAvailability)
        .where(
          upperBound
            ? and(
                gte(zuvyMentorSlotAvailability.slotStartDateTime, fromDate),
                lte(zuvyMentorSlotAvailability.slotStartDateTime, upperBound),
              )
            : gte(zuvyMentorSlotAvailability.slotStartDateTime, fromDate),
        );

      filteredSlotIds = filteredSlots.map((slot) => slot.id);

      if (filteredSlotIds.length === 0) {
        return {
          sessions: {
            total: 0,
            completed: 0,
            cancelled: 0,
            missed: 0,
            completionRate: '0.00',
            cancellationRate: '0.00',
          },
          ratings: {
            averageRating: '0.00',
            totalRatings: 0,
          },
          upcomingSessions: 0,
          utilization: {
            totalSlots: 0,
            usedSlots: 0,
            utilizationRate: '0.00',
          },
        };
      }

      sessionConditions.push(
        inArray(zuvyMentorSlotBooking.slotAvailabilityId, filteredSlotIds),
      );
    }

    /* ==========================================================
       SESSION COUNTS
    ========================================================== */

    const [sessionCounts] = await db
      .select({
        total: sql<number>`COUNT(*)`,
        completed: sql<number>`
          COUNT(*) FILTER (
            WHERE session_lifecycle_state = 'COMPLETED'
          )
        `,
        cancelled: sql<number>`
          COUNT(*) FILTER (
            WHERE session_lifecycle_state = 'CANCELLED'
          )
        `,
        missed: sql<number>`
          COUNT(*) FILTER (
            WHERE session_lifecycle_state = 'MISSED'
          )
        `,
      })
      .from(zuvyMentorSlotBooking)
      .where(and(...sessionConditions));

    const total = Number(sessionCounts.total || 0);
    const completed = Number(sessionCounts.completed || 0);
    const cancelled = Number(sessionCounts.cancelled || 0);
    const missed = Number(sessionCounts.missed || 0);

    const completionRate = total > 0 ? (completed / total) * 100 : 0;

    const cancellationRate = total > 0 ? (cancelled / total) * 100 : 0;

    /* ==========================================================
       RATINGS
    ========================================================== */

    const [ratingData] = await db
      .select({
        avgRating: sql<number>`AVG(mentor_rating)`,
        ratingCount: sql<number>`COUNT(mentor_rating)`,
      })
      .from(zuvyMentorSlotBooking)
      .where(and(...sessionConditions));

    /* ==========================================================
       UPCOMING SESSIONS
    ========================================================== */

    const upcomingSlots = await db
      .select({
        id: zuvyMentorSlotAvailability.id,
      })
      .from(zuvyMentorSlotAvailability)
      .where(
        filter === 'all'
          ? gte(zuvyMentorSlotAvailability.slotStartDateTime, now)
          : and(
              gte(zuvyMentorSlotAvailability.slotStartDateTime, now),
              lte(zuvyMentorSlotAvailability.slotStartDateTime, endOfToday),
            ),
      );

    const upcomingSlotIds = upcomingSlots.map((slot) => slot.id);

    let upcomingCount = 0;

    if (upcomingSlotIds.length > 0) {
      const [upcoming] = await db
        .select({
          upcomingCount: sql<number>`COUNT(*)`,
        })
        .from(zuvyMentorSlotBooking)
        .where(
          and(
            ...sessionConditions.filter(
              (c) => !(typeof c === 'object' && filteredSlotIds.length > 0),
            ),
            eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
            inArray(zuvyMentorSlotBooking.slotAvailabilityId, upcomingSlotIds),
          ),
        );

      upcomingCount = Number(upcoming?.upcomingCount || 0);
    }

    /* ==========================================================
       SLOT UTILIZATION
    ========================================================== */

    const utilizationConditions: any[] = [];

    if (fromDate) {
      utilizationConditions.push(
        gte(zuvyMentorSlotAvailability.slotStartDateTime, fromDate),
      );
    }

    const [slotUtilization] = await db
      .select({
        totalSlots: sql<number>`COUNT(*)`,
        usedSlots: sql<number>`
          COUNT(*) FILTER (
            WHERE current_booked_count > 0
          )
        `,
      })
      .from(zuvyMentorSlotAvailability)
      .where(
        and(
          ...utilizationConditions,
          organizationId !== undefined
            ? sql`${zuvyMentorSlotAvailability.mentorSlotManagementId} IN (
                SELECT id
                FROM zuvy_mentor_slot_management
                WHERE mentor_user_id = ${mentorUserId}
                  AND organization_id = ${organizationId}
              )`
            : sql`${zuvyMentorSlotAvailability.mentorSlotManagementId} IN (
                SELECT id
                FROM zuvy_mentor_slot_management
                WHERE mentor_user_id = ${mentorUserId}
              )`,
        ),
      );

    const totalSlots = Number(slotUtilization.totalSlots || 0);

    const usedSlots = Number(slotUtilization.usedSlots || 0);

    const utilizationRate = totalSlots > 0 ? (usedSlots / totalSlots) * 100 : 0;

    return {
      filter,
      sessions: {
        total,
        completed,
        cancelled,
        missed,
        upcoming: upcomingCount,
        completionRate: completionRate.toFixed(2),
        cancellationRate: cancellationRate.toFixed(2),
      },
      ratings: {
        averageRating: Number(ratingData.avgRating || 0).toFixed(2),
        totalRatings: Number(ratingData.ratingCount || 0),
      },
      utilization: {
        totalSlots,
        usedSlots,
        utilizationRate: utilizationRate.toFixed(2),
      },
    };
  }
}
