/**
 * End-to-end check for the Zoom licence fixes and the connection pool, against
 * the DEV database only (refuses any other DB_NAME).
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/e2e-zoom-licence.ts
 *
 * Runs the real services, database, transactions and locks. Zoom is never
 * called: every Zoom method is replaced by a stub, and any Zoom method not
 * stubbed throws. Emails are stubbed. Test slots and classes sit 25-35 years
 * ahead so they never meet real data. Everything created is deleted at the
 * end, and the test student's credit row is restored byte for byte.
 *
 * Cancel note: the dev database's `zuvy_mentor_session_attendance` table is a
 * different, older table (see the plan doc), so the credit recount inside
 * cancelBooking fails on dev. Cancel cases run with that recount replaced by
 * a no-op (CANCEL_RECOUNT_STUBBED below). Everything else in cancel is real.
 *
 * Override the dev users with E2E_MENTOR_ID / E2E_STUDENT_ID / E2E_ORG_ID.
 */
// A module, so its names don't clash with the other e2e scripts' globals.
export {};

process.env.RECORDING_WORKER_ENABLED = 'false';
process.env.ATTENDANCE_WORKER_ENABLED = 'false';
process.env.MENTOR_ATTENDANCE_JOB_ENABLED = 'false';
process.env.GMAIL_MONITOR_ENABLED = 'false';

/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const { Client } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const { NestFactory } = require('@nestjs/core');
const { SchedulerRegistry } = require('@nestjs/schedule');
const { AppModule } = require('../src/app.module');
const {
  MentorSlotService,
} = require('../src/controller/mentor-slot/mentor-slot.service');
const {
  MentorRecurrenceService,
} = require('../src/controller/mentor-slot/recurrence/mentor-recurrence.service');
const { ClassesService } = require('../src/controller/classes/classes.service');
const { ConfigIndex } = require('../src/config/index');
const {
  ZOOM_LICENSE_COOLDOWN_MS,
} = require('../src/common/constants/zoom-license.constants');
const { db } = require('../src/db');
const schema = require('../drizzle/schema');
const {
  and,
  eq,
  gte,
  inArray,
  lt,
  ne,
  notInArray,
  sql,
} = require('drizzle-orm');

const MENTOR = Number(process.env.E2E_MENTOR_ID ?? 66142);
const STUDENT = Number(process.env.E2E_STUDENT_ID ?? 65757);
const ORG = Number(process.env.E2E_ORG_ID ?? 1);
const REASON = 'E2E licence test clean-up';
const CANCEL_RECOUNT_STUBBED = true;
const MIN = 60_000;
const LOG_DIR = process.env.E2E_LOG_DIR || '.';

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

// E2E_ONLY=G7 runs only the sections whose name starts with that prefix.
const ONLY = process.env.E2E_ONLY;
async function section(name: string, run: () => Promise<void>) {
  if (ONLY && !name.startsWith(ONLY)) return;
  console.log(`\n--- ${name} ---`);
  try {
    await run();
  } catch (error: any) {
    report(`${name}: stopped by an unexpected error`, false, error.message);
  }
}

async function expectRefused(
  label: string,
  run: () => Promise<any>,
  pattern: RegExp,
) {
  try {
    await run();
    report(label, false, 'was not refused');
  } catch (error: any) {
    report(label, pattern.test(error.message), error.message);
  }
}

// Far-future base day so nothing here meets real slots or classes.
// Chosen in main() so the 120-day range holds no existing slots or licence
// holds (other test scripts also park data far in the future).
let BASE = 0;
let RANGE_END = new Date(0);
async function pickEmptyRange() {
  for (let attempt = 0; attempt < 20; attempt++) {
    const d = new Date(
      Date.now() + (9200 + Math.floor(Math.random() * 3000)) * 86_400_000,
    );
    d.setUTCHours(0, 0, 0, 0);
    const from = d;
    const to = new Date(d.getTime() + 120 * 86_400_000);
    const busy = await db.execute(sql`
      SELECT (SELECT count(*) FROM main.zuvy_mentor_slot_availability
                WHERE slot_start_date_time >= ${from} AND slot_start_date_time < ${to})
           + (SELECT count(*) FROM main.license_assignments
                WHERE start_time >= ${from} AND start_time < ${to}) AS n`);
    if (Number(busy.rows[0].n) === 0) {
      BASE = from.getTime();
      RANGE_END = to;
      return;
    }
  }
  throw new Error(
    'Could not find an empty far-future date range for the test.',
  );
}
let dayCounter = 0;
const nextDay = () => (dayCounter += 2);
const at = (day: number, hhmm: string, plusMs = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(BASE + day * 86_400_000 + (h * 60 + m) * MIN + plusMs);
};
const iso = (d: Date) => d.toISOString();

const fillerIds: number[] = [];
const bookingIds: number[] = [];
const classSessionIds: number[] = [];
const extraSlotIds: number[] = [];

let svc: any;
let recurrence: any;
let classes: any;
let lic: any;
let mgmt: any;
let realRows: number[] = [];
let hosts: Array<{ id: number; email: string }> = [];
let secondStudent: number;
let poolSize: number;
let N: number;
let classBatch: any;
let metricsSnapshot: string | null = null;

/* ------------------------------------------------------------------ setup */

function blockZoom(zoomService: any, allowed: Record<string, any>) {
  const proto = Object.getPrototypeOf(zoomService);
  for (const key of Object.getOwnPropertyNames(proto)) {
    if (key === 'constructor' || typeof proto[key] !== 'function') continue;
    zoomService[key] =
      allowed[key] ??
      (async () => {
        throw new Error(`Zoom call blocked in licence e2e: ${key}`);
      });
  }
}

let meetingSeq = 0;
let failNextMeeting = false;
const zoomStubs = {
  getUser: async () => ({ success: true, data: { status: 'active' } }),
  createMeetingForUser: async () => {
    if (failNextMeeting) {
      failNextMeeting = false;
      return { success: false, error: 'E2E: Zoom is down' };
    }
    meetingSeq += 1;
    return {
      success: true,
      data: {
        id: 990000000 + meetingSeq,
        join_url: 'https://zoom.invalid/j',
        start_url: 'https://zoom.invalid/s',
        password: 'e2e',
      },
    };
  },
  getMeeting: async () => ({
    success: true,
    data: { uuid: `e2e-licence-${Date.now()}-${meetingSeq}` },
  }),
  deleteMeeting: async () => ({ success: true }),
  updateMeeting: async () => ({ success: true }),
};

// The credit row is saved and put back inside Postgres, so its
// `timestamp without time zone` columns are not shifted by this machine's
// UTC offset on the way through JS.
async function readStudentMetricsJson(): Promise<string | null> {
  const result = await db.execute(
    sql`SELECT row_to_json(m)::text AS j FROM main.zuvy_student_booking_metrics m WHERE m.user_id = ${STUDENT}`,
  );
  return result.rows[0]?.j ?? null;
}
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

async function filler(i: number, start: Date, end: Date, host = hosts[i].id) {
  const [r] = await db
    .insert(schema.licenseAssignments)
    .values({
      licenseId: realRows[i],
      instructorId: host,
      sourceType: 'mentor_slot',
      mentorSlotAvailabilityId: null,
      startTime: start,
      endTime: end,
    })
    .returning({ id: schema.licenseAssignments.id });
  fillerIds.push(Number(r.id));
}
// Every real licence busy (or all but `free`) in this window.
async function fillPool(start: Date, end: Date, free = 0) {
  for (let i = 0; i < N - free; i++) await filler(i, start, end);
}

async function createSlot(start: Date, end: Date, maxCapacity = 1) {
  const [slot] = await svc.createSlot(
    MENTOR,
    { slotStartDateTime: iso(start), slotEndDateTime: iso(end), maxCapacity },
    ORG,
  );
  return slot;
}

