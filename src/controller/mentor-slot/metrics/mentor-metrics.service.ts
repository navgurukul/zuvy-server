import { Injectable } from '@nestjs/common';
import { db } from '../../../db';
import {
  zuvyMentorSlotBooking,
  zuvyMentorSlotAvailability,
} from '../../../../drizzle/schema';
import { and, eq, ne, sql, gt, gte, lte, inArray } from 'drizzle-orm';

// The Sessions "Upcoming" tab's states (session.service getMentorSessions).
const MENTOR_UPCOMING_STATES = ['SCHEDULED', 'IN_PROGRESS'];

@Injectable()
export class MentorMetricsService {
  private mentorScopeConditions(mentorUserId: bigint, organizationId?: number) {
    const conditions = [eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId)];
    if (organizationId !== undefined) {
      conditions.push(eq(zuvyMentorSlotBooking.organizationId, organizationId));
    }
    return conditions;
  }

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

    const sessionConditions: any[] = this.mentorScopeConditions(
      mentorUserId,
      organizationId,
    );

    if (fromDate) {
      // Sessions starting in the period (fromDate to the end of today).
      // A subquery, so an empty period still returns the full response
      // shape (it used to return a different one) and the period's slot ids
      // stay in the database instead of being loaded here.
      sessionConditions.push(
        inArray(
          zuvyMentorSlotBooking.slotAvailabilityId,
          db
            .select({ id: zuvyMentorSlotAvailability.id })
            .from(zuvyMentorSlotAvailability)
            .where(
              and(
                gte(zuvyMentorSlotAvailability.slotStartDateTime, fromDate),
                lte(zuvyMentorSlotAvailability.slotStartDateTime, endOfToday),
              ),
            ),
        ),
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

    // Deliberately NOT reusing sessionConditions here: its optional last
    // entry (inArray on filteredSlotIds, pushed above when fromDate is set)
    // scopes to the PAST 30d/3m window for the completed/cancelled/missed
    // counts, and "upcoming" is in the future. Only the mentor/org scoping
    // applies (see MDA-12).
    //
    // Upcoming is what the Sessions "Upcoming" tab lists: not cancelled,
    // scheduled or live (IN_PROGRESS), and not over yet. A live session
    // started before now, so it is matched on its end, not its start.
    const upcomingConditions: any[] = [
      ...this.mentorScopeConditions(mentorUserId, organizationId),
      ne(zuvyMentorSlotBooking.status, 'cancelled'),
      inArray(
        zuvyMentorSlotBooking.sessionLifecycleState,
        MENTOR_UPCOMING_STATES,
      ),
      gt(zuvyMentorSlotAvailability.slotEndDateTime, now),
    ];
    if (filter !== 'all') {
      // Unchanged: with a 30d/3m period, only sessions starting by the end
      // of today count.
      upcomingConditions.push(
        lte(zuvyMentorSlotAvailability.slotStartDateTime, endOfToday),
      );
    }

    const [upcoming] = await db
      .select({
        upcomingCount: sql<number>`COUNT(*)`,
      })
      .from(zuvyMentorSlotBooking)
      .innerJoin(
        zuvyMentorSlotAvailability,
        eq(
          zuvyMentorSlotAvailability.id,
          zuvyMentorSlotBooking.slotAvailabilityId,
        ),
      )
      .where(and(...upcomingConditions));

    const upcomingCount = Number(upcoming?.upcomingCount || 0);

    /* ==========================================================
       SLOT UTILIZATION
    ========================================================== */

    // A removed slot (kept only for its cancelled bookings) isn't offered
    // time, so it doesn't count towards the mentor's slots.
    const utilizationConditions: any[] = [
      ne(zuvyMentorSlotAvailability.status, 'removed'),
    ];

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
