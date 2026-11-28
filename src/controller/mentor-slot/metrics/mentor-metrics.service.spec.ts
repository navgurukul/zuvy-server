// A chainable stand-in for db.select(): every query records its WHERE
// condition and joins, and resolves (when awaited) to the next canned result
// in call order. A query that is never awaited, like the period subquery
// passed to inArray, takes no result.
type FakeQuery = {
  condition?: unknown;
  joins: unknown[][];
  awaited: boolean;
};
const queries: FakeQuery[] = [];
const resultQueue: unknown[] = [];

jest.mock('../../../db', () => ({
  db: {
    select: () => {
      const record: FakeQuery = { joins: [], awaited: false };
      queries.push(record);
      const q: any = {
        from: () => q,
        innerJoin: (...args: unknown[]) => {
          record.joins.push(args);
          return q;
        },
        where: (condition: unknown) => {
          record.condition = condition;
          return q;
        },
        then: (resolve: any, reject: any) => {
          record.awaited = true;
          return Promise.resolve(resultQueue.shift()).then(resolve, reject);
        },
      };
      return q;
    },
  },
}));

import { and, eq, gt, inArray, lte, ne } from 'drizzle-orm';
import {
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
} from '../../../../drizzle/schema';
import { MentorMetricsService } from './mentor-metrics.service';

// Only Date is faked, so awaiting still works.
const NOW = new Date('2026-11-27T06:30:00.000Z');
beforeAll(() => {
  jest.useFakeTimers({
    now: NOW,
    doNotFake: [
      'nextTick',
      'queueMicrotask',
      'setImmediate',
      'clearImmediate',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'hrtime',
      'performance',
    ],
  });
});
afterAll(() => jest.useRealTimers());

const endOfToday = () => {
  const d = new Date(NOW);
  d.setHours(23, 59, 59, 999);
  return d;
};

/** The awaited queries in order: counts, ratings, upcoming, utilization. */
const awaited = () => queries.filter((q) => q.awaited);
const upcomingQuery = () => queries.find((q) => q.joins.length > 0);

const counts = (n = 0) => [{ total: n, completed: 0, cancelled: 0, missed: 0 }];
const ratings = [{ avgRating: null, ratingCount: 0 }];
const utilization = [{ totalSlots: 0, usedSlots: 0 }];

describe('MentorMetricsService.getMentorMetrics — upcoming count', () => {
  beforeEach(() => {
    queries.length = 0;
    resultQueue.length = 0;
  });

  it('counts scheduled and live sessions that are not over, scoped to the mentor and org (all time)', async () => {
    const mentorUserId = 41027n;
    const organizationId = 9;
    resultQueue.push(counts(2), ratings, [{ upcomingCount: 3 }], utilization);

    const result = await new MentorMetricsService().getMentorMetrics(
      mentorUserId,
      organizationId,
      'all',
    );

    expect(result.sessions.upcoming).toBe(3);
    expect(awaited()).toHaveLength(4);
    const upcoming = upcomingQuery();
    expect(upcoming?.joins).toHaveLength(1);
    expect(upcoming?.condition).toEqual(
      and(
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
        eq(zuvyMentorSlotBooking.organizationId, organizationId),
        ne(zuvyMentorSlotBooking.status, 'cancelled'),
        inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
          'SCHEDULED',
          'IN_PROGRESS',
        ]),
        // On the end, not the start: a live session started before now.
        gt(zuvyMentorSlotAvailability.slotEndDateTime, NOW),
      ),
    );
  });

  it('keeps mentor/org scoping and bounds upcoming to today when a period (30d) is set (MDA-12)', async () => {
    const mentorUserId = 41027n;
    const organizationId = 9;
    resultQueue.push(counts(2), ratings, [{ upcomingCount: 5 }], utilization);

    const result = await new MentorMetricsService().getMentorMetrics(
      mentorUserId,
      organizationId,
      '30d',
    );

    expect(result.sessions.upcoming).toBe(5);
    expect(upcomingQuery()?.condition).toEqual(
      and(
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
        eq(zuvyMentorSlotBooking.organizationId, organizationId),
        ne(zuvyMentorSlotBooking.status, 'cancelled'),
        inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
          'SCHEDULED',
          'IN_PROGRESS',
        ]),
        gt(zuvyMentorSlotAvailability.slotEndDateTime, NOW),
        lte(zuvyMentorSlotAvailability.slotStartDateTime, endOfToday()),
      ),
    );
  });

  it('keeps the same scoping when no organizationId is given', async () => {
    const mentorUserId = 41027n;
    resultQueue.push(counts(), ratings, [{ upcomingCount: 1 }], utilization);

    const result = await new MentorMetricsService().getMentorMetrics(
      mentorUserId,
      undefined,
      '3m',
    );

    expect(result.sessions.upcoming).toBe(1);
    expect(upcomingQuery()?.condition).toEqual(
      and(
        eq(zuvyMentorSlotBooking.mentorUserId, mentorUserId),
        ne(zuvyMentorSlotBooking.status, 'cancelled'),
        inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
          'SCHEDULED',
          'IN_PROGRESS',
        ]),
        gt(zuvyMentorSlotAvailability.slotEndDateTime, NOW),
        lte(zuvyMentorSlotAvailability.slotStartDateTime, endOfToday()),
      ),
    );
  });

  it('returns the full response shape for a period with no sessions (no early return)', async () => {
    resultQueue.push(counts(), ratings, [{ upcomingCount: 0 }], utilization);

    const result: any = await new MentorMetricsService().getMentorMetrics(
      41027n,
      9,
      '30d',
    );

    expect(result.filter).toBe('30d');
    expect(result.sessions).toEqual({
      total: 0,
      completed: 0,
      cancelled: 0,
      missed: 0,
      upcoming: 0,
      completionRate: '0.00',
      cancellationRate: '0.00',
    });
    expect(result.upcomingSessions).toBeUndefined();
    // The period's slots are a subquery: built, never loaded on their own.
    expect(queries.filter((q) => !q.awaited)).toHaveLength(1);
    expect(awaited()).toHaveLength(4);
  });
});
