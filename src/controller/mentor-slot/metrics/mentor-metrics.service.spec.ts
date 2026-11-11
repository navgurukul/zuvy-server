// Every db.select(...) call in this service follows the same uniform
// .select(cols).from(table).where(condition) shape (no joins), so one
// generic queue-based mock covers all of them: push a canned result per
// expected call, in call order, and capture each `where` argument so we can
// assert on the actual conditions a query ran with.
const whereCalls: unknown[] = [];
const resultQueue: unknown[] = [];

jest.mock('../../../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          whereCalls.push(condition);
          return Promise.resolve(resultQueue.shift());
        },
      }),
    }),
  },
}));

import { and, eq, inArray } from 'drizzle-orm';
import { zuvyMentorSlotBooking } from '../../../../drizzle/schema';
import { MentorMetricsService } from './mentor-metrics.service';

describe('MentorMetricsService.getMentorMetrics — upcoming count scoping', () => {
  beforeEach(() => {
    whereCalls.length = 0;
    resultQueue.length = 0;
  });

  it('keeps mentor/org scoping on the upcoming-count query when a date filter (30d/3m) is active', async () => {
    const mentorUserId = 41027n;
    const organizationId = 9;
    const upcomingSlotIds = [200, 201];

    // Query order for filter='30d' (fromDate set, filteredSlotIds non-empty):
    // 1. filteredSlots  2. sessionCounts  3. ratingData
    // 4. upcomingSlots  5. upcoming (the one this test is about)  6. slotUtilization
    resultQueue.push(
      [{ id: 100 }], // 1. filteredSlots — non-empty, so we don't hit the early-return path
      [{ total: 2, completed: 1, cancelled: 0, missed: 1 }], // 2. sessionCounts
      [{ avgRating: 4.5, ratingCount: 1 }], // 3. ratingData
      upcomingSlotIds.map((id) => ({ id })), // 4. upcomingSlots
      [{ upcomingCount: 5 }], // 5. upcoming
      [{ totalSlots: 10, usedSlots: 3 }], // 6. slotUtilization
    );

    const service = new MentorMetricsService();
    const result = await service.getMentorMetrics(
      mentorUserId,
      organizationId,
      '30d',
    );

    expect(result.sessions.upcoming).toBe(5);

    // The 5th select's WHERE (index 4) must still scope by this exact
    // mentor + org — before the fix, every condition here (including
    // mentorUserId/organizationId) was stripped whenever a date filter was
    // active, silently counting every mentor's/org's upcoming bookings.
    const upcomingWhere = whereCalls[4];
    expect(upcomingWhere).toEqual(
      and(
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
        eq(zuvyMentorSlotBooking.organizationId, organizationId),
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
        inArray(zuvyMentorSlotBooking.slotAvailabilityId, upcomingSlotIds),
      ),
    );
  });

  it('keeps the same scoping when no organizationId is given', async () => {
    const mentorUserId = 41027n;
    const upcomingSlotIds = [300];

    resultQueue.push(
      [{ id: 100 }],
      [{ total: 0, completed: 0, cancelled: 0, missed: 0 }],
      [{ avgRating: null, ratingCount: 0 }],
      upcomingSlotIds.map((id) => ({ id })),
      [{ upcomingCount: 1 }],
      [{ totalSlots: 0, usedSlots: 0 }],
    );

    const service = new MentorMetricsService();
    const result = await service.getMentorMetrics(
      mentorUserId,
      undefined,
      '3m',
    );

    expect(result.sessions.upcoming).toBe(1);

    const upcomingWhere = whereCalls[4];
    expect(upcomingWhere).toEqual(
      and(
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
        inArray(zuvyMentorSlotBooking.slotAvailabilityId, upcomingSlotIds),
      ),
    );
  });
});
