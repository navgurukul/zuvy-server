/**
 * End-to-end check for mentor session attendance and the no-show credit
 * rules, against the DEV database only (refuses any other DB_NAME).
 *
 *   npx ts-node -r tsconfig-paths/register --transpile-only scripts/e2e-mentor-attendance.ts
 *
 * Needs migration 0047. Case 1 uses real Zoom end to end. The other cases
 * drive the real job, DB, transactions and credit recount with Zoom's answer
 * scripted, since nobody can join a meeting from a script. Cron jobs and
 * background workers are stopped in this process, so only this script's own
 * bookings are touched. Each booking is cleaned up through the real
 * cancelBooking flow, and its attendance row is deleted at the end.
 *
 * The test student must have at least 2 credits left this quota year.
 * Override the dev users with E2E_MENTOR_ID / E2E_STUDENT_ID / E2E_ORG_ID.
 */
process.env.RECORDING_WORKER_ENABLED = 'false';
process.env.ATTENDANCE_WORKER_ENABLED = 'false';
process.env.MENTOR_ATTENDANCE_JOB_ENABLED = 'false';

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
  MentorAttendanceJob,
} = require('../src/controller/mentor-slot/jobs/mentor-attendance.job');
const { ZoomService } = require('../src/services/zoom/zoom.service');
const { FLAGS } = require('../src/constants/flags');
const { db } = require('../src/db');
const schema = require('../drizzle/schema');
const { and, eq, inArray } = require('drizzle-orm');

const MENTOR = Number(process.env.E2E_MENTOR_ID ?? 66142);
const STUDENT = Number(process.env.E2E_STUDENT_ID ?? 65757);
const ORG = Number(process.env.E2E_ORG_ID ?? 1);
const created: number[] = [];
let passed = 0;
let failed = 0;
const report = (label: string, ok: boolean, detail?: string) => {
  ok ? passed++ : failed++;
  console.log(
    `${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` (${detail})` : ''}`,
  );
};

let svc: any;
let sessions: any;
let job: any;
let zoom: any;
let mgmtId: number;
let mentorEmail: string;
// Far-future days so test slots never collide with real ones.
let day = 9000 + Math.floor(Math.random() * 4000);

type Booking = { bookingId: number; slotId: number; start: Date; end: Date };

async function book(): Promise<Booking> {
  day += 3;
  const start = new Date(Date.now() + day * 86_400_000);
  const end = new Date(start.getTime() + 30 * 60_000);
  await svc.createSlot(
    MENTOR,
    {
      slotStartDateTime: start.toISOString(),
      slotEndDateTime: end.toISOString(),
    },
    ORG,
  );
  const [slot] = await db
    .select()
    .from(schema.zuvyMentorSlotAvailability)
    .where(
      and(
        eq(schema.zuvyMentorSlotAvailability.mentorSlotManagementId, mgmtId),
        eq(schema.zuvyMentorSlotAvailability.slotStartDateTime, start),
      ),
    )
    .limit(1);
  const res = await svc.bookSlot(STUDENT, slot.id);
  created.push(res.id);
  return { bookingId: res.id, slotId: slot.id, start, end };
}

const getBooking = async (id: number) =>
  (
    await db
      .select()
      .from(schema.zuvyMentorSlotBooking)
      .where(eq(schema.zuvyMentorSlotBooking.id, id))
      .limit(1)
  )[0];
const getAttendance = async (id: number) =>
  (
    await db
      .select()
      .from(schema.zuvyMentorSessionAttendance)
      .where(eq(schema.zuvyMentorSessionAttendance.mentorBookingId, id))
      .limit(1)
  )[0];
const getMetrics = async () =>
  (
    await db
      .select()
      .from(schema.zuvyStudentBookingMetrics)
      .where(eq(schema.zuvyStudentBookingMetrics.userId, BigInt(STUDENT)))
      .limit(1)
  )[0];
const setSlotTimes = (id: number, start: Date, end: Date) =>
  db
    .update(schema.zuvyMentorSlotAvailability)
    .set({ slotStartDateTime: start, slotEndDateTime: end })
    .where(eq(schema.zuvyMentorSlotAvailability.id, id));
