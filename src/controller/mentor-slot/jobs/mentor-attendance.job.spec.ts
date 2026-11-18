// Records what the job writes, instead of touching a database. The services
// are stubbed so jest doesn't load their full import graph.
const writes = {
  unresolved: [] as any[],
  claims: [] as any[],
  bookingUpdates: [] as any[],
};
let claimReturns: any[] = [{ id: 1 }];

const trx = {
  insert: () => ({
    values: (values: any) => ({
      onConflictDoUpdate: () => ({
        returning: () => {
          writes.claims.push(values);
          return Promise.resolve(claimReturns);
        },
      }),
    }),
  }),
  update: () => ({
    set: (set: any) => ({
      where: () => {
        writes.bookingUpdates.push(set);
        return Promise.resolve();
      },
    }),
  }),
};

jest.mock('src/db', () => ({
  db: {
    insert: () => ({
      values: (values: any) => ({
        onConflictDoUpdate: (conflict: any) => {
          writes.unresolved.push({ values, conflict });
          return Promise.resolve();
        },
      }),
    }),
    transaction: (cb: (t: any) => Promise<unknown>) => cb(trx),
  },
}));
jest.mock('src/services/zoom/zoom.service', () => ({ ZoomService: class {} }));
jest.mock('../mentor-slot.service', () => ({ MentorSlotService: class {} }));

import {
  MentorAttendanceJob,
  mentorAttendanceJobEnabled,
} from './mentor-attendance.job';
import { FLAGS } from '../../../constants/flags';

const MENTOR = 'mentor@example.org';
const NOW = new Date('2026-11-12T12:00:00.000Z');
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000);

// A 30-minute slot that ended `endedMinutesAgo` ago.
const booking = (endedMinutesAgo = 30) => ({
  bookingId: 5,
  studentUserId: 9n,
  zoomMeetingId: '123',
  slotStart: minutesAgo(endedMinutesAgo + 30),
  slotEnd: minutesAgo(endedMinutesAgo),
  mentorEmail: MENTOR,
});

// One participant connection inside the default slot.
const p = (email: string | undefined, seconds: number) => ({
  id: '',
  name: 'x',
  user_email: email,
  join_time: minutesAgo(58).toISOString(),
  leave_time: new Date(minutesAgo(58).getTime() + seconds * 1000).toISOString(),
  duration: seconds,
});
// One run of the meeting starting at the default slot's start.
const runAtSlot = (...participants: any[]) => ({
  startTime: minutesAgo(60).toISOString(),
  participants,
});

