import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  and,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { db } from 'src/db';
import {
  users,
  zuvyMentorSessionAttendance,
  zuvyMentorSlotAvailability,
  zuvyMentorSlotBooking,
} from '../../../../drizzle/schema';
import { ZoomService } from 'src/services/zoom/zoom.service';
import { MentorSlotService } from '../mentor-slot.service';
import {
  AttendanceDecision,
  MeetingState,
  decideAttendance,
  lifecycleStateFor,
  noShowCreditRulesEnabled,
  outcomeRefundsCredit,
  runsInSessionWindow,
} from '../attendance/mentor-attendance.util';

// Wait this long after a slot ends before the first check, so Zoom has
// usually finished the meeting and its participant report.
const FIRST_CHECK_DELAY_MS = 15 * 60 * 1000;
// Only sessions that ended within this window are checked. Older sessions are
// never touched, so turning this on doesn't rewrite or refund history.
const LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;
// Still inconclusive this long after the slot ended: stop retrying and leave
// the booking as it is.
const GIVE_UP_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
// A booking that was just retried waits this long before the next attempt,
// so bookings that keep failing don't take every batch.
const RETRY_INTERVAL_MS = 30 * 60 * 1000;
// Bounds Zoom API calls per run (each booking costs 2-3 calls).
const BATCH_SIZE = 20;

// Off unless MENTOR_ATTENDANCE_JOB_ENABLED=true, like the other background
// workers. Turn it on only once migration 0047 is applied, and on one server
// only: on several, each calls Zoom for the same sessions (the claim in
// record() still stops a double refund).
export function mentorAttendanceJobEnabled(
  env: NodeJS.ProcessEnv = process.env,
) {
  return env.MENTOR_ATTENDANCE_JOB_ENABLED === 'true';
}

/**
 * Records who actually joined each mentor session, from Zoom's participant
 * report, once the session has ended. Sets the booking to COMPLETED (both
 * joined) or MISSED (anyone didn't), and — under the credit rules — gives the
 * student's credit back and removes their booking cooldown when the mentor
 * didn't join or nobody did.
 */
@Injectable()
export class MentorAttendanceJob implements OnModuleInit {
  private readonly logger = new Logger(MentorAttendanceJob.name);
  private running = false;

  constructor(
    private readonly zoomService: ZoomService,
    private readonly mentorSlotService: MentorSlotService,
  ) {}

  onModuleInit() {
    this.logger.log(
      mentorAttendanceJobEnabled()
        ? 'Mentor attendance job is on.'
        : 'Mentor attendance job is off (MENTOR_ATTENDANCE_JOB_ENABLED is not "true").',
    );
  }

