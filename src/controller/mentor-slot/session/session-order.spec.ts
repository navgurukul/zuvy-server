import { PgDialect } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { sessionListOrder, sessionOrderBy } from './session-order';

const dialect = new PgDialect();
const orderSql = (sortBy: 'booked' | 'start', sort: 'asc' | 'desc') =>
  dialect.sqlToQuery(sql.join(sessionOrderBy(sortBy, sort), sql`, `)).sql;

describe('sessionListOrder', () => {
  it('defaults to newest booking first', () => {
    expect(sessionListOrder()).toEqual({ sortBy: 'booked', sort: 'desc' });
  });

  it('takes start and asc', () => {
    expect(sessionListOrder('start', 'asc')).toEqual({
      sortBy: 'start',
      sort: 'asc',
    });
  });

  it('falls back to the defaults for anything else', () => {
    expect(sessionListOrder('slotStart', 'ASC')).toEqual({
      sortBy: 'booked',
      sort: 'desc',
    });
    expect(sessionListOrder('', 'up')).toEqual({
      sortBy: 'booked',
      sort: 'desc',
    });
  });
});

describe('sessionOrderBy', () => {
  it('booked, desc: booking time then id, newest first (the old default)', () => {
    expect(orderSql('booked', 'desc')).toBe(
      '"zuvy_mentor_slot_booking"."booked_at" desc, "zuvy_mentor_slot_booking"."id" desc',
    );
  });

  it('booked, asc: oldest booking first, ties by id ascending', () => {
    expect(orderSql('booked', 'asc')).toBe(
      '"zuvy_mentor_slot_booking"."booked_at" asc, "zuvy_mentor_slot_booking"."id" asc',
    );
  });

  it('start, asc: next session first, sessions without a slot last', () => {
    expect(orderSql('start', 'asc')).toBe(
      '"zuvy_mentor_slot_availability"."slot_start_date_time" ASC NULLS LAST, "zuvy_mentor_slot_booking"."id" asc',
    );
  });

  it('start, desc: latest session first, sessions without a slot last', () => {
    expect(orderSql('start', 'desc')).toBe(
      '"zuvy_mentor_slot_availability"."slot_start_date_time" DESC NULLS LAST, "zuvy_mentor_slot_booking"."id" desc',
    );
  });
});
