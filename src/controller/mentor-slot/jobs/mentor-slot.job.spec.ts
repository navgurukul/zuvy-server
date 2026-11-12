// Keep this off the real database — build a minimal fake query builder that
// records what handleSessionTransitions actually asks for and sets.
const selectWhere = jest.fn();
const updateCalls: Array<{ set: unknown; whereArgs: unknown }> = [];

jest.mock('../../../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: (...args: unknown[]) => selectWhere(...args),
        }),
      }),
    }),
    update: () => ({
      set: (set: unknown) => ({
        where: (...whereArgs: unknown[]) => {
          updateCalls.push({ set, whereArgs });
          return Promise.resolve();
        },
      }),
    }),
  },
}));

import { and, eq, inArray, isNull } from 'drizzle-orm';
import { zuvyMentorSlotBooking } from '../../../../drizzle/schema';
import { MentorSlotJob } from './mentor-slot.job';

const NOW = new Date('2026-11-05T10:00:00.000Z');

describe('MentorSlotJob.handleSessionTransitions', () => {
  beforeEach(() => {
    selectWhere.mockReset();
    updateCalls.length = 0;
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('only queries SCHEDULED/IN_PROGRESS bookings', async () => {
    selectWhere.mockResolvedValue([]);
    const job = new MentorSlotJob();

    await job.handleSessionTransitions();

    expect(selectWhere).toHaveBeenCalledTimes(1);
  });

  it('groups each booking into exactly the right bulk transition', async () => {
    selectWhere.mockResolvedValue([
      // SCHEDULED, now within [start, end) -> IN_PROGRESS
      {
        bookingId: 1,
        lifecycle: 'SCHEDULED',
        joinedAt: null,
        slotStart: '2026-11-05T09:30:00.000Z',
        slotEnd: '2026-11-05T10:30:00.000Z',
      },
      // IN_PROGRESS, now past end -> COMPLETED
      {
        bookingId: 2,
        lifecycle: 'IN_PROGRESS',
        joinedAt: '2026-11-05T09:00:00.000Z',
        slotStart: '2026-11-05T09:00:00.000Z',
        slotEnd: '2026-11-05T09:30:00.000Z',
      },
      // SCHEDULED, now past end, never joined -> MISSED
      {
        bookingId: 3,
        lifecycle: 'SCHEDULED',
        joinedAt: null,
        slotStart: '2026-11-05T08:00:00.000Z',
        slotEnd: '2026-11-05T08:30:00.000Z',
      },
      // SCHEDULED, hasn't started yet -> untouched
      {
        bookingId: 4,
        lifecycle: 'SCHEDULED',
        joinedAt: null,
        slotStart: '2026-11-05T11:00:00.000Z',
        slotEnd: '2026-11-05T11:30:00.000Z',
      },
      // SCHEDULED, now past end, attendance recorded -> COMPLETED. The cron
      // never saw it IN_PROGRESS (e.g. it was down during the slot); before,
      // no branch matched and it stayed "upcoming" forever.
      {
        bookingId: 5,
        lifecycle: 'SCHEDULED',
        joinedAt: '2026-11-05T08:05:00.000Z',
        slotStart: '2026-11-05T08:00:00.000Z',
        slotEnd: '2026-11-05T08:30:00.000Z',
      },
    ]);

    const job = new MentorSlotJob();
    await job.handleSessionTransitions();

    // Exactly one bulk UPDATE per target state (not one per row). Compare
    // each call's WHERE against real drizzle expressions built from the
    // expected ids, so this checks both the batching and the grouping.
    expect(updateCalls).toHaveLength(3);

    const byState = (state: string) =>
      updateCalls.find(
        (c) =>
          (c.set as { sessionLifecycleState?: string })
            .sessionLifecycleState === state,
      );

    // Each UPDATE's WHERE now also re-checks the exact prior lifecycle
    // state (not just the id list), so a booking that changed state between
    // the SELECT and this UPDATE running can never be stomped over.
    expect(byState('IN_PROGRESS')?.whereArgs[0]).toEqual(
      and(
        inArray(zuvyMentorSlotBooking.id, [1]),
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
      ),
    );
    expect(byState('COMPLETED')?.whereArgs[0]).toEqual(
      and(
        inArray(zuvyMentorSlotBooking.id, [2, 5]),
        inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
          'SCHEDULED',
          'IN_PROGRESS',
        ]),
      ),
    );
    // MISSED also re-checks joined_at IS NULL at write time, so attendance
    // recorded between the SELECT and this UPDATE isn't stored as a no-show.
    expect(byState('MISSED')?.whereArgs[0]).toEqual(
      and(
        inArray(zuvyMentorSlotBooking.id, [3]),
        eq(zuvyMentorSlotBooking.sessionLifecycleState, 'SCHEDULED'),
        isNull(zuvyMentorSlotBooking.joinedAt),
      ),
    );
    expect(byState('COMPLETED')?.set).toMatchObject({ completedAt: NOW });
  });

  it('issues no updates when nothing needs to transition', async () => {
    selectWhere.mockResolvedValue([
      {
        bookingId: 4,
        lifecycle: 'SCHEDULED',
        joinedAt: null,
        slotStart: '2026-11-05T11:00:00.000Z',
        slotEnd: '2026-11-05T11:30:00.000Z',
      },
    ]);

    const job = new MentorSlotJob();
    await job.handleSessionTransitions();

    expect(updateCalls).toHaveLength(0);
  });
});
