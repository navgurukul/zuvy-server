import { IST_OFFSET_MS } from './afe-report.rows';

/**
 * Settings, all from the environment. The report is off unless
 * AFE_REPORT_ENABLED=true, so dev and staging servers never email the client.
 *
 *   AFE_REPORT_ENABLED=true            turn the weekly email on
 *   AFE_REPORT_ORG_ID=7                the AFE Career Tours organisation (prod: 7)
 *   AFE_REPORT_TO=a@x.org,b@y.org      recipients (default join-zuvy@navgurukul.org)
 *   AFE_REPORT_START=2026-11-20T15:00:00+05:30
 *                                      where the first automatic report starts
 *                                      (default: from the beginning). Set it to
 *                                      the end of a report sent by hand, so the
 *                                      weekly ones carry on from there.
 *
 * Reports cover Monday 9 AM to the next Monday 9 AM, India time, and are sent
 * on Monday from 9 AM. Sending uses the app's existing SES settings:
 * SES_ACCESS_KEY_ID, SES_SECRET_ACCESS_KEY, AWS_REGION and SES_FROM_EMAIL.
 */
export const DEFAULT_RECIPIENT = 'join-zuvy@navgurukul.org';

export const REPORT_WEEKDAY = 1; // Monday (0 = Sunday)
export const REPORT_HOUR_IST = 9;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export interface AfeReportConfig {
  enabled: boolean;
  orgId: number | null;
  recipients: string[];
  /** Start of the first automatic report; null = from the beginning. */
  start: Date | null;
  /** AFE_REPORT_START is set but isn't a date with a time zone. */
  startInvalid: boolean;
}

function positiveInt(value: string | undefined): number | null {
  if (value === undefined || value.trim() === '') return null;
  const n = Number(value.trim());
  return Number.isInteger(n) && n >= 1 && n <= 2_147_483_647 ? n : null;
}

/** An ISO date-time with an explicit time zone ("Z" or "+05:30"), or null. */
function startOf(value: string | undefined): {
  start: Date | null;
  invalid: boolean;
} {
  if (value === undefined || value.trim() === '')
    return { start: null, invalid: false };
  const text = value.trim();
  const ms = Date.parse(text);
  const hasZone = /(Z|[+-]\d{2}:?\d{2})$/i.test(text);
  if (Number.isNaN(ms) || !hasZone) return { start: null, invalid: true };
  return { start: new Date(ms), invalid: false };
}

export function afeReportConfig(
  env: NodeJS.ProcessEnv = process.env,
): AfeReportConfig {
  const recipients = (env.AFE_REPORT_TO ?? DEFAULT_RECIPIENT)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const { start, invalid } = startOf(env.AFE_REPORT_START);
  return {
    enabled: env.AFE_REPORT_ENABLED === 'true',
    orgId: positiveInt(env.AFE_REPORT_ORG_ID),
    recipients,
    start,
    startInvalid: invalid,
  };
}

/** Why the scheduled report can't run with these settings, if it can't. */
export function configProblem(config: AfeReportConfig): string | null {
  if (!config.orgId)
    return 'AFE_REPORT_ORG_ID is not set to an organisation id';
  if (config.recipients.length === 0) return 'AFE_REPORT_TO has no recipients';
  if (config.startInvalid) {
    return 'AFE_REPORT_START is not a date-time with a time zone, e.g. 2026-11-20T15:00:00+05:30';
  }
  for (const key of [
    'SES_ACCESS_KEY_ID',
    'SES_SECRET_ACCESS_KEY',
    'AWS_REGION',
    'SES_FROM_EMAIL',
  ]) {
    if (!process.env[key]) return `${key} is not set`;
  }
  return null;
}

/** The most recent Monday 9:00 AM India time at or before `now`. */
export function lastWeeklyBoundary(now: Date): Date {
  const wall = new Date(now.getTime() + IST_OFFSET_MS); // UTC fields = IST wall clock
  const daysSince = (wall.getUTCDay() - REPORT_WEEKDAY + 7) % 7;
  let boundaryWall =
    Date.UTC(
      wall.getUTCFullYear(),
      wall.getUTCMonth(),
      wall.getUTCDate(),
      REPORT_HOUR_IST,
    ) -
    daysSince * DAY_MS;
  if (boundaryWall > wall.getTime()) boundaryWall -= WEEK_MS;
  return new Date(boundaryWall - IST_OFFSET_MS);
}

// After a failed attempt, wait this long before trying the same period again.
export const RETRY_AFTER_MS = 3 * 60 * 60 * 1000;
// A run still "sending" after this long belongs to a server that died.
export const STALE_SENDING_MS = 30 * 60 * 1000;

export interface RunSummary {
  status: 'sending' | 'sent' | 'failed';
  windowEnd: Date;
  createdAt: Date;
}

export type ReportPlan =
  | { due: true; from: Date; to: Date }
  | { due: false; reason: string };

/**
 * Which report, if any, is due now. A report always ends at a Monday 9 AM
 * (India time) and starts where the last sent one ended (or at `start`, or
 * the beginning, for the first one). So reports go out every Monday from
 * 9 AM, cover exactly one week, and a server that was down on Monday sends the
 * missed report at its next check, still ending at that Monday 9 AM.
 */
export function planReport(
  now: Date,
  lastSent: RunSummary | null,
  lastAttempt: RunSummary | null,
  start: Date | null,
): ReportPlan {
  const from = lastSent ? lastSent.windowEnd : (start ?? new Date(0));
  const to = lastWeeklyBoundary(now);
  if (to.getTime() <= from.getTime()) {
    return { due: false, reason: 'no full report period since the last one' };
  }
  if (
    lastAttempt?.status === 'failed' &&
    now.getTime() - lastAttempt.createdAt.getTime() < RETRY_AFTER_MS
  ) {
    return { due: false, reason: 'waiting to retry after a failure' };
  }
  return { due: true, from, to };
}
