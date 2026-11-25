import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../db';
import { zuvyMentorshipConfig } from '../../../../drizzle/schema';

/** The mentorship rules, as numbers the code can use. */
export interface MentorshipConfig {
  /** Sessions a student can book, across all their courses. */
  totalCredits: number;
  /** Days between a student's sessions, from the latest session's start. */
  gapDays: number;
  /** Book (and later cancel or reschedule) only this many hours ahead. */
  noticeHours: number;
  /** Minutes before the start that the join button opens. */
  joinOpenMinutes: number;
  /** Accepted reschedules allowed per booking. */
  maxAcceptedReschedules: number;
  /** Only bookings made from this moment use a credit. */
  creditsCountedFrom: Date;
}

/** Used for any key missing from the table (or holding a bad value). */
export const DEFAULT_MENTORSHIP_CONFIG: Readonly<MentorshipConfig> =
  Object.freeze({
    totalCredits: 3,
    gapDays: 14,
    noticeHours: 72,
    joinOpenMinutes: 10,
    maxAcceptedReschedules: 1,
    creditsCountedFrom: new Date('2026-04-15T00:00:00.000Z'),
  });

const KEYS: Record<keyof MentorshipConfig, string> = {
  totalCredits: 'total_credits',
  gapDays: 'gap_days',
  noticeHours: 'notice_hours',
  joinOpenMinutes: 'join_open_minutes',
  maxAcceptedReschedules: 'max_accepted_reschedules',
  creditsCountedFrom: 'credits_counted_from',
};

const CACHE_MS = 60_000;

/**
 * Builds the config from the table's rows. A missing key, or one that isn't a
 * whole number of zero or more (a valid date for credits_counted_from),
 * keeps its default and is reported in `problems`.
 */
export function parseMentorshipConfig(
  rows: Array<{ key: string; value: unknown }>,
): { config: MentorshipConfig; problems: string[] } {
  const byKey = new Map(rows.map((row) => [row.key, row.value]));
  const config: MentorshipConfig = { ...DEFAULT_MENTORSHIP_CONFIG };
  const problems: string[] = [];

  for (const field of Object.keys(KEYS) as Array<keyof MentorshipConfig>) {
    const key = KEYS[field];
    if (!byKey.has(key)) continue;
    const raw = byKey.get(key);

    if (field === 'creditsCountedFrom') {
      const date = typeof raw === 'string' ? new Date(raw) : null;
      if (date && !Number.isNaN(date.getTime())) {
        config.creditsCountedFrom = date;
      } else {
        problems.push(`${key}=${JSON.stringify(raw)} is not a date`);
      }
      continue;
    }

    const value = typeof raw === 'string' ? Number(raw) : raw;
    if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
      (config as any)[field] = value;
    } else {
      problems.push(`${key}=${JSON.stringify(raw)} is not a whole number >= 0`);
    }
  }
  return { config, problems };
}

/**
 * The mentorship rules from zuvy_mentorship_config, cached for 60 seconds so
 * a change made by Ops reaches every server within a minute. If the table
 * can't be read, the last good values (or the defaults) are used, so a
 * database hiccup never blocks bookings.
 */
@Injectable()
export class MentorshipConfigService {
  private readonly logger = new Logger(MentorshipConfigService.name);
  private cached: { config: MentorshipConfig; loadedAt: number } | null = null;
  private loading: Promise<MentorshipConfig> | null = null;
  private reported = new Set<string>();
  // Test runs only: values that win over the table.
  private overrides: Partial<MentorshipConfig> | null = null;

  /**
   * The current rules. Call it before opening a transaction where you can:
   * it may need a database connection of its own.
   */
  async get(): Promise<MentorshipConfig> {
    if (this.cached && Date.now() - this.cached.loadedAt < CACHE_MS) {
      return this.withOverrides(this.cached.config);
    }
    if (!this.loading) {
      this.loading = this.load().finally(() => {
        this.loading = null;
      });
    }
    return this.withOverrides(await this.loading);
  }

  /** Forget the cached values; the next get() reads the table. */
  invalidate() {
    this.cached = null;
  }

  /** For test scripts: make these values win over the table (null clears). */
  setOverridesForTesting(overrides: Partial<MentorshipConfig> | null) {
    this.overrides = overrides;
  }

  private withOverrides(config: MentorshipConfig): MentorshipConfig {
    return this.overrides ? { ...config, ...this.overrides } : config;
  }

  private async load(): Promise<MentorshipConfig> {
    try {
      const rows = await db
        .select({
          key: zuvyMentorshipConfig.key,
          value: zuvyMentorshipConfig.value,
        })
        .from(zuvyMentorshipConfig);
      const { config, problems } = parseMentorshipConfig(rows);
      for (const problem of problems) this.reportOnce(problem);
      this.cached = { config, loadedAt: Date.now() };
      return config;
    } catch (error: any) {
      this.reportOnce(
        `could not read zuvy_mentorship_config (${error.message}); using ${this.cached ? 'the last values read' : 'the defaults'}`,
      );
      // Try again on the next call rather than caching the failure.
      return this.cached?.config ?? { ...DEFAULT_MENTORSHIP_CONFIG };
    }
  }

  private reportOnce(problem: string) {
    if (this.reported.has(problem)) return;
    this.reported.add(problem);
    this.logger.warn(`Mentorship config: ${problem}.`);
  }
}
