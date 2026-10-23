import { SQL, sql } from 'drizzle-orm';

export function normalizeTopicName(name: string | null | undefined): string {
  return (name ?? '').replace(/\s+/g, ' ').trim();
}

export function topicNameKey(name: string | null | undefined): string {
  return normalizeTopicName(name).toLowerCase();
}

export function topicNameEquals(column: unknown, topicName: string): SQL {
  return sql`LOWER(TRIM(${column})) = ${topicNameKey(topicName)}`;
}

export function topicNamesMatch(left: unknown, right: unknown): SQL {
  return sql`LOWER(TRIM(${left})) = LOWER(TRIM(${right}))`;
}