  @Cron(CronExpression.EVERY_10_MINUTES)
  async recordEndedSessions() {
    if (!mentorAttendanceJobEnabled()) return;
    // A slow run (Zoom latency) must not overlap the next tick.
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      const candidates = await this.findCandidates(now);
      for (const booking of candidates) {
        try {
          await this.processBooking(booking, now);
        } catch (error: any) {
          this.logger.error(
            `Attendance check failed for mentor booking ${booking.bookingId}: ${error.message}`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  private findCandidates(now: Date) {
    return (
      db
        .select({
          bookingId: zuvyMentorSlotBooking.id,
          studentUserId: zuvyMentorSlotBooking.studentUserId,
          zoomMeetingId: zuvyMentorSlotBooking.zoomMeetingId,
          slotStart: zuvyMentorSlotAvailability.slotStartDateTime,
          slotEnd: zuvyMentorSlotAvailability.slotEndDateTime,
          mentorEmail: users.email,
        })
        .from(zuvyMentorSlotBooking)
        .innerJoin(
          zuvyMentorSlotAvailability,
          eq(
            zuvyMentorSlotAvailability.id,
            zuvyMentorSlotBooking.slotAvailabilityId,
          ),
        )
        .innerJoin(users, eq(users.id, zuvyMentorSlotBooking.mentorUserId))
        .leftJoin(
          zuvyMentorSessionAttendance,
          eq(
            zuvyMentorSessionAttendance.mentorBookingId,
            zuvyMentorSlotBooking.id,
          ),
        )
        .where(
          and(
            ne(zuvyMentorSlotBooking.status, 'cancelled'),
            inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
              'COMPLETED',
              'MISSED',
            ]),
            isNotNull(zuvyMentorSlotBooking.zoomMeetingId),
            lte(
              zuvyMentorSlotAvailability.slotEndDateTime,
              new Date(now.getTime() - FIRST_CHECK_DELAY_MS),
            ),
            gt(
              zuvyMentorSlotAvailability.slotEndDateTime,
              new Date(now.getTime() - LOOKBACK_MS),
            ),
            // Never checked, or still pending and not retried in the last
            // RETRY_INTERVAL_MS. RECORDED and UNAVAILABLE are final.
            or(
              isNull(zuvyMentorSessionAttendance.id),
              and(
                eq(zuvyMentorSessionAttendance.status, 'PENDING'),
                lt(
                  zuvyMentorSessionAttendance.checkedAt,
                  new Date(now.getTime() - RETRY_INTERVAL_MS),
                ),
              ),
            ),
          ),
        )
        // Never-checked bookings first, then the ones retried longest ago.
        .orderBy(
          sql`${zuvyMentorSessionAttendance.checkedAt} ASC NULLS FIRST`,
          zuvyMentorSlotAvailability.slotEndDateTime,
        )
        .limit(BATCH_SIZE)
    );
  }

  private async processBooking(
    booking: {
      bookingId: number;
      studentUserId: bigint;
      zoomMeetingId: string | null;
      slotStart: Date;
      slotEnd: Date;
      mentorEmail: string | null;
    },
    now: Date,
  ) {
    const slotStart = new Date(booking.slotStart);
    const slotEnd = new Date(booking.slotEnd);
    let decision: AttendanceDecision;

    try {
      // Only runs around the session's own time count, not e.g. the mentor
      // testing the link the day before.
      const runs = runsInSessionWindow(
        await this.zoomService.getPastMeetingRuns(booking.zoomMeetingId),
        slotStart,
        slotEnd,
      );
      const instanceCount = runs.length;
      const participants = runs.flatMap((run) => run.participants);

      // No run in the window means the meeting either never ran or is still
      // running; ask Zoom which. Any error leaves it unknown (no refund).
      let meetingState: MeetingState = { kind: 'not_running' };
      if (instanceCount === 0) {
        const meeting = await this.zoomService.getMeeting(
          booking.zoomMeetingId,
        );
        meetingState = !meeting.success
          ? { kind: 'unknown', error: meeting.error ?? 'unknown Zoom error' }
          : meeting.data?.status === 'started'
            ? { kind: 'live' }
            : { kind: 'not_running' };
      }

      decision = decideAttendance({
        instanceCount,
        participants,
        mentorEmail: booking.mentorEmail,
        meetingState,
        slotEnd,
        now,
      });
    } catch (error: any) {
      decision = {
        kind: 'retry',
        reason: `Zoom request failed: ${error.response?.data?.message || error.message}`,
      };
    }

    if (decision.kind === 'retry') {
      const givingUp = now.getTime() - slotEnd.getTime() > GIVE_UP_AFTER_MS;
      await this.markUnresolved(
        booking.bookingId,
        decision.reason,
        givingUp,
        now,
      );
      if (givingUp) {
        this.logger.warn(
          `Gave up on attendance for mentor booking ${booking.bookingId}: ${decision.reason}`,
        );
      }
      return;
    }

    await this.record(booking, decision, now);
  }

  private markUnresolved(
    bookingId: number,
    reason: string,
    givingUp: boolean,
    now: Date,
  ) {
    const status = givingUp ? 'UNAVAILABLE' : 'PENDING';
    return db
      .insert(zuvyMentorSessionAttendance)
      .values({
        mentorBookingId: bookingId,
        status,
        attempts: 1,
        lastError: reason,
        checkedAt: now,
      } as typeof zuvyMentorSessionAttendance.$inferInsert)
      .onConflictDoUpdate({
        target: zuvyMentorSessionAttendance.mentorBookingId,
        set: {
          status,
          attempts: sql`${zuvyMentorSessionAttendance.attempts} + 1`,
          lastError: reason,
          checkedAt: now,
          updatedAt: now,
        } as Partial<typeof zuvyMentorSessionAttendance.$inferInsert>,
        // Never downgrade a result another run already recorded.
        where: eq(zuvyMentorSessionAttendance.status, 'PENDING'),
      });
  }

  private async record(
    booking: { bookingId: number; studentUserId: bigint },
    decision: Extract<AttendanceDecision, { kind: 'record' }>,
    now: Date,
  ) {
    const refundCredit =
      outcomeRefundsCredit(decision.outcome) && noShowCreditRulesEnabled();
    const lifecycle = lifecycleStateFor(decision.outcome);

    const recorded = await db.transaction(async (trx) => {
      // Claim the booking: this succeeds once. If the row is already
      // RECORDED (an overlapping run or another server got there first),
      // nothing is returned and nothing else happens — so a credit can't be
      // refunded twice.
      const claimed = await trx
        .insert(zuvyMentorSessionAttendance)
        .values({
          mentorBookingId: booking.bookingId,
          status: 'RECORDED',
          outcome: decision.outcome,
          mentorAttendedSeconds: decision.mentorSeconds,
          studentAttendedSeconds: decision.studentSeconds,
          creditRefunded: refundCredit,
          attempts: 1,
          lastError: null,
          checkedAt: now,
        } as typeof zuvyMentorSessionAttendance.$inferInsert)
        .onConflictDoUpdate({
          target: zuvyMentorSessionAttendance.mentorBookingId,
          set: {
            status: 'RECORDED',
            outcome: decision.outcome,
            mentorAttendedSeconds: decision.mentorSeconds,
            studentAttendedSeconds: decision.studentSeconds,
            creditRefunded: refundCredit,
            attempts: sql`${zuvyMentorSessionAttendance.attempts} + 1`,
            lastError: null,
            checkedAt: now,
            updatedAt: now,
          } as Partial<typeof zuvyMentorSessionAttendance.$inferInsert>,
          where: eq(zuvyMentorSessionAttendance.status, 'PENDING'),
        })
        .returning({ id: zuvyMentorSessionAttendance.id });

      if (claimed.length === 0) return false;

      // Only a session that has ended and wasn't cancelled meanwhile.
      await trx
        .update(zuvyMentorSlotBooking)
        .set({
          sessionLifecycleState: lifecycle,
          ...(lifecycle === 'COMPLETED'
            ? {
                completedAt: sql`COALESCE(${zuvyMentorSlotBooking.completedAt}, ${now})`,
              }
            : {}),
          updatedAt: now,
        } as Partial<typeof zuvyMentorSlotBooking.$inferInsert>)
        .where(
          and(
            eq(zuvyMentorSlotBooking.id, booking.bookingId),
            ne(zuvyMentorSlotBooking.status, 'cancelled'),
            inArray(zuvyMentorSlotBooking.sessionLifecycleState, [
              'COMPLETED',
              'MISSED',
            ]),
          ),
        );

      if (refundCredit) {
        await this.mentorSlotService.recomputeStudentBookingMetrics(
          trx,
          booking.studentUserId,
        );
      }
      return true;
    });

    if (!recorded) return;

    this.logger.log(
      `Mentor booking ${booking.bookingId}: ${decision.outcome} (mentor ${decision.mentorSeconds}s, student ${decision.studentSeconds}s)${refundCredit ? ', credit refunded' : ''}`,
    );
  }
}