async function holdsFor(slotId: number) {
  return db
    .select()
    .from(schema.licenseAssignments)
    .where(eq(schema.licenseAssignments.mentorSlotAvailabilityId, slotId));
}
async function slotRow(slotId: number) {
  const [slot] = await db
    .select()
    .from(schema.zuvyMentorSlotAvailability)
    .where(eq(schema.zuvyMentorSlotAvailability.id, slotId));
  return slot;
}
async function bookingRow(bookingId: number) {
  const [b] = await db
    .select()
    .from(schema.zuvyMentorSlotBooking)
    .where(eq(schema.zuvyMentorSlotBooking.id, bookingId));
  return b;
}
async function bookingsOnSlot(slotId: number) {
  return db
    .select()
    .from(schema.zuvyMentorSlotBooking)
    .where(eq(schema.zuvyMentorSlotBooking.slotAvailabilityId, slotId));
}
async function alertsFor(bookingIdList: number[]) {
  if (!bookingIdList.length) return 0;
  const [{ n }] = await db
    .select({ n: sql`count(*)::int` })
    .from(schema.zuvyNotifications)
    .where(
      and(
        eq(schema.zuvyNotifications.referenceType, 'booking'),
        inArray(schema.zuvyNotifications.referenceId, bookingIdList),
      ),
    );
  return n;
}
// Slots that already existed in the test's date range before it started.
// They belong to someone else: never counted, never deleted.
const preexistingSlotIds = new Set<number>();
async function slotIdsInTestRange(): Promise<number[]> {
  return (
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
  ).map((r: any) => r.id);
}

async function slotsInDay(day: number) {
  const rows = await db
    .select()
    .from(schema.zuvyMentorSlotAvailability)
    .where(
      and(
        eq(schema.zuvyMentorSlotAvailability.mentorSlotManagementId, mgmt.id),
        gte(
          schema.zuvyMentorSlotAvailability.slotStartDateTime,
          at(day, '00:00'),
        ),
        lt(
          schema.zuvyMentorSlotAvailability.slotStartDateTime,
          at(day + 1, '00:00'),
        ),
      ),
    );
  return rows.filter((s: any) => !preexistingSlotIds.has(s.id));
}

// Real student booking through bookSlot. The credit row is reset first so
// earlier test bookings don't put the student in the booking cooldown.
async function realBooking(slotId: number) {
  await restoreStudentMetrics();
  const booked = await svc.bookSlot(STUDENT, slotId);
  bookingIds.push(booked.id);
  return booked.id as number;
}

// A booking made the way bookSlot makes it (row + licence in one
// transaction), without the student credit checks, for cases that need more
// bookings than one student's credits allow.
async function fixtureBooking(slotId: number, studentId = secondStudent) {
  return db.transaction(async (trx: any) => {
    const [slot] = await trx
      .select()
      .from(schema.zuvyMentorSlotAvailability)
      .where(eq(schema.zuvyMentorSlotAvailability.id, slotId))
      .for('update');
    await svc.ensureMentorSlotLicenseAssignment(trx, slot, mgmt);
    const [booking] = await trx
      .insert(schema.zuvyMentorSlotBooking)
      .values({
        slotAvailabilityId: slotId,
        studentUserId: BigInt(studentId),
        mentorUserId: BigInt(MENTOR),
        organizationId: mgmt.organizationId,
        status: 'confirmed',
        confirmedAt: new Date(),
        sessionLifecycleState: 'SCHEDULED',
      })
      .returning();
    const count = slot.currentBookedCount + 1;
    await trx
      .update(schema.zuvyMentorSlotAvailability)
      .set({
        currentBookedCount: count,
        status: count >= slot.maxCapacity ? 'full' : 'available',
      })
      .where(eq(schema.zuvyMentorSlotAvailability.id, slotId));
    bookingIds.push(booking.id);
    return booking.id as number;
  });
}

// A hold the old code made when a slot was created.
async function legacyHold(slot: any) {
  const [r] = await db
    .insert(schema.licenseAssignments)
    .values({
      licenseId: realRows[N - 1],
      instructorId: MENTOR,
      sourceType: 'mentor_slot',
      mentorSlotAvailabilityId: slot.id,
      startTime: new Date(slot.slotStartDateTime),
      endTime: new Date(slot.slotEndDateTime),
    })
    .returning({ id: schema.licenseAssignments.id });
  return Number(r.id);
}

async function proposeFixture(bookingId: number, toSlotId: number) {
  await db
    .update(schema.zuvyMentorSlotBooking)
    .set({
      rescheduleStatus: 'pending',
      rescheduleRequestedAt: new Date(),
      rescheduleProposedSlotId: toSlotId,
      sessionLifecycleState: 'RESCHEDULE_PENDING',
    })
    .where(eq(schema.zuvyMentorSlotBooking.id, bookingId));
}

// Licence allocation the way a class makes it: assignLicense + the
// assignment row, in one transaction on the given handle.
const allocate = (handle: any, host: number, start: Date, end: Date) =>
  handle.transaction(async (trx: any) => {
    const licenseId = await lic.assignLicense(trx, {
      instructorId: host,
      startTime: start,
      endTime: end,
    });
    const [r] = await trx
      .insert(schema.licenseAssignments)
      .values({
        licenseId,
        instructorId: host,
        sourceType: 'mentor_slot',
        startTime: start,
        endTime: end,
      })
      .returning({ id: schema.licenseAssignments.id });
    fillerIds.push(Number(r.id));
    return licenseId;
  });

const runScript = (args: string) => {
  try {
    return {
      code: 0,
      out: execSync(
        `npx ts-node -r tsconfig-paths/register --transpile-only scripts/release-unbooked-mentor-slot-licences.ts ${args}`,
        {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          timeout: 300_000,
        },
      ),
    };
  } catch (error: any) {
    return { code: error.status ?? 1, out: `${error.stdout}${error.stderr}` };
  }
};
const listedIn = (out: string, id: number) =>
  out
    .split('\n')
    .some((line) => new RegExp(`[│|]\\s*${id}\\s*[│|]`).test(line));

