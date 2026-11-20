/**
 * End-to-end check for the mentorship booking rules (credits, the gap, the
 * notice before a slot), against the DEV database only (refuses any other
 * DB_NAME).
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/e2e-mentorship-credits.ts
 *
 * Runs the real services, database, transactions and locks. Zoom and email
 * are stubbed. Test slots sit 25-35 years ahead so they never meet real data.
 *
 * Real bookings on dev can't affect the results: the run sets
 * credits_counted_from to its own start (a test-only override of the config,
 * never written to the table), so only the bookings it makes use a credit.
 * Everything it creates is deleted at the end, and the test student's
 * credit row is put back byte for byte.
 *
 * Needs migrations 0047 (attendance) and 0050 (mentorship config) on dev.
 * Override the dev users with E2E_MENTOR_ID / E2E_STUDENT_ID / E2E_ORG_ID.
 */
export {};

process.env.RECORDING_WORKER_ENABLED = 'false';
process.env.ATTENDANCE_WORKER_ENABLED = 'false';
process.env.MENTOR_ATTENDANCE_JOB_ENABLED = 'false';
process.env.GMAIL_MONITOR_ENABLED = 'false';

/* eslint-disable @typescript-eslint/no-var-requires */
const { NestFactory } = require('@nestjs/core');
const { SchedulerRegistry } = require('@nestjs/schedule');
const { AppModule } = require('../src/app.module');
const {
  MentorSlotService,
} = require('../src/controller/mentor-slot/mentor-slot.service');
const {
  MentorPublicService,
} = require('../src/controller/mentor-slot/public/mentor-public.service');
const {
  MentorshipConfigService,
} = require('../src/controller/mentor-slot/mentorship-rules/mentorship-config.service');
const {
  formatIstDateTime,
} = require('../src/controller/mentor-slot/mentorship-rules/mentorship-rules');
const { db } = require('../src/db');
const schema = require('../drizzle/schema');
const { and, eq, gte, inArray, lt, sql } = require('drizzle-orm');

const MENTOR = Number(process.env.E2E_MENTOR_ID ?? 66142);
const STUDENT = Number(process.env.E2E_STUDENT_ID ?? 65757);
const ORG = Number(process.env.E2E_ORG_ID ?? 1);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

let passed = 0;
let failed = 0;
const failures: string[] = [];
const report = (label: string, ok: boolean, detail?: string) => {
  ok ? passed++ : failed++;
  if (!ok) failures.push(label);
  console.log(
    `${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`,
  );
};

const ONLY = process.env.E2E_ONLY;
async function section(name: string, run: () => Promise<void>) {
  if (ONLY && !ONLY.split(',').some((p) => name.startsWith(p))) return;
  console.log(`\n--- ${name} ---`);
  try {
    await run();
  } catch (error: any) {
    report(`${name}: stopped by an unexpected error`, false, error.message);
  }
}

/** The refusal's code and message, or null when it wasn't refused. */
async function refusal(run: () => Promise<any>) {
  try {
    await run();
    return null;
  } catch (error: any) {
    const body = error?.getResponse?.() ?? {};
    return {
      code: body.code as string | undefined,
      status: error?.getStatus?.() as number | undefined,
      message: String(body.message ?? error.message),
      data: body.data ?? {},
    };
  }
}

// Far-future range with no slots and no licence holds in it.
let BASE = 0;
let RANGE_END = new Date(0);
async function pickEmptyRange() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const d = new Date(
      Date.now() + (9200 + Math.floor(Math.random() * 3000)) * DAY,
    );
    d.setUTCHours(0, 0, 0, 0);
    const to = new Date(d.getTime() + 200 * DAY);
    const busy = await db.execute(sql`
      SELECT (SELECT count(*) FROM main.zuvy_mentor_slot_availability
                WHERE slot_start_date_time >= ${d} AND slot_start_date_time < ${to})
           + (SELECT count(*) FROM main.license_assignments
                WHERE start_time >= ${d} AND start_time < ${to}) AS n`);
    if (Number(busy.rows[0].n) === 0) {
      BASE = d.getTime();
      RANGE_END = to;
      return;
    }
  }
  throw new Error('Could not find an empty far-future date range.');
}
let dayCounter = 0;
const nextDay = () => (dayCounter += 2);
const at = (day: number, hhmm: string, plusMs = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(BASE + day * DAY + (h * 60 + m) * MIN + plusMs);
};