const setBooking = (id: number, fields: any) =>
  db
    .update(schema.zuvyMentorSlotBooking)
    .set(fields)
    .where(eq(schema.zuvyMentorSlotBooking.id, id));

// Make a booking look like a 30-minute session that ended `minutesAgo` ago
// and was closed by the transitions cron with the given state.
async function endSession(b: Booking, minutesAgo: number, state = 'COMPLETED') {
  const end = new Date(Date.now() - minutesAgo * 60_000);
  const start = new Date(end.getTime() - 30 * 60_000);
  await setSlotTimes(b.slotId, start, end);
  await setBooking(b.bookingId, { sessionLifecycleState: state });
  return { start, end };
}
async function runJob(b: Booking, slot: { start: Date; end: Date }) {
  const row = await getBooking(b.bookingId);
  await job.processBooking(
    {
      bookingId: b.bookingId,
      studentUserId: BigInt(STUDENT),
      zoomMeetingId: row.zoomMeetingId,
      slotStart: slot.start,
      slotEnd: slot.end,
      mentorEmail,
    },
    new Date(),
  );
}

// Zoom answers are scripted on the exact ZoomService instance injected into
// the job: ZoomService is provided by several modules, one instance each.
const useRealZoom = () => {
  delete zoom.getPastMeetingRuns;
  delete zoom.getMeeting;
};
const scriptRuns = (answer: any) => {
  zoom.getPastMeetingRuns =
    typeof answer === 'function' ? answer : async () => answer;
};
// One run of the meeting, starting 2 minutes into the slot.
const runAt = (slot: { start: Date }, ...participants: any[]) => [
  {
    startTime: new Date(slot.start.getTime() + 2 * 60_000).toISOString(),
    participants,
  },
];
const participant = (
  slot: { start: Date },
  email: string | undefined,
  seconds: number,
) => {
  const join = new Date(slot.start.getTime() + 2 * 60_000);
  return {
    id: '',
    name: 'p',
    user_email: email,
    join_time: join.toISOString(),
    leave_time: new Date(join.getTime() + seconds * 1000).toISOString(),
    duration: seconds,
  };
};

async function cleanup(b: Booking) {
  const row = await getBooking(b.bookingId);
  if (!row || row.status === 'cancelled') return;
  await setSlotTimes(b.slotId, b.start, b.end);
  await setBooking(b.bookingId, {
    sessionLifecycleState: 'SCHEDULED',
    rescheduleStatus: null,
    rescheduleProposedSlotId: null,
    rescheduleRequestedAt: null,
  });
  await svc.cancelBooking(
    b.bookingId,
    'E2E cleanup for mentor attendance tests',
    'student',
    STUDENT,
  );
}

