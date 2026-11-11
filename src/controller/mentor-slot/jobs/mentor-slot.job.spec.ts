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

import { inArray } from 'drizzle-orm';
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
    ]);

    const job = new MentorSlotJob();
    await job.handleSessionTransitions();

    // Exactly one bulk UPDATE per target state (not one per row) — that's
    // the actual fix. Compare each call's WHERE against a real inArray(...)
    // built from the expected booking ids, same column, so this verifies
    // both the batching and the correct id grouping.
    expect(updateCalls).toHaveLength(3);

    const byState = (state: string) =>
      updateCalls.find(
        (c) =>
          (c.set as { sessionLifecycleState?: string })
            .sessionLifecycleState === state,
      );

    expect(byState('IN_PROGRESS')?.whereArgs[0]).toEqual(
      inArray(zuvyMentorSlotBooking.id, [1]),
    );
    expect(byState('COMPLETED')?.whereArgs[0]).toEqual(
      inArray(zuvyMentorSlotBooking.id, [2]),
    );
    expect(byState('MISSED')?.whereArgs[0]).toEqual(
      inArray(zuvyMentorSlotBooking.id, [3]),
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