let svc: any;
let publicSvc: any;
let config: any;
let runStart: Date;

/* ---------------------------------------------------------------- Zoom */

let meetingSeq = 0;
let failNextMeeting = false;
const zoomStubs: Record<string, any> = {
  getUser: async () => ({ success: true, data: { status: 'active', type: 2 } }),
  applyLicensedUserSettings: async () => ({ success: true }),
  syncZoomLicenseUser: async () => undefined,
  ensureLicensedUser: async () => ({ success: true, licensed: true }),
  createMeetingForUser: async () => {
    if (failNextMeeting) {
      failNextMeeting = false;
      return { success: false, error: 'E2E: Zoom is down' };
    }
    meetingSeq += 1;
    return {
      success: true,
      data: {
        id: 980000000 + meetingSeq,
        join_url: 'https://zoom.invalid/j',
        start_url: 'https://zoom.invalid/s',
        password: 'e2e',
      },
    };
  },
  getMeeting: async () => ({
    success: true,
    data: { uuid: `e2e-credits-${Date.now()}-${meetingSeq}` },
  }),
  deleteMeeting: async () => ({ success: true }),
  updateMeeting: async () => ({ success: true }),
};
function blockZoom(zoomService: any) {
  const proto = Object.getPrototypeOf(zoomService);
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor' || typeof proto[key] !== 'function') continue;
    zoomService[key] =
      zoomStubs[key] ??
      (async () => {
        throw new Error(`Zoom call blocked in credits e2e: ${key}`);
      });
  }
}

/* ------------------------------------------------------------- helpers */

async function createSlot(start: Date, minutes = 30) {
  const [slot] = await svc.createSlot(
    MENTOR,
    {
      slotStartDateTime: start.toISOString(),
      slotEndDateTime: new Date(start.getTime() + minutes * MIN).toISOString(),
      maxCapacity: 1,
    },
    ORG,
  );
  return slot;
}
const book = (slotId: number) => svc.bookSlot(STUDENT, slotId);
const cancel = (bookingId: number) =>
  svc.cancelBooking(bookingId, 'E2E credits test clean-up', 'student');
const eligibility = () => svc.getBookingEligibility(STUDENT);

async function nothingReservedOn(slotId: number) {
  const bookings = await db
    .select({ id: schema.zuvyMentorSlotBooking.id })
    .from(schema.zuvyMentorSlotBooking)
    .where(eq(schema.zuvyMentorSlotBooking.slotAvailabilityId, slotId));
  const holds = await db
    .select({ id: schema.licenseAssignments.id })
    .from(schema.licenseAssignments)
    .where(eq(schema.licenseAssignments.mentorSlotAvailabilityId, slotId));
  const [slot] = await db
    .select({ n: schema.zuvyMentorSlotAvailability.currentBookedCount })
    .from(schema.zuvyMentorSlotAvailability)
    .where(eq(schema.zuvyMentorSlotAvailability.id, slotId));
  return bookings.length === 0 && holds.length === 0 && slot?.n === 0;
}

// The test student's credit row, saved and restored inside Postgres so its
// `timestamp without time zone` columns aren't shifted on the way.
async function readStudentMetricsJson(): Promise<string | null> {
  const result = await db.execute(
    sql`SELECT row_to_json(m)::text AS j FROM main.zuvy_student_booking_metrics m WHERE m.user_id = ${STUDENT}`,
  );
  return result.rows[0]?.j ?? null;
}
let metricsSnapshot: string | null = null;
async function restoreStudentMetrics() {
  await db
    .delete(schema.zuvyStudentBookingMetrics)
    .where(eq(schema.zuvyStudentBookingMetrics.userId, BigInt(STUDENT)));
  if (metricsSnapshot) {
    await db.execute(
      sql`INSERT INTO main.zuvy_student_booking_metrics SELECT * FROM json_populate_record(NULL::main.zuvy_student_booking_metrics, ${metricsSnapshot}::json)`,
    );
  }
}

/** Only bookings made from now on count (test bookings). */
function countFromNow(extra: Record<string, unknown> = {}) {
  config.setOverridesForTesting({
    creditsCountedFrom: new Date(),
    totalCredits: 3,
    gapDays: 14,
    noticeHours: 72,
    ...extra,
  });
}

/* --------------------------------------------------------------- tests */

