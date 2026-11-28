import { asc, desc, sql } from 'drizzle-orm';
import {
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
} from '../../../../drizzle/schema';

/**
 * What the session lists are ordered by: when the booking was made
 * ("booked", the default the lists always used) or when the session starts
 * ("start"). The booking id breaks ties, so paging never skips or repeats a
 * row.
 */
export type SessionSortBy = 'booked' | 'start';
export type SessionSortOrder = 'asc' | 'desc';

/** Anything but "start" is "booked"; anything but "asc" is "desc". */
export function sessionListOrder(
  sortBy?: string,
  sort?: string,
): { sortBy: SessionSortBy; sort: SessionSortOrder } {
  return {
    sortBy: sortBy === 'start' ? 'start' : 'booked',
    sort: sort === 'asc' ? 'asc' : 'desc',
  };
}

/** The ORDER BY for a session list (the query joins the booking's slot). */
export function sessionOrderBy(sortBy: SessionSortBy, sort: SessionSortOrder) {
  const tieBreak =
    sort === 'asc'
      ? asc(zuvyMentorSlotBooking.id)
      : desc(zuvyMentorSlotBooking.id);
  if (sortBy === 'start') {
    // A booking whose slot row is gone has no start; it goes last.
    return [
      sort === 'asc'
        ? sql`${zuvyMentorSlotAvailability.slotStartDateTime} ASC NULLS LAST`
        : sql`${zuvyMentorSlotAvailability.slotStartDateTime} DESC NULLS LAST`,
      tieBreak,
    ];
  }
  return [
    sort === 'asc'
      ? asc(zuvyMentorSlotBooking.bookedAt)
      : desc(zuvyMentorSlotBooking.bookedAt),
    tieBreak,
  ];
}
