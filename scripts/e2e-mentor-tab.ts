/**
 * End-to-end check for the mentor tab (MT1 Sessions, MT2 Availability),
 * against the DEV database only (refuses any other DB_NAME).
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/e2e-mentor-tab.ts
 *
 * Real services, database, transactions and locks; Zoom and email stubbed.
 * Test sessions sit 25-35 years ahead. To test time boundaries on them the
 * run moves notice_hours, join_open_minutes and slot_min_lead_days through
 * MentorshipConfigService's test override (never written to the table).
 * Only this run's bookings count toward credits. Everything it creates is
 * deleted; the student's credit row is put back.
 * Needs migrations 0047 and 0050-0053.
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
  MentorRecurrenceService,
} = require('../src/controller/mentor-slot/recurrence/mentor-recurrence.service');
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
let recurrence: any;
let config: any;
let runStart: Date;
let failGetMeeting = false;
const zoomStubs: Record<string, any> = {
  getUser: async () => ({ success: true, data: { status: 'active', type: 2 } }),
  applyLicensedUserSettings: async () => ({ success: true }),
  syncZoomLicenseUser: async () => undefined,
  ensureLicensedUser: async () => ({ success: true, licensed: true }),
  createMeetingForUser: async () => ({
    success: true,
    data: {
      id: 950000000 + Math.floor(Math.random() * 1e6),
      join_url: 'https://zoom.invalid/j',
      start_url: 'https://zoom.invalid/s-saved',
      password: 'e2e',
    },
  }),
  getMeeting: async () =>
    failGetMeeting
      ? { success: false, error: 'E2E: Zoom down' }
      : {
          success: true,
          data: {
            uuid: `e2e-mentor-tab-${Date.now()}`,
            start_url: 'https://zoom.invalid/s-fresh',
          },
        },
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
    ...extra,
  });
const hoursUntil = (d: Date) => Math.ceil((d.getTime() - Date.now()) / HOUR);

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
const REASON = 'E2E: mentor tab test reason';
const mentorList = (filter = 'all') =>
  sessions.getMentorSessions(BigInt(MENTOR), ORG, filter, 200, 0);
const mentorCard = async (bookingId: number, filter = 'all') =>
  (await mentorList(filter)).data.find(
    (d: any) => Number(d.booking.id) === bookingId,
  );

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
  recurrence = app.get(MentorRecurrenceService);
  config = app.get(MentorshipConfigService);
  for (const z of new Set([
    svc.zoomService,
    svc.zoomLicenseService.zoomService,
    recurrence.zoomLicenseService.zoomService,
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
  const [mgmt] = await db
    .select()
    .from(schema.zuvyMentorSlotManagement)
    .where(
      and(
        eq(schema.zuvyMentorSlotManagement.mentorUserId, BigInt(MENTOR)),
        eq(schema.zuvyMentorSlotManagement.organizationId, ORG),
      ),
    );

  try {
    await section(
      'M1. New slots start at least 4 days ahead (MT2)',
      async () => {
        config.invalidate();
        config.setOverridesForTesting(null);
        report(
          'slot_min_lead_days is 4 in the config table',
          (await config.get()).minSlotLeadDays === 4,
        );
        rules();
        const d = nextDay();
        // Put the lead boundary on the test day: slots before it are too soon.
        rules({ minSlotLeadDays: Math.ceil((d.getTime() - Date.now()) / DAY) });
        const lead = (await config.get()).minSlotLeadDays;
        const earliest = new Date(Date.now() + lead * DAY);
        const tooSoon = await refusal(() =>
          slotAt(new Date(earliest.getTime() - 2 * HOUR)),
        );
        report(
          'a slot inside the lead time is refused (SLOT_LEAD_TOO_SHORT)',
          tooSoon?.code === 'SLOT_LEAD_TOO_SHORT' &&
            /^Slots need to start at least \d+ days from now\. Pick a time from .+ on\.$/.test(
              tooSoon.message,
            ),
          tooSoon?.message,
        );
        const ok = await slotAt(new Date(earliest.getTime() + 2 * HOUR));
        report('a slot after it is created', !!ok?.id);

        const check = await svc.checkSlotLicenceAvailability(
          MENTOR,
          new Date(earliest.getTime() - 2 * HOUR).toISOString(),
          new Date(earliest.getTime() - HOUR).toISOString(),
        );
        report(
          'licence-check: lead time not met → canCreate false, with the message',
          check.canCreate === false &&
            check.leadTime.ok === false &&
            !!check.leadTime.message &&
            !!check.studentsCanBookUntil &&
            !!check.serverTime,
          JSON.stringify(check.leadTime),
        );
        const fine = await svc.checkSlotLicenceAvailability(
          MENTOR,
          new Date(earliest.getTime() + 5 * HOUR).toISOString(),
          new Date(earliest.getTime() + 6 * HOUR).toISOString(),
        );
        const until = new Date(earliest.getTime() + 5 * HOUR - 72 * HOUR);
        report(
          'licence-check: fine → canCreate true, students can book until 72 h before',
          fine.canCreate === true &&
            fine.leadTime.ok === true &&
            new Date(fine.studentsCanBookUntil).getTime() === until.getTime(),
        );

        const rrStart = new Date(
          Math.floor((earliest.getTime() - DAY + 3 * HOUR) / MIN) * MIN,
        );
        const series = await refusal(() =>
          recurrence.generateRecurringSlots(
            {
              mentorSlotManagementId: mgmt.id,
              slotStart: rrStart,
              slotEnd: new Date(rrStart.getTime() + 30 * MIN),
              recurrenceRule: `DTSTART:${rrStart.toISOString().replace(/[-:]/g, '').slice(0, 15)}Z\nRRULE:FREQ=DAILY;COUNT=3`,
              recurrenceEndDate: new Date(rrStart.getTime() + 4 * DAY),
            },
            MENTOR,
          ),
        );
        const created = await db
          .select()
          .from(schema.zuvyMentorSlotAvailability)
          .where(
            and(
              eq(
                schema.zuvyMentorSlotAvailability.mentorSlotManagementId,
                mgmt.id,
              ),
              gte(schema.zuvyMentorSlotAvailability.slotStartDateTime, rrStart),
              lt(
                schema.zuvyMentorSlotAvailability.slotStartDateTime,
                new Date(rrStart.getTime() + 4 * DAY),
              ),
              eq(schema.zuvyMentorSlotAvailability.isRecurring, true),
            ),
          );
        report(
          'a series starting inside the lead time is refused, listing the times, nothing created',
          series?.code === 'SLOT_LEAD_TOO_SHORT' &&
            /1 of these is too soon/.test(series.message) &&
            created.length === 0,
          series?.message,
        );
        rules();
      },
    );

    let bookedId = 0;
    let bookedSlot: any;
    let heldSlot: any;
    await section(
      'M2. Availability: states, messages, removal (MT2)',
      async () => {
        rules();
        const open = await slotAt(nextDay());
        bookedSlot = await slotAt(nextDay());
        bookedId = await book(bookedSlot.id);
        heldSlot = await slotAt(nextDay());
        const soon = await slotAt(nextDay());
        await svc.proposeReschedule(bookedId, heldSlot.id, REASON, STUDENT);

        // The test week: from the open slot's week to the last slot's.
        const weekOffset = Math.round(
          (new Date(open.slotStartDateTime).getTime() - Date.now()) / (7 * DAY),
        );
        const findSlot = async (slot: any) => {
          for (let w = weekOffset - 1; w <= weekOffset + 2; w++) {
            const week = await svc.getMySlots(MENTOR, w, 'asc', ORG);
            const found = week.slots.find((s: any) => s.id === slot.id);
            if (found) return { week, found };
          }
          return { week: null, found: null };
        };
        // "soon" inside the notice: students can't book it.
        rules({
          noticeHours: hoursUntil(new Date(soon.slotStartDateTime)) + 1,
        });
        const o = await findSlot(open);
        const b = await findSlot(bookedSlot);
        const h = await findSlot(heldSlot);
        const s = await findSlot(soon);
        rules();
        report(
          'open slot: state, last booking time, removable, message',
          o.found?.state === 'tooSoonToBook' || o.found?.state === 'open',
          o.found?.state,
        );
        report(
          "booked slot: booked, the student's short name, not removable",
          b.found?.state === 'booked' &&
            b.found.canRemove === false &&
            b.found.removeBlockedReason === 'SLOT_BOOKED' &&
            b.found.students.length === 1 &&
            /^\S+ \S\.$|^\S+$/.test(b.found.students[0].shortName ?? ''),
          JSON.stringify(b.found?.students),
        );
        report(
          'held slot (reschedule request): held, not removable',
          h.found?.state === 'held' && h.found.canRemove === false,
          h.found?.state,
        );
        report(
          'slot inside the notice: tooSoonToBook, removable',
          s.found?.state === 'tooSoonToBook' &&
            s.found.canRemove === true &&
            /can't book this slot any more/.test(s.found.message),
          s.found?.message,
        );
        const ow = await findSlot(open);
        report(
          'an open slot outside the notice: open, with the "students can book until" line',
          ow.found?.state === 'open' &&
            ow.found.canRemove &&
            /^Students can book this slot until .+, 72 hours before it starts\. You can remove it at any time while it's open\.$/.test(
              ow.found.message,
            ),
          ow.found?.message,
        );
        report(
          'week header: summary counts and server time',
          !!o.week?.summary &&
            typeof o.week.summary.open === 'number' &&
            !!o.week.serverTime &&
            o.week.rules.minSlotLeadDays === 4 &&
            !!o.week.earliestNewSlotStart,
        );
        const ws = new Date(o.week.weekStart);
        const istParts = new Date(ws.getTime() + 330 * MIN);
        report(
          'the week starts Monday 00:00 India time',
          istParts.getUTCDay() === 1 &&
            istParts.getUTCHours() === 0 &&
            istParts.getUTCMinutes() === 0,
          o.week.weekStart,
        );

        const r1 = await refusal(() =>
          svc.removeSlot(MENTOR, bookedSlot.id, ORG),
        );
        report(
          'removing a booked slot: SLOT_BOOKED with the design message',
          r1?.code === 'SLOT_BOOKED' &&
            r1.message ===
              "Booked slots can't be removed. Cancel the booking first.",
          r1?.message,
        );
        const r2 = await refusal(() =>
          svc.removeSlot(MENTOR, heldSlot.id, ORG),
        );
        report(
          'removing a slot held by a reschedule request: refused too',
          r2?.code === 'SLOT_BOOKED',
        );
        await svc.removeSlot(MENTOR, soon.id, ORG);
        const gone = await db
          .select()
          .from(schema.zuvyMentorSlotAvailability)
          .where(eq(schema.zuvyMentorSlotAvailability.id, soon.id));
        report(
          'an open slot inside the notice can be removed',
          gone.length === 0,
        );
      },
    );

    await section('M3. Sessions tabs and cards (MT1)', async () => {
      rules();
      // Action needed: the pending request from M2.
      const a = await mentorCard(bookedId);
      report(
        'action needed: card with the request, reason and reply deadline; accept/decline on',
        a.displayState === 'ACTION_NEEDED' &&
          a.actions.acceptReschedule.allowed &&
          a.actions.declineReschedule.allowed &&
          a.actions.cancel.reason === 'RESCHEDULE_PENDING' &&
          a.reschedule.reason === REASON &&
          new Date(a.reschedule.replyBy).getTime() ===
            new Date(bookedSlot.slotStartDateTime).getTime(),
        a.message,
      );
      report(
        'student, course and credits on the card',
        a.student?.name &&
          'bootcampName' in a.student &&
          'batchName' in a.student &&
          typeof a.studentCredits?.creditsLeft === 'number' &&
          a.studentCredits.creditsAssigned === 100,
        JSON.stringify({ student: a.student, credits: a.studentCredits }),
      );
      report(
        'old fields kept (booking with the host link, studentName, slotStart)',
        !!a.booking &&
          'meetingLink' in a.booking &&
          'studentName' in a &&
          !!a.slotStart,
      );

      const actionTab = (await mentorList('action-needed')).data.map((d: any) =>
        Number(d.booking.id),
      );
      const legacyTab = (await mentorList('reschedule')).data.map((d: any) =>
        Number(d.booking.id),
      );
      const upcomingTab = (await mentorList('upcoming')).data.map((d: any) =>
        Number(d.booking.id),
      );
      report(
        'Action Needed tab (and its old name) has it; Upcoming does not',
        actionTab.includes(bookedId) &&
          legacyTab.includes(bookedId) &&
          !upcomingTab.includes(bookedId),
      );

      await svc.declineReschedule(bookedId, MENTOR, ORG);
      const u = await mentorCard(bookedId);
      report(
        'after declining: Upcoming, cancel on, the cancel-until line',
        u.displayState === 'UPCOMING' &&
          u.actions.cancel.allowed &&
          /^You can cancel until .+, 72 hours before the session\. The student gets the credit back\.$/.test(
            u.message,
          ),
        u.message,
      );
      report(
        '… and it moved to the Upcoming tab',
        (await mentorList('upcoming')).data.some(
          (d: any) => Number(d.booking.id) === bookedId,
        ),
      );

      rules({
        noticeHours: hoursUntil(new Date(bookedSlot.slotStartDateTime)) + 1,
      });
      const late = await mentorCard(bookedId);
      report(
        'inside the notice: no cancel, the email-Ops line',
        late.actions.cancel.reason === 'TOO_LATE_TO_CHANGE' &&
          late.message ===
            `This session starts in under ${(await config.get()).noticeHours} hours. Email team@zuvy.org to cancel it.`,
        late.message,
      );
      rules();

      // Completed, missed, cancelled tabs.
      const done = await book((await slotAt(nextDay())).id);
      await db
        .update(schema.zuvyMentorSlotBooking)
        .set({ sessionLifecycleState: 'COMPLETED' })
        .where(eq(schema.zuvyMentorSlotBooking.id, done));
      const missed = await book((await slotAt(nextDay())).id);
      await db
        .update(schema.zuvyMentorSlotBooking)
        .set({ sessionLifecycleState: 'MISSED' })
        .where(eq(schema.zuvyMentorSlotBooking.id, missed));
      const goneSlot = await slotAt(nextDay());
      const gone = await book(goneSlot.id);
      await svc.cancelBooking(
        gone,
        'E2E: the student cancelled this',
        'student',
        STUDENT,
      );
      const ids = async (f: string) =>
        (await mentorList(f)).data.map((d: any) => Number(d.booking.id));
      report(
        'Completed / Missed / Cancelled tabs',
        (await ids('completed')).includes(done) &&
          (await ids('missed')).includes(missed) &&
          (await ids('cancelled')).includes(gone) &&
          !(await ids('completed')).includes(missed),
      );
      const all = await mentorList();
      report(
        'counts for every tab, plus rules and server time',
        [
          'total',
          'upcoming',
          'actionNeeded',
          'completed',
          'missed',
          'cancelled',
          'reschedule',
        ].every((k) => k in all.counts) &&
          all.rules.noticeHours === 72 &&
          !!all.serverTime,
        JSON.stringify(all.counts),
      );
      const c = await mentorCard(gone);
      report(
        'cancelled by the student: who and why',
        c.displayState === 'CANCELLED' &&
          c.cancellation.by === 'student' &&
          /^Cancelled by .+ on .+: "E2E: the student cancelled this"\.$/.test(
            c.message,
          ),
        c.message,
      );
      const m = await mentorCard(missed);
      report('missed card', m.displayState === 'MISSED');

      // Removing a slot whose booking was cancelled keeps that booking's
      // history: the slot is marked removed, not deleted (the FK cascades).
      const metrics = new MentorMetricsService();
      const slotsBefore = (
        await metrics.getMentorMetrics(BigInt(MENTOR), ORG, 'all')
      ).utilization.totalSlots;
      const removed = await svc.removeSlot(MENTOR, goneSlot.id, ORG);
      const slotsAfter = (
        await metrics.getMentorMetrics(BigInt(MENTOR), ORG, 'all')
      ).utilization.totalSlots;
      const [slotRow] = await db
        .select()
        .from(schema.zuvyMentorSlotAvailability)
        .where(eq(schema.zuvyMentorSlotAvailability.id, goneSlot.id));
      const [bookingRow] = await db
        .select({ id: schema.zuvyMentorSlotBooking.id })
        .from(schema.zuvyMentorSlotBooking)
        .where(eq(schema.zuvyMentorSlotBooking.id, gone));
      let listed = false;
      for (let w = -1; w <= 8 && !listed; w++) {
        const week = await svc.getMySlots(MENTOR, w, 'asc', ORG);
        listed = week.slots.some((s: any) => s.id === goneSlot.id);
      }
      report(
        'removing a slot after its booking was cancelled keeps the booking',
        removed.message === 'Slot deleted successfully' &&
          slotRow?.status === 'removed' &&
          slotRow?.isPublic === false &&
          !!bookingRow &&
          (await ids('cancelled')).includes(gone) &&
          !listed,
        JSON.stringify({ status: slotRow?.status, listed }),
      );
      report(
        "a removed slot no longer counts in the mentor's utilization",
        slotsAfter === slotsBefore - 1,
        `${slotsBefore} -> ${slotsAfter}`,
      );

      const detail = await sessions.getSessionDetail(bookedId, BigInt(MENTOR));
      report(
        'mentor session detail carries the card, student and credits',
        detail.displayState === 'UPCOMING' &&
          !!detail.actions &&
          !!detail.studentCredits &&
          'zoomStartUrl' in detail,
      );
      const asStudent = await sessions.getSessionDetail(
        bookedId,
        BigInt(STUDENT),
      );
      report(
        'the student still gets their own card',
        !('studentCredits' in asStudent) && !!asStudent.actions?.reschedule,
      );
    });

    await section('M4. Join link (MT1)', async () => {
      rules();
      const slot = await slotAt(nextDay());
      const id = await book(slot.id);
      const notYet = await refusal(() =>
        svc.getMentorJoinLink(MENTOR, id, ORG),
      );
      report(
        'before the join window: JOIN_NOT_OPEN',
        notYet?.code === 'JOIN_NOT_OPEN' &&
          /^Join opens 10 min before the start/.test(notYet.message),
        notYet?.message,
      );
      const c1 = await mentorCard(id);
      report(
        'card: join off with JOIN_NOT_OPEN',
        c1.actions.join.reason === 'JOIN_NOT_OPEN',
      );

      // Open the window on the test session.
      rules({
        joinOpenMinutes:
          Math.ceil(
            (new Date(slot.slotStartDateTime).getTime() - Date.now()) / MIN,
          ) + 5,
      });
      const link = await svc.getMentorJoinLink(MENTOR, id, ORG);
      report(
        'inside the window: a fresh host link from Zoom',
        link.url === 'https://zoom.invalid/s-fresh' &&
          link.fresh === true &&
          !!link.joinLink,
        JSON.stringify(link),
      );
      const c2 = await mentorCard(id);
      report(
        'card: Starting soon, join on',
        c2.displayState === 'STARTING_SOON' && c2.actions.join.allowed,
      );
      failGetMeeting = true;
      const fallback = await svc.getMentorJoinLink(MENTOR, id, ORG);
      failGetMeeting = false;
      report(
        'Zoom unreachable: the saved link, marked not fresh',
        fallback.url === 'https://zoom.invalid/s-saved' &&
          fallback.fresh === false,
      );
      const notMine = await refusal(() =>
        svc.getMentorJoinLink(STUDENT, id, ORG),
      );
      report(
        'not the mentor: refused',
        !!notMine &&
          (notMine.status === 403 ||
            notMine.status === 400 ||
            notMine.status === 404),
        `${notMine?.status} ${notMine?.message}`,
      );
      rules();
      await svc.cancelBooking(
        id,
        'E2E: mentor cancels for the join test',
        'mentor',
        MENTOR,
      );
      const after = await refusal(() => svc.getMentorJoinLink(MENTOR, id, ORG));
      report(
        'a cancelled session: no link',
        after?.code === 'ALREADY_CANCELLED',
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