async function main() {
  console.log(`DB: ${process.env.DB_NAME}`);
  if (process.env.DB_NAME !== 'dev') {
    console.log('Refusing: this script only runs against the dev database.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  app
    .get(SchedulerRegistry)
    .getCronJobs()
    .forEach((cron: any) => cron.stop());

  svc = app.get(MentorSlotService);
  publicSvc = app.get(MentorPublicService);
  config = app.get(MentorshipConfigService);
  const lic = svc.zoomLicenseService;
  for (const z of new Set([svc.zoomService, lic.zoomService])) blockZoom(z);
  lic.syncLicensedUsersFromZoom = async () => 0;
  svc.emailService.sendEmail = async () => undefined;

  metricsSnapshot = await readStudentMetricsJson();
  await pickEmptyRange();
  runStart = new Date();
  console.log(
    `Mentor ${MENTOR}, student ${STUDENT}, base day ${new Date(BASE).toISOString().slice(0, 10)}`,
  );

  const testBookingIds: number[] = [];
  const track = (booked: any) => {
    testBookingIds.push(Number(booked.id));
    return booked;
  };

  try {
    await section('C1. Config read from the table', async () => {
      config.setOverridesForTesting(null);
      config.invalidate();
      const rules = await config.get();
      report(
        'the seeded values are in force (3 credits, 14 days, 72 h, 10 min, 1, 15 Apr 2026)',
        rules.totalCredits === 3 &&
          rules.gapDays === 14 &&
          rules.noticeHours === 72 &&
          rules.joinOpenMinutes === 10 &&
          rules.maxAcceptedReschedules === 1 &&
          rules.creditsCountedFrom.toISOString() === '2026-04-15T00:00:00.000Z',
        JSON.stringify(rules),
      );
    });

    countFromNow();

    await section(
      'C2. Eligibility and metrics for a student with no counted bookings',
      async () => {
        const e = await eligibility();
        report(
          'eligibility: 3 of 3 left, can book, no gap',
          e.credits.creditsAssigned === 3 &&
            e.credits.creditsUsed === 0 &&
            e.credits.creditsLeft === 3 &&
            e.credits.canBook === true &&
            e.credits.nextEligibleDate === null &&
            e.credits.blockReason === null,
          JSON.stringify(e.credits),
        );
        report(
          'eligibility: rules, earliest bookable start and server time',
          e.rules.noticeHours === 72 &&
            e.rules.totalCredits === 3 &&
            e.rules.gapDays === 14 &&
            Math.abs(new Date(e.serverTime).getTime() - Date.now()) < 60_000 &&
            Math.abs(
              new Date(e.earliestBookableStart).getTime() -
                (new Date(e.serverTime).getTime() + 72 * HOUR),
            ) < 1000,
        );
        const m = await svc.getStudentMetrics(STUDENT);
        report(
          'metrics: same credits block, old fields kept',
          JSON.stringify(m.credits) === JSON.stringify(e.credits) &&
            m.remainingCredits === 3 &&
            m.canBook === true &&
            m.nextEligible === null &&
            !!m.serverTime &&
            !!m.sessions,
        );
      },
    );

    let firstBooking: any;
    let firstSlot: any;
    await section('C3. Notice before a slot, and the slot lists', async () => {
      // Put the notice boundary inside the test range: slots just before it
      // are refused and hidden, slots after it are bookable and listed.
      const d = nextDay();
      const noticeHours = Math.floor(
        (at(d, '12:00').getTime() - Date.now()) / HOUR,
      );
      countFromNow({ noticeHours });
      const earliest = new Date(Date.now() + noticeHours * HOUR);

      const tooSoon = await createSlot(new Date(earliest.getTime() - MIN));
      const r = await refusal(() => book(tooSoon.id));
      report(
        'a slot starting 1 minute inside the notice is refused (SLOT_TOO_SOON, 400)',
        r?.code === 'SLOT_TOO_SOON' &&
          r?.status === 400 &&
          r?.message ===
            `This slot starts in under ${noticeHours} hours, so it can't be booked. Pick a later slot.`,
        r?.message,
      );
      report(
        'the refused booking reserved nothing',
        await nothingReservedOn(tooSoon.id),
      );

      const listedBefore = (await publicSvc.getAvailableSlots(MENTOR, ORG)).map(
        (s: any) => s.id,
      );
      const [mentorUser] = await db
        .select({ email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, BigInt(MENTOR)));
      const mentorRow = async () => {
        const list = await publicSvc.getAllMentors(
          10,
          0,
          undefined,
          undefined,
          undefined,
          mentorUser.email,
          ORG,
        );
        const rows = Array.isArray(list)
          ? list
          : (list?.data ?? list?.mentors ?? []);
        return rows.find((m: any) => Number(m.userId ?? m.id) === MENTOR);
      };
      const countBefore = Number((await mentorRow())?.availableSlots ?? NaN);

      const bookable = await createSlot(
        new Date(earliest.getTime() + 40 * MIN),
      );
      const listed = (await publicSvc.getAvailableSlots(MENTOR, ORG)).map(
        (s: any) => s.id,
      );
      report(
        'availability list: hides the slot inside the notice, shows the one after it',
        !listed.includes(tooSoon.id) &&
          !listedBefore.includes(tooSoon.id) &&
          listed.includes(bookable.id),
      );
      const countAfter = Number((await mentorRow())?.availableSlots ?? NaN);
      report(
        "mentor list's open-slot count only counts the bookable slot",
        Number.isFinite(countBefore) && countAfter === countBefore + 1,
        `${countBefore} -> ${countAfter}`,
      );

      firstSlot = await createSlot(new Date(earliest.getTime() + 90 * MIN));
      firstBooking = track(await book(firstSlot.id));
      const gapEnd = new Date(
        new Date(firstSlot.slotStartDateTime).getTime() + 14 * DAY,
      );
      report(
        'a slot after the notice is booked; the response has the credit block',
        !!firstBooking.meetingLink &&
          firstBooking.credits?.creditsUsed === 1 &&
          firstBooking.credits?.creditsLeft === 2 &&
          firstBooking.remainingCredits === 2 &&
          new Date(firstBooking.nextEligible).getTime() === gapEnd.getTime() &&
          new Date(firstBooking.credits?.nextEligibleDate).getTime() ===
            gapEnd.getTime() &&
          firstBooking.credits?.blockReason === 'GAP_ACTIVE' &&
          !!firstBooking.serverTime,
        JSON.stringify(firstBooking.credits),
      );

      const rescheduleList = (
        await svc.getRescheduleSlotsForBooking(STUDENT, firstBooking.id)
      ).map((s: any) => s.id);
      report(
        'reschedule list: hides the slot inside the notice, shows the bookable one',
        !rescheduleList.includes(tooSoon.id) &&
          rescheduleList.includes(bookable.id),
      );
      // Keep the first booking counted from here on.
      config.setOverridesForTesting({
        creditsCountedFrom: runStart,
        totalCredits: 3,
        gapDays: 14,
        noticeHours: 72,
      });
    });

    await section('C4. The gap', async () => {
      const gapEnd = new Date(
        new Date(firstSlot.slotStartDateTime).getTime() + 14 * DAY,
      );
      const later = await createSlot(at(nextDay(), '10:00'));
      const r = await refusal(() => book(later.id));
      report(
        'booking inside the gap is refused (GAP_ACTIVE, 403) with the exact date',
        r?.code === 'GAP_ACTIVE' &&
          r?.status === 403 &&
          r?.message ===
            `You can book your next session from ${formatIstDateTime(gapEnd)}. Sessions need to be 2 weeks apart.` &&
          new Date(r?.data?.nextEligibleDate as any).getTime() ===
            gapEnd.getTime(),
        r?.message,
      );
      report(
        'the refused booking reserved nothing',
        await nothingReservedOn(later.id),
      );

      const e = await eligibility();
      report(
        'eligibility says the same',
        e.credits.blockReason === 'GAP_ACTIVE' &&
          e.credits.creditsLeft === 2 &&
          new Date(e.credits.nextEligibleDate).getTime() === gapEnd.getTime(),
      );

      await cancel(firstBooking.id);
      const after = await eligibility();
      report(
        'cancelling gives the credit back and ends the gap',
        after.credits.creditsUsed === 0 &&
          after.credits.creditsLeft === 3 &&
          after.credits.canBook === true,
        JSON.stringify(after.credits),
      );
      const rebooked = track(await book(later.id));
      report(
        'and the student can book again',
        rebooked.credits?.creditsUsed === 1,
      );
    });

    await section('C5. No credits left', async () => {
      countFromNow({ gapDays: 0 });
      const slots = [];
      for (let i = 0; i < 4; i++)
        slots.push(await createSlot(at(nextDay(), '10:00')));
      for (let i = 0; i < 3; i++) track(await book(slots[i].id));
      const r = await refusal(() => book(slots[3].id));
      report(
        'a 4th booking is refused (NO_CREDITS, 403) with the R1 message',
        r?.code === 'NO_CREDITS' &&
          r?.status === 403 &&
          r?.message === "You've used all 3 of your mentorship credits." &&
          r?.data?.creditsLeft === 0,
        r?.message,
      );
      report(
        'the refused booking reserved nothing',
        await nothingReservedOn(slots[3].id),
      );

      const row = (
        await db.execute(
          sql`SELECT quota_used, is_quota_exhausted, total_bookings FROM main.zuvy_student_booking_metrics WHERE user_id = ${STUDENT}`,
        )
      ).rows[0];
      report(
        'the cached credit row matches',
        Number(row?.quota_used) === 3 && row?.is_quota_exhausted === true,
        JSON.stringify(row),
      );

      // A refunded no-show (mentor didn't come) no longer uses a credit.
      const [counted] = await db
        .select({ id: schema.zuvyMentorSlotBooking.id })
        .from(schema.zuvyMentorSlotBooking)
        .where(
          and(
            eq(schema.zuvyMentorSlotBooking.slotAvailabilityId, slots[0].id),
            eq(schema.zuvyMentorSlotBooking.status, 'confirmed'),
          ),
        );
      await db.insert(schema.zuvyMentorSessionAttendance).values({
        mentorBookingId: counted.id,
        status: 'RECORDED',
        outcome: 'MENTOR_NO_SHOW',
        creditRefunded: true,
      });
      const refunded = await eligibility();
      report(
        'a refunded no-show gives the credit back',
        refunded.credits.creditsUsed === 2 && refunded.credits.canBook,
        JSON.stringify(refunded.credits),
      );
      track(await book(slots[3].id));
      report('so the 4th booking now goes through', true);

      // Moving credits_counted_from forward gives everyone fresh credits.
      countFromNow({ gapDays: 0 });
      const fresh = await eligibility();
      report(
        'moving credits_counted_from forward: all credits back',
        fresh.credits.creditsUsed === 0 && fresh.credits.creditsLeft === 3,
      );
    });

    await section('C6. Two bookings at the same moment', async () => {
      for (let round = 1; round <= 3; round++) {
        // Gap on: whichever books first blocks the other.
        countFromNow();
        const a = await createSlot(at(nextDay(), '10:00'));
        const b = await createSlot(at(nextDay(), '10:00'));
        const results = await Promise.allSettled([book(a.id), book(b.id)]);
        results.forEach((x) => x.status === 'fulfilled' && track(x.value));
        const won = results.filter((x) => x.status === 'fulfilled').length;
        const lost = results.find((x) => x.status === 'rejected') as any;
        const used = (await eligibility()).credits.creditsUsed;
        report(
          `round ${round}, gap on: one booking, one GAP_ACTIVE, one credit used`,
          won === 1 &&
            lost?.reason?.getResponse?.()?.code === 'GAP_ACTIVE' &&
            used === 1,
          `${won} won, ${lost?.reason?.message}, used ${used}`,
        );

        // Gap off, 1 credit: whichever books first uses the last credit.
        countFromNow({ gapDays: 0, totalCredits: 1 });
        const c = await createSlot(at(nextDay(), '10:00'));
        const d = await createSlot(at(nextDay(), '10:00'));
        const results2 = await Promise.allSettled([book(c.id), book(d.id)]);
        results2.forEach((x) => x.status === 'fulfilled' && track(x.value));
        const won2 = results2.filter((x) => x.status === 'fulfilled').length;
        const lost2 = results2.find((x) => x.status === 'rejected') as any;
        report(
          `round ${round}, last credit: one booking, one NO_CREDITS`,
          won2 === 1 && lost2?.reason?.getResponse?.()?.code === 'NO_CREDITS',
          `${won2} won, ${lost2?.reason?.message}`,
        );
      }
    });

    await section(
      'C7. A failed or abandoned booking gives the credit back',
      async () => {
        countFromNow();
        const slot = await createSlot(at(nextDay(), '10:00'));
        failNextMeeting = true;
        const r = await refusal(() => book(slot.id));
        const e = await eligibility();
        report(
          'Zoom fails: booking refused, nothing reserved, credit unused',
          !!r &&
            (await nothingReservedOn(slot.id)) &&
            e.credits.creditsUsed === 0,
          r?.message,
        );

        const booked = track(await book(slot.id));
        // Make it look stuck between bookSlot's steps for 20 minutes.
        await db
          .update(schema.zuvyMentorSlotBooking)
          .set({
            meetingLink: null,
            bookedAt: new Date(Date.now() - 20 * MIN),
          })
          .where(eq(schema.zuvyMentorSlotBooking.id, booked.id));
        // The job releases every stuck booking on dev, not just ours: run it
        // only when ours is the only one.
        const others = await db.execute(sql`
          SELECT count(*)::int AS n FROM main.zuvy_mentor_slot_booking
          WHERE status = 'confirmed' AND meeting_link IS NULL
            AND google_event_id IS NULL
            AND booked_at < now() - interval '15 minutes'
            AND booked_at > now() - interval '7 days'
            AND id <> ${booked.id}`);
        if (Number(others.rows[0].n) > 0) {
          report(
            'abandoned booking (skipped: other stuck bookings on dev)',
            true,
          );
          return;
        }
        const released = await svc.releaseAbandonedBookings();
        const after = await eligibility();
        report(
          'abandoned booking released by the job: credit back, gap gone',
          released >= 1 &&
            (await nothingReservedOn(slot.id)) &&
            after.credits.creditsUsed === 0 &&
            after.credits.canBook,
          `${released} released, ${JSON.stringify(after.credits)}`,
        );
      },
    );
  } finally {
    console.log('\n--- Clean-up ---');
    config.setOverridesForTesting(null);
    config.invalidate();
    const slotIds = (
      await db
        .select({ id: schema.zuvyMentorSlotAvailability.id })
        .from(schema.zuvyMentorSlotAvailability)
        .where(
          and(
            gte(
              schema.zuvyMentorSlotAvailability.slotStartDateTime,
              new Date(BASE),
            ),
            lt(schema.zuvyMentorSlotAvailability.slotStartDateTime, RANGE_END),
          ),
        )
    ).map((s: any) => s.id);
    const bookingIds = slotIds.length
      ? (
          await db
            .select({ id: schema.zuvyMentorSlotBooking.id })
            .from(schema.zuvyMentorSlotBooking)
            .where(
              inArray(schema.zuvyMentorSlotBooking.slotAvailabilityId, slotIds),
            )
        ).map((b: any) => b.id)
      : [];
    const allBookings = [...new Set([...bookingIds, ...testBookingIds])];
    if (allBookings.length) {
      await db
        .delete(schema.zuvyNotifications)
        .where(
          and(
            eq(schema.zuvyNotifications.referenceType, 'booking'),
            inArray(schema.zuvyNotifications.referenceId, allBookings),
          ),
        );
    }
    // Deleting the slots cascades to their bookings, attendance rows and
    // licence holds.
    if (slotIds.length) {
      await db
        .delete(schema.zuvyMentorSlotAvailability)
        .where(inArray(schema.zuvyMentorSlotAvailability.id, slotIds));
    }
    await restoreStudentMetrics();
    report(
      'test student credit row restored exactly',
      (await readStudentMetricsJson()) === metricsSnapshot,
    );
    const left = await db.execute(sql`
      SELECT (SELECT count(*) FROM main.zuvy_mentor_slot_availability
                WHERE slot_start_date_time >= ${new Date(BASE)} AND slot_start_date_time < ${RANGE_END})::int AS slots,
             (SELECT count(*) FROM main.license_assignments
                WHERE start_time >= ${new Date(BASE)} AND start_time < ${RANGE_END})::int AS holds,
             (SELECT count(*) FROM main.zuvy_mentor_slot_booking
                WHERE id = ANY(string_to_array(${allBookings.join(',') || '0'}, ',')::int[]))::int AS bookings`);
    const { slots, holds, bookings } = left.rows[0];
    report(
      'no test slots, bookings or licence holds left',
      slots === 0 && holds === 0 && bookings === 0,
      `${slots} slots, ${bookings} bookings, ${holds} holds`,
    );
    console.log(
      `Removed ${slotIds.length} slot(s), ${allBookings.length} booking(s).`,
    );
    await app.close();
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) console.log(`Failed: ${failures.join(' ; ')}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E script crashed:', e);
  process.exit(1);
});
