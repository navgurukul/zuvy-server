/**
 * The mentorship booking rules as plain functions. They take `now` as an
 * argument (always the server's clock, never the device's), so tests can put
 * it a minute either side of a boundary.
 */
import { MentorshipConfig } from './mentorship-config.service';
import { MentorshipError } from './mentorship-error';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** A student's credit position. */
export interface CreditState {
  creditsAssigned: number;
  creditsUsed: number;
  creditsLeft: number;
  /**
   * When the student may book again because of the gap: the latest session's
   * start plus the gap. Null when they can book now, or when they have no
   * credits left (no date would let them book).
   */
  nextEligibleDate: Date | null;
  canBook: boolean;
  blockReason: 'NO_CREDITS' | 'GAP_ACTIVE' | null;
}

/** What the credit count is worked out from. */
export interface CreditUsage {
  /** Bookings that use a credit (see CreditService). */
  creditsUsed: number;
  /** Start of the latest of those bookings' sessions, past or future. */
  latestSessionStart: Date | null;
}

export function computeCreditState(
  usage: CreditUsage,
  config: MentorshipConfig,
  now: Date,
): CreditState {
  const creditsAssigned = config.totalCredits;
  const creditsUsed = usage.creditsUsed;
  const creditsLeft = Math.min(
    creditsAssigned,
    Math.max(0, creditsAssigned - creditsUsed),
  );
  const gapEndsAt = gapEndsAfter(usage.latestSessionStart, config);
  const gapActive = !!gapEndsAt && now.getTime() < gapEndsAt.getTime();

  const blockReason =
    creditsLeft === 0 ? 'NO_CREDITS' : gapActive ? 'GAP_ACTIVE' : null;

  return {
    creditsAssigned,
    creditsUsed,
    creditsLeft,
    nextEligibleDate: blockReason === 'GAP_ACTIVE' ? gapEndsAt : null,
    canBook: blockReason === null,
    blockReason,
  };
}

/** The latest session's start plus the gap (exact time, not whole days). */
export function gapEndsAfter(
  latestSessionStart: Date | null,
  config: MentorshipConfig,
): Date | null {
  if (!latestSessionStart || config.gapDays <= 0) return null;
  return new Date(latestSessionStart.getTime() + config.gapDays * DAY_MS);
}

/** The earliest slot start a student can book now. */
export function earliestBookableStart(
  now: Date,
  config: MentorshipConfig,
): Date {
  return new Date(now.getTime() + config.noticeHours * HOUR_MS);
}

/**
 * A slot can be booked only if it starts at least `noticeHours` from now.
 * Exactly the notice is allowed.
 */
export function assertSlotHasNotice(
  slotStart: Date,
  now: Date,
  config: MentorshipConfig,
) {
  const earliest = earliestBookableStart(now, config);
  if (slotStart.getTime() < earliest.getTime()) {
    throw new MentorshipError(
      'SLOT_TOO_SOON',
      `This slot starts in under ${plural(config.noticeHours, 'hour')}, so it can't be booked. Pick a later slot.`,
      { noticeHours: config.noticeHours, earliestStart: earliest },
    );
  }
}

/** Refuses a booking the student's credits or gap don't allow. */
export function assertCreditsAllowBooking(
  state: CreditState,
  config: MentorshipConfig,
) {
  if (state.blockReason === 'NO_CREDITS') {
    throw new MentorshipError(
      'NO_CREDITS',
      state.creditsAssigned === 1
        ? "You've used your mentorship credit."
        : `You've used all ${state.creditsAssigned} of your mentorship credits.`,
      creditData(state),
    );
  }
  if (state.blockReason === 'GAP_ACTIVE') {
    throw new MentorshipError(
      'GAP_ACTIVE',
      `You can book your next session from ${formatIstDateTime(state.nextEligibleDate)}. Sessions need to be ${gapPhrase(config.gapDays)} apart.`,
      creditData(state),
    );
  }
}

const SUPPORT_EMAIL = 'team@zuvy.org';

/** Reschedule and cancel close this long before the session (notice_hours). */
export function changesCloseAt(sessionStart: Date, config: MentorshipConfig) {
  return new Date(sessionStart.getTime() - config.noticeHours * HOUR_MS);
}

/**
 * A student or mentor can cancel or reschedule only until `noticeHours`
 * before the session (exactly the notice is allowed). Ops can at any time,
 * so Ops paths don't call this.
 */
export function assertCanChangeSession(
  actor: 'student' | 'mentor',
  sessionStart: Date,
  now: Date,
  config: MentorshipConfig,
) {
  const closesAt = changesCloseAt(sessionStart, config);
  if (now.getTime() > closesAt.getTime()) {
    throw new MentorshipError(
      'TOO_LATE_TO_CHANGE',
      actor === 'mentor'
        ? `This session starts in under ${plural(config.noticeHours, 'hour')}. Email ${SUPPORT_EMAIL} to cancel it.`
        : `Rescheduling and cancelling close ${plural(config.noticeHours, 'hour')} before the session. If you can't attend, email ${SUPPORT_EMAIL}.`,
      { noticeHours: config.noticeHours, changesCloseAt: closesAt },
    );
  }
}

/** "Good to know" in the booking drawer, worded with the configured numbers. */
export function goodToKnow(config: MentorshipConfig) {
  const notice = plural(config.noticeHours, 'hour');
  return [
    {
      tone: 'info',
      text: `Cancel up to ${notice} before. Your credit comes back.`,
    },
    {
      tone: 'info',
      text: `Reschedule up to ${notice} before. Your mentor needs to accept.`,
    },
    {
      tone: 'info',
      text: `Join opens ${plural(config.joinOpenMinutes, 'minute')} before the start.`,
    },
    {
      tone: 'warning',
      text: `Inside ${notice}, email ${SUPPORT_EMAIL} if you can't attend. If you miss the session, you lose the credit.`,
    },
  ] as const;
}

/** The credit fields every response carries. */
export function creditData(state: CreditState) {
  return {
    creditsAssigned: state.creditsAssigned,
    creditsUsed: state.creditsUsed,
    creditsLeft: state.creditsLeft,
    nextEligibleDate: state.nextEligibleDate,
    canBook: state.canBook,
    blockReason: state.blockReason,
  };
}

/** "2 weeks", "1 week", "10 days". */
export function gapPhrase(days: number) {
  return days > 0 && days % 7 === 0
    ? plural(days / 7, 'week')
    : plural(days, 'day');
}

/** "24 Nov 2026, 6:00 pm", in India time. */
export function formatIstDateTime(date: Date): string {
  const day = date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = date.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${day}, ${time}`;
}

function plural(count: number, unit: string) {
  return `${count} ${unit}${count === 1 ? '' : 's'}`;
}