describe('MentorAttendanceJob', () => {
  let zoom: { getPastMeetingRuns: jest.Mock; getMeeting: jest.Mock };
  let mentorSlotService: { recomputeStudentBookingMetrics: jest.Mock };
  let job: MentorAttendanceJob;
  const checkBooking = (b = booking()) => (job as any).processBooking(b, NOW);

  beforeEach(() => {
    writes.unresolved.length = 0;
    writes.claims.length = 0;
    writes.bookingUpdates.length = 0;
    claimReturns = [{ id: 1 }];
    FLAGS.MENTOR_NO_SHOW_CREDIT_RULES = true;
    zoom = { getPastMeetingRuns: jest.fn(), getMeeting: jest.fn() };
    mentorSlotService = { recomputeStudentBookingMetrics: jest.fn() };
    job = new MentorAttendanceJob(zoom as any, mentorSlotService as any);
  });

  it('treats a Zoom failure as "try again", never as a no-show', async () => {
    zoom.getPastMeetingRuns.mockRejectedValue(new Error('Zoom 503'));
    await checkBooking();
    expect(writes.claims).toHaveLength(0);
    expect(writes.unresolved[0].values).toMatchObject({ status: 'PENDING' });
    expect(writes.unresolved[0].values.lastError).toMatch(/Zoom 503/);
  });

  it('gives up (UNAVAILABLE) once the session ended more than 2 days ago', async () => {
    zoom.getPastMeetingRuns.mockRejectedValue(new Error('Zoom 503'));
    await checkBooking(booking(3 * 24 * 60));
    expect(writes.unresolved[0].values).toMatchObject({
      status: 'UNAVAILABLE',
    });
    expect(writes.claims).toHaveLength(0);
  });

  it('waits while a meeting with no run yet is still running', async () => {
    zoom.getPastMeetingRuns.mockResolvedValue([]);
    zoom.getMeeting.mockResolvedValue({
      success: true,
      data: { status: 'started' },
    });
    await checkBooking(booking(120));
    expect(writes.unresolved[0].values).toMatchObject({ status: 'PENDING' });
    expect(writes.claims).toHaveLength(0);
  });

  it('does not refund when Zoom says the meeting no longer exists; retries with that reason', async () => {
    zoom.getPastMeetingRuns.mockResolvedValue([]);
    zoom.getMeeting.mockResolvedValue({
      success: false,
      error:
        'Failed to fetch Zoom meeting: Meeting does not exist: 85076806622.',
    });
    await checkBooking(booking(120));
    expect(writes.claims).toHaveLength(0);
    expect(writes.unresolved[0].values).toMatchObject({ status: 'PENDING' });
    expect(writes.unresolved[0].values.lastError).toMatch(
      /Meeting does not exist/,
    );
    expect(
      mentorSlotService.recomputeStudentBookingMetrics,
    ).not.toHaveBeenCalled();
  });

  it('records nobody joined, and refunds, when Zoom confirms the meeting never ran', async () => {
    zoom.getPastMeetingRuns.mockResolvedValue([]);
    zoom.getMeeting.mockResolvedValue({
      success: true,
      data: { status: 'waiting' },
    });
    await checkBooking(booking(120));
    expect(writes.claims[0]).toMatchObject({
      outcome: 'NOBODY_JOINED',
      creditRefunded: true,
    });
    expect(writes.bookingUpdates[0]).toMatchObject({
      sessionLifecycleState: 'MISSED',
    });
    expect(
      mentorSlotService.recomputeStudentBookingMetrics,
    ).toHaveBeenCalledWith(trx, 9n);
  });

  it('ignores a run outside the session window (mentor testing the link the day before)', async () => {
    const b = booking(120);
    zoom.getPastMeetingRuns.mockResolvedValue([
      {
        startTime: new Date(
          b.slotStart.getTime() - 24 * 60 * 60 * 1000,
        ).toISOString(),
        participants: [p(MENTOR, 300)],
      },
    ]);
    zoom.getMeeting.mockResolvedValue({
      success: true,
      data: { status: 'waiting' },
    });
    await checkBooking(b);
    // Without the window this was recorded as STUDENT_NO_SHOW (mentor 300s)
    // and the student was not refunded.
    expect(writes.claims[0]).toMatchObject({
      outcome: 'NOBODY_JOINED',
      creditRefunded: true,
    });
  });

  it('records a student no-show as MISSED and keeps the credit used', async () => {
    zoom.getPastMeetingRuns.mockResolvedValue([runAtSlot(p(MENTOR, 571))]);
    await checkBooking();
    expect(writes.claims[0]).toMatchObject({
      outcome: 'STUDENT_NO_SHOW',
      creditRefunded: false,
    });
    expect(writes.bookingUpdates[0]).toMatchObject({
      sessionLifecycleState: 'MISSED',
    });
    expect(
      mentorSlotService.recomputeStudentBookingMetrics,
    ).not.toHaveBeenCalled();
  });

  it('refunds the credit for a mentor no-show (credit rules on by default)', async () => {
    zoom.getPastMeetingRuns.mockResolvedValue([runAtSlot(p(undefined, 900))]);
    await checkBooking();
    expect(writes.claims[0]).toMatchObject({
      outcome: 'MENTOR_NO_SHOW',
      creditRefunded: true,
    });
    expect(writes.bookingUpdates[0]).toMatchObject({
      sessionLifecycleState: 'MISSED',
    });
    expect(
      mentorSlotService.recomputeStudentBookingMetrics,
    ).toHaveBeenCalledWith(trx, 9n);
  });

  it('does not refund when the MENTOR_NO_SHOW_CREDIT_RULES switch is off, but still records MISSED', async () => {
    FLAGS.MENTOR_NO_SHOW_CREDIT_RULES = false;
    zoom.getPastMeetingRuns.mockResolvedValue([runAtSlot(p(undefined, 900))]);
    await checkBooking();
    expect(writes.claims[0]).toMatchObject({
      outcome: 'MENTOR_NO_SHOW',
      creditRefunded: false,
    });
    expect(writes.bookingUpdates[0]).toMatchObject({
      sessionLifecycleState: 'MISSED',
    });
    expect(
      mentorSlotService.recomputeStudentBookingMetrics,
    ).not.toHaveBeenCalled();
  });

  it('records BOTH_JOINED as COMPLETED without touching credits', async () => {
    zoom.getPastMeetingRuns.mockResolvedValue([
      runAtSlot(p(MENTOR, 182), p('student@x.org', 141)),
    ]);
    await checkBooking();
    expect(writes.claims[0]).toMatchObject({
      outcome: 'BOTH_JOINED',
      creditRefunded: false,
    });
    expect(writes.bookingUpdates[0]).toMatchObject({
      sessionLifecycleState: 'COMPLETED',
    });
    expect(
      mentorSlotService.recomputeStudentBookingMetrics,
    ).not.toHaveBeenCalled();
  });

  describe('MENTOR_ATTENDANCE_JOB_ENABLED switch', () => {
    const saved = process.env.MENTOR_ATTENDANCE_JOB_ENABLED;
    afterEach(() => {
      if (saved === undefined) delete process.env.MENTOR_ATTENDANCE_JOB_ENABLED;
      else process.env.MENTOR_ATTENDANCE_JOB_ENABLED = saved;
    });

    it('is on only for the exact value "true"', () => {
      expect(
        mentorAttendanceJobEnabled({ MENTOR_ATTENDANCE_JOB_ENABLED: 'true' }),
      ).toBe(true);
      expect(
        mentorAttendanceJobEnabled({ MENTOR_ATTENDANCE_JOB_ENABLED: 'false' }),
      ).toBe(false);
      expect(
        mentorAttendanceJobEnabled({ MENTOR_ATTENDANCE_JOB_ENABLED: 'TRUE' }),
      ).toBe(false);
      expect(mentorAttendanceJobEnabled({})).toBe(false);
    });

    it('does not query or call Zoom when off', async () => {
      delete process.env.MENTOR_ATTENDANCE_JOB_ENABLED;
      const find = jest
        .spyOn(job as any, 'findCandidates')
        .mockResolvedValue([booking()]);
      await job.recordEndedSessions();
      expect(find).not.toHaveBeenCalled();
      expect(zoom.getPastMeetingRuns).not.toHaveBeenCalled();
    });

    it('checks each candidate when on', async () => {
      process.env.MENTOR_ATTENDANCE_JOB_ENABLED = 'true';
      jest.spyOn(job as any, 'findCandidates').mockResolvedValue([booking()]);
      zoom.getPastMeetingRuns.mockResolvedValue([
        runAtSlot(p(MENTOR, 300), p('s@x.org', 300)),
      ]);
      await job.recordEndedSessions();
      expect(zoom.getPastMeetingRuns).toHaveBeenCalledWith('123');
      expect(writes.claims[0]).toMatchObject({ outcome: 'BOTH_JOINED' });
    });
  });

  it('does nothing more when another run already recorded the booking (no double refund)', async () => {
    claimReturns = [];
    zoom.getPastMeetingRuns.mockResolvedValue([runAtSlot(p(undefined, 900))]);
    await checkBooking();
    expect(writes.bookingUpdates).toHaveLength(0);
    expect(
      mentorSlotService.recomputeStudentBookingMetrics,
    ).not.toHaveBeenCalled();
  });
});
