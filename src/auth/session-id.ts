import { sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { zuvySessionCounters } from '../../drizzle/schema';

// Career Tours session IDs, for logins of students who have a school:
//   CT_IN_<YYYYMMDD>_<school UDISE code>_<7-digit number>
// e.g. CT_IN_20261028_36070700101_0000025 is the 25th login from that school
// on 28 Oct 2026. The number restarts at 0000001 for each school each day,
// so it stays short and never runs out; with the date and the school it is
// unique. Only capital letters, digits and underscores; 34 characters.
//
// A student whose school is not in the list (they typed its name at
// sign-up) gets NUDISE in place of the code, e.g.
// CT_IN_20261028_NUDISE_0000003; all such schools share one daily count.

const PREFIX = 'CT_IN'; // Career Tours, India
const NUMBER_DIGITS = 7;

/** Stands in for the UDISE code when the student's school is not listed. */
export const UNLISTED_SCHOOL_CODE = 'NUDISE';

/**
 * The school part of a Career Tours session ID: the UDISE code of a listed
 * school, NUDISE for a school typed in by hand, or null when the login has
 * no school at all (it then gets a random UUID instead).
 */
export function sessionSchoolCode(
  udiseCode?: string | null,
  unlistedSchool?: boolean,
): string | null {
  if (udiseCode) return udiseCode;
  return unlistedSchool ? UNLISTED_SCHOOL_CODE : null;
}
const INDIA_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** The date in India (IST) at a moment, as YYYYMMDD. */
export function sessionDate(at: Date = new Date()): string {
  const part = (type: string) =>
    INDIA_DATE.formatToParts(at).find((p) => p.type === type).value;
  return `${part('year')}${part('month')}${part('day')}`;
}

/** 20261028 + 36070700101 + 25 -> CT_IN_20261028_36070700101_0000025 */
export function formatCtSessionId(
  date: string,
  schoolCode: string,
  sequence: number,
): string {
  return `${PREFIX}_${date}_${schoolCode}_${String(sequence).padStart(NUMBER_DIGITS, '0')}`;
}

/**
 * Hands out the next number for a school on a date in one atomic
 * statement: the first login returns 1, the next 2, and so on. Two logins
 * at the same moment get different numbers, because Postgres locks the
 * counter row while it updates it.
 */
export async function nextSessionNumber(
  db: PgDatabase<any, any, any>,
  date: string,
  schoolCode: string,
): Promise<number> {
  const [row] = await db
    .insert(zuvySessionCounters)
    .values({ sessionDate: date, udiseCode: schoolCode, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [zuvySessionCounters.sessionDate, zuvySessionCounters.udiseCode],
      set: {
        lastNumber: sql`${zuvySessionCounters.lastNumber} + 1`,
        updatedAt: sql`now()`,
      } as any,
    })
    .returning({ lastNumber: zuvySessionCounters.lastNumber });
  return Number(row.lastNumber);
}
