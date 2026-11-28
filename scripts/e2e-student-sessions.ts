/**
 * End-to-end check for the student's My Sessions API (ST3/ST4 cards),
 * against the DEV database only (refuses any other DB_NAME).
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/e2e-student-sessions.ts
 *
 * Books real sessions 25-35 years ahead through bookSlot (Zoom and email
 * stubbed), puts them in each state the design shows, and checks what
 * GET /student/mentor-sessions/my and the session detail return. Only this
 * run's bookings count toward credits (test-only config override). Every
 * row it creates is deleted, and the student's credit row is put back.
 * The card logic itself, minute by minute, is in session-card.spec.ts.
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
const DAY = 24 * 60 * MIN;

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
let dayCounter = 0;
const nextDay = () => new Date(BASE + (dayCounter += 2) * DAY + 10 * 60 * MIN);

let svc: any;
let sessions: any;
let meetingSeq = 0;
const zoomStubs: Record<string, any> = {
  getUser: async () => ({ success: true, data: { status: 'active', type: 2 } }),
  applyLicensedUserSettings: async () => ({ success: true }),
  syncZoomLicenseUser: async () => undefined,
  ensureLicensedUser: async () => ({ success: true, licensed: true }),
  createMeetingForUser: async () => {
    meetingSeq += 1;
    return {
      success: true,
      data: {
        id: 970000000 + meetingSeq,
        join_url: `https://zoom.invalid/j/${meetingSeq}`,
        start_url: 'https://zoom.invalid/s',
        password: 'e2e',
      },
    };
  },
  getMeeting: async () => ({
    success: true,
    data: { uuid: `e2e-sessions-${Date.now()}-${meetingSeq}` },
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
async function bookedSession() {
  const slot = await slotAt(nextDay());
  const booked = await svc.bookSlot(STUDENT, slot.id);
  return { slot, bookingId: Number(booked.id) };
}
const setBooking = (id: number, values: any) =>
  db
    .update(schema.zuvyMentorSlotBooking)
    .set(values)
    .where(eq(schema.zuvyMentorSlotBooking.id, id));

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
  const config = app.get(MentorshipConfigService);
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
  // Only this run's bookings count; no gap, so it can book several.
  config.setOverridesForTesting({
    creditsCountedFrom: new Date(),
    totalCredits: 100,
    gapDays: 0,
    noticeHours: 72,
  });
  const ids: Record<string, number> = {};

  const fetchAll = async (filter = 'all') => {
    const out = await sessions.getStudentSessions(
      BigInt(STUDENT),
      filter,
      200,
      0,
    );
    return out;
  };
  const cardOf = async (bookingId: number, filter = 'all') =>
    (await fetchAll(filter)).data.find(
      (d: any) => Number(d.booking.id) === bookingId,
    );

  try {
    await section('M1. States wired from real data', async () => {
      // Upcoming (far ahead), and a second that will be cancelled by the student.
      const up = await bookedSession();
      ids.upcoming = up.bookingId;

      // Reschedule waiting for the mentor: proposed slot on another day.
      const rs = await bookedSession();
      const target = await slotAt(nextDay());
      await setBooking(rs.bookingId, {
        rescheduleStatus: 'pending',
        rescheduleRequestedAt: new Date(),
        rescheduleProposedSlotId: target.id,
        sessionLifecycleState: 'RESCHEDULE_PENDING',
      });
      ids.reschedule = rs.bookingId;

      // Completed with a finished recording.
      const done = await bookedSession();
      await setBooking(done.bookingId, {
        sessionLifecycleState: 'COMPLETED',
        completedAt: new Date(),
      });
      await db.insert(schema.zuvyMentorSessionRecordings).values({
        mentorBookingId: done.bookingId,
        zoomMeetingId: 'e2e',
        status: 'COMPLETED',
        driveLink: 'https://youtu.be/e2e',
      });
      ids.completed = done.bookingId;

      const c = await cardOf(ids.upcoming);
      report(
        'upcoming: state, actions with reasons, message, times',
        c.displayState === 'UPCOMING' &&
          c.actions.cancel.allowed &&
          c.actions.reschedule.allowed &&
          c.actions.join.allowed === false &&
          c.actions.join.reason === 'JOIN_NOT_OPEN' &&
          /^Reschedule or cancel until /.test(c.message) &&
          new Date(c.changesCloseAt).getTime() ===
            new Date(c.slotStart).getTime() - 72 * 60 * MIN &&
          new Date(c.joinOpensAt).getTime() ===
            new Date(c.slotStart).getTime() - 10 * MIN,
        `${c.displayState} ${c.message}`,
      );
      report(
        'old fields still there (booking, mentorName, slotStart, slotEnd) + mentorTitle',
        !!c.booking &&
          'mentorName' in c &&
          !!c.slotStart &&
          !!c.slotEnd &&
          'mentorTitle' in c &&
          !('zoomStartUrl' in c.booking),
      );

      const r = await cardOf(ids.reschedule);
      report(
        'reschedule requested: proposed time from the proposed slot, reply by the original start, cancel blocked',
        r.displayState === 'RESCHEDULE_REQUESTED' &&
          new Date(r.reschedule.proposedStart).getTime() ===
            new Date(target.slotStartDateTime).getTime() &&
          new Date(r.reschedule.replyBy).getTime() ===
            new Date(r.slotStart).getTime() &&
          r.actions.cancel.reason === 'RESCHEDULE_PENDING',
        r.message,
      );

      const d = await cardOf(ids.completed);
      report(
        'completed: recording ready from the recordings table, feedback open',
        d.displayState === 'COMPLETED' &&
          d.recording.state === 'READY' &&
          d.actions.viewRecording.url === 'https://youtu.be/e2e' &&
          d.actions.giveFeedback.allowed,
        JSON.stringify(d.recording),
      );
    });

    await section('M2. Cancelled and missed', async () => {
      const mine = await bookedSession();
      await svc.cancelBooking(
        mine.bookingId,
        'E2E: exam clash today',
        'student',
        STUDENT,
      );
      const c = await cardOf(mine.bookingId);
      report(
        'cancelled by the student',
        c.displayState === 'CANCELLED' &&
          c.cancellation.by === 'you' &&
          /^Cancelled by you on /.test(c.message) &&
          c.usesCredit === false &&
          c.recording.state === 'NOT_HELD',
        c.message,
      );

      const theirs = await bookedSession();
      await svc.cancelBooking(
        theirs.bookingId,
        'Unwell today, sorry',
        'mentor',
        MENTOR,
      );
      const m = await cardOf(theirs.bookingId);
      report(
        'cancelled by the mentor: name and reason',
        m.cancellation.by === 'mentor' &&
          m.cancellation.reason === 'Unwell today, sorry' &&
          m.message.includes('"Unwell today, sorry"'),
        m.message,
      );

      const missed = await bookedSession();
      await setBooking(missed.bookingId, { sessionLifecycleState: 'MISSED' });
      const x = await cardOf(missed.bookingId);
      report(
        'missed: uses the credit',
        x.displayState === 'MISSED' &&
          x.usesCredit === true &&
          /^You didn't join/.test(x.message),
        x.message,
      );
      await db.insert(schema.zuvyMentorSessionAttendance).values({
        mentorBookingId: missed.bookingId,
        status: 'RECORDED',
        outcome: 'MENTOR_NO_SHOW',
        creditRefunded: true,
      });
      const y = await cardOf(missed.bookingId);
      report(
        'mentor no-show: credit returned (from the attendance table)',
        y.usesCredit === false &&
          /didn't join, so your credit was returned/.test(y.message),
        y.message,
      );
      ids.missed = missed.bookingId;
    });

    await section('M3. Header, filters and counts', async () => {
      const all = await fetchAll();
      const elig = await svc.getBookingEligibility(STUDENT);
      report(
        'credit header matches the eligibility endpoint',
        JSON.stringify(all.credits) === JSON.stringify(elig.credits) &&
          all.rules.noticeHours === 72 &&
          all.rules.joinOpenMinutes === 10 &&
          !!all.serverTime,
        JSON.stringify(all.credits),
      );
      const upcoming = (await fetchAll('upcoming')).data.map((d: any) =>
        Number(d.booking.id),
      );
      report(
        'upcoming includes a session with a pending reschedule',
        upcoming.includes(ids.reschedule) &&
          upcoming.includes(ids.upcoming) &&
          !upcoming.includes(ids.completed),
      );
      const missed = (await fetchAll('missed')).data.map((d: any) =>
        Number(d.booking.id),
      );
      report(
        'missed filter',
        missed.includes(ids.missed) && !missed.includes(ids.upcoming),
      );
      report(
        'counts include missed, and upcoming counts the pending reschedule',
        Number(all.counts.missed) >= 1 && Number(all.counts.upcoming) >= 2,
        JSON.stringify(all.counts),
      );
    });

    await section('M4. Session detail', async () => {
      const asStudent = await sessions.getSessionDetail(
        ids.reschedule,
        BigInt(STUDENT),
      );
      report(
        'student detail carries the card',
        asStudent.displayState === 'RESCHEDULE_REQUESTED' &&
          !!asStudent.actions &&
          !!asStudent.reschedule &&
          !('zoomStartUrl' in asStudent),
        asStudent.message,
      );
      const asMentor = await sessions.getSessionDetail(
        ids.reschedule,
        BigInt(MENTOR),
      );
      report(
        'mentor detail: the mentor card, not the student card',
        asMentor.displayState === 'ACTION_NEEDED' &&
          'studentCredits' in asMentor &&
          !('rescheduleOutcome' in asMentor) &&
          'zoomStartUrl' in asMentor,
      );
    });
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
    if (bookingIds.length) {
      await db
        .delete(schema.zuvyNotifications)
        .where(
          and(
            eq(schema.zuvyNotifications.referenceType, 'booking'),
            inArray(schema.zuvyNotifications.referenceId, bookingIds),
          ),
        );
    }
    // Deleting the slots cascades to bookings, attendance, recordings and holds.
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
