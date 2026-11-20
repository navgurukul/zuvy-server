/**
 * End-to-end check for the booking drawer (ST2) and the cancel and
 * reschedule forms (ST4), against the DEV database only (refuses any other
 * DB_NAME).
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/e2e-student-changes.ts
 *
 * Real services, database, transactions and locks; Zoom and email stubbed.
 * Test sessions sit 25-35 years ahead. To test the "closes 72 hours before"
 * boundary on them, the run moves notice_hours (a test-only override of the
 * config, never written to the table) so the boundary lands on its own
 * sessions. Only this run's bookings count toward credits. Everything it
 * creates is deleted; the student's credit row is put back.
 * Needs migrations 0047, 0050 and 0052.
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
  SessionService,
} = require('../src/controller/mentor-slot/session/session.service');
const {
  MentorshipConfigService,
} = require('../src/controller/mentor-slot/mentorship-rules/mentorship-config.service');
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
async function section(name: string, run: () => Promise<void>) {
  console.log(`\n--- ${name} ---`);
  try {
    await run();
  } catch (error: any) {
    report(`${name}: stopped by an unexpected error`, false, error.message);
  }
}
/** The refusal's { code, status, message }, or null if it went through. */
async function refusal(run: () => Promise<any>) {
  try {
    await run();
    return null;
  } catch (error: any) {
    const body = error?.getResponse?.() ?? {};
    return {
      code: body.code as string | undefined,
      status: error?.getStatus?.(),
      message: String(body.message ?? error.message),
    };
  }
}

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
      SELECT (SELECT count(*) FROM main.zuvy_mentor_slot_availability WHERE slot_start_date_time >= ${d} AND slot_start_date_time < ${to})
           + (SELECT count(*) FROM main.license_assignments WHERE start_time >= ${d} AND start_time < ${to}) AS n`);
    if (Number(busy.rows[0].n) === 0) {
      BASE = d.getTime();
      RANGE_END = to;
      return;
    }
  }
  throw new Error('No empty far-future range.');
}
let dayCounter = 0;
const nextDay = () => new Date(BASE + (dayCounter += 2) * DAY + 10 * HOUR);

let svc: any;
let sessions: any;
let config: any;
const zoomStubs: Record<string, any> = {
  getUser: async () => ({ success: true, data: { status: 'active', type: 2 } }),
  applyLicensedUserSettings: async () => ({ success: true }),
  syncZoomLicenseUser: async () => undefined,
  ensureLicensedUser: async () => ({ success: true, licensed: true }),
  createMeetingForUser: async () => ({
    success: true,
    data: {
      id: 960000000 + Math.floor(Math.random() * 1e6),
      join_url: 'https://zoom.invalid/j',
      start_url: 'https://zoom.invalid/s',
      password: 'e2e',
    },
  }),
  getMeeting: async () => ({
    success: true,
    data: { uuid: `e2e-changes-${Date.now()}` },
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
        throw new Error(`Zoom call blocked: ${key}`);
      });
  }
}

const rules = (extra: Record<string, unknown> = {}) =>
  config.setOverridesForTesting({
    creditsCountedFrom: runStart,
    totalCredits: 100,
    gapDays: 0,
    noticeHours: 72,
    maxAcceptedReschedules: 1,
    ...extra,
  });
/** notice_hours such that `start` is `inside` hours inside (or, if negative, outside) the notice. */
const noticeAround = (start: Date, inside: number) =>
  Math.ceil((start.getTime() - Date.now()) / HOUR) + inside;
let runStart: Date;

async function slotAt(start: Date) {
  const [slot] = await svc.createSlot(
    MENTOR,
    {
      slotStartDateTime: start.toISOString(),
      slotEndDateTime: new Date(start.getTime() + 45 * MIN).toISOString(),
      maxCapacity: 1,
    },
    ORG,
  );
  return slot;
}
async function slotRow(id: number) {
  const [s] = await db
    .select()
    .from(schema.zuvyMentorSlotAvailability)
    .where(eq(schema.zuvyMentorSlotAvailability.id, id));
  return s;
}
async function bookingRow(id: number) {
  const [b] = await db
    .select()
    .from(schema.zuvyMentorSlotBooking)
    .where(eq(schema.zuvyMentorSlotBooking.id, id));
  return b;
}
async function holds(slotId: number) {
  return (
    await db
      .select()
      .from(schema.licenseAssignments)
      .where(eq(schema.licenseAssignments.mentorSlotAvailabilityId, slotId))
  ).length;
}
const book = async (slotId: number) =>
  Number((await svc.bookSlot(STUDENT, slotId)).id);
const card = async (bookingId: number) =>
  (await sessions.getStudentSessions(BigInt(STUDENT), 'all', 200, 0)).data.find(
    (d: any) => Number(d.booking.id) === bookingId,
  );
const REASON = 'E2E: clashes with my exam';

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
  sessions = app.get(SessionService);
  config = app.get(MentorshipConfigService);
  for (const z of new Set([
    svc.zoomService,
    svc.zoomLicenseService.zoomService,
  ]))
    blockZoom(z);
  svc.zoomLicenseService.syncLicensedUsersFromZoom = async () => 0;
  svc.emailService.sendEmail = async () => undefined;

  const snapshot =
    (
      await db.execute(
        sql`SELECT row_to_json(m)::text AS j FROM main.zuvy_student_booking_metrics m WHERE m.user_id = ${STUDENT}`,
      )
    ).rows[0]?.j ?? null;
  await pickEmptyRange();
  runStart = new Date();
  rules();

  try {
    await section('D1. Booking drawer preview (ST2)', async () => {
      config.setOverridesForTesting({
        creditsCountedFrom: runStart,
        totalCredits: 3,
        gapDays: 14,
        noticeHours: 72,
      });
      const slot = await slotAt(nextDay());
      const p = await svc.getBookingPreview(STUDENT, slot.id);
      const opens = new Date(
        new Date(slot.slotStartDateTime).getTime() + 14 * DAY,
      );
      report(
        'bookable: credit impact and next booking date',
        p.canBook &&
          p.blocked === null &&
          p.impact.summary === 'Uses 1 credit, 2 left after this' &&
          new Date(p.impact.nextBookingOpensAt).getTime() === opens.getTime() &&
          /^Your next booking opens on .+, 2 weeks after this session\.$/.test(
            p.impact.detail,
          ),
        `${p.impact?.summary} | ${p.impact?.detail}`,
      );
      report(
        'good-to-know lines with the configured numbers',
        p.goodToKnow.length === 4 &&
          p.goodToKnow[0].text ===
            'Cancel up to 72 hours before. Your credit comes back.' &&
          p.goodToKnow[3].tone === 'warning',
      );
      report(
        'the preview reserved nothing',
        (await slotRow(slot.id)).currentBookedCount === 0 &&
          (await holds(slot.id)) === 0,
      );

      config.setOverridesForTesting({
        creditsCountedFrom: runStart,
        totalCredits: 3,
        gapDays: 14,
        noticeHours: noticeAround(new Date(slot.slotStartDateTime), 1),
      });
      const soon = await svc.getBookingPreview(STUDENT, slot.id);
      report(
        'inside the notice: blocked, same code and message as booking',
        soon.canBook === false &&
          soon.blocked.code === 'SLOT_TOO_SOON' &&
          soon.impact === null,
        soon.blocked?.message,
      );

      config.setOverridesForTesting({
        creditsCountedFrom: runStart,
        totalCredits: 3,
        gapDays: 14,
        noticeHours: 72,
      });
      await book(slot.id);
      const other = await slotAt(nextDay());
      const gap = await svc.getBookingPreview(STUDENT, other.id);
      report(
        'after a booking: blocked by the gap',
        gap.blocked?.code === 'GAP_ACTIVE' &&
          /Sessions need to be 2 weeks apart\.$/.test(gap.blocked.message),
        gap.blocked?.message,
      );
      const taken = await svc.getBookingPreview(STUDENT, slot.id);
      report(
        'a full slot: SLOT_TAKEN (after the credit checks)',
        taken.blocked?.code === 'GAP_ACTIVE' ||
          taken.blocked?.code === 'SLOT_TAKEN',
        taken.blocked?.code,
      );
      rules();
      const full = await svc.getBookingPreview(STUDENT, slot.id);
      report(
        'a full slot with credits to spare: SLOT_TAKEN',
        full.blocked?.code === 'SLOT_TAKEN',
        full.blocked?.message,
      );
    });

    await section('D2. Cancel (ST4)', async () => {
      rules();
      const slot = await slotAt(nextDay());
      const id = await book(slot.id);
      const before = await svc.getCancelPreview(STUDENT, id);
      report(
        'cancel preview: credit comes back, can book straight away',
        before.canCancel &&
          /^Your credit comes back, so you'll have \d+ of 100 left, and you can book again straight away\.$/.test(
            before.message,
          ),
        before.message,
      );

      rules({ noticeHours: noticeAround(new Date(slot.slotStartDateTime), 1) });
      const late = await svc.getCancelPreview(STUDENT, id);
      report(
        'inside the notice: preview says closed',
        late.canCancel === false && late.blocked.code === 'TOO_LATE_TO_CHANGE',
        late.blocked?.message,
      );
      const r = await refusal(() =>
        svc.cancelBooking(id, REASON, 'student', STUDENT),
      );
      report(
        'student cancel inside the notice: refused with the R1 message',
        r?.code === 'TOO_LATE_TO_CHANGE' &&
          r?.status === 400 &&
          r.message ===
            'Rescheduling and cancelling close ' +
              noticeAround(new Date(slot.slotStartDateTime), 1) +
              " hours before the session. If you can't attend, email team@zuvy.org.",
        r?.message,
      );
      const m = await refusal(() =>
        svc.cancelBooking(id, REASON, 'mentor', MENTOR),
      );
      report(
        'mentor cancel inside the notice: their own message',
        m?.code === 'TOO_LATE_TO_CHANGE' &&
          /Email team@zuvy\.org to cancel it\.$/.test(m.message),
        m?.message,
      );
      report(
        'and the booking is untouched',
        (await bookingRow(id)).status === 'confirmed',
      );
      const c = await card(id);
      report(
        'card: cancel and reschedule closed',
        c.actions.cancel.reason === 'TOO_LATE_TO_CHANGE' &&
          c.actions.reschedule.reason === 'TOO_LATE_TO_CHANGE',
      );

      rules();
      const done = await svc.cancelBooking(id, REASON, 'student', STUDENT);
      report(
        'outside the notice: cancelled, response carries the credits',
        !!done.credits && typeof done.credits.creditsLeft === 'number',
        JSON.stringify(done.credits),
      );
      const again = await svc.getCancelPreview(STUDENT, id);
      report(
        'preview after cancel: ALREADY_CANCELLED',
        again.blocked?.code === 'ALREADY_CANCELLED',
      );
    });

    let rsBooking = 0;
    let originalSlot: any;
    await section(
      'D3. Reschedule request holds the new slot (ST4)',
      async () => {
        rules();
        // An earlier slot, so the notice can cover it but not the booking.
        const earlier = await slotAt(nextDay());
        originalSlot = await slotAt(nextDay());
        rsBooking = await book(originalSlot.id);
        const target = await slotAt(nextDay());

        rules({
          noticeHours: noticeAround(new Date(earlier.slotStartDateTime), 1),
        });
        const soonNew = await refusal(() =>
          svc.proposeReschedule(rsBooking, earlier.id, REASON, STUDENT),
        );
        report(
          'a new slot inside the notice (booking itself outside): SLOT_TOO_SOON',
          soonNew?.code === 'SLOT_TOO_SOON' &&
            /^Pick a slot that starts at least \d+ hours from now\.$/.test(
              soonNew.message,
            ),
          `${soonNew?.code}: ${soonNew?.message}`,
        );
        rules({
          noticeHours: noticeAround(
            new Date(originalSlot.slotStartDateTime),
            1,
          ),
        });
        const lateOriginal = await refusal(() =>
          svc.proposeReschedule(rsBooking, target.id, REASON, STUDENT),
        );
        report(
          'the booking itself inside the notice: TOO_LATE_TO_CHANGE',
          lateOriginal?.code === 'TOO_LATE_TO_CHANGE',
          lateOriginal?.message,
        );
        rules();

        await svc.proposeReschedule(rsBooking, target.id, REASON, STUDENT);
        const b = await bookingRow(rsBooking);
        const t = await slotRow(target.id);
        report(
          'request saved with its reason; seat held on the new slot',
          b.rescheduleStatus === 'pending' &&
            b.rescheduleReason === REASON &&
            b.rescheduleSeatHeld === true &&
            t.currentBookedCount === 1 &&
            t.status === 'full',
          `${t.currentBookedCount} ${t.status}`,
        );
        report('the new slot holds a licence', (await holds(target.id)) === 1);
        const alert = await db
          .select()
          .from(schema.zuvyNotifications)
          .where(
            and(
              eq(schema.zuvyNotifications.referenceId, rsBooking),
              eq(schema.zuvyNotifications.type, 'RESCHEDULE_REQUEST'),
            ),
          );
        report(
          'the mentor is told, with the reply deadline',
          alert.length === 1 &&
            /Reply by .+, or the session stays as booked\.$/.test(
              alert[0].message,
            ),
          alert[0]?.message,
        );

        const r = await refusal(() =>
          svc.cancelBooking(rsBooking, REASON, 'student', STUDENT),
        );
        report(
          'cancel while the request waits: RESCHEDULE_PENDING',
          r?.code === 'RESCHEDULE_PENDING',
          r?.message,
        );
        const secondSlot = await slotAt(nextDay());
        const second = await refusal(() =>
          svc.proposeReschedule(rsBooking, secondSlot.id, REASON, STUDENT),
        );
        report(
          'a second request while one waits: refused',
          !!second,
          second?.message,
        );
        const c = await card(rsBooking);
        report(
          'card: Reschedule requested, replies by the original start',
          c.displayState === 'RESCHEDULE_REQUESTED' &&
            new Date(c.reschedule.replyBy).getTime() ===
              new Date(originalSlot.slotStartDateTime).getTime(),
        );

        const bookedOnTarget = await refusal(() =>
          svc.bookSlot(STUDENT, target.id),
        );
        report(
          'nobody can book the held slot',
          !!bookedOnTarget,
          bookedOnTarget?.message,
        );

        await svc.declineReschedule(rsBooking, MENTOR, ORG);
        const d = await bookingRow(rsBooking);
        const t2 = await slotRow(target.id);
        report(
          'decline: status kept as declined, seat and licence given back',
          d.rescheduleStatus === 'declined' &&
            d.rescheduleSeatHeld === false &&
            d.slotAvailabilityId === originalSlot.id &&
            t2.currentBookedCount === 0 &&
            t2.status === 'available' &&
            (await holds(target.id)) === 0,
          `${t2.currentBookedCount} ${t2.status}`,
        );
        const dc = await card(rsBooking);
        report(
          'card: what the student sees after a decline',
          dc.rescheduleOutcome?.status === 'declined' &&
            /can't make that time\. Your session stays on .+\. You can still cancel until .+, and your credit comes back\.$/.test(
              dc.rescheduleOutcome.message,
            ),
          dc.rescheduleOutcome?.message,
        );
      },
    );

    await section('D4. Accept, and only once (ST4)', async () => {
      rules();
      const target = await slotAt(nextDay());
      await svc.proposeReschedule(rsBooking, target.id, REASON, STUDENT);
      await svc.acceptReschedule(rsBooking, MENTOR, ORG);
      const b = await bookingRow(rsBooking);
      const t = await slotRow(target.id);
      const o = await slotRow(originalSlot.id);
      report(
        'accept: moved, counted, reminders reset',
        b.slotAvailabilityId === target.id &&
          b.rescheduleStatus === 'accepted' &&
          b.acceptedRescheduleCount === 1 &&
          b.reminder24hSent === false &&
          b.reminder1hSent === false &&
          b.rescheduleSeatHeld === false,
      );
      report(
        'the held seat became the booking (count 1, not 2); the old slot is free',
        t.currentBookedCount === 1 &&
          o.currentBookedCount === 0 &&
          o.status === 'available' &&
          (await holds(originalSlot.id)) === 0 &&
          (await holds(target.id)) === 1,
        `new ${t.currentBookedCount}, old ${o.currentBookedCount}`,
      );
      const c = await card(rsBooking);
      report(
        'card: accepted note, no more reschedules',
        c.rescheduleOutcome?.status === 'accepted' &&
          /accepted\. Your session moved to /.test(
            c.rescheduleOutcome.message,
          ) &&
          c.actions.reschedule.reason === 'RESCHEDULE_LIMIT',
        c.rescheduleOutcome?.message,
      );
      const thirdSlot = await slotAt(nextDay());
      const again = await refusal(() =>
        svc.proposeReschedule(rsBooking, thirdSlot.id, REASON, STUDENT),
      );
      report(
        'a second reschedule: RESCHEDULE_LIMIT',
        again?.code === 'RESCHEDULE_LIMIT',
        again?.message,
      );
    });

    await section(
      'D5. No reply: the request lapses at the original start',
      async () => {
        rules();
        const slot = await slotAt(nextDay());
        const id = await book(slot.id);
        const target = await slotAt(nextDay());
        await svc.proposeReschedule(id, target.id, REASON, STUDENT);
        const early = await svc.expireRescheduleRequests(
          new Date(new Date(slot.slotStartDateTime).getTime() - MIN),
          [id],
        );
        report(
          'a minute before the original start: still waiting',
          early === 0 && (await bookingRow(id)).rescheduleStatus === 'pending',
        );
        const n = await svc.expireRescheduleRequests(
          new Date(slot.slotStartDateTime),
          [id],
        );
        const b = await bookingRow(id);
        const t = await slotRow(target.id);
        report(
          'at the original start: expired, session stays, seat given back',
          n === 1 &&
            b.rescheduleStatus === 'expired' &&
            b.slotAvailabilityId === slot.id &&
            b.sessionLifecycleState === 'SCHEDULED' &&
            t.currentBookedCount === 0 &&
            (await holds(target.id)) === 0,
        );
        const alert = await db
          .select()
          .from(schema.zuvyNotifications)
          .where(
            and(
              eq(schema.zuvyNotifications.referenceId, id),
              eq(schema.zuvyNotifications.type, 'RESCHEDULE_EXPIRED'),
            ),
          );
        report('the student is told', alert.length === 1);
        const again = await svc.expireRescheduleRequests(
          new Date(slot.slotStartDateTime),
          [id],
        );
        report('an answered request is never touched again', again === 0);
      },
    );

    await section(
      'D6. Requests made before this change (no held seat)',
      async () => {
        rules();
        const slot = await slotAt(nextDay());
        const id = await book(slot.id);
        const target = await slotAt(nextDay());
        // The old way: marked pending, nothing held.
        await db
          .update(schema.zuvyMentorSlotBooking)
          .set({
            rescheduleStatus: 'pending',
            rescheduleRequestedAt: new Date(),
            rescheduleProposedSlotId: target.id,
            sessionLifecycleState: 'RESCHEDULE_PENDING',
          })
          .where(eq(schema.zuvyMentorSlotBooking.id, id));
        await svc.acceptReschedule(id, MENTOR, ORG);
        const t = await slotRow(target.id);
        report(
          'accept still takes the seat itself (count 1)',
          t.currentBookedCount === 1 &&
            (await bookingRow(id)).slotAvailabilityId === target.id,
          `${t.currentBookedCount}`,
        );
      },
    );
  } finally {
    console.log('\n--- Clean-up ---');
    config.setOverridesForTesting(null);
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
    if (bookingIds.length)
      await db
        .delete(schema.zuvyNotifications)
        .where(
          and(
            eq(schema.zuvyNotifications.referenceType, 'booking'),
            inArray(schema.zuvyNotifications.referenceId, bookingIds),
          ),
        );
    if (slotIds.length)
      await db
        .delete(schema.zuvyMentorSlotAvailability)
        .where(inArray(schema.zuvyMentorSlotAvailability.id, slotIds));
    await db
      .delete(schema.zuvyStudentBookingMetrics)
      .where(eq(schema.zuvyStudentBookingMetrics.userId, BigInt(STUDENT)));
    if (snapshot)
      await db.execute(
        sql`INSERT INTO main.zuvy_student_booking_metrics SELECT * FROM json_populate_record(NULL::main.zuvy_student_booking_metrics, ${snapshot}::json)`,
      );
    const now =
      (
        await db.execute(
          sql`SELECT row_to_json(m)::text AS j FROM main.zuvy_student_booking_metrics m WHERE m.user_id = ${STUDENT}`,
        )
      ).rows[0]?.j ?? null;
    report('student credit row put back exactly', now === snapshot);
    const left = await db.execute(
      sql`SELECT (SELECT count(*) FROM main.zuvy_mentor_slot_availability WHERE slot_start_date_time >= ${new Date(BASE)} AND slot_start_date_time < ${RANGE_END})::int + (SELECT count(*) FROM main.license_assignments WHERE start_time >= ${new Date(BASE)} AND start_time < ${RANGE_END})::int AS n`,
    );
    report(
      'no test slots or licence holds left',
      Number(left.rows[0].n) === 0,
      `${left.rows[0].n}`,
    );
    console.log(
      `Removed ${slotIds.length} slot(s), ${bookingIds.length} booking(s).`,
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
