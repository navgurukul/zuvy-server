import { inArray } from 'drizzle-orm';
import { db } from '../db/index';
import { zuvyStudentCredentials } from '../../drizzle/schema';

/**
 * Student IDs for the given users, keyed by user id as a string. Users
 * without a Student ID account are simply absent from the map.
 */
export async function getStudentIdsByUserId(
  userIds: Array<number | bigint | string>,
): Promise<Map<string, string>> {
  const ids = Array.from(new Set(userIds.map((id) => String(id))));
  if (ids.length === 0) return new Map();

  const rows = await db
    .select({
      userId: zuvyStudentCredentials.userId,
      studentId: zuvyStudentCredentials.studentId,
    })
    .from(zuvyStudentCredentials)
    .where(
      inArray(
        zuvyStudentCredentials.userId,
        ids.map((id) => BigInt(id)),
      ),
    );

  return new Map(rows.map((r) => [String(r.userId), r.studentId]));
}