async function main() {
  console.log(`DB: ${process.env.DB_NAME}`);
  if (process.env.DB_NAME !== 'dev') {
    console.log('Refusing: this script only runs against the dev database.');
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  app
    .get(SchedulerRegistry)
    .getCronJobs()
    .forEach((cron: any) => cron.stop());
  svc = app.get(MentorSlotService);
  sessions = app.get(SessionService);
  job = app.get(MentorAttendanceJob);
  zoom = job.zoomService;
  if (!(zoom instanceof ZoomService))
    throw new Error('job.zoomService not found');
  mgmtId = (
    await db
      .select()
      .from(schema.zuvyMentorSlotManagement)
      .where(eq(schema.zuvyMentorSlotManagement.mentorUserId, BigInt(MENTOR)))
      .limit(1)
  )[0].id;
  mentorEmail = (
    await db
      .select({ email: schema.users.email })
      .from(schema.users)
      .where(eq(schema.users.id, BigInt(MENTOR)))
      .limit(1)
  )[0].email;
  const baseline = await getMetrics();
  console.log(
    `Baseline: quotaUsed=${baseline?.quotaUsed}, cooldownEnd=${baseline?.cooldownEndDate}\n`,
  );

  try {
    console.log(
      '--- 1. Real Zoom: meeting never ran -> NOBODY_JOINED, credit back, gap removed ---',
    );
    {
      const b = await book();
      try {
        const afterBook = await getMetrics();
        report(
          'booking used a credit',
          afterBook.quotaUsed === baseline.quotaUsed + 1,
          `quotaUsed=${afterBook.quotaUsed}`,
        );
        const slot = await endSession(b, 120);
        const candidates = await job.findCandidates(new Date());
        report(
          'ended session is picked up by the job',
          candidates.some((c: any) => c.bookingId === b.bookingId),
          `candidates=${candidates.length}`,
        );
        useRealZoom();
        await runJob(b, slot);
        const att = await getAttendance(b.bookingId);
        const row = await getBooking(b.bookingId);
        const m = await getMetrics();
        report(
          'recorded NOBODY_JOINED from real Zoom',
          att?.status === 'RECORDED' && att?.outcome === 'NOBODY_JOINED',
          `status=${att?.status}, outcome=${att?.outcome}, lastError=${att?.lastError ?? '-'}`,
        );
        report(
          'booking set to MISSED',
          row.sessionLifecycleState === 'MISSED',
          row.sessionLifecycleState,
        );
        report(
          'credit refunded and gap removed',
          att?.creditRefunded === true &&
            m.quotaUsed === baseline.quotaUsed &&
            String(m.cooldownEndDate) === String(baseline.cooldownEndDate),
          `quotaUsed=${m.quotaUsed}, cooldownEnd=${m.cooldownEndDate}`,
        );
        const after = await job.findCandidates(new Date());
        report(
          'recorded session is no longer picked up',
          !after.some((c: any) => c.bookingId === b.bookingId),
        );
        await runJob(b, slot);
        const att2 = await getAttendance(b.bookingId);
        const m2 = await getMetrics();
        report(
          'running again changes nothing (no double refund)',
          att2.attempts === att.attempts && m2.quotaUsed === m.quotaUsed,
          `attempts=${att2.attempts}, quotaUsed=${m2.quotaUsed}`,
        );
        const next = await book();
        report(
          'student can book again straight away',
          !!next.bookingId,
          `booking ${next.bookingId}`,
        );
        await cleanup(next);
      } finally {
        await cleanup(b);
      }
    }

    console.log('\n--- 2. Student no-show -> MISSED, credit kept ---');
    {
      const b = await book();
      try {
        const slot = await endSession(b, 120);
        scriptRuns(runAt(slot, participant(slot, mentorEmail, 600)));
        await runJob(b, slot);
        const att = await getAttendance(b.bookingId);
        const row = await getBooking(b.bookingId);
        const m = await getMetrics();
        report(
          'recorded STUDENT_NO_SHOW, not refunded',
          att?.outcome === 'STUDENT_NO_SHOW' && att?.creditRefunded === false,
          `outcome=${att?.outcome}`,
        );
        report(
          'booking set to MISSED',
          row.sessionLifecycleState === 'MISSED',
          row.sessionLifecycleState,
        );
        report(
          'credit stays used',
          m.quotaUsed === baseline.quotaUsed + 1,
          `quotaUsed=${m.quotaUsed}`,
        );
      } finally {
        await cleanup(b);
      }
    }

    console.log(
      '\n--- 3. Mentor no-show, then the mentor tries to mark it complete ---',
    );
    {
      const b = await book();
      try {
        const slot = await endSession(b, 120);
        scriptRuns(runAt(slot, participant(slot, undefined, 900)));
        await runJob(b, slot);
        const att = await getAttendance(b.bookingId);
        const m = await getMetrics();
        report(
          'recorded MENTOR_NO_SHOW, refunded',
          att?.outcome === 'MENTOR_NO_SHOW' && att?.creditRefunded === true,
          `outcome=${att?.outcome}`,
        );
        report(
          'credit back and gap removed',
          m.quotaUsed === baseline.quotaUsed &&
            String(m.cooldownEndDate) === String(baseline.cooldownEndDate),
          `quotaUsed=${m.quotaUsed}`,
        );
        let rejected = '';
        try {
          await svc.completeSession(b.bookingId, MENTOR);
        } catch (e: any) {
          rejected = e.message;
        }
        const row = await getBooking(b.bookingId);
        report(
          'mentor cannot mark it complete by hand',
          /already recorded from Zoom \(MENTOR_NO_SHOW\)/.test(rejected),
          rejected || 'not rejected',
        );
        report(
          'booking stays MISSED',
          row.sessionLifecycleState === 'MISSED',
          row.sessionLifecycleState,
        );
      } finally {
        await cleanup(b);
      }
    }

    console.log(
      '\n--- 4. Both joined on a booking the cron had marked MISSED -> COMPLETED ---',
    );
    {
      const b = await book();
      try {
        const slot = await endSession(b, 120, 'MISSED');
        scriptRuns(
          runAt(
            slot,
            participant(slot, mentorEmail, 182),
            participant(slot, 'student@x.org', 141),
          ),
        );
        await runJob(b, slot);
        const att = await getAttendance(b.bookingId);
        const row = await getBooking(b.bookingId);
        const m = await getMetrics();
        report(
          'recorded BOTH_JOINED, COMPLETED with completedAt',
          att?.outcome === 'BOTH_JOINED' &&
            row.sessionLifecycleState === 'COMPLETED' &&
            !!row.completedAt,
          `state=${row.sessionLifecycleState}`,
        );
        report(
          'credit stays used',
          m.quotaUsed === baseline.quotaUsed + 1,
          `quotaUsed=${m.quotaUsed}`,
        );
      } finally {
        await cleanup(b);
      }
    }

    console.log(
      '\n--- 5. Only a test run the day before -> NOBODY_JOINED, refunded ---',
    );
    {
      const b = await book();
      try {
        const slot = await endSession(b, 120);
        const dayBefore = {
          start: new Date(slot.start.getTime() - 86_400_000),
        };
        scriptRuns(runAt(dayBefore, participant(dayBefore, mentorEmail, 300)));
        zoom.getMeeting = async () => ({
          success: true,
          data: { status: 'waiting' },
        });
        await runJob(b, slot);
        const att = await getAttendance(b.bookingId);
        report(
          'the earlier run is ignored',
          att?.outcome === 'NOBODY_JOINED' && att?.creditRefunded === true,
          `outcome=${att?.outcome}`,
        );
      } finally {
        useRealZoom();
        await cleanup(b);
      }
    }

    console.log('\n--- 6. Credit rules switched off -> MISSED, no refund ---');
    {
      const b = await book();
      FLAGS.MENTOR_NO_SHOW_CREDIT_RULES = false;
      try {
        const slot = await endSession(b, 120);
        scriptRuns(runAt(slot, participant(slot, undefined, 900)));
        await runJob(b, slot);
        const att = await getAttendance(b.bookingId);
        const row = await getBooking(b.bookingId);
        const m = await getMetrics();
        report(
          'MENTOR_NO_SHOW recorded, not refunded',
          att?.outcome === 'MENTOR_NO_SHOW' && att?.creditRefunded === false,
          `creditRefunded=${att?.creditRefunded}`,
        );
        report(
          'booking still set to MISSED',
          row.sessionLifecycleState === 'MISSED',
          row.sessionLifecycleState,
        );
        report(
          'credit stays used',
          m.quotaUsed === baseline.quotaUsed + 1,
          `quotaUsed=${m.quotaUsed}`,
        );
      } finally {
        FLAGS.MENTOR_NO_SHOW_CREDIT_RULES = true;
        await cleanup(b);
      }
    }

    console.log(
      '\n--- 7. Zoom fails twice, then answers -> PENDING, PENDING, RECORDED ---',
    );
    {
      const b = await book();
      try {
        const slot = await endSession(b, 120);
        scriptRuns(async () => {
          throw new Error('Zoom 503 Service Unavailable');
        });
        await runJob(b, slot);
        await runJob(b, slot);
        const pending = await getAttendance(b.bookingId);
        const row = await getBooking(b.bookingId);
        report(
          'errors leave it PENDING with attempts counted',
          pending?.status === 'PENDING' &&
            pending?.attempts === 2 &&
            /503/.test(pending?.lastError ?? ''),
          `status=${pending?.status}, attempts=${pending?.attempts}`,
        );
        report(
          'booking untouched while pending',
          row.sessionLifecycleState === 'COMPLETED',
          row.sessionLifecycleState,
        );
        scriptRuns(runAt(slot, participant(slot, mentorEmail, 600)));
        await runJob(b, slot);
        const done = await getAttendance(b.bookingId);
        report(
          'recorded once Zoom answers',
          done?.status === 'RECORDED' &&
            done?.outcome === 'STUDENT_NO_SHOW' &&
            done?.attempts === 3 &&
            done?.lastError === null,
          `status=${done?.status}, attempts=${done?.attempts}`,
        );
      } finally {
        await cleanup(b);
      }
    }

    console.log(
      '\n--- 8. Still failing 2+ days later -> UNAVAILABLE, never revisited ---',
    );
    {
      const b = await book();
      try {
        const slot = await endSession(b, 60 * 50);
        scriptRuns(async () => {
          throw new Error('Zoom 503 Service Unavailable');
        });
        await runJob(b, slot);
        const gaveUp = await getAttendance(b.bookingId);
        report(
          'marked UNAVAILABLE',
          gaveUp?.status === 'UNAVAILABLE',
          gaveUp?.status,
        );
        scriptRuns(runAt(slot, participant(slot, undefined, 900)));
        await runJob(b, slot);
        const still = await getAttendance(b.bookingId);
        const m = await getMetrics();
        report(
          'a later answer does not overwrite it or refund',
          still?.status === 'UNAVAILABLE' &&
            still?.creditRefunded === false &&
            m.quotaUsed === baseline.quotaUsed + 1,
          `status=${still?.status}, quotaUsed=${m.quotaUsed}`,
        );
        const candidates = await job.findCandidates(new Date());
        report(
          'and it is no longer picked up',
          !candidates.some((c: any) => c.bookingId === b.bookingId),
        );
      } finally {
        await cleanup(b);
      }
    }

    console.log(
      '\n--- 9. Long-past and cancelled sessions are never picked up ---',
    );
    {
      const b = await book();
      try {
        await endSession(b, 60 * 24 * 4);
        const candidates = await job.findCandidates(new Date());
        report(
          'session that ended 4 days ago is skipped',
          !candidates.some((c: any) => c.bookingId === b.bookingId),
        );
      } finally {
        await cleanup(b);
      }
      const candidates = await job.findCandidates(new Date());
      report(
        'cancelled booking is skipped',
        !candidates.some((c: any) => c.bookingId === b.bookingId),
      );
    }

    console.log('\n--- 10. Student never gets the host Zoom link ---');
    {
      const b = await book();
      try {
        const asStudent = await sessions.getSessionDetail(
          b.bookingId,
          BigInt(STUDENT),
        );
        const asMentor = await sessions.getSessionDetail(
          b.bookingId,
          BigInt(MENTOR),
        );
        report(
          'session detail: no zoomStartUrl / zoomPassword for the student',
          !('zoomStartUrl' in asStudent) && !('zoomPassword' in asStudent),
        );
        report(
          'session detail: the mentor still gets the host link',
          !!asMentor.zoomStartUrl,
        );
      } finally {
        await cleanup(b);
      }
    }
  } finally {
    useRealZoom();
    FLAGS.MENTOR_NO_SHOW_CREDIT_RULES = true;
    if (created.length) {
      await db
        .delete(schema.zuvyMentorSessionAttendance)
        .where(
          inArray(schema.zuvyMentorSessionAttendance.mentorBookingId, created),
        );
    }
    const m = await getMetrics();
    report(
      'student metrics back to baseline at the end',
      m?.quotaUsed === baseline?.quotaUsed &&
        String(m?.cooldownEndDate) === String(baseline?.cooldownEndDate),
      `quotaUsed=${m?.quotaUsed}, cooldownEnd=${m?.cooldownEndDate}`,
    );
    console.log(
      `\nTest bookings created (all cancelled): ${created.join(',')}`,
    );
    await app.close();
  }
  console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('E2E script crashed:', e);
  process.exit(1);
});