/* ------------------------------------------------------------------ tests */

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
  recurrence = app.get(MentorRecurrenceService);
  classes = app.get(ClassesService);
  lic = svc.zoomLicenseService;

  const zoomServices = new Set(
    [
      svc.zoomService,
      lic.zoomService,
      recurrence.zoomLicenseService.zoomService,
      classes.zoomService,
      classes.zoomLicenseService?.zoomService,
    ].filter(Boolean),
  );
  zoomServices.forEach((z) => blockZoom(z, zoomStubs));
  for (const licenceService of new Set(
    [lic, recurrence.zoomLicenseService, classes.zoomLicenseService].filter(
      Boolean,
    ),
  )) {
    licenceService.syncLicensedUsersFromZoom = async () => 0;
    licenceService.ensureHostLicensedForWindow = async () => undefined;
  }
  svc.emailService.sendEmail = async () => undefined;

  const realRecount = svc.recomputeStudentBookingMetrics.bind(svc);
  let recountShouldThrow = false;
  if (CANCEL_RECOUNT_STUBBED) {
    svc.recomputeStudentBookingMetrics = async () => {
      if (recountShouldThrow) {
        recountShouldThrow = false;
        throw new Error('E2E: forced failure late in cancel');
      }
    };
  }
  void realRecount;

  [mgmt] = await db
    .select()
    .from(schema.zuvyMentorSlotManagement)
    .where(
      and(
        eq(schema.zuvyMentorSlotManagement.mentorUserId, BigInt(MENTOR)),
        eq(schema.zuvyMentorSlotManagement.organizationId, ORG),
      ),
    )
    .limit(1);

  const protectedEmails = Array.from(
    await lic.getProtectedLicenseEmails(db),
  ) as string[];
  realRows = (
    await db
      .select({ id: schema.zuvyUserLicenses.id })
      .from(schema.zuvyUserLicenses)
      .where(
        and(
          eq(schema.zuvyUserLicenses.status, 'active'),
          eq(schema.zuvyUserLicenses.licenseType, 2),
          eq(schema.zuvyUserLicenses.isProtected, false),
        ),
      )
      .orderBy(schema.zuvyUserLicenses.id)
  ).map((r: any) => Number(r.id));
  N = realRows.length;
  poolSize = await lic.getTransferableLicensePoolCount(db);

  hosts = (
    await db
      .select({ id: schema.users.id, email: schema.users.email })
      .from(schema.users)
      .where(
        and(
          notInArray(schema.users.id, [BigInt(MENTOR), BigInt(STUDENT)]),
          sql`${schema.users.email} IS NOT NULL`,
          protectedEmails.length
            ? notInArray(sql`lower(${schema.users.email})`, protectedEmails)
            : sql`1 = 1`,
        ),
      )
      .orderBy(sql`${schema.users.id} DESC`)
      .limit(N + 16)
  ).map((u: any) => ({
    id: Number(u.id),
    email: String(u.email).toLowerCase(),
  }));

  const [second] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(
      and(
        notInArray(schema.users.id, [BigInt(MENTOR), BigInt(STUDENT)]),
        sql`NOT EXISTS (SELECT 1 FROM main.zuvy_mentor_slot_booking b WHERE b.student_user_id = ${schema.users.id})`,
        sql`NOT EXISTS (SELECT 1 FROM main.zuvy_student_booking_metrics m WHERE m.user_id = ${schema.users.id})`,
      ),
    )
    .orderBy(sql`${schema.users.id} DESC`)
    .limit(1);
  secondStudent = Number(second.id);

  const batchRows = await db.execute(sql`
    SELECT b.id AS batch_id, b.bootcamp_id, b.instructor_id, lower(u.email) AS instructor_email,
      (SELECT m.id FROM main.zuvy_course_modules m WHERE m.bootcamp_id = b.bootcamp_id ORDER BY m.id LIMIT 1) AS module_id,
      (SELECT mc.id FROM main.zuvy_module_chapter mc JOIN main.zuvy_course_modules m ON m.id = mc.module_id
        WHERE m.bootcamp_id = b.bootcamp_id ORDER BY mc.id LIMIT 1) AS chapter_id
    FROM main.zuvy_batches b JOIN main.users u ON u.id = b.instructor_id
    WHERE b.instructor_id NOT IN (${MENTOR}, ${STUDENT}) AND u.email IS NOT NULL
    ORDER BY b.id DESC LIMIT 20`);
  classBatch = batchRows.rows.find(
    (r: any) =>
      r.module_id &&
      r.chapter_id &&
      !protectedEmails.includes(String(r.instructor_email)),
  );

  metricsSnapshot = await readStudentMetricsJson();
  await pickEmptyRange();
  (await slotIdsInTestRange()).forEach((id) => preexistingSlotIds.add(id));

  console.log(
    `Pool size ${poolSize}, real licences ${N}, cooldown ${ZOOM_LICENSE_COOLDOWN_MS / MIN} min, base day ${iso(new Date(BASE)).slice(0, 10)}, cancel recount stubbed: ${CANCEL_RECOUNT_STUBBED}`,
  );
  if (!mgmt || N < 4 || poolSize < 2 || hosts.length < N + 14 || !classBatch) {
    console.log('Refusing: dev data does not meet the test prerequisites.');
    await app.close();
    process.exit(1);
  }

  try {
    /* ============================================ A. Creating slots */

    await section('A1. Creating a slot reserves no licence', async () => {
      const d = nextDay();
      const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
      report('slot created', !!slot?.id, `slot ${slot?.id}`);
      report(
        'no licence hold for the open slot',
        (await holdsFor(slot.id)).length === 0,
      );
      report(
        'slot is open',
        slot.status === 'available' && slot.currentBookedCount === 0,
      );
    });

    await section('A2. Pool full: slot refused, nothing written', async () => {
      const d = nextDay();
      await fillPool(at(d, '10:00'), at(d, '11:00'));
      await expectRefused(
        'slot inside the busy hour is refused',
        () => createSlot(at(d, '10:15'), at(d, '10:45')),
        /No Zoom licence is free at this time\. The next free time is/,
      );
      await expectRefused(
        "slot overlapping only the busy hour's start is refused",
        () => createSlot(at(d, '09:45'), at(d, '10:15')),
        /No Zoom licence is free/,
      );
      report(
        'no slot row was created that day',
        (await slotsInDay(d)).length === 0,
      );
    });

    await section('A3. Cooldown boundary', async () => {
      const d = nextDay();
      await fillPool(at(d, '10:00'), at(d, '11:00'));
      const freeAt = new Date(
        at(d, '11:00').getTime() + ZOOM_LICENSE_COOLDOWN_MS,
      );
      await expectRefused(
        'slot starting 1 minute before the cooldown ends is refused',
        () =>
          createSlot(
            new Date(freeAt.getTime() - MIN),
            new Date(freeAt.getTime() + 29 * MIN),
          ),
        /No Zoom licence is free/,
      );
      const ok = await createSlot(
        freeAt,
        new Date(freeAt.getTime() + 30 * MIN),
      );
      report(
        'slot starting exactly when the cooldown ends is created',
        !!ok?.id,
      );
      const ending = await createSlot(at(d, '09:00'), at(d, '10:00'));
      report(
        'slot ending exactly when the busy hour starts is created',
        !!ending?.id,
      );
    });

    await section('A4. Recurring slots', async () => {
      const d = nextDay();
      const rule = (start: Date, count: number) =>
        `DTSTART:${iso(start).replace(/[-:]/g, '').slice(0, 15)}Z\nRRULE:FREQ=DAILY;COUNT=${count}`;
      // All free: 3 slots, no holds.
      await recurrence.generateRecurringSlots(
        {
          mentorSlotManagementId: mgmt.id,
          slotStart: at(d, '08:00'),
          slotEnd: at(d, '08:30'),
          recurrenceRule: rule(at(d, '08:00'), 3),
          recurrenceEndDate: at(d + 3, '00:00'),
        },
        MENTOR,
      );
      const created = [
        ...(await slotsInDay(d)),
        ...(await slotsInDay(d + 1)),
        ...(await slotsInDay(d + 2)),
      ].filter((s: any) => new Date(s.slotStartDateTime).getUTCHours() === 8);
      report(
        '3 recurring slots created when licences are free',
        created.length === 3,
        `${created.length}`,
      );
      const holds = (
        await Promise.all(created.map((s: any) => holdsFor(s.id)))
      ).flat();
      report('recurring slots reserve no licence', holds.length === 0);

      // Two of three days full: nothing created, both days listed.
      const e = nextDay() + 3;
      dayCounter += 3;
      await fillPool(at(e, '12:00'), at(e, '13:00'));
      await fillPool(at(e + 2, '12:00'), at(e + 2, '13:00'));
      await expectRefused(
        'recurrence with 2 busy days is refused, listing both',
        () =>
          recurrence.generateRecurringSlots(
            {
              mentorSlotManagementId: mgmt.id,
              slotStart: at(e, '12:15'),
              slotEnd: at(e, '12:45'),
              recurrenceRule: rule(at(e, '12:15'), 3),
              recurrenceEndDate: at(e + 3, '00:00'),
            },
            MENTOR,
          ),
        /No Zoom licence is free for 2 of these slot times: .+, .+\./,
      );
      const any = [
        ...(await slotsInDay(e)),
        ...(await slotsInDay(e + 1)),
        ...(await slotsInDay(e + 2)),
      ];
      report(
        'refused recurrence created no slots, not even on the free day',
        any.length === 0,
        `${any.length}`,
      );
    });

    await section('A5. Licence-check endpoint (service method)', async () => {
      const d = nextDay();
      await fillPool(at(d, '10:00'), at(d, '11:00'));
      const full = await svc.checkSlotLicenceAvailability(
        MENTOR,
        iso(at(d, '10:15')),
        iso(at(d, '10:45')),
      );
      const expectedNext = at(d, '11:00', ZOOM_LICENSE_COOLDOWN_MS);
      report(
        'busy time: unavailable, next free time = end + cooldown, with a message',
        full.available === false &&
          new Date(full.nextAvailableAt).getTime() === expectedNext.getTime() &&
          /next free time/.test(full.message || ''),
        `next ${full.nextAvailableAt && iso(new Date(full.nextAvailableAt))}`,
      );
      const free = await svc.checkSlotLicenceAvailability(
        MENTOR,
        iso(at(d, '14:00')),
        iso(at(d, '14:30')),
      );
      report(
        'free time: available, no message',
        free.available === true && free.message === null,
      );
      const before = (await slotsInDay(d)).length;
      report('the check reserves nothing and creates nothing', before === 0);
      await expectRefused(
        'end before start is refused',
        () =>
          svc.checkSlotLicenceAvailability(
            MENTOR,
            iso(at(d, '11:00')),
            iso(at(d, '10:00')),
          ),
        /Invalid time range/,
      );
      await expectRefused(
        'end equal to start is refused',
        () =>
          svc.checkSlotLicenceAvailability(
            MENTOR,
            iso(at(d, '11:00')),
            iso(at(d, '11:00')),
          ),
        /Invalid time range/,
      );
      await expectRefused(
        'unparseable dates are refused',
        () =>
          svc.checkSlotLicenceAvailability(MENTOR, 'not-a-date', 'also-not'),
        /Invalid time range/,
      );
      await expectRefused(
        'missing dates are refused',
        () => svc.checkSlotLicenceAvailability(MENTOR, undefined, undefined),
        /Invalid time range/,
      );
      await expectRefused(
        'a non-mentor (the student) is refused',
        () =>
          svc.checkSlotLicenceAvailability(
            STUDENT,
            iso(at(d, '14:00')),
            iso(at(d, '14:30')),
          ),
        /./,
      );
    });

    await section('A6. Protected host has its own pool of one', async () => {
      const [protectedUser] = protectedEmails.length
        ? await db
            .select({ id: schema.users.id })
            .from(schema.users)
            .where(inArray(sql`lower(${schema.users.email})`, protectedEmails))
            .limit(1)
        : [];
      if (!protectedUser) {
        console.log('SKIP — no user in dev has a protected licence email');
        return;
      }
      const d = nextDay();
      await fillPool(at(d, '10:00'), at(d, '11:00'));
      const own = await db.transaction((trx: any) =>
        lic.checkLicenseAvailability(trx, {
          instructorId: Number(protectedUser.id),
          startTime: at(d, '10:00'),
          endTime: at(d, '11:00'),
        }),
      );
      report(
        'protected host is free even when the shared pool is full',
        own.available === true && own.poolSize === 1,
      );
    });

    /* ============================================ B. Booking */

    let sharedLicence: number | null = null;
    await section(
      'B1+B2. Booking reserves; back-to-back slots share a licence',
      async () => {
        const d = nextDay();
        await fillPool(at(d, '10:00'), at(d, '11:00'), 1);
        const slotA = await createSlot(at(d, '10:00'), at(d, '10:30'));
        const bookingId = await realBooking(slotA.id);
        const holdsA = await holdsFor(slotA.id);
        sharedLicence = holdsA[0] ? Number(holdsA[0].licenseId) : null;
        report(
          'booking reserved exactly one licence',
          holdsA.length === 1,
          `licence ${sharedLicence}`,
        );
        report(
          'hold covers the slot time',
          holdsA.length === 1 &&
            new Date(holdsA[0].startTime).getTime() ===
              at(d, '10:00').getTime() &&
            new Date(holdsA[0].endTime).getTime() === at(d, '10:30').getTime(),
        );
        report(
          'mentor and student alerts saved with the booking',
          (await alertsFor([bookingId])) === 2,
        );
        report('slot is now full', (await slotRow(slotA.id)).status === 'full');

        const slotB = await createSlot(at(d, '10:30'), at(d, '11:00'));
        report(
          "the mentor's back-to-back slot B is allowed while only A's licence is free",
          !!slotB?.id,
        );
        const other = await db.transaction((trx: any) =>
          lic.checkLicenseAvailability(trx, {
            instructorId: hosts[N].id,
            startTime: at(d, '10:30'),
            endTime: at(d, '11:00'),
          }),
        );
        report(
          'another host at the same time is still refused',
          other.available === false,
        );
        await expectRefused(
          "the mentor's overlapping slot is still refused (existing overlap rule)",
          () => createSlot(at(d, '10:15'), at(d, '10:45')),
          /overlaps with another mentor slot/,
        );
        await fixtureBooking(slotB.id);
        const holdsB = await holdsFor(slotB.id);
        report(
          "booking slot B reuses slot A's licence",
          holdsB.length === 1 && Number(holdsB[0].licenseId) === sharedLicence,
          `A ${sharedLicence}, B ${holdsB[0]?.licenseId}`,
        );
      },
    );

    await section('B3. Slot that already has an old-style hold', async () => {
      const d = nextDay();
      const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
      await legacyHold(slot);
      await realBooking(slot.id);
      report(
        'booking does not add a second hold',
        (await holdsFor(slot.id)).length === 1,
      );
    });

    await section(
      'B4. A class took the last licence after the slot was created',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await fillPool(at(d, '10:00'), at(d, '11:00'));
        await restoreStudentMetrics();
        const before = await readStudentMetricsJson();
        await expectRefused(
          'student gets the clear "no meeting licence" message',
          () => svc.bookSlot(STUDENT, slot.id),
          /no meeting licence is free at that time\. Please pick another slot\./,
        );
        const s = await slotRow(slot.id);
        report('no booking row', (await bookingsOnSlot(slot.id)).length === 0);
        report(
          'slot still open, count 0',
          s.status === 'available' && s.currentBookedCount === 0,
        );
        report('no hold', (await holdsFor(slot.id)).length === 0);
        report(
          'student credits unchanged',
          (await readStudentMetricsJson()) === before,
        );
      },
    );

    await section(
      'B5. Zoom fails during booking: everything rolls back',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await restoreStudentMetrics();
        const before = await readStudentMetricsJson();
        const [{ maxAlert }] = await db
          .select({ maxAlert: sql`coalesce(max(id),0)::int` })
          .from(schema.zuvyNotifications);
        failNextMeeting = true;
        await expectRefused(
          'booking fails with a clear message',
          () => svc.bookSlot(STUDENT, slot.id),
          /Unable to schedule session/,
        );
        const s = await slotRow(slot.id);
        report('no booking row', (await bookingsOnSlot(slot.id)).length === 0);
        report('no hold', (await holdsFor(slot.id)).length === 0);
        report(
          'slot count unchanged',
          s.currentBookedCount === 0 && s.status === 'available',
        );
        report(
          'student credits unchanged',
          (await readStudentMetricsJson()) === before,
        );
        const [{ newAlerts }] = await db
          .select({ newAlerts: sql`count(*)::int` })
          .from(schema.zuvyNotifications)
          .where(
            and(
              sql`${schema.zuvyNotifications.id} > ${maxAlert}`,
              inArray(schema.zuvyNotifications.userId, [
                BigInt(MENTOR),
                BigInt(STUDENT),
              ]),
            ),
          );
        report(
          'no "Session confirmed" alert left behind (was a bug)',
          newAlerts === 0,
          `${newAlerts} new alerts`,
        );
      },
    );

    await section(
      'B6. Two booking requests for one slot at the same moment',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await restoreStudentMetrics();
        const results = await Promise.allSettled([
          svc.bookSlot(STUDENT, slot.id),
          svc.bookSlot(STUDENT, slot.id),
        ]);
        results.forEach(
          (r: any) => r.status === 'fulfilled' && bookingIds.push(r.value.id),
        );
        const won = results.filter((r) => r.status === 'fulfilled').length;
        report(
          'exactly one wins',
          won === 1,
          results
            .map((r: any) =>
              r.status === 'fulfilled' ? 'won' : r.reason?.message,
            )
            .join(' | '),
        );
        report(
          'one booking row, one hold',
          (await bookingsOnSlot(slot.id)).length === 1 &&
            (await holdsFor(slot.id)).length === 1,
        );
        report(
          'slot count is 1',
          (await slotRow(slot.id)).currentBookedCount === 1,
        );
      },
    );

    /* ============================================ C. Cancel */

    await section('C1. Cancel gives the licence back', async () => {
      const d = nextDay();
      const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
      const bookingId = await realBooking(slot.id);
      await svc.cancelBooking(bookingId, REASON, 'student', STUDENT);
      report('hold removed', (await holdsFor(slot.id)).length === 0);
      report(
        'slot open again',
        (await slotRow(slot.id)).status === 'available',
      );
      report(
        'booking cancelled',
        (await bookingRow(bookingId)).status === 'cancelled',
      );
      report(
        'freed licence can be used by another host straight away',
        (
          await db.transaction((trx: any) =>
            lic.checkLicenseAvailability(trx, {
              instructorId: hosts[N].id,
              startTime: at(d, '10:00'),
              endTime: at(d, '10:30'),
            }),
          )
        ).available === true,
      );
    });

    await section(
      'C2. Slot for 2 keeps its licence until the last cancel',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'), 2);
        const b1 = await fixtureBooking(slot.id, STUDENT);
        const b2 = await fixtureBooking(slot.id);
        report(
          'two bookings share one hold',
          (await holdsFor(slot.id)).length === 1,
        );
        await svc.cancelBooking(b1, REASON, 'mentor', MENTOR);
        report(
          'hold kept while one booking remains',
          (await holdsFor(slot.id)).length === 1,
        );
        await svc.cancelBooking(b2, REASON, 'mentor', MENTOR);
        report(
          'hold released after the last cancel',
          (await holdsFor(slot.id)).length === 0,
        );
      },
    );

    await section('C3. Cancelling twice', async () => {
      const d = nextDay();
      const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
      const b = await fixtureBooking(slot.id);
      await svc.cancelBooking(b, REASON, 'mentor', MENTOR);
      await expectRefused(
        'second cancel is refused',
        () => svc.cancelBooking(b, REASON, 'mentor', MENTOR),
        /already cancelled/,
      );
      const s = await slotRow(slot.id);
      report(
        'slot count not pushed below 0',
        s.currentBookedCount === 0,
        `${s.currentBookedCount}`,
      );
    });

    await section(
      'C4. Two cancels of one booking at the same moment',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'), 2);
        const keep = await fixtureBooking(slot.id, STUDENT);
        const b = await fixtureBooking(slot.id);
        const results = await Promise.allSettled([
          svc.cancelBooking(b, REASON, 'mentor', MENTOR),
          svc.cancelBooking(b, REASON, 'mentor', MENTOR),
        ]);
        const won = results.filter((r) => r.status === 'fulfilled').length;
        report(
          'exactly one cancel succeeds',
          won === 1,
          results
            .map((r: any) =>
              r.status === 'fulfilled' ? 'ok' : r.reason?.message,
            )
            .join(' | '),
        );
        const s = await slotRow(slot.id);
        report(
          'slot count dropped by exactly one',
          s.currentBookedCount === 1,
          `${s.currentBookedCount}`,
        );
        report(
          'the other booking keeps the hold',
          (await holdsFor(slot.id)).length === 1 &&
            (await bookingRow(keep)).status === 'confirmed',
        );
      },
    );

    await section(
      'C5. Cancel that fails late rolls back the licence release too',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        const b = await fixtureBooking(slot.id);
        recountShouldThrow = true;
        await expectRefused(
          'cancel fails',
          () => svc.cancelBooking(b, REASON, 'mentor', MENTOR),
          /forced failure/,
        );
        report(
          'booking still confirmed',
          (await bookingRow(b)).status === 'confirmed',
        );
        report('hold still there', (await holdsFor(slot.id)).length === 1);
        report('slot still full', (await slotRow(slot.id)).status === 'full');
      },
    );

    /* ============================================ D. Reschedule */

    await section('D1. Accept moves the licence', async () => {
      const d = nextDay();
      const from = await createSlot(at(d, '10:00'), at(d, '10:30'));
      const to = await createSlot(at(d, '12:00'), at(d, '12:30'));
      const b = await fixtureBooking(from.id);
      await proposeFixture(b, to.id);
      await svc.acceptReschedule(b, MENTOR, ORG);
      report(
        'old slot released its licence',
        (await holdsFor(from.id)).length === 0,
      );
      report(
        'new slot holds one licence',
        (await holdsFor(to.id)).length === 1,
      );
      report(
        'old slot open, new slot full',
        (await slotRow(from.id)).status === 'available' &&
          (await slotRow(to.id)).status === 'full',
      );
    });

    await section(
      'D2. Accept when the old slot still has another booking',
      async () => {
        const d = nextDay();
        const from = await createSlot(at(d, '10:00'), at(d, '10:30'), 2);
        const to = await createSlot(at(d, '12:00'), at(d, '12:30'));
        await fixtureBooking(from.id, STUDENT);
        const b = await fixtureBooking(from.id);
        await proposeFixture(b, to.id);
        await svc.acceptReschedule(b, MENTOR, ORG);
        report(
          'old slot keeps its licence for the remaining booking',
          (await holdsFor(from.id)).length === 1,
        );
        report(
          'new slot holds one licence',
          (await holdsFor(to.id)).length === 1,
        );
      },
    );

    await section('D3. Accept onto a slot with an old-style hold', async () => {
      const d = nextDay();
      const from = await createSlot(at(d, '10:00'), at(d, '10:30'));
      const to = await createSlot(at(d, '12:00'), at(d, '12:30'));
      await legacyHold(to);
      const b = await fixtureBooking(from.id);
      await proposeFixture(b, to.id);
      await svc.acceptReschedule(b, MENTOR, ORG);
      report(
        'no second hold on the new slot',
        (await holdsFor(to.id)).length === 1,
      );
    });

    await section('D4. Decline changes no licences', async () => {
      const d = nextDay();
      const from = await createSlot(at(d, '10:00'), at(d, '10:30'));
      const to = await createSlot(at(d, '12:00'), at(d, '12:30'));
      const b = await fixtureBooking(from.id);
      await proposeFixture(b, to.id);
      await svc.declineReschedule(b, MENTOR, ORG);
      report(
        'old slot keeps its hold, new slot has none',
        (await holdsFor(from.id)).length === 1 &&
          (await holdsFor(to.id)).length === 0,
      );
    });

    await section('D5. Accept refused (new slot full) rolls back', async () => {
      const d = nextDay();
      const from = await createSlot(at(d, '10:00'), at(d, '10:30'));
      const to = await createSlot(at(d, '12:00'), at(d, '12:30'));
      const b = await fixtureBooking(from.id);
      await fixtureBooking(to.id, STUDENT);
      await proposeFixture(b, to.id);
      await expectRefused(
        'accept is refused',
        () => svc.acceptReschedule(b, MENTOR, ORG),
        /full/i,
      );
      report('old slot keeps its hold', (await holdsFor(from.id)).length === 1);
      report(
        'new slot still has exactly its own hold',
        (await holdsFor(to.id)).length === 1,
      );
      report(
        'booking still on the old slot',
        (await bookingRow(b)).slotAvailabilityId === from.id,
      );
    });

    /* ============================================ E. Removing slots */

    await section('E. Removing open slots', async () => {
      const d = nextDay();
      const plain = await createSlot(at(d, '10:00'), at(d, '10:30'));
      await svc.removeSlot(MENTOR, plain.id, ORG);
      report('open slot without a hold is removed', !(await slotRow(plain.id)));
      const old = await createSlot(at(d, '12:00'), at(d, '12:30'));
      const holdId = await legacyHold(old);
      await svc.removeSlot(MENTOR, old.id, ORG);
      const [left] = await db
        .select()
        .from(schema.licenseAssignments)
        .where(eq(schema.licenseAssignments.id, holdId));
      report(
        'removing a slot with an old-style hold removes the hold too',
        !(await slotRow(old.id)) && !left,
      );
      const booked = await createSlot(at(d, '14:00'), at(d, '14:30'));
      await fixtureBooking(booked.id);
      await expectRefused(
        'booked slot cannot be removed',
        () => svc.removeSlot(MENTOR, booked.id, ORG),
        /Booked slots cannot be deleted/,
      );
      report(
        'booked slot keeps its hold',
        (await holdsFor(booked.id)).length === 1,
      );
    });

    /* ============================================ F. Classes */

    await section('F1. Peak count instead of touching count', async () => {
      const d = nextDay();
      for (let i = 0; i < N; i++) {
        const start = at(d, '10:00', i * 10 * MIN);
        await filler(i, start, new Date(start.getTime() + 6 * MIN));
      }
      const window = {
        start: at(d, '10:00'),
        end: at(d, '10:00', N * 10 * MIN),
      };
      const teacher = hosts[N + 1];
      const fit = await db.transaction((trx: any) =>
        lic.canFitInPool(
          trx,
          { startTime: window.start, endTime: window.end },
          teacher.email,
        ),
      );
      report(
        'class next to back-to-back sessions fits (old count refused it)',
        fit.fits === true && fit.peakInUse === 1,
        `old count would be ${N} vs pool ${poolSize}, peak ${fit.peakInUse}`,
      );
      const e = nextDay();
      await fillPool(at(e, '10:00'), at(e, '11:00'));
      const full = await db.transaction((trx: any) =>
        lic.canFitInPool(
          trx,
          { startTime: at(e, '10:00'), endTime: at(e, '11:00') },
          teacher.email,
        ),
      );
      report(
        'a really full hour does not fit',
        full.fits === false,
        `peak ${full.peakInUse}`,
      );
      const g = nextDay();
      await filler(0, at(g, '10:00'), at(g, '10:30'), teacher.id);
      await filler(1, at(g, '10:00'), at(g, '11:00'));
      const own = await db.transaction((trx: any) =>
        lic.canFitInPool(
          trx,
          { startTime: at(g, '10:30'), endTime: at(g, '11:00') },
          teacher.email,
        ),
      );
      report(
        "a teacher's back-to-back class shares their own licence",
        own.fits === true,
        `peak ${own.peakInUse}, pool ${poolSize}`,
      );
    });

    await section(
      'F2. Saving a class (the check just before it is saved)',
      async () => {
        const save = async (day: number, label: string) => {
          const result = await classes.saveSessionsToDatabase([
            {
              meetingId: 'e2e-licence',
              hangoutLink: 'https://zoom.invalid/j',
              creator: 'e2e@zuvy.invalid',
              startTime: iso(at(day, '10:00')),
              endTime: iso(at(day, '11:00')),
              batchId: classBatch.batch_id,
              bootcampId: classBatch.bootcamp_id,
              moduleId: classBatch.module_id,
              chapterId: classBatch.chapter_id,
              title: `E2E licence test ${label}`,
              isZoomMeet: true,
              licenseId: realRows[N - 1],
            },
          ]);
          (result.data || []).forEach((s: any) =>
            classSessionIds.push(Number(s.id)),
          );
          return result;
        };
        const d = nextDay();
        for (let i = 0; i < poolSize; i++) {
          const start = at(d, '10:00', i * 20 * MIN);
          await filler(i, start, new Date(start.getTime() + 15 * MIN));
        }
        const ok = await save(d, 'fits');
        report(
          'class saved when sessions only run one after another',
          ok.status === 'success',
          ok.message || ok.error,
        );
        const [assignment] = ok.data?.[0]
          ? await db
              .select()
              .from(schema.licenseAssignments)
              .where(eq(schema.licenseAssignments.sessionId, ok.data[0].id))
          : [];
        report(
          'class licence assignment recorded',
          !!assignment && assignment.sourceType === 'class_session',
        );

        const e = nextDay();
        for (let i = 0; i < poolSize; i++)
          await filler(i, at(e, '10:00'), at(e, '11:00'));
        const no = await save(e, 'full');
        report(
          'class refused when the pool is full at the same moment',
          no.status === 'error' &&
            /No Zoom licenses available/.test(no.message || ''),
          no.message,
        );
        const rows = await db.execute(
          sql`SELECT count(*)::int AS n FROM main.zuvy_sessions WHERE title = 'E2E licence test full'`,
        );
        report('refused class left no session row', rows.rows[0].n === 0);
      },
    );

    await section(
      'F3. Class warns about open mentor slots it affects',
      async () => {
        const d = nextDay();
        for (let i = 0; i < poolSize - 1; i++)
          await filler(i, at(d, '10:00'), at(d, '11:00'));
        const atRisk = await createSlot(at(d, '10:00'), at(d, '10:30'));
        const held = await createSlot(at(d, '10:30'), at(d, '11:00'));
        await legacyHold(held);
        const booked = await createSlot(at(d, '12:00'), at(d, '12:30'));
        await fixtureBooking(booked.id);
        const e = nextDay();
        const safe = await createSlot(at(e, '10:00'), at(e, '10:30'));
        const teacherEmail = hosts[N + 1].email;
        const risky = await db.transaction((trx: any) =>
          lic.findOpenMentorSlotsAtRisk(
            trx,
            { startTime: at(d, '10:00'), endTime: at(d, '13:00') },
            teacherEmail,
          ),
        );
        const ids = risky.map((s: any) => s.slotId);
        report(
          'open slot that would lose its licence is listed',
          ids.includes(atRisk.id),
          `${ids.length} listed`,
        );
        report(
          'slot that already holds a licence is not listed',
          !ids.includes(held.id),
        );
        report('booked slot is not listed', !ids.includes(booked.id));
        const none = await db.transaction((trx: any) =>
          lic.findOpenMentorSlotsAtRisk(
            trx,
            { startTime: at(e, '10:00'), endTime: at(e, '11:00') },
            teacherEmail,
          ),
        );
        report(
          'open slot with room to spare is not listed',
          !none.some((s: any) => s.slotId === safe.id),
        );
      },
    );

    /* ============================================ G. Concurrency and the pool */

    await section('G1. Last licence, separate connections', async () => {
      const d = nextDay();
      await fillPool(at(d, '10:00'), at(d, '11:00'), 1);
      const c1 = new Client(ConfigIndex.database);
      const c2 = new Client(ConfigIndex.database);
      await c1.connect();
      await c2.connect();
      try {
        const results = await Promise.allSettled([
          allocate(
            drizzle(c1, { schema }),
            hosts[N].id,
            at(d, '10:00'),
            at(d, '11:00'),
          ),
          allocate(
            drizzle(c2, { schema }),
            hosts[N + 1].id,
            at(d, '10:00'),
            at(d, '11:00'),
          ),
        ]);
        report(
          'exactly one of two wins',
          results.filter((r) => r.status === 'fulfilled').length === 1,
        );
      } finally {
        await c1.end();
        await c2.end();
      }
    });

    await section(
      "G2. Last licence, through the app's db handle (pool)",
      async () => {
        const d = nextDay();
        await fillPool(at(d, '10:00'), at(d, '11:00'), 1);
        const results = await Promise.allSettled([
          allocate(db, hosts[N].id, at(d, '10:00'), at(d, '11:00')),
          allocate(db, hosts[N + 1].id, at(d, '10:00'), at(d, '11:00')),
        ]);
        const won = results.filter((r) => r.status === 'fulfilled').length;
        report(
          'exactly one of two wins (both won on the old shared connection)',
          won === 1,
          `${won} won`,
        );
      },
    );

    await section(
      'G3. Student booking and a class race for the last licence',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await fillPool(at(d, '10:00'), at(d, '11:00'), 1);
        await restoreStudentMetrics();
        const results = await Promise.allSettled([
          svc.bookSlot(STUDENT, slot.id),
          allocate(db, hosts[N + 2].id, at(d, '10:00'), at(d, '11:00')),
        ]);
        if (results[0].status === 'fulfilled')
          bookingIds.push((results[0] as any).value.id);
        const won = results.filter((r) => r.status === 'fulfilled').length;
        report(
          'exactly one of booking and class wins',
          won === 1,
          results
            .map((r: any) =>
              r.status === 'fulfilled'
                ? 'won'
                : r.reason?.message?.slice(0, 70),
            )
            .join(' | '),
        );
        const holds = await holdsFor(slot.id);
        report(
          'a losing booking leaves no hold and no booking',
          results[0].status === 'fulfilled' ||
            (holds.length === 0 &&
              (await bookingsOnSlot(slot.id)).length === 0),
        );
      },
    );

    await section(
      'G4. 14 allocations at once, more than the pool has connections',
      async () => {
        const d = nextDay();
        await fillPool(at(d, '10:00'), at(d, '11:00'), 3);
        const started = Date.now();
        const results = await Promise.allSettled(
          Array.from({ length: 14 }, (_, k) =>
            allocate(db, hosts[N + k].id, at(d, '10:00'), at(d, '11:00')),
          ),
        );
        const secs = Math.round((Date.now() - started) / 1000);
        const won = results.filter((r) => r.status === 'fulfilled').length;
        const reasons = new Set(
          results
            .filter((r) => r.status === 'rejected')
            .map((r: any) => r.reason?.message?.slice(0, 40)),
        );
        report(
          'exactly the 3 free licences are given out',
          won === 3,
          `${won} won`,
        );
        report(
          'no deadlock: all 14 finished',
          results.length === 14,
          `${secs}s`,
        );
        const busy = results.filter(
          (r: any) =>
            r.status === 'rejected' &&
            /Zoom licences are busy/.test(r.reason?.message),
        ).length;
        report(
          'every loser fails cleanly: "no licence free" or "busy, try again"',
          [...reasons].every((m) =>
            /No Zoom licen|Zoom licences are busy/.test(String(m)),
          ),
          `${[...reasons].join(' | ')}; ${busy} of 11 timed out on the lock`,
        );
      },
    );

    await section(
      'G5. Lock held too long: request fails cleanly after 20 s',
      async () => {
        const d = nextDay();
        const holder = new Client(ConfigIndex.database);
        await holder.connect();
        try {
          await holder.query('BEGIN');
          await holder.query(
            `SELECT pg_advisory_xact_lock(hashtext('zuvy_zoom_license_pool'))`,
          );
          const started = Date.now();
          await expectRefused(
            'allocation waiting on the lock gives up with a clear message',
            () =>
              db.transaction((trx: any) =>
                lic.checkLicenseAvailability(trx, {
                  instructorId: hosts[N].id,
                  startTime: at(d, '10:00'),
                  endTime: at(d, '11:00'),
                }),
              ),
            /Zoom licences are busy/,
          );
          const secs = (Date.now() - started) / 1000;
          report(
            'gave up after about 20 s',
            secs >= 19 && secs < 40,
            `${secs.toFixed(1)}s`,
          );
        } finally {
          await holder.query('ROLLBACK').catch(() => undefined);
          await holder.end();
        }
        const after = await db.transaction((trx: any) =>
          lic.checkLicenseAvailability(trx, {
            instructorId: hosts[N].id,
            startTime: at(d, '10:00'),
            endTime: at(d, '11:00'),
          }),
        );
        report(
          'works again once the lock is released, with the normal lock timeout restored',
          after.available === true,
        );
      },
    );

    await section(
      'G6. Database drops a connection in the middle of a transaction',
      async () => {
        const killer = new Client(ConfigIndex.database);
        await killer.connect();
        try {
          let crashed = false;
          const onCrash = () => {
            crashed = true;
          };
          process.once('uncaughtException', onCrash);
          await expectRefused(
            'the request using that connection fails',
            () =>
              db.transaction(async (trx: any) => {
                const r = await trx.execute(
                  sql`SELECT pg_backend_pid() AS pid`,
                );
                await killer.query('SELECT pg_terminate_backend($1)', [
                  r.rows[0].pid,
                ]);
                // Idle in the transaction while the server drops the connection.
                await new Promise((resolve) => setTimeout(resolve, 1500));
                await trx.execute(sql`SELECT 1`);
              }),
            /terminat|Connection|not queryable|closed/i,
          );
          process.removeListener('uncaughtException', onCrash);
          report('the process did not crash', !crashed);
          const after = await db.execute(sql`SELECT 1 AS ok`);
          report(
            'the next query gets a working connection',
            after.rows[0].ok === 1,
          );
        } finally {
          await killer.end();
        }
      },
    );

    await section(
      'G7. Licence transfer: donor check runs inside the booking transaction',
      async () => {
        const d = nextDay();
        const start = at(d, '10:00');
        const end = at(d, '11:00');
        const host = hosts[N + 2];
        const busyDonor = hosts[N + 3];
        const freeDonor = hosts[N + 4];
        const zoom = lic.zoomService;
        const saved = {
          ensureLicensedUser: zoom.ensureLicensedUser,
          listAuthorizedUsers: zoom.listAuthorizedUsers,
          downgradeUser: zoom.downgradeUser,
        };
        // The real method (the test replaced it on the instance at start-up).
        const realEnsure =
          Object.getPrototypeOf(lic).ensureHostLicensedForWindow;
        const ROLLBACK = 'E2E: roll back the test transaction';
        let licensed = false;
        const downgraded: string[] = [];
        zoom.ensureLicensedUser = async () =>
          licensed
            ? { success: true, licensed: true }
            : { success: false, step: 'license', error: 'needs a license' };
        zoom.downgradeUser = async (email: string) => {
          downgraded.push(email);
          licensed = true;
          return { success: true };
        };
        try {
          await db
            .transaction(async (trx: any) => {
              await lic.lockLicensePool(trx);
              // The busy donor's session exists only inside this transaction.
              await trx.insert(schema.licenseAssignments).values({
                licenseId: realRows[0],
                instructorId: busyDonor.id,
                sourceType: 'mentor_slot',
                startTime: start,
                endTime: end,
              });
              report(
                'donor check through the transaction sees its uncommitted session',
                (await lic.isZoomEmailFreeForTimeRange(
                  busyDonor.email,
                  start,
                  end,
                  trx,
                )) === false,
              );
              report(
                'the same check on the global db does not (so the transaction is really used)',
                (await lic.isZoomEmailFreeForTimeRange(
                  busyDonor.email,
                  start,
                  end,
                )) === true,
              );

              zoom.listAuthorizedUsers = async () => ({
                success: true,
                data: {
                  users: [
                    { email: busyDonor.email },
                    { email: freeDonor.email },
                  ],
                },
              });
              await realEnsure.call(lic, host.email, start, end, trx);
              report(
                'transfer skips the busy donor and takes the free one',
                downgraded.length === 1 && downgraded[0] === freeDonor.email,
                downgraded.join(','),
              );

              licensed = false;
              downgraded.length = 0;
              zoom.listAuthorizedUsers = async () => ({
                success: true,
                data: { users: [{ email: busyDonor.email }] },
              });
              await expectRefused(
                'no free donor: clear refusal',
                () => realEnsure.call(lic, host.email, start, end, trx),
                /No free licensed Zoom user/,
              );
              report(
                'nothing was downgraded when no donor was free',
                downgraded.length === 0,
              );
              throw new Error(ROLLBACK);
            })
            .catch((error: any) => {
              if (error.message !== ROLLBACK) throw error;
            });
        } finally {
          Object.assign(zoom, saved);
        }
        const [{ n }] = await db
          .select({ n: sql`count(*)::int` })
          .from(schema.licenseAssignments)
          .where(
            and(
              eq(schema.licenseAssignments.instructorId, busyDonor.id),
              gte(schema.licenseAssignments.startTime, start),
              lt(schema.licenseAssignments.startTime, end),
            ),
          );
        report('test transaction rolled back, nothing saved', n === 0);
      },
    );

    /* ============================================ H. Clean-up script */

    await section('H. Clean-up script', async () => {
      const d = nextDay();
      const unbooked = await createSlot(at(d, '10:00'), at(d, '10:30'));
      const booked = await createSlot(at(d, '12:00'), at(d, '12:30'));
      const cancelled = await createSlot(at(d, '14:00'), at(d, '14:30'));
      const unbookedHold = await legacyHold(unbooked);
      await fixtureBooking(booked.id);
      const cancelledBooking = await fixtureBooking(cancelled.id);
      await db
        .update(schema.zuvyMentorSlotBooking)
        .set({ status: 'cancelled', sessionLifecycleState: 'CANCELLED' })
        .where(eq(schema.zuvyMentorSlotBooking.id, cancelledBooking));
      const [past] = await db
        .insert(schema.zuvyMentorSlotAvailability)
        .values({
          mentorSlotManagementId: mgmt.id,
          slotStartDateTime: new Date('2001-01-01T10:00:00Z'),
          slotEndDateTime: new Date('2001-01-01T10:30:00Z'),
          durationMinutes: 30,
          status: 'available',
        })
        .returning();
      extraSlotIds.push(past.id);
      await legacyHold(past);
      const ids = [unbooked.id, booked.id, cancelled.id, past.id];

      const dry = runScript(`--slot-ids=${ids.join(',')}`);
      report(
        'dry run lists the unbooked future slot',
        listedIn(dry.out, unbooked.id),
      );
      report(
        'dry run lists a slot whose only booking was cancelled',
        listedIn(dry.out, cancelled.id),
      );
      report('dry run skips the booked slot', !listedIn(dry.out, booked.id));
      report('dry run skips the past slot', !listedIn(dry.out, past.id));
      report(
        'dry run deletes nothing',
        (await holdsFor(unbooked.id)).length === 1 &&
          (await holdsFor(cancelled.id)).length === 1,
      );

      const bad = runScript('--slot-ids=');
      report(
        'empty --slot-ids is rejected',
        bad.code !== 0 && /needs a comma-separated list/.test(bad.out),
      );

      const applied = runScript(`--apply --slot-ids=${ids.join(',')}`);
      report(
        '--apply removes exactly 2 holds',
        /Removed 2 licence hold\(s\)/.test(applied.out),
        applied.out
          .split('\n')
          .filter((l) => /Removed|hold\(s\)/.test(l))
          .join(' / '),
      );
      const [gone] = await db
        .select()
        .from(schema.licenseAssignments)
        .where(eq(schema.licenseAssignments.id, unbookedHold));
      report(
        'unbooked and cancelled-only slots lost their holds',
        !gone && (await holdsFor(cancelled.id)).length === 0,
      );
      report(
        'booked and past slots kept theirs',
        (await holdsFor(booked.id)).length === 1 &&
          (await holdsFor(past.id)).length === 1,
      );
    });
  } finally {
    /* ============================================ clean-up */
    console.log('\n--- Clean-up ---');
    const allBookingIds = [...bookingIds];
    // Only slots this run created: anything that was already in the range
    // before the run started is left alone.
    const slotIdsInRange = (await slotIdsInTestRange()).filter(
      (id) => !preexistingSlotIds.has(id),
    );
    const allSlotIds = [...slotIdsInRange, ...extraSlotIds];
    if (allSlotIds.length) {
      const onSlots = await db
        .select({ id: schema.zuvyMentorSlotBooking.id })
        .from(schema.zuvyMentorSlotBooking)
        .where(
          inArray(schema.zuvyMentorSlotBooking.slotAvailabilityId, allSlotIds),
        );
      onSlots.forEach((b: any) => allBookingIds.push(b.id));
    }
    if (allBookingIds.length) {
      await db
        .delete(schema.zuvyNotifications)
        .where(
          and(
            eq(schema.zuvyNotifications.referenceType, 'booking'),
            inArray(schema.zuvyNotifications.referenceId, allBookingIds),
          ),
        );
    }
    if (classSessionIds.length) {
      await db
        .delete(schema.licenseAssignments)
        .where(inArray(schema.licenseAssignments.sessionId, classSessionIds));
      await db
        .delete(schema.zuvySessions)
        .where(inArray(schema.zuvySessions.id, classSessionIds));
    }
    if (fillerIds.length) {
      await db
        .delete(schema.licenseAssignments)
        .where(inArray(schema.licenseAssignments.id, fillerIds));
    }
    // Deleting the slots cascades to their bookings, holds and recordings.
    if (allSlotIds.length) {
      await db
        .delete(schema.zuvyMentorSlotAvailability)
        .where(inArray(schema.zuvyMentorSlotAvailability.id, allSlotIds));
    }
    await restoreStudentMetrics();
    await db
      .delete(schema.zuvyStudentBookingMetrics)
      .where(
        eq(schema.zuvyStudentBookingMetrics.userId, BigInt(secondStudent)),
      );

    report(
      'test student credit row restored exactly',
      (await readStudentMetricsJson()) === metricsSnapshot,
    );
    const [{ holdsLeft }] = await db
      .select({ holdsLeft: sql`count(*)::int` })
      .from(schema.licenseAssignments)
      .where(
        and(
          gte(schema.licenseAssignments.startTime, new Date(BASE)),
          lt(schema.licenseAssignments.startTime, RANGE_END),
        ),
      );
    report('no test licence holds left', holdsLeft === 0, `${holdsLeft}`);
    const [{ slotsLeft }] = await db
      .select({ slotsLeft: sql`count(*)::int` })
      .from(schema.zuvyMentorSlotAvailability)
      .where(
        and(
          gte(
            schema.zuvyMentorSlotAvailability.slotStartDateTime,
            new Date(BASE),
          ),
          lt(schema.zuvyMentorSlotAvailability.slotStartDateTime, RANGE_END),
        ),
      );
    report('no test slots left', slotsLeft === 0, `${slotsLeft}`);
    const leftClasses = await db.execute(
      sql`SELECT count(*)::int AS n FROM main.zuvy_sessions WHERE title LIKE 'E2E licence test%'`,
    );
    report('no test class sessions left', leftClasses.rows[0].n === 0);
    console.log(
      `Removed ${allSlotIds.length} slot(s), ${fillerIds.length} filler hold(s), ${allBookingIds.length} booking(s), ${classSessionIds.length} class session(s).`,
    );
    await app.close();
  }

  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) console.log(`Failed: ${failures.join(' ; ')}`);
  void LOG_DIR;
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E script crashed:', e);
  process.exit(1);
});
