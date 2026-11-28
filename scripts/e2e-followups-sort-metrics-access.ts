/**
 * End-to-end check for five mentorship follow-ups, against the DEV database
 * only (refuses any other DB_NAME):
 *   F1. a mentor's bookable slots come soonest first
 *   F2. session lists take sortBy=start (next session first), and paging is stable
 *   F3. mentor metrics count live (IN_PROGRESS) sessions as upcoming, and a
 *       30d/3m period with no sessions keeps the full response shape
 *   F4. rules carry maxAcceptedReschedules (both session lists, eligibility)
 *   F5. eligibility checks enrolment, as booking does
 *
 *   npx ts-node --transpile-only -P tsconfig.json -r tsconfig-paths/register scripts/e2e-followups-sort-metrics-access.ts
 *
 * Real services, database and transactions; Zoom and email stubbed. Test
 * slots sit 25-35 years ahead (one is moved to "now" for the live-session
 * check). Rule numbers come from MentorshipConfigService's test override
 * (never written to the table). Everything the run creates is deleted and
 * the student's credit row is put back.
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
  MentorPublicService,
} = require('../src/controller/mentor-slot/public/mentor-public.service');
const {
  MentorshipConfigService,
} = require('../src/controller/mentor-slot/mentorship-rules/mentorship-config.service');
const {
  MentorMetricsService,
} = require('../src/controller/mentor-slot/metrics/mentor-metrics.service');
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
const dayAt = (n: number) => new Date(BASE + n * DAY + 10 * HOUR);

let svc: any;
let sessions: any;
let publicSvc: any;
let config: any;
let runStart: Date;
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
    data: {
      uuid: `e2e-followups-${Date.now()}`,
      start_url: 'https://zoom.invalid/s',
    },
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
    joinOpenMinutes: 10,
    minSlotLeadDays: 4,
    maxAcceptedReschedules: 1,
    ...extra,
  });

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
const book = async (slotId: number) =>
  Number((await svc.bookSlot(STUDENT, slotId)).id);
const ids = (list: any) => list.data.map((d: any) => Number(d.booking.id));
const only = (all: number[], mine: number[]) =>
  all.filter((id) => mine.includes(id));
const same = (a: unknown[], b: unknown[]) =>
  JSON.stringify(a) === JSON.stringify(b);

// Slots moved out of the far-future range (the live-session check); cleaned
// up by id.
const movedSlotIds: number[] = [];

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
  publicSvc = app.get(MentorPublicService);
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
    // Three slots created out of order: day 6, day 2, day 4.
    const s6 = await slotAt(dayAt(6));
    const s2 = await slotAt(dayAt(2));
    const s4 = await slotAt(dayAt(4));

    await section('F1. Bookable slots come soonest first', async () => {
      const list = await publicSvc.getAvailableSlots(MENTOR, ORG);
      const mine = list
        .filter((s: any) => [s2.id, s4.id, s6.id].includes(s.id))
        .map((s: any) => s.id);
      report(
        "this run's slots in start order",
        same(mine, [s2.id, s4.id, s6.id]),
        JSON.stringify(mine),
      );
      const starts = list.map((s: any) =>
        new Date(s.slotStartDateTime).getTime(),
      );
      report(
        'the whole list is in start order',
        starts.every((t: number, i: number) => i === 0 || starts[i - 1] <= t),
        `${list.length} slot(s)`,
      );
    });

    // Booked in the order day 6, day 2, day 4: booking order differs from
    // start order.
    const b6 = await book(s6.id);
    const b2 = await book(s2.id);
    const b4 = await book(s4.id);
    const mine = [b2, b4, b6];

    await section(
      'F2. Session lists: sortBy=start, stable paging',
      async () => {
        const mentorStart = only(
          ids(
            await sessions.getMentorSessions(
              BigInt(MENTOR),
              ORG,
              'upcoming',
              200,
              0,
              'asc',
              'start',
            ),
          ),
          mine,
        );
        report(
          'mentor upcoming, sortBy=start asc: next session first',
          same(mentorStart, [b2, b4, b6]),
          JSON.stringify(mentorStart),
        );
        const mentorStartDesc = only(
          ids(
            await sessions.getMentorSessions(
              BigInt(MENTOR),
              ORG,
              'upcoming',
              200,
              0,
              'desc',
              'start',
            ),
          ),
          mine,
        );
        report(
          'mentor upcoming, sortBy=start desc: latest session first',
          same(mentorStartDesc, [b6, b4, b2]),
          JSON.stringify(mentorStartDesc),
        );
        const mentorDefault = only(
          ids(
            await sessions.getMentorSessions(
              BigInt(MENTOR),
              ORG,
              'upcoming',
              200,
              0,
            ),
          ),
          mine,
        );
        report(
          'mentor default unchanged: newest booking first',
          same(mentorDefault, [b4, b2, b6]),
          JSON.stringify(mentorDefault),
        );
        const mentorBookedAsc = only(
          ids(
            await sessions.getMentorSessions(
              BigInt(MENTOR),
              ORG,
              'upcoming',
              200,
              0,
              'asc',
            ),
          ),
          mine,
        );
        report(
          'mentor sort=asc (booked): oldest booking first, as before',
          same(mentorBookedAsc, [b6, b2, b4]),
          JSON.stringify(mentorBookedAsc),
        );

        const studentStart = only(
          ids(
            await sessions.getStudentSessions(
              BigInt(STUDENT),
              'upcoming',
              200,
              0,
              'asc',
              'start',
            ),
          ),
          mine,
        );
        report(
          'student upcoming, sortBy=start asc: next session first',
          same(studentStart, [b2, b4, b6]),
          JSON.stringify(studentStart),
        );
        const studentDefault = only(
          ids(
            await sessions.getStudentSessions(
              BigInt(STUDENT),
              'upcoming',
              200,
              0,
            ),
          ),
          mine,
        );
        report(
          'student default unchanged: newest booking first',
          same(studentDefault, [b4, b2, b6]),
          JSON.stringify(studentDefault),
        );

        // Pages of 1 put together give the same list as one big page.
        const full = ids(
          await sessions.getMentorSessions(
            BigInt(MENTOR),
            ORG,
            'all',
            500,
            0,
            'asc',
            'start',
          ),
        );
        const paged: number[] = [];
        for (let offset = 0; offset < full.length + 1; offset++) {
          paged.push(
            ...ids(
              await sessions.getMentorSessions(
                BigInt(MENTOR),
                ORG,
                'all',
                1,
                offset,
                'asc',
                'start',
              ),
            ),
          );
        }
        report(
          'paging by start, one row at a time: no row skipped or repeated',
          same(paged, full) && new Set(full).size === full.length,
          `${full.length} row(s)`,
        );
      },
    );

    await section(
      'F3. Mentor metrics: live sessions are upcoming',
      async () => {
        const metrics = new MentorMetricsService();
        const upcoming = async (filter = 'all') =>
          (await metrics.getMentorMetrics(BigInt(MENTOR), ORG, filter)).sessions
            .upcoming;
        const before = await upcoming();

        // Make b2 a live session: its slot now runs from 10 minutes ago to
        // 35 minutes ahead, and it is IN_PROGRESS. Only this run's rows change.
        const now = Date.now();
        await db
          .update(schema.zuvyMentorSlotAvailability)
          .set({
            slotStartDateTime: new Date(now - 10 * MIN),
            slotEndDateTime: new Date(now + 35 * MIN),
          })
          .where(eq(schema.zuvyMentorSlotAvailability.id, s2.id));
        movedSlotIds.push(s2.id);
        await db
          .update(schema.zuvyMentorSlotBooking)
          .set({ sessionLifecycleState: 'IN_PROGRESS' })
          .where(eq(schema.zuvyMentorSlotBooking.id, b2));

        const live = await upcoming();
        report(
          'a live session still counts as upcoming (it dropped out before)',
          live === before,
          `${before} -> ${live}`,
        );
        const today = await upcoming('30d');
        report(
          'with a 30d period, the live session counts (it starts today)',
          today >= 1,
          `${today}`,
        );

        // Over: the slot ended 5 minutes ago -> no longer upcoming.
        await db
          .update(schema.zuvyMentorSlotAvailability)
          .set({
            slotStartDateTime: new Date(now - 50 * MIN),
            slotEndDateTime: new Date(now - 5 * MIN),
          })
          .where(eq(schema.zuvyMentorSlotAvailability.id, s2.id));
        const ended = await upcoming();
        report(
          'a session whose slot has ended is not upcoming',
          ended === before - 1,
          `${before} -> ${ended}`,
        );

        // Cancelled: b6 no longer upcoming.
        await svc.cancelBooking(
          b6,
          'E2E: follow-up metrics check',
          'mentor',
          MENTOR,
        );
        const afterCancel = await upcoming();
        report(
          'a cancelled session is not upcoming',
          afterCancel === ended - 1,
          `${ended} -> ${afterCancel}`,
        );

        const full: any = await metrics.getMentorMetrics(
          BigInt(MENTOR),
          ORG,
          '30d',
        );
        report(
          'a period always returns the full shape (filter, sessions.upcoming)',
          full.filter === '30d' &&
            typeof full.sessions?.upcoming === 'number' &&
            full.upcomingSessions === undefined &&
            !!full.ratings &&
            !!full.utilization,
          JSON.stringify(full.sessions),
        );
        // A mentor with no bookings at all: the shape used to change for an
        // empty period.
        const nobody: any = await metrics.getMentorMetrics(
          BigInt(MENTOR),
          999999999,
          '3m',
        );
        report(
          'an empty period keeps the full shape',
          nobody.filter === '3m' &&
            nobody.sessions.total === 0 &&
            nobody.sessions.upcoming === 0 &&
            nobody.upcomingSessions === undefined,
          JSON.stringify(nobody.sessions),
        );
      },
    );

    await section('F4. rules carry maxAcceptedReschedules', async () => {
      rules({ maxAcceptedReschedules: 2 });
      const m = await sessions.getMentorSessions(
        BigInt(MENTOR),
        ORG,
        'all',
        1,
        0,
      );
      const s = await sessions.getStudentSessions(BigInt(STUDENT), 'all', 1, 0);
      const e = await svc.getBookingEligibility(STUDENT);
      report(
        'mentor list, student list and eligibility all say 2',
        m.rules.maxAcceptedReschedules === 2 &&
          s.rules.maxAcceptedReschedules === 2 &&
          e.rules.maxAcceptedReschedules === 2,
        JSON.stringify([m.rules, s.rules, e.rules]),
      );
      rules();
    });

    await section('F5. Eligibility checks enrolment', async () => {
      const ok = await svc.getBookingEligibility(STUDENT);
      report(
        'an enrolled student: access allowed, can book',
        ok.access.allowed === true &&
          ok.access.code === null &&
          ok.credits.canBook === true &&
          ok.credits.blockReason === null,
        JSON.stringify({ access: ok.access, canBook: ok.credits.canBook }),
      );

      // Someone with no active enrolment (read only: nothing is written).
      const outsider = (
        await db.execute(sql`
          SELECT u.id FROM main.users u
          WHERE NOT EXISTS (
            SELECT 1 FROM main.zuvy_batch_enrollments e
            WHERE e.user_id = u.id AND e.status = 'active')
          ORDER BY u.id LIMIT 1`)
      ).rows[0]?.id;
      if (!outsider) {
        report('found a user with no active enrolment', false);
        return;
      }
      const no = await svc.getBookingEligibility(Number(outsider));
      report(
        'not enrolled: access refused, canBook false, blockReason MENTORSHIP_NOT_AVAILABLE',
        no.access.allowed === false &&
          no.access.code === 'MENTORSHIP_NOT_AVAILABLE' &&
          no.access.message ===
            'You are not enrolled in a course with mentorship access.' &&
          no.credits.canBook === false &&
          no.credits.blockReason === 'MENTORSHIP_NOT_AVAILABLE' &&
          no.credits.nextEligibleDate === null,
        JSON.stringify({ access: no.access, credits: no.credits }),
      );
      const preview = await svc.getBookingPreview(Number(outsider), s4.id);
      report(
        'the booking preview refuses with the same code and message',
        preview.blocked?.code === 'MENTORSHIP_NOT_AVAILABLE' &&
          preview.blocked?.message === no.access.message,
        JSON.stringify(preview.blocked),
      );
      let refused = '';
      try {
        await svc.bookSlot(Number(outsider), s4.id);
      } catch (error: any) {
        refused = `${error?.getStatus?.()} ${error.message}`;
      }
      report(
        'booking itself still refuses with 403 and the same message',
        refused === `403 ${no.access.message}`,
        refused,
      );
    });
  } finally {
    console.log('\n--- Clean-up ---');
    config.setOverridesForTesting(null);
    const slotIds = [
      ...new Set([
        ...(
          await db
            .select({ id: schema.zuvyMentorSlotAvailability.id })
            .from(schema.zuvyMentorSlotAvailability)
            .where(
              and(
                gte(
                  schema.zuvyMentorSlotAvailability.slotStartDateTime,
                  new Date(BASE),
                ),
                lt(
                  schema.zuvyMentorSlotAvailability.slotStartDateTime,
                  RANGE_END,
                ),
              ),
            )
        ).map((s: any) => s.id),
        ...movedSlotIds,
      ]),
    ];
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
      sql`SELECT (SELECT count(*) FROM main.zuvy_mentor_slot_availability WHERE slot_start_date_time >= ${new Date(BASE)} AND slot_start_date_time < ${RANGE_END})::int
             + (SELECT count(*) FROM main.license_assignments WHERE start_time >= ${new Date(BASE)} AND start_time < ${RANGE_END})::int
             + (SELECT count(*) FROM main.zuvy_mentor_slot_availability WHERE id IN (${sql.join(
               (movedSlotIds.length ? movedSlotIds : [0]).map(
                 (id: number) => sql`${id}`,
               ),
               sql`, `,
             )}))::int
             + (SELECT count(*) FROM main.zuvy_mentor_slot_booking WHERE id IN (${sql.join(
               (bookingIds.length ? bookingIds : [0]).map(
                 (id: number) => sql`${id}`,
               ),
               sql`, `,
             )}))::int AS n`,
    );
    report(
      'no test slots, bookings or licence holds left',
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
