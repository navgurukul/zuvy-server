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
 * Credits: the run counts only its own bookings (credits_counted_from is set
 * to the run's start through MentorshipConfigService's test override, never
 * written to the table), with no gap and plenty of credits, so the licence
 * cases can book as often as they need. The credit rules themselves are
 * checked in scripts/e2e-mentorship-credits.ts. The credit recount is real;
 * RECOUNT_FAULTS lets a case make it fail once.
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
// The credit recount is the real one; a case can make it fail once.
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
  if (ONLY && !ONLY.split(',').some((p) => name.startsWith(p))) return;
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
    const to = new Date(d.getTime() + 200 * 86_400_000);
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
// Gap between the starts of 6-minute sessions that must never be in use at
// the same time: each one's cooldown ends 4 minutes before the next starts.
const STAGGER_MS = 6 * MIN + ZOOM_LICENSE_COOLDOWN_MS + 4 * MIN;

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
let savedTotalLicences: string | undefined;

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
let failNextGetMeeting = false;
let createMeetingDelayMs = 0;
let omitJoinUrlNext = false;
let onMeetingCreated: ((id: number) => void) | null = null;
const deletedMeetingIds: string[] = [];
const zoomStubs = {
  getUser: async () => ({ success: true, data: { status: 'active', type: 2 } }),
  // Licensed-host bookkeeping on the fast path: no Zoom call, no row write.
  applyLicensedUserSettings: async () => ({ success: true }),
  syncZoomLicenseUser: async () => undefined,
  // The real ensureHostLicensedForWindow runs; Zoom says the host is licensed.
  ensureLicensedUser: async () => ({ success: true, licensed: true }),
  createMeetingForUser: async () => {
    if (failNextMeeting) {
      failNextMeeting = false;
      return { success: false, error: 'E2E: Zoom is down' };
    }
    if (createMeetingDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, createMeetingDelayMs));
    }
    meetingSeq += 1;
    onMeetingCreated?.(990000000 + meetingSeq);
    const noJoinUrl = omitJoinUrlNext;
    omitJoinUrlNext = false;
    return {
      success: true,
      data: {
        id: 990000000 + meetingSeq,
        join_url: noJoinUrl ? undefined : 'https://zoom.invalid/j',
        start_url: 'https://zoom.invalid/s',
        password: 'e2e',
      },
    };
  },
  getMeeting: async () => {
    if (failNextGetMeeting) {
      failNextGetMeeting = false;
      return { success: false, error: 'E2E: meeting lookup failed' };
    }
    return {
      success: true,
      data: { uuid: `e2e-licence-${Date.now()}-${meetingSeq}` },
    };
  },
  deleteMeeting: async (id: string) => {
    deletedMeetingIds.push(String(id));
    return { success: true };
  },
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
// The student's credits as the app works them out.
async function creditStateJson(): Promise<string> {
  const e = await svc.getBookingEligibility(STUDENT);
  return JSON.stringify(e.credits);
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
        meetingLink: 'https://zoom.invalid/fixture',
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
  }
  svc.emailService.sendEmail = async () => undefined;

  const realRecount = svc.recomputeStudentBookingMetrics.bind(svc);
  let recountShouldThrow = false;
  svc.recomputeStudentBookingMetrics = async (...args: any[]) => {
    if (recountShouldThrow) {
      recountShouldThrow = false;
      throw new Error('E2E: forced failure late in cancel');
    }
    return realRecount(...args);
  };

  // Only this run's bookings use a credit, with no gap and plenty of
  // credits, so the licence cases can book as often as they need.
  svc.mentorshipConfig.setOverridesForTesting({
    creditsCountedFrom: new Date(),
    totalCredits: 100000,
    gapDays: 0,
    noticeHours: 72,
  });

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
  // Run with the configured pool matching the real licences, as production
  // should be set up (ZOOM_TOTAL_LICENSES = transferable + protected). Dev's
  // default (7) gives a pool of 2; R6 tests that case on its own.
  savedTotalLicences = process.env.ZOOM_TOTAL_LICENSES;
  const protectedSeatCount = Number(
    (
      await db.execute(
        sql`SELECT count(*)::int AS n FROM main.zuvy_user_licenses WHERE is_protected AND status = 'active' AND license_type = 2`,
      )
    ).rows[0].n,
  );
  process.env.ZOOM_TOTAL_LICENSES = String(N + protectedSeatCount);
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
      await expectRefused(
        'slot ending exactly when the busy hour starts is refused (its own cooldown runs into it)',
        () => createSlot(at(d, '09:00'), at(d, '10:00')),
        /No Zoom licence is free/,
      );
      const endsOneCooldownBefore = new Date(
        at(d, '10:00').getTime() - ZOOM_LICENSE_COOLDOWN_MS,
      );
      const ending = await createSlot(
        new Date(endsOneCooldownBefore.getTime() - 30 * MIN),
        endsOneCooldownBefore,
      );
      report(
        'slot ending one cooldown before the busy hour is created',
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
      dayCounter += 5;
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
        const before = await creditStateJson();
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
          (await creditStateJson()) === before,
        );
      },
    );

    await section(
      'B5. Zoom fails during booking: everything rolls back',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await restoreStudentMetrics();
        const before = await creditStateJson();
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
          (await creditStateJson()) === before,
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
        /Booked slots can't be removed. Cancel the booking first./,
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
        const start = at(d, '10:00', i * STAGGER_MS);
        await filler(i, start, new Date(start.getTime() + 6 * MIN));
      }
      const window = {
        start: at(d, '10:00'),
        end: at(d, '10:00', N * STAGGER_MS),
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
        for (let i = 0; i < N - 1; i++)
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

    await section('G7. Licence transfer between Zoom accounts', async () => {
      // Both licence-moving code paths share one Zoom service object here;
      // fake Zoom on every Zoom service instance the test can reach.
      const zoomTargets = Array.from(
        new Set([lic.zoomService, classes.zoomService].filter(Boolean)),
      );
      const saved = zoomTargets.map((z: any) => ({
        z,
        ensureLicensedUser: z.ensureLicensedUser,
        getUser: z.getUser,
        listAuthorizedUsers: z.listAuthorizedUsers,
        downgradeUser: z.downgradeUser,
      }));
      // Zoom, faked: hosts start unlicensed; downgrading a donor frees one
      // licence, which the next licensing attempt by a host takes. With
      // `accountFull`, a host with no free licence gets Zoom's "still basic"
      // answer instead of a licence error.
      let licensedHosts = new Set<string>();
      let freeSeats = 0;
      let downgraded: string[] = [];
      let donors: string[] = [];
      let accountFull = false;
      let licensingCalls = 0;
      let slowDowngradeMs = 0;
      const fake = {
        ensureLicensedUser: async (email: string) => {
          licensingCalls += 1;
          const key = email.toLowerCase();
          if (licensedHosts.has(key)) return { success: true, licensed: true };
          if (freeSeats > 0) {
            freeSeats -= 1;
            licensedHosts.add(key);
            return { success: true, licensed: true };
          }
          return accountFull
            ? {
                success: false,
                step: 'verify',
                error: `Zoom user ${key} is currently basic with status 'active'.`,
              }
            : { success: false, step: 'license', error: 'needs a license' };
        },
        getUser: async (email: string) => ({
          success: true,
          data: {
            type: licensedHosts.has(email.toLowerCase()) ? 2 : 1,
            status: 'active',
          },
        }),
        listAuthorizedUsers: async () => {
          // A little Zoom latency, so two transfers really overlap.
          await new Promise((resolve) => setTimeout(resolve, 300));
          return {
            success: true,
            data: {
              users: donors
                .filter((d) => !downgraded.includes(d))
                .map((email) => ({ email })),
            },
          };
        },
        downgradeUser: async (email: string) => {
          downgraded.push(email.toLowerCase());
          freeSeats += 1;
          // The licence is free in the account from here until the host takes it.
          if (slowDowngradeMs)
            await new Promise((resolve) =>
              setTimeout(resolve, slowDowngradeMs),
            );
          return { success: true };
        },
      };
      zoomTargets.forEach((z: any) => Object.assign(z, fake));
      const reset = (list: string[]) => {
        licensedHosts = new Set();
        freeSeats = 0;
        downgraded = [];
        donors = list;
        accountFull = false;
        licensingCalls = 0;
        slowDowngradeMs = 0;
      };
      const ensure = (host: string, start: Date, end: Date) =>
        lic.ensureHostLicensedForWindow(host, start, end);

      try {
        const d = nextDay();
        const start = at(d, '10:00');
        const end = at(d, '11:00');
        const [hostA, hostB, busyDonor, freeDonor, freeDonor2, liveDonor] = [
          hosts[N + 2],
          hosts[N + 3],
          hosts[N + 4],
          hosts[N + 5],
          hosts[N + 6],
          hosts[N + 11],
        ];
        const [busy] = await db
          .insert(schema.licenseAssignments)
          .values({
            licenseId: realRows[0],
            instructorId: busyDonor.id,
            sourceType: 'mentor_slot',
            startTime: start,
            endTime: end,
          })
          .returning({ id: schema.licenseAssignments.id });
        fillerIds.push(Number(busy.id));

        reset([busyDonor.email, freeDonor.email]);
        await ensure(hostA.email, start, end);
        report(
          'transfer skips the busy donor and takes the free one',
          downgraded.length === 1 && downgraded[0] === freeDonor.email,
          downgraded.join(','),
        );
        report(
          'one licensing attempt before the transfer, one after (no repeat under the lock)',
          licensingCalls === 2,
          `${licensingCalls} calls`,
        );

        // A donor hosting a session right now (free at the new session's
        // time) keeps its licence.
        const now = Date.now();
        const [live] = await db
          .insert(schema.licenseAssignments)
          .values({
            licenseId: realRows[0],
            instructorId: liveDonor.id,
            sourceType: 'mentor_slot',
            startTime: new Date(now - 10 * 60_000),
            endTime: new Date(now + 20 * 60_000),
          })
          .returning({ id: schema.licenseAssignments.id });
        fillerIds.push(Number(live.id));
        reset([liveDonor.email, freeDonor.email]);
        await ensure(hostA.email, start, end);
        report(
          'a donor hosting right now is skipped',
          downgraded.length === 1 && downgraded[0] === freeDonor.email,
          downgraded.join(','),
        );
        reset([liveDonor.email]);
        await expectRefused(
          'only a live donor: refused, not downgraded',
          () => ensure(hostA.email, start, end),
          /No free licensed Zoom user/,
        );
        report('the live donor was not touched', downgraded.length === 0);
        // It sits at the real current time, outside the test's date range:
        // remove it at once so nothing else sees it.
        await db
          .delete(schema.licenseAssignments)
          .where(eq(schema.licenseAssignments.id, live.id));

        // A Zoom error that isn't about licences: reported as it is, with no
        // donor lookup.
        reset([freeDonor.email]);
        const realEnsure = fake.ensureLicensedUser;
        zoomTargets.forEach((z: any) => {
          z.ensureLicensedUser = async () => ({
            success: false,
            step: 'fetch',
            error: 'E2E: Zoom user lookup failed',
          });
        });
        try {
          await expectRefused(
            'a non-licence Zoom error is reported as it is',
            () => ensure(hostA.email, start, end),
            /Zoom user lookup failed/,
          );
          report('... and no licence moved', downgraded.length === 0);
        } finally {
          zoomTargets.forEach((z: any) => {
            z.ensureLicensedUser = realEnsure;
          });
        }

        // A licence a transfer has just freed (donor downgraded, host not yet
        // upgraded) can't be taken by another request in between.
        reset([freeDonor.email]);
        slowDowngradeMs = 600;
        const first = ensure(hostA.email, start, end).then(
          () => 'ok',
          (e: any) => e.message,
        );
        await new Promise((resolve) => setTimeout(resolve, 450));
        const second = ensure(hostB.email, start, end).then(
          () => 'ok',
          (e: any) => e.message,
        );
        const [firstOutcome, secondOutcome] = await Promise.all([
          first,
          second,
        ]);
        report(
          'the transfer that freed the licence gets it',
          firstOutcome === 'ok',
          `${firstOutcome} | ${secondOutcome}`,
        );
        report(
          'the other request waits its turn instead of taking it',
          /No free licensed Zoom user/.test(secondOutcome),
          secondOutcome,
        );
        report(
          'only one licence moved',
          downgraded.length === 1,
          downgraded.join(','),
        );

        // A licence that became free while waiting is used before any donor.
        reset([freeDonor.email]);
        freeSeats = 1;
        await ensure(hostA.email, start, end);
        report(
          'a free licence in the account is used, no donor downgraded',
          downgraded.length === 0,
        );

        // Alternative-host check: takes a free licence under the same lock.
        reset([]);
        freeSeats = 1;
        const alt = await lic.ensureLicensedUnderTransferLock(hostB.email);
        report(
          'alternative-host check takes a free licence',
          alt.success && alt.licensed && freeSeats === 0,
        );

        // Already licensed: no licensing call, but the licence row is
        // recorded and the licensed-user settings applied (as before).
        reset([]);
        licensedHosts.add(hostA.email.toLowerCase());
        let settingsApplied = 0;
        let rowsSynced = 0;
        const realApply = zoomTargets.map(
          (z: any) => z.applyLicensedUserSettings,
        );
        const realSync = zoomTargets.map((z: any) => z.syncZoomLicenseUser);
        zoomTargets.forEach((z: any) => {
          z.applyLicensedUserSettings = async () => {
            settingsApplied += 1;
            return { success: true };
          };
          z.syncZoomLicenseUser = async () => {
            rowsSynced += 1;
          };
        });
        try {
          await ensure(hostA.email, start, end);
          report(
            'licensed host: settings applied and row recorded, nothing licensed',
            settingsApplied === 1 && rowsSynced === 1 && licensingCalls === 0,
            `settings ${settingsApplied}, rows ${rowsSynced}, licensing ${licensingCalls}`,
          );
        } finally {
          zoomTargets.forEach((z: any, i: number) => {
            z.applyLicensedUserSettings = realApply[i];
            z.syncZoomLicenseUser = realSync[i];
          });
        }

        reset([busyDonor.email]);
        await expectRefused(
          'no free donor: clear refusal',
          () => ensure(hostA.email, start, end),
          /No free licensed Zoom user/,
        );
        report(
          'nothing downgraded when no donor is free',
          downgraded.length === 0,
        );

        // Zoom account has no licence left: bookings move one (as before),
        // classes ask for one to be freed in Zoom (as before).
        reset([freeDonor.email]);
        accountFull = true;
        await ensure(hostA.email, start, end);
        report(
          'account full: a booking still moves a licence',
          downgraded.length === 1,
          downgraded.join(','),
        );
        reset([freeDonor.email]);
        accountFull = true;
        await expectRefused(
          'account full: a class is refused with the old message',
          () =>
            classes.ensureInstructorHasZoomLicenseForSession(
              hostB.email,
              start,
              end,
            ),
          /reached the Business license limit/,
        );
        report('... and moves no licence', downgraded.length === 0);

        reset([freeDonor.email, freeDonor2.email]);
        const both = await Promise.allSettled([
          ensure(hostA.email, start, end),
          ensure(hostB.email, start, end),
        ]);
        report(
          'two booking transfers at once both succeed',
          both.every((r) => r.status === 'fulfilled'),
          both
            .map((r: any) =>
              r.status === 'fulfilled' ? 'ok' : r.reason?.message,
            )
            .join(' | '),
        );
        report(
          '... and take two different donors',
          downgraded.length === 2 && new Set(downgraded).size === 2,
          downgraded.join(','),
        );

        reset([freeDonor.email, freeDonor2.email]);
        const mixed = await Promise.allSettled([
          ensure(hostA.email, start, end),
          classes.ensureInstructorHasZoomLicenseForSession(
            hostB.email,
            start,
            end,
          ),
        ]);
        report(
          'a booking transfer and a class transfer at once both succeed',
          mixed.every((r) => r.status === 'fulfilled'),
          mixed
            .map((r: any) =>
              r.status === 'fulfilled' ? 'ok' : r.reason?.message,
            )
            .join(' | '),
        );
        report(
          '... and take two different donors',
          downgraded.length === 2 && new Set(downgraded).size === 2,
          downgraded.join(','),
        );

        // Two transfers for the same host at once: the second finds the host
        // already licensed under the lock and moves nothing.
        reset([freeDonor.email, freeDonor2.email]);
        const same = await Promise.allSettled([
          ensure(hostA.email, start, end),
          ensure(hostA.email, start, end),
        ]);
        report(
          'two transfers for the same host: both succeed, one licence moved',
          same.every((r) => r.status === 'fulfilled') &&
            downgraded.length === 1,
          `${downgraded.join(',')} | ${same.map((r: any) => (r.status === 'fulfilled' ? 'ok' : r.reason?.message)).join(' | ')}`,
        );

        // The lock is released afterwards, with no transaction left open.
        const probe = await db.execute(
          sql`SELECT pg_try_advisory_lock(hashtext('zuvy_zoom_license_transfer')) AS free`,
        );
        if (probe.rows[0].free)
          await db.execute(
            sql`SELECT pg_advisory_unlock(hashtext('zuvy_zoom_license_transfer'))`,
          );
        report(
          'the transfer lock is released after use',
          probe.rows[0].free === true,
        );
        const idleTx = await db.execute(
          sql`SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename = current_user AND state LIKE 'idle in transaction%' AND query ILIKE '%advisory%transfer%'`,
        );
        report(
          'no transaction left open by a transfer',
          idleTx.rows[0].n === 0,
        );
      } finally {
        saved.forEach((entry: any) => {
          entry.z.ensureLicensedUser = entry.ensureLicensedUser;
          entry.z.getUser = entry.getUser;
          entry.z.listAuthorizedUsers = entry.listAuthorizedUsers;
          entry.z.downgradeUser = entry.downgradeUser;
        });
      }
    });

    /* ============================================ H. Clean-up script */

    /* ============================================ N. Review fixes */

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));
    const waitForBooking = async (slotId: number) => {
      const started = Date.now();
      while (Date.now() - started < 20_000) {
        const rows = await bookingsOnSlot(slotId);
        if (rows.length) return rows[0];
        await sleep(150);
      }
      throw new Error(`no booking appeared on slot ${slotId}`);
    };
    const resetZoomHooks = () => {
      createMeetingDelayMs = 0;
      onMeetingCreated = null;
      failNextGetMeeting = false;
      failNextMeeting = false;
    };
    const confirmAlerts = async (bookingId: number) => {
      const [{ n }] = await db
        .select({ n: sql`count(*)::int` })
        .from(schema.zuvyNotifications)
        .where(
          and(
            eq(schema.zuvyNotifications.referenceType, 'booking'),
            eq(schema.zuvyNotifications.referenceId, bookingId),
            inArray(schema.zuvyNotifications.type, [
              'BOOKING_CREATED',
              'BOOKING_CONFIRMED',
            ]),
          ),
        );
      return n;
    };

    await section(
      'N1. Booking does not hold the licence lock while Zoom is called',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await restoreStudentMetrics();
        createMeetingDelayMs = 5000;
        let bookingDone = false;
        try {
          const booking = svc.bookSlot(STUDENT, slot.id).then((b: any) => {
            bookingDone = true;
            bookingIds.push(b.id);
            return b;
          });
          await waitForBooking(slot.id);
          const started = Date.now();
          const other = await db.transaction((trx: any) =>
            lic.checkLicenseAvailability(trx, {
              instructorId: hosts[N].id,
              startTime: at(d, '12:00'),
              endTime: at(d, '12:30'),
            }),
          );
          const secs = (Date.now() - started) / 1000;
          report(
            'another allocation takes the licence lock while the booking waits on Zoom',
            other.available === true && !bookingDone && secs < 3,
            `${secs.toFixed(1)}s, booking still waiting on Zoom: ${!bookingDone}`,
          );
          const done = await booking;
          const row = await bookingRow(done.id);
          report(
            'the booking then completes with its meeting saved',
            !!row.zoomMeetingId && !!row.meetingLink,
          );
          report(
            'its alerts are sent once the meeting exists',
            (await confirmAlerts(done.id)) === 2,
          );
        } finally {
          resetZoomHooks();
        }
      },
    );

    await section(
      'N2. Booking cancelled while Zoom is being called',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await restoreStudentMetrics();
        createMeetingDelayMs = 5000;
        let createdId: number | null = null;
        onMeetingCreated = (id) => {
          createdId = id;
        };
        try {
          const outcome = svc.bookSlot(STUDENT, slot.id).then(
            () => 'booked',
            (e: any) => e.message,
          );
          const pending = await waitForBooking(slot.id);
          bookingIds.push(pending.id);
          await svc.cancelBooking(pending.id, REASON, 'student', STUDENT);
          const message = await outcome;
          report(
            'the student is told it was cancelled while being set up',
            /cancelled while the session was being set up/.test(message),
            message,
          );
          report(
            'the Zoom meeting made meanwhile is deleted',
            createdId !== null && deletedMeetingIds.includes(String(createdId)),
          );
          const row = await bookingRow(pending.id);
          report(
            'booking stays cancelled, no meeting saved on it',
            row.status === 'cancelled' && !row.zoomMeetingId,
          );
          report('licence given back', (await holdsFor(slot.id)).length === 0);
          report(
            'no "booking confirmed" alerts',
            (await confirmAlerts(pending.id)) === 0,
          );
        } finally {
          resetZoomHooks();
        }
      },
    );

    await section('N3. Zoom fails after the meeting was created', async () => {
      const d = nextDay();
      const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
      await restoreStudentMetrics();
      const before = await creditStateJson();
      let createdId: number | null = null;
      onMeetingCreated = (id) => {
        createdId = id;
      };
      failNextGetMeeting = true;
      try {
        await expectRefused(
          'booking fails with a clear message',
          () => svc.bookSlot(STUDENT, slot.id),
          /Unable to schedule session/,
        );
      } finally {
        resetZoomHooks();
      }
      report(
        'the half-made Zoom meeting is deleted',
        createdId !== null && deletedMeetingIds.includes(String(createdId)),
      );
      const s = await slotRow(slot.id);
      report('booking removed', (await bookingsOnSlot(slot.id)).length === 0);
      report('licence given back', (await holdsFor(slot.id)).length === 0);
      report(
        'slot open again, count 0',
        s.status === 'available' && s.currentBookedCount === 0,
      );
      report(
        'student credits exactly as before',
        (await creditStateJson()) === before,
      );
    });

    await section('N4. Saving the meeting fails: booking undone', async () => {
      const d = nextDay();
      const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
      await restoreStudentMetrics();
      const before = await creditStateJson();
      let createdId: number | null = null;
      onMeetingCreated = (id) => {
        createdId = id;
      };
      const notif = svc.notificationService;
      const realCreate = notif.createNotification;
      notif.createNotification = async () => {
        throw new Error('E2E: alert write failed');
      };
      try {
        await expectRefused(
          'booking fails with a clear message',
          () => svc.bookSlot(STUDENT, slot.id),
          /Unable to schedule session/,
        );
      } finally {
        notif.createNotification = realCreate;
        resetZoomHooks();
      }
      report(
        'the Zoom meeting is deleted',
        createdId !== null && deletedMeetingIds.includes(String(createdId)),
      );
      report('booking removed', (await bookingsOnSlot(slot.id)).length === 0);
      report('licence given back', (await holdsFor(slot.id)).length === 0);
      report(
        'student credits exactly as before',
        (await creditStateJson()) === before,
      );
    });

    await section(
      "N5. Slot creation counts other mentors' open slots",
      async () => {
        const protectedList = Array.from(
          await lic.getProtectedLicenseEmails(db),
        ) as string[];
        const others = (
          await db.execute(sql`
          SELECT m.id, m.mentor_user_id AS mentor_id
          FROM main.zuvy_mentor_slot_management m JOIN main.users u ON u.id = m.mentor_user_id
          WHERE m.id <> ${mgmt.id} AND u.email IS NOT NULL AND m.mentor_user_id <> ${MENTOR}
          ORDER BY m.id DESC LIMIT 20`)
        ).rows;
        if (!others.length) {
          report('dev has another mentor to test with', false);
          return;
        }
        const otherEmails = await db.execute(
          sql`SELECT id, lower(email) AS email FROM main.users WHERE id IN (${sql.join(
            others.map((o: any) => sql`${o.mentor_id}`),
            sql`, `,
          )})`,
        );
        const other = others.find((o: any) => {
          const e = otherEmails.rows.find(
            (r: any) => String(r.id) === String(o.mentor_id),
          );
          return e && !protectedList.includes(e.email);
        });
        if (!other) {
          report('dev has another mentor to test with', false);
          return;
        }
        const openSlotFor = async (day: number, from: string, to: string) => {
          const [row] = await db
            .insert(schema.zuvyMentorSlotAvailability)
            .values({
              mentorSlotManagementId: other.id,
              slotStartDateTime: at(day, from),
              slotEndDateTime: at(day, to),
              durationMinutes: 30,
              status: 'available',
            })
            .returning();
          extraSlotIds.push(row.id);
          return row;
        };

        const d = nextDay();
        await fillPool(at(d, '10:00'), at(d, '11:00'), 1);
        await openSlotFor(d, '10:00', '10:30');
        await expectRefused(
          "the last licence is taken by another mentor's open slot: slot refused",
          () => createSlot(at(d, '10:00'), at(d, '10:30')),
          /No Zoom licence is free/,
        );
        const check = await svc.checkSlotLicenceAvailability(
          MENTOR,
          iso(at(d, '10:00')),
          iso(at(d, '10:30')),
        );
        report('licence-check says the same', check.available === false);

        const e = nextDay();
        await fillPool(at(e, '10:00'), at(e, '11:00'), 2);
        const booked = await openSlotFor(e, '10:00', '10:30');
        const [hold] = await db
          .insert(schema.licenseAssignments)
          .values({
            licenseId: realRows[N - 1],
            instructorId: Number(other.mentor_id),
            sourceType: 'mentor_slot',
            mentorSlotAvailabilityId: booked.id,
            startTime: at(e, '10:00'),
            endTime: at(e, '10:30'),
          })
          .returning({ id: schema.licenseAssignments.id });
        fillerIds.push(Number(hold.id));
        const ok = await createSlot(at(e, '10:00'), at(e, '10:30'));
        report(
          'a slot that already holds a licence is counted once, not twice',
          !!ok?.id,
        );
      },
    );

    await section(
      'N6. Read-only licence-check does not wait for the licence lock',
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
          const result = await svc.checkSlotLicenceAvailability(
            MENTOR,
            iso(at(d, '10:00')),
            iso(at(d, '10:30')),
          );
          const secs = (Date.now() - started) / 1000;
          report(
            'answers at once while the lock is held elsewhere',
            result.available === true && secs < 3,
            `${secs.toFixed(1)}s`,
          );
        } finally {
          await holder.query('ROLLBACK').catch(() => undefined);
          await holder.end();
        }
      },
    );

    await section('N7. Lock-wait limits', async () => {
      const shown = await db.execute(sql`SHOW lock_timeout`);
      report(
        'every pooled connection waits at most 30 s for a lock',
        shown.rows[0].lock_timeout === '30s',
        shown.rows[0].lock_timeout,
      );
      const idle = await db.execute(
        sql`SHOW idle_in_transaction_session_timeout`,
      );
      report(
        'an idle transaction is ended after 2 minutes',
        idle.rows[0].idle_in_transaction_session_timeout === '2min',
        idle.rows[0].idle_in_transaction_session_timeout,
      );
      const inside = await db.transaction(async (trx: any) => {
        await lic.lockLicensePool(trx);
        return (await trx.execute(sql`SHOW lock_timeout`)).rows[0].lock_timeout;
      });
      report(
        'after taking the licence lock, the 30 s limit is back (not "no limit")',
        inside === '30s',
        inside,
      );
    });

    await section(
      'N8. Accepting a reschedule when no licence is free',
      async () => {
        const d = nextDay();
        const from = await createSlot(at(d, '08:00'), at(d, '08:30'));
        const to = await createSlot(at(d, '10:00'), at(d, '10:30'));
        const b = await fixtureBooking(from.id);
        await proposeFixture(b, to.id);
        await fillPool(at(d, '10:00'), at(d, '11:00'));
        await expectRefused(
          'mentor gets a clear message',
          () => svc.acceptReschedule(b, MENTOR, ORG),
          /No meeting licence is free at the new time/,
        );
        report(
          'booking still on the old slot',
          (await bookingRow(b)).slotAvailabilityId === from.id,
        );
        report(
          'old slot keeps its licence, new slot has none',
          (await holdsFor(from.id)).length === 1 &&
            (await holdsFor(to.id)).length === 0,
        );
      },
    );

    await section(
      'N9. Accepting a reschedule while someone books the old slot',
      async () => {
        let ok = 0;
        const problems: string[] = [];
        for (let round = 0; round < 3; round++) {
          const d = nextDay();
          const from = await createSlot(at(d, '10:00'), at(d, '10:30'), 2);
          const to = await createSlot(at(d, '12:00'), at(d, '12:30'));
          const b = await fixtureBooking(from.id);
          await proposeFixture(b, to.id);
          await restoreStudentMetrics();
          const results = await Promise.allSettled([
            svc.acceptReschedule(b, MENTOR, ORG),
            svc.bookSlot(STUDENT, from.id),
          ]);
          if (results[1].status === 'fulfilled')
            bookingIds.push((results[1] as any).value.id);
          if (results.every((r) => r.status === 'fulfilled')) ok++;
          results.forEach(
            (r: any) =>
              r.status === 'rejected' && problems.push(r.reason?.message),
          );
        }
        report(
          'both succeed in all 3 rounds, no deadlock',
          ok === 3,
          problems.join(' | ') || '3 of 3',
        );
      },
    );

    await section(
      'N10. Class warning: the right slots, the right time window',
      async () => {
        const teacherEmail = hosts[N + 1].email;
        const atRiskFor = (day: number, from: string, to: string) =>
          db.transaction((trx: any) =>
            lic.findOpenMentorSlotsAtRisk(
              trx,
              { startTime: at(day, from), endTime: at(day, to) },
              teacherEmail,
            ),
          );

        // A slot that was already unbookable is not blamed on the class.
        const d = nextDay();
        await fillPool(at(d, '10:00'), at(d, '11:00'));
        const [stuck] = await db
          .insert(schema.zuvyMentorSlotAvailability)
          .values({
            mentorSlotManagementId: mgmt.id,
            slotStartDateTime: at(d, '10:00'),
            slotEndDateTime: at(d, '10:30'),
            durationMinutes: 30,
            status: 'available',
          })
          .returning();
        extraSlotIds.push(stuck.id);
        const listed1 = (await atRiskFor(d, '10:00', '11:00')).map(
          (s: any) => s.slotId,
        );
        report(
          'slot that was already unbookable is not listed',
          !listed1.includes(stuck.id),
        );

        // The class's cooldown overlaps sessions that start after the class.
        const e = nextDay();
        const slot = await createSlot(at(e, '10:15'), at(e, '11:00'));
        for (let i = 0; i < N - 1; i++)
          await filler(i, at(e, '10:41'), at(e, '11:00'));
        const listed2 = (await atRiskFor(e, '10:00', '10:40')).map(
          (s: any) => s.slotId,
        );
        report(
          "slot is listed when the class's cooldown runs into sessions after the class",
          listed2.includes(slot.id),
        );
      },
    );

    await section(
      'N11. Class creation when the warning check fails',
      async () => {
        const lsvc = classes.zoomLicenseService;
        const realFind = lsvc.findOpenMentorSlotsAtRisk;
        const d = nextDay();
        // Every licence is touched once in the class's time but never two at
        // once, so the class gets a shared pool seat (the placeholder path).
        for (let i = 0; i < N; i++) {
          const start = at(d, '10:00', i * STAGGER_MS);
          await filler(i, start, new Date(start.getTime() + 6 * MIN));
        }
        const teacher = (
          await db.execute(
            sql`SELECT lower(u.email) AS email FROM main.zuvy_batches b JOIN main.users u ON u.id = b.instructor_id WHERE b.id = ${classBatch.batch_id}`,
          )
        ).rows[0].email;
        const placeholderBefore = await db
          .select()
          .from(schema.zuvyUserLicenses)
          .where(eq(schema.zuvyUserLicenses.zoomEmail, teacher));
        lsvc.findOpenMentorSlotsAtRisk = async (executor: any) => {
          await executor.execute(
            sql`SELECT * FROM main.e2e_table_that_does_not_exist`,
          );
          return [];
        };
        const title = `E2E licence test class ${Date.now()}`;
        let result: any;
        try {
          result = await classes.createZoomSession(
            {
              title,
              startDateTime: iso(at(d, '10:00')),
              endDateTime: iso(at(d, '10:00', N * STAGGER_MS)),
              timeZone: 'Asia/Kolkata',
              batchId: classBatch.batch_id,
              bootcampId: classBatch.bootcamp_id,
              moduleId: classBatch.module_id,
            },
            { email: 'e2e-licence@zuvy.invalid' },
          );
        } finally {
          lsvc.findOpenMentorSlotsAtRisk = realFind;
        }
        const sessions = (result?.data || []).map((s: any) => Number(s.id));
        sessions.forEach((id: number) => classSessionIds.push(id));
        try {
          report(
            'class still created',
            result?.status === 'success',
            result?.message || result?.error,
          );
          const [assignment] = sessions.length
            ? await db
                .select()
                .from(schema.licenseAssignments)
                .where(eq(schema.licenseAssignments.sessionId, sessions[0]))
            : [];
          const [licence] = assignment
            ? await db
                .select()
                .from(schema.zuvyUserLicenses)
                .where(eq(schema.zuvyUserLicenses.id, assignment.licenseId))
            : [];
          report(
            "the class's licence row exists (the failed check didn't roll it back)",
            !!licence,
            licence ? `licence ${licence.id}` : 'missing',
          );
        } finally {
          if (sessions.length) {
            await db
              .delete(schema.licenseAssignments)
              .where(inArray(schema.licenseAssignments.sessionId, sessions));
            await db
              .delete(schema.zuvySessions)
              .where(inArray(schema.zuvySessions.id, sessions));
            classSessionIds.splice(
              0,
              classSessionIds.length,
              ...classSessionIds.filter((id) => !sessions.includes(id)),
            );
          }
          await db
            .delete(schema.zuvyModuleChapter)
            .where(eq(schema.zuvyModuleChapter.title, title));
          if (!placeholderBefore.length) {
            await db
              .delete(schema.zuvyUserLicenses)
              .where(eq(schema.zuvyUserLicenses.zoomEmail, teacher));
          }
        }
      },
    );

    await section(
      'N12. AI-assessment submit: LLM called before the transaction',
      async () => {
        const {
          AiAssessmentService,
        } = require('../src/ai-assessment/ai-assessment.service');
        const ai = app.get(AiAssessmentService);
        const [assessment] = (
          await db.execute(
            sql`SELECT id FROM main.ai_assessment ORDER BY id DESC LIMIT 1`,
          )
        ).rows;
        const [question] = (
          await db.execute(
            sql`SELECT id FROM main.questions_by_llm ORDER BY id DESC LIMIT 1`,
          )
        ).rows;
        if (!assessment || !question) {
          report('dev has an AI assessment and a question to test with', false);
          return;
        }
        const counts = async () =>
          (
            await db.execute(sql`SELECT
            (SELECT count(*) FROM main.question_student_answer_relation WHERE student_id = ${STUDENT}) AS answers,
            (SELECT count(*) FROM main.student_level_relation WHERE student_id = ${STUDENT}) AS levels,
            (SELECT count(*) FROM main.question_evaluation WHERE student_id = ${STUDENT}) AS evaluations`)
          ).rows[0];
        const before = JSON.stringify(await counts());
        const realGenerate = ai.llmService.generate;
        ai.llmService.generate = async () => 'not json, so parsing fails';
        try {
          await expectRefused(
            'unparseable LLM answer: submit fails',
            () =>
              ai.submitLlmAssessment(STUDENT, {
                aiAssessmentId: assessment.id,
                answers: [
                  { id: question.id, selectedAnswerByStudent: { id: 1 } },
                ],
              }),
            /./,
          );
        } finally {
          ai.llmService.generate = realGenerate;
        }
        report(
          'nothing written: answers, level and evaluations unchanged',
          JSON.stringify(await counts()) === before,
        );
      },
    );

    /* ============================================ R. Second review fixes */

    await section(
      'R1. A booking left half-made is released by the job',
      async () => {
        const d = nextDay();
        const makeReserved = async (
          slot: any,
          minutesAgo: number,
          withMeeting: boolean,
        ) => {
          const id = await fixtureBooking(slot.id);
          await db
            .update(schema.zuvyMentorSlotBooking)
            .set({
              meetingLink: withMeeting ? 'https://zoom.invalid/done' : null,
              bookedAt: new Date(Date.now() - minutesAgo * MIN),
            })
            .where(eq(schema.zuvyMentorSlotBooking.id, id));
          return id;
        };
        const stuckSlot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        const freshSlot = await createSlot(at(d, '12:00'), at(d, '12:30'));
        const doneSlot = await createSlot(at(d, '14:00'), at(d, '14:30'));
        const stuck = await makeReserved(stuckSlot, 20, false);
        // Zoom had created its meeting before the request died.
        await db
          .update(schema.zuvyMentorSlotBooking)
          .set({ zoomMeetingId: '990777001' })
          .where(eq(schema.zuvyMentorSlotBooking.id, stuck));
        const fresh = await makeReserved(freshSlot, 2, false);
        const done = await makeReserved(doneSlot, 20, true);
        const outside = await db.execute(sql`
        SELECT count(*)::int AS n FROM main.zuvy_mentor_slot_booking b
        JOIN main.zuvy_mentor_slot_availability s ON s.id = b.slot_availability_id
        WHERE b.status = 'confirmed' AND b.zoom_meeting_id IS NULL AND b.meeting_link IS NULL
          AND b.google_event_id IS NULL AND b.booked_at < now() - interval '15 minutes'
          AND b.booked_at > now() - interval '7 days'
          AND NOT (s.slot_start_date_time >= ${new Date(BASE)} AND s.slot_start_date_time < ${RANGE_END})`);
        if (outside.rows[0].n > 0) {
          report(
            'no stuck bookings in dev outside this test (would be released too)',
            false,
            `${outside.rows[0].n} found`,
          );
          return;
        }
        const released = await svc.releaseAbandonedBookings();
        report(
          'the stuck booking (no meeting, 20 min old) is released',
          !(await bookingRow(stuck)),
          `${released} released`,
        );
        report(
          'its recorded Zoom meeting is deleted',
          deletedMeetingIds.includes('990777001'),
        );
        report(
          'its seat and licence are given back',
          (await holdsFor(stuckSlot.id)).length === 0 &&
            (await slotRow(stuckSlot.id)).currentBookedCount === 0 &&
            (await slotRow(stuckSlot.id)).status === 'available',
        );
        report(
          'a booking still within the 15 minutes is left alone',
          !!(await bookingRow(fresh)) &&
            (await holdsFor(freshSlot.id)).length === 1,
        );
        report(
          'a finished booking is left alone',
          !!(await bookingRow(done)) &&
            (await holdsFor(doneSlot.id)).length === 1,
        );
        report(
          'running it again releases nothing more',
          (await svc.releaseAbandonedBookings()) === 0,
        );

        // Giving the credit back fails: the booking (seat, licence and all)
        // is kept and retried on the next run, not dropped with the
        // student's credit still spent.
        if (CANCEL_RECOUNT_STUBBED) {
          const retrySlot = await createSlot(at(d, '16:00'), at(d, '16:30'));
          const retry = await makeReserved(retrySlot, 20, false);
          recountShouldThrow = true;
          const firstTry = await svc.releaseAbandonedBookings();
          recountShouldThrow = false;
          report(
            'credit undo fails: the booking is kept for the next run',
            firstTry === 0 &&
              !!(await bookingRow(retry)) &&
              (await holdsFor(retrySlot.id)).length === 1,
            `${firstTry} released`,
          );
          const secondTry = await svc.releaseAbandonedBookings();
          report(
            'the next run releases it',
            secondTry === 1 && !(await bookingRow(retry)),
            `${secondTry} released`,
          );
        }
      },
    );

    await section(
      'R2. No reschedule request while a booking is still being set up',
      async () => {
        const d = nextDay();
        const from = await createSlot(at(d, '10:00'), at(d, '10:30'));
        const to = await createSlot(at(d, '12:00'), at(d, '12:30'));
        const b = await fixtureBooking(from.id, STUDENT);
        await db
          .update(schema.zuvyMentorSlotBooking)
          .set({ meetingLink: null })
          .where(eq(schema.zuvyMentorSlotBooking.id, b));
        await expectRefused(
          'proposing a new time is refused with a clear message',
          () =>
            svc.proposeReschedule(
              b,
              to.id,
              'E2E reschedule while setting up',
              STUDENT,
            ),
          /still being set up/,
        );
        // Past the abandoned-booking threshold it is not "being set up" any
        // more, and still can't be moved.
        await db
          .update(schema.zuvyMentorSlotBooking)
          .set({ bookedAt: new Date(Date.now() - 20 * 60_000) })
          .where(eq(schema.zuvyMentorSlotBooking.id, b));
        await expectRefused(
          'an abandoned booking (no link after 15 min) is refused too',
          () =>
            svc.proposeReschedule(
              b,
              to.id,
              'E2E reschedule abandoned',
              STUDENT,
            ),
          /never set up/,
        );
        await db
          .update(schema.zuvyMentorSlotBooking)
          .set({ meetingLink: 'https://zoom.invalid/done' })
          .where(eq(schema.zuvyMentorSlotBooking.id, b));
        await svc.proposeReschedule(
          b,
          to.id,
          'E2E reschedule once set up',
          STUDENT,
        );
        report(
          'once the meeting exists, proposing works',
          (await bookingRow(b)).rescheduleStatus === 'pending',
        );
      },
    );

    await section(
      'R11. Zoom returns no join link: the booking is undone',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await restoreStudentMetrics();
        const creditBefore = await creditStateJson();
        const deletedBefore = deletedMeetingIds.length;
        omitJoinUrlNext = true;
        await expectRefused(
          'the booking fails',
          () => svc.bookSlot(STUDENT, slot.id),
          /./,
        );
        omitJoinUrlNext = false;
        report(
          'no booking is left',
          (await bookingsOnSlot(slot.id)).filter(
            (b: any) => b.status !== 'cancelled',
          ).length === 0,
        );
        report(
          'the seat and licence are free again',
          (await holdsFor(slot.id)).length === 0 &&
            (await slotRow(slot.id)).status === 'available',
        );
        report(
          'the half-made Zoom meeting is deleted',
          deletedMeetingIds.length === deletedBefore + 1,
        );
        report(
          'the student keeps the credit',
          (await creditStateJson()) === creditBefore,
        );
      },
    );

    await section(
      "R3. Allocator: prefers the host's own licence, respects the cooldown tail",
      async () => {
        const d = nextDay();
        const host = hosts[N + 7];
        const ownLicence = realRows[N - 1];
        const [own] = await db
          .insert(schema.licenseAssignments)
          .values({
            licenseId: ownLicence,
            instructorId: host.id,
            sourceType: 'mentor_slot',
            startTime: at(d, '10:00'),
            endTime: at(d, '10:30'),
          })
          .returning({ id: schema.licenseAssignments.id });
        fillerIds.push(Number(own.id));
        const picked = await allocate(
          db,
          host.id,
          at(d, '10:30'),
          at(d, '11:00'),
        );
        report(
          "a host's back-to-back session gets the same licence",
          picked === ownLicence,
          `own ${ownLicence}, picked ${picked}`,
        );

        // An adjacent assignment that holds no licence (here a class row not
        // on Zoom) doesn't steer the choice: the first free licence is used.
        const g = nextDay();
        const host2 = hosts[N + 12];
        const [ghost] = await db
          .insert(schema.licenseAssignments)
          .values({
            licenseId: realRows[N - 1],
            instructorId: host2.id,
            sourceType: 'class_session',
            sessionId: null,
            startTime: at(g, '10:00'),
            endTime: at(g, '10:30'),
          })
          .returning({ id: schema.licenseAssignments.id });
        fillerIds.push(Number(ghost.id));
        const picked2 = await allocate(
          db,
          host2.id,
          at(g, '10:30'),
          at(g, '11:00'),
        );
        report(
          "an adjacent assignment that holds no licence isn't preferred",
          picked2 === realRows[0],
          `first ${realRows[0]}, picked ${picked2}`,
        );

        const e = nextDay();
        const tailLicence = realRows[0];
        for (let i = 1; i < N; i++)
          await filler(i, at(e, '10:00'), at(e, '11:00'));
        const [later] = await db
          .insert(schema.licenseAssignments)
          .values({
            licenseId: tailLicence,
            instructorId: hosts[N + 8].id,
            sourceType: 'mentor_slot',
            startTime: at(e, '11:01'),
            endTime: at(e, '11:30'),
          })
          .returning({ id: schema.licenseAssignments.id });
        fillerIds.push(Number(later.id));
        const result = await allocate(
          db,
          hosts[N + 9].id,
          at(e, '10:00'),
          at(e, '11:00'),
        ).then(
          (id: number) => `picked ${id}`,
          (error: any) => error.message,
        );
        report(
          'a licence needed again within the cooldown is not handed out',
          !/^picked/.test(result),
          result,
        );
      },
    );

    await section(
      'R4. No Zoom sync inside an allocation; sync before it when rows look empty',
      async () => {
        const realCount = lic.getActiveLicensePoolCount;
        const realSync = lic.syncLicensedUsersFromZoom;
        let syncCalls = 0;
        lic.syncLicensedUsersFromZoom = async () => {
          syncCalls += 1;
          return 0;
        };
        try {
          // Allocation itself never syncs, even if the rows look empty.
          lic.getActiveLicensePoolCount = async () => 0;
          const d = nextDay();
          await allocate(
            db,
            hosts[N + 10].id,
            at(d, '10:00'),
            at(d, '10:30'),
          ).catch(() => undefined);
          report(
            'assignLicense makes no Zoom sync call',
            syncCalls === 0,
            `${syncCalls} calls`,
          );

          // The pre-transaction helper does, when the rows look empty...
          await lic.ensureLicencePoolSynced(hosts[N + 10].email);
          report(
            'ensureLicencePoolSynced syncs when no licence row is active',
            syncCalls === 1,
          );

          // ...and not otherwise.
          lic.getActiveLicensePoolCount = realCount;
          syncCalls = 0;
          await lic.ensureLicencePoolSynced(hosts[N + 10].email);
          report(
            'and does nothing when licence rows are active',
            syncCalls === 0,
          );
        } finally {
          lic.getActiveLicensePoolCount = realCount;
          lic.syncLicensedUsersFromZoom = realSync;
        }
      },
    );

    await section(
      'R8. Step 3 committed but its acknowledgement was lost',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await restoreStudentMetrics();
        const realTransaction = db.transaction;
        let calls = 0;
        // The booking's 2nd transaction (step 3) commits, then reports an error.
        db.transaction = async function (...args: any[]) {
          calls += 1;
          const result = await realTransaction.apply(this, args);
          if (calls === 2) throw new Error('E2E: connection lost after COMMIT');
          return result;
        };
        const deletedBefore = deletedMeetingIds.length;
        let response: any = null;
        let failure: string | null = null;
        try {
          response = await svc.bookSlot(STUDENT, slot.id);
          bookingIds.push(response.id);
        } catch (error: any) {
          failure = error.message;
        } finally {
          db.transaction = realTransaction;
        }
        report(
          'the booking is reported as made (not an error)',
          !!response?.id && !failure,
          failure ?? `booking ${response?.id}`,
        );
        const row = response ? await bookingRow(response.id) : null;
        report(
          'its meeting is kept, not deleted',
          !!row?.zoomMeetingId && deletedMeetingIds.length === deletedBefore,
        );
        report(
          'seat and licence stay with it',
          (await holdsFor(slot.id)).length === 1 &&
            (await slotRow(slot.id)).status === 'full',
        );
      },
    );

    await section(
      'R9. ZOOM_TOTAL_LICENSES unset or invalid: a fixed 12, not a live count',
      async () => {
        const saved = process.env.ZOOM_TOTAL_LICENSES;
        try {
          process.env.ZOOM_TOTAL_LICENSES = '12';
          const poolAt12 = await lic.getTransferableLicensePoolCount(db);
          delete process.env.ZOOM_TOTAL_LICENSES;
          report(
            'unset: same pool as ZOOM_TOTAL_LICENSES=12',
            (await lic.getTransferableLicensePoolCount(db)) === poolAt12,
            `pool ${poolAt12}`,
          );
          for (const bad of ['   ', 'abc', '0', '-3', '7.5']) {
            process.env.ZOOM_TOTAL_LICENSES = bad;
            report(
              `"${bad}" falls back to 12`,
              (await lic.getTransferableLicensePoolCount(db)) === poolAt12,
            );
          }
          process.env.ZOOM_TOTAL_LICENSES = '14';
          report(
            'a valid value is used as is',
            (await lic.getTransferableLicensePoolCount(db)) === poolAt12 + 2,
          );
          // The pool doesn't move when the licence rows do (a sync marking
          // rows inactive mid-run must not shrink it).
          delete process.env.ZOOM_TOTAL_LICENSES;
          const realCount = lic.getActiveLicensePoolCount;
          lic.getActiveLicensePoolCount = async () => 0;
          try {
            report(
              'unaffected by the licence rows',
              (await lic.getTransferableLicensePoolCount(db)) === poolAt12,
            );
          } finally {
            lic.getActiveLicensePoolCount = realCount;
          }
        } finally {
          if (saved === undefined) delete process.env.ZOOM_TOTAL_LICENSES;
          else process.env.ZOOM_TOTAL_LICENSES = saved;
        }
      },
    );

    await section('R10. Licence-transfer lock', async () => {
      const other = new Client(ConfigIndex.database);
      await other.connect();
      try {
        // Another server is in the middle of a transfer.
        await other.query('BEGIN');
        await other.query(
          `SELECT pg_advisory_xact_lock(hashtext('zuvy_zoom_license_transfer'))`,
        );
        const started = Date.now();
        await expectRefused(
          'a transfer waiting too long gives up with a clear message',
          () => lic.withLicenceTransferLock(async () => 'ran', 3000),
          /busy being moved between accounts/,
        );
        const secs = (Date.now() - started) / 1000;
        report(
          'it gave up after about the limit',
          secs >= 2.5 && secs < 10,
          `${secs.toFixed(1)}s`,
        );
        const waiting = lic.withLicenceTransferLock(async () => 'ran', 20_000);
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await other.query('COMMIT');
        report(
          'it goes ahead once the other server finishes',
          (await waiting) === 'ran',
        );
      } finally {
        await other.query('ROLLBACK').catch(() => undefined);
        await other.end();
      }

      // Queued in memory behind a slow transfer: the wait is bounded, queue
      // included. It gives up at its limit and its transfer never runs; the
      // queue keeps working for the next one.
      let queuedRan = false;
      const queueStarted = Date.now();
      const slow = lic.withLicenceTransferLock(async () => {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return 'slow';
      }, 30_000);
      const queued = lic.withLicenceTransferLock(async () => {
        queuedRan = true;
        return 'queued';
      }, 1000);
      const queuedOutcome = await queued.then(
        () => 'ran',
        (error: any) => error.message,
      );
      const queuedSecs = (Date.now() - queueStarted) / 1000;
      report(
        'a queued transfer gives up at its limit, not when the queue clears',
        /busy being moved/.test(queuedOutcome) && queuedSecs < 2.5,
        `${queuedOutcome} after ${queuedSecs.toFixed(1)}s`,
      );
      report('the slow transfer ahead still finishes', (await slow) === 'slow');
      report('the one that gave up never ran', queuedRan === false);
      report(
        'the queue still works afterwards',
        (await lic.withLicenceTransferLock(async () => 'next', 5000)) ===
          'next',
      );

      // A transfer whose Zoom call never answers fails at the time limit,
      // and the queue moves on instead of stalling every later transfer.
      const savedLimit = lic.transferWorkTimeoutMs;
      lic.transferWorkTimeoutMs = 1000;
      try {
        const hungStarted = Date.now();
        const hung = await lic
          .withLicenceTransferLock(() => new Promise(() => undefined), 30_000)
          .then(
            () => 'returned',
            (error: any) => error.message,
          );
        report(
          'a hung transfer fails at its time limit',
          /took too long/.test(hung) && Date.now() - hungStarted < 5000,
          `${hung} after ${((Date.now() - hungStarted) / 1000).toFixed(1)}s`,
        );
        report(
          '... and the next transfer still runs',
          (await lic.withLicenceTransferLock(async () => 'after', 5000)) ===
            'after',
        );
      } finally {
        lic.transferWorkTimeoutMs = savedLimit;
      }

      // The transfer finishes, then its lock connection is lost before the
      // lock's transaction ends: the transfer is still reported done.
      let killed = 0;
      let lostResult: any = null;
      let lostError: string | null = null;
      try {
        lostResult = await lic.withLicenceTransferLock(async () => {
          const holder = await db.execute(sql`
            SELECT pid FROM pg_stat_activity
            WHERE usename = current_user AND pid <> pg_backend_pid()
              AND state LIKE 'idle in transaction%'
              AND query ILIKE '%idle_in_transaction_session_timeout%'`);
          for (const row of holder.rows) {
            await db.execute(sql`SELECT pg_terminate_backend(${row.pid}::int)`);
            killed += 1;
          }
          return 'transferred';
        });
      } catch (error: any) {
        lostError = error.message;
      }
      report(
        'lock connection lost after the transfer: still reported done',
        killed === 1 && lostResult === 'transferred',
        lostError ?? `killed ${killed}, result ${lostResult}`,
      );
      report(
        'the app keeps working after that connection was cut',
        (await db.execute(sql`SELECT 1 AS one`)).rows[0].one === 1,
      );

      // Only transactions the licence-lock code opens (other people's
      // sessions on the shared dev database are not this test's business).
      const open = await db.execute(
        sql`SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE usename = current_user AND state LIKE 'idle in transaction%'
              AND (query ILIKE '%advisory%' OR query ILIKE '%idle_in_transaction_session_timeout%')`,
      );
      report(
        'no transaction left open afterwards',
        open.rows[0].n === 0,
        `${open.rows[0].n}`,
      );
    });

    await section(
      'R5. Clean-up script waits for a booking in progress',
      async () => {
        const d = nextDay();
        const slot = await createSlot(at(d, '10:00'), at(d, '10:30'));
        await legacyHold(slot);
        const booker = new Client(ConfigIndex.database);
        await booker.connect();
        let scriptOut = '';
        try {
          // A booking under way: slot row locked, booking row not committed yet.
          await booker.query('BEGIN');
          await booker.query(
            'SELECT id FROM main.zuvy_mentor_slot_availability WHERE id = $1 FOR UPDATE',
            [slot.id],
          );
          const inserted = await booker.query(
            `INSERT INTO main.zuvy_mentor_slot_booking (slot_availability_id, student_user_id, mentor_user_id, organization_id, status, session_lifecycle_state, meeting_link, confirmed_at)
           VALUES ($1, $2, $3, $4, 'confirmed', 'SCHEDULED', 'https://zoom.invalid/fixture', now()) RETURNING id`,
            [slot.id, secondStudent, MENTOR, mgmt.organizationId],
          );
          bookingIds.push(Number(inserted.rows[0].id));
          const { exec } = require('child_process');
          const script = new Promise<string>((resolve) =>
            exec(
              `npx ts-node -r tsconfig-paths/register --transpile-only scripts/release-unbooked-mentor-slot-licences.ts --apply --slot-ids=${slot.id}`,
              { timeout: 300_000 },
              (_e: any, out: string, err: string) => resolve(`${out}${err}`),
            ),
          );
          // Commit only once the script is waiting on the locked slot row.
          let waited = false;
          for (let i = 0; i < 240 && !waited; i++) {
            await new Promise((resolve) => setTimeout(resolve, 500));
            const w =
              await db.execute(sql`SELECT count(*)::int AS n FROM pg_stat_activity
            WHERE usename = current_user AND wait_event_type = 'Lock' AND query ILIKE '%zuvy_mentor_slot_availability%for update%'`);
            waited = w.rows[0].n > 0;
          }
          report('the script waited for the booking in progress', waited);
          await booker.query('COMMIT');
          scriptOut = await script;
        } finally {
          await booker.query('ROLLBACK').catch(() => undefined);
          await booker.end();
        }
        report(
          'the hold of the slot booked meanwhile is kept',
          (await holdsFor(slot.id)).length === 1,
        );
        report(
          'the script removed nothing',
          /Removed 0 licence hold\(s\)/.test(scriptOut),
          scriptOut
            .split('\n')
            .filter((l) => /hold\(s\)/.test(l))
            .join(' / '),
        );
      },
    );

    await section(
      'R6. Slot creation, booking and classes use the same capacity',
      async () => {
        const saved = process.env.ZOOM_TOTAL_LICENSES;
        const protectedSeats = Number(
          (
            await db.execute(
              sql`SELECT count(*)::int AS n FROM main.zuvy_user_licenses WHERE is_protected AND status = 'active' AND license_type = 2`,
            )
          ).rows[0].n,
        );
        // A pool configured smaller than the real licences, as dev's default
        // is: the configured number is the limit for everything (licence
        // rows lag behind Zoom, so they are not counted).
        process.env.ZOOM_TOTAL_LICENSES = String(protectedSeats + 2);
        try {
          report(
            'capacity is the configured pool, not the licence rows',
            (
              await lic.checkLicenseAvailability(
                db,
                {
                  instructorId: hosts[N + 1].id,
                  startTime: at(nextDay(), '13:00'),
                  endTime: at(nextDay(), '13:30'),
                },
                { lock: false },
              )
            ).poolSize === 2,
          );

          const d = nextDay();
          await filler(0, at(d, '10:00'), at(d, '11:00'));
          await filler(1, at(d, '10:00'), at(d, '11:00'));
          await expectRefused(
            'slot refused once the configured pool is full, even with licence rows free',
            () => createSlot(at(d, '10:00'), at(d, '10:30')),
            /No Zoom licence is free/,
          );
          const classResult = await allocate(
            db,
            hosts[N + 13].id,
            at(d, '10:00'),
            at(d, '10:30'),
          ).then(
            (id: number) => `picked ${id}`,
            (error: any) => error.message,
          );
          report(
            '... and a class is refused at the same point',
            !/^picked/.test(classResult),
            classResult,
          );

          // Placeholder seats (taken when no licence row was free) count too:
          // a free row is refused when the pool is full at the peak.
          const p = nextDay();
          const [placeholder] = await db
            .insert(schema.zuvyUserLicenses)
            .values({
              zoomEmail: 'e2e-placeholder@zuvy.invalid',
              userName: 'e2e placeholder',
              licenseType: 1,
              status: 'active',
              isProtected: false,
            } as any)
            .returning({ id: schema.zuvyUserLicenses.id });
          // With the pool configured to all N licences.
          process.env.ZOOM_TOTAL_LICENSES = String(protectedSeats + N);
          try {
            for (let i = 0; i < N - 1; i++)
              await filler(i, at(p, '10:00'), at(p, '11:00'));
            const [onPlaceholder] = await db
              .insert(schema.licenseAssignments)
              .values({
                licenseId: Number(placeholder.id),
                instructorId: hosts[N + 14].id,
                sourceType: 'mentor_slot',
                startTime: at(p, '10:00'),
                endTime: at(p, '11:00'),
              })
              .returning({ id: schema.licenseAssignments.id });
            fillerIds.push(Number(onPlaceholder.id));
            const overResult = await allocate(
              db,
              hosts[N + 15].id,
              at(p, '10:00'),
              at(p, '10:30'),
            ).then(
              (id: number) => `picked ${id}`,
              (error: any) => error.message,
            );
            report(
              'a free licence row is refused when placeholder seats fill the pool',
              !/^picked/.test(overResult),
              overResult,
            );
          } finally {
            await db
              .delete(schema.licenseAssignments)
              .where(
                eq(schema.licenseAssignments.licenseId, Number(placeholder.id)),
              );
            await db
              .delete(schema.zuvyUserLicenses)
              .where(eq(schema.zuvyUserLicenses.id, Number(placeholder.id)));
            process.env.ZOOM_TOTAL_LICENSES = String(protectedSeats + 2);
          }

          // The configured pool's last licence (1 of 2 in use).
          const g = nextDay();
          await filler(0, at(g, '10:00'), at(g, '11:00'));
          const slot = await createSlot(at(g, '10:00'), at(g, '10:30'));
          await restoreStudentMetrics();
          const booked = await svc.bookSlot(STUDENT, slot.id);
          bookingIds.push(booked.id);
          report(
            'a slot that passed creation can be booked (last licence)',
            !!booked?.id,
          );
        } finally {
          if (saved === undefined) delete process.env.ZOOM_TOTAL_LICENSES;
          else process.env.ZOOM_TOTAL_LICENSES = saved;
        }
      },
    );

    await section('R7. Recurring slots: one batch check', async () => {
      const d = nextDay();
      dayCounter += 25;
      const rule = (start: Date, count: number) =>
        `DTSTART:${iso(start).replace(/[-:]/g, '').slice(0, 15)}Z\nRRULE:FREQ=DAILY;COUNT=${count}`;
      await fillPool(at(d + 3, '18:00'), at(d + 3, '19:00'));
      await fillPool(at(d + 7, '18:00'), at(d + 7, '19:00'));
      const started = Date.now();
      await expectRefused(
        '20 daily slots, 2 days full: refused listing exactly those 2',
        () =>
          recurrence.generateRecurringSlots(
            {
              mentorSlotManagementId: mgmt.id,
              slotStart: at(d, '18:15'),
              slotEnd: at(d, '18:45'),
              recurrenceRule: rule(at(d, '18:15'), 20),
              recurrenceEndDate: at(d + 21, '00:00'),
            },
            MENTOR,
          ),
        /No Zoom licence is free for 2 of these slot times/,
      );
      const secs = (Date.now() - started) / 1000;
      report(
        'the whole check is quick (one load, not one per slot)',
        secs < 15,
        `${secs.toFixed(1)}s`,
      );
      const e = d + 22;
      await recurrence.generateRecurringSlots(
        {
          mentorSlotManagementId: mgmt.id,
          slotStart: at(e, '18:15'),
          slotEnd: at(e, '18:45'),
          recurrenceRule: rule(at(e, '18:15'), 3),
          recurrenceEndDate: at(e + 3, '00:00'),
        },
        MENTOR,
      );
      const made = [
        ...(await slotsInDay(e)),
        ...(await slotsInDay(e + 1)),
        ...(await slotsInDay(e + 2)),
      ];
      report(
        'when all times are free, all are created',
        made.length === 3,
        `${made.length}`,
      );
    });

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
    // Retried: if a connection was cut mid-transaction, the server can hold
    // that transaction's row locks until its idle limit (2 min) ends it.
    if (allSlotIds.length) {
      for (let attempt = 1; ; attempt++) {
        try {
          await db
            .delete(schema.zuvyMentorSlotAvailability)
            .where(inArray(schema.zuvyMentorSlotAvailability.id, allSlotIds));
          break;
        } catch (error: any) {
          if (error?.code !== '55P03' || attempt >= 6) throw error;
          console.log(
            `Clean-up: test slots still locked, retrying (${attempt})`,
          );
        }
      }
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
    svc.mentorshipConfig.setOverridesForTesting(null);
    if (savedTotalLicences === undefined)
      delete process.env.ZOOM_TOTAL_LICENSES;
    else process.env.ZOOM_TOTAL_LICENSES = savedTotalLicences;
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
