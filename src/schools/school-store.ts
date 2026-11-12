// Relative imports only: scripts/import-schools.ts loads this file with
// plain ts-node, outside Nest.
import { sql } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { zuvySchools } from '../../drizzle/schema';
import { PlaceNames, SchoolRow } from './school-rows';

type Db = PgDatabase<any, any, any>;

/** Rows per INSERT; 10 columns x 1,000 rows stays far below Postgres' limit. */
export const UPSERT_BATCH_SIZE = 1000;

/** The state and city spellings already in the school list. */
export async function loadPlaceNames(db: Db): Promise<PlaceNames> {
  const known = await db
    .selectDistinct({
      state: zuvySchools.state,
      district: zuvySchools.district,
    })
    .from(zuvySchools);
  return new PlaceNames(known);
}

/**
 * Adds new schools and updates existing ones (matched by UDISE code) in one
 * statement, and makes them active. The rows must have different UDISE
 * codes. Returns how many were added and how many updated.
 */
export async function upsertSchools(db: Db, rows: SchoolRow[]) {
  if (!rows.length) return { inserted: 0, updated: 0 };
  const result = await db
    .insert(zuvySchools)
    .values(rows as any)
    .onConflictDoUpdate({
      target: zuvySchools.udiseCode,
      set: {
        schoolName: sql`excluded.school_name`,
        state: sql`excluded.state`,
        district: sql`excluded.district`,
        block: sql`excluded.block`,
        village: sql`excluded.village`,
        pincode: sql`excluded.pincode`,
        management: sql`excluded.management`,
        classFrom: sql`excluded.class_from`,
        classTo: sql`excluded.class_to`,
        isActive: sql`true`,
        updatedAt: sql`now()`,
      } as any,
    })
    // xmax = 0 only for rows this statement inserted (not updated).
    .returning({ inserted: sql<boolean>`(xmax = 0)` });
  const inserted = result.filter((row) => row.inserted).length;
  return { inserted, updated: result.length - inserted };
}
