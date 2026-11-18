// Each db.select(...) chain resolves (at .limit()) to the next queued result.
const selectResults: any[][] = [];
const chain: any = new Proxy(
  {},
  {
    get: (_t, prop) =>
      prop === 'limit'
        ? () => Promise.resolve(selectResults.shift() ?? [])
        : () => chain,
  },
);
jest.mock('../../../db', () => ({ db: { select: () => chain } }));
jest.mock('../mentor-slot.service', () => ({ MentorSlotService: class {} }));
jest.mock('src/notification/email/email.service', () => ({
  NotificationEmailService: class {},
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminMentorSessionService } from './admin-mentor-session.service';

// Session 2:00 PM – 3:00 PM
const START = new Date('2026-11-11T14:00:00Z');
const END = new Date('2026-11-11T15:00:00Z');
const at = (hhmm: string) => new Date(`2026-11-11T${hhmm}:00Z`);
const MENTOR_JOINED = new Date('2026-11-11T13:58:00Z');
const STUDENT_JOINED = new Date('2026-11-11T14:01:00Z');

const row = (mentorJoinedAt: Date | null, studentJoinedAt: Date | null) => ({
  bookingId: 1,
  slotStart: START,
  slotEnd: END,
  mentorId: 10n,
  studentId: 20n,
  mentorJoinedAt,
  studentJoinedAt,
});

describe('AdminMentorSessionService', () => {
  const service = new AdminMentorSessionService({} as any, {} as any);

  describe('needsAttention at 2:05 PM', () => {
    it.each([
      ['both joined', MENTOR_JOINED, STUDENT_JOINED, false, []],
      ['mentor missing', null, STUDENT_JOINED, true, ['mentor']],
      ['student missing', MENTOR_JOINED, null, true, ['student']],
      [
        'both missing (still counts once)',
        null,
        null,
        true,
        ['mentor', 'student'],
      ],
    ])('%s', (_label, m, s, expected, notJoined) => {
      const out = service.toLiveSession(row(m, s), at('14:05'));
      expect(out.needsAttention).toBe(expected);
      expect(out.notJoined).toEqual(notJoined);
    });
  });

  it('does not flag a session only 3 minutes in', () => {
    const out = service.toLiveSession(row(null, null), at('14:03'));
    expect(out.phase).toBe('in_progress');
    expect(out.needsAttention).toBe(false);
  });

  it('does not flag before start or after end', () => {
    expect(service.toLiveSession(row(null, null), at('13:50')).phase).toBe(
      'starting_soon',
    );
    expect(
      service.toLiveSession(row(null, null), at('13:50')).needsAttention,
    ).toBe(false);
    expect(service.toLiveSession(row(null, null), at('15:10')).phase).toBe(
      'ended',
    );
    expect(
      service.toLiveSession(row(null, null), at('15:10')).needsAttention,
    ).toBe(false);
  });

  describe('assertCanViewOrg', () => {
    it('lets an org admin view their own org', () => {
      expect(() =>
        service.assertCanViewOrg({ id: 1, roles: ['admin'], orgId: 1 }, 1),
      ).not.toThrow();
    });

    it('gives 403 to an org admin asking for another org', () => {
      expect(() =>
        service.assertCanViewOrg({ id: 1, roles: ['admin'], orgId: 1 }, 2),
      ).toThrow(ForbiddenException);
    });

    it('lets a super admin view any org', () => {
      expect(() =>
        service.assertCanViewOrg(
          { id: 1, roles: ['super_admin'], orgId: 1 },
          2,
        ),
      ).not.toThrow();
    });

    it('gives 403 to non-admins in the same org', () => {
      expect(() =>
        service.assertCanViewOrg({ id: 1, roles: ['student'], orgId: 1 }, 1),
      ).toThrow(ForbiddenException);
      expect(() =>
        service.assertCanViewOrg({ id: 1, roles: ['instructor'], orgId: 1 }, 1),
      ).toThrow(ForbiddenException);
    });
  });

  describe('cancelSession', () => {
    const HOUR = 60 * 60 * 1000;
    const REASON = 'Mentor has a family emergency';
    const orgAdmin = { id: 7, roles: ['admin'], orgId: 1 };

    let applyCancellation: jest.Mock;
    let sendEmail: jest.Mock;
    let svc: AdminMentorSessionService;

    const session = (startInMs: number, durationMs = HOUR, orgId = 1) => ({
      organizationId: orgId,
      bootcampId: 5,
      slotId: 99,
      slotStart: new Date(Date.now() + startInMs),
      slotEnd: new Date(Date.now() + startInMs + durationMs),
      mentorName: 'Mentor',
      mentorEmail: 'mentor@example.com',
      studentName: 'Student',
      studentEmail: 'student@example.com',
    });

    // booking lookup, course-in-org lookup, mentorship-enabled lookup
    const queue = (s: any, mentorshipOn = true) => {
      selectResults.length = 0;
      selectResults.push([s], [{ id: 5 }], mentorshipOn ? [{ id: 1 }] : []);
    };

    beforeEach(() => {
      // Runs the beforeCancel checks against a still-open, unlocked booking.
      applyCancellation = jest.fn(async (_id, _reason, _by, opts) => {
        await opts.beforeCancel({ slotAvailabilityId: 99, completedAt: null });
        return { message: 'Booking cancelled successfully.' };
      });
      sendEmail = jest.fn().mockResolvedValue(undefined);
      svc = new AdminMentorSessionService(
        { applyCancellation } as any,
        { sendEmail } as any,
      );
    });

    it.each([
      ['24+ hours away', 48 * HOUR],
      ['under 24 hours away', 2 * HOUR],
      ['live (started 10 min ago)', -10 * 60 * 1000],
    ])('accepts a session %s', async (_label, startIn) => {
      queue(session(startIn));
      const out = await svc.cancelSession(orgAdmin, 1, REASON);
      expect(out.creditReturned).toBe(true);
      expect(applyCancellation).toHaveBeenCalledWith(
        1,
        REASON,
        'admin',
        expect.any(Object),
      );
    });

    it('rejects a session that has ended', async () => {
      queue(session(-2 * HOUR));
      await expect(svc.cancelSession(orgAdmin, 1, REASON)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects a session the mentor already completed', () => {
      expect(() =>
        svc.assertCancellableAt(
          { slotEnd: new Date(Date.now() + HOUR), completedAt: new Date() },
          new Date(),
        ),
      ).toThrow(BadRequestException);
    });

    it.each([['123456789'], ['   12345678   '], [''], [undefined as any]])(
      'rejects reason %p (under 10 characters)',
      async (reason) => {
        await expect(svc.cancelSession(orgAdmin, 1, reason)).rejects.toThrow(
          BadRequestException,
        );
        expect(applyCancellation).not.toHaveBeenCalled();
      },
    );

    it('tells the student and mentor, both with the reason', async () => {
      queue(session(48 * HOUR));
      await svc.cancelSession(orgAdmin, 1, REASON);

      const opts = applyCancellation.mock.calls[0][3];
      expect(opts.studentMessage).toContain(REASON);
      expect(opts.studentMessage).toContain('credit has been returned');
      expect(opts.mentorMessage).toContain(REASON);

      expect(sendEmail).toHaveBeenCalledTimes(2);
      const recipients = sendEmail.mock.calls.map((c) => c[0]);
      expect(recipients).toEqual(
        expect.arrayContaining(['student@example.com', 'mentor@example.com']),
      );
      for (const call of sendEmail.mock.calls) {
        expect(call[3].reason).toBe(REASON);
      }
    });

    it('escapes HTML in the reason before emailing it', async () => {
      queue(session(48 * HOUR));
      await svc.cancelSession(orgAdmin, 1, '<b>bad</b> & sad reason');
      expect(sendEmail.mock.calls[0][3].reason).toBe(
        '&lt;b&gt;bad&lt;/b&gt; &amp; sad reason',
      );
    });

    it('gives 403 to an admin from another organisation', async () => {
      queue(session(48 * HOUR, HOUR, 2));
      await expect(svc.cancelSession(orgAdmin, 1, REASON)).rejects.toThrow(
        ForbiddenException,
      );
      expect(applyCancellation).not.toHaveBeenCalled();
    });

    it('lets a super admin cancel in any organisation', async () => {
      queue(session(48 * HOUR, HOUR, 2));
      await svc.cancelSession(
        { id: 1, roles: ['super_admin'], orgId: 1 },
        1,
        REASON,
      );
      expect(applyCancellation).toHaveBeenCalled();
    });

    it('gives 403 to a non-admin', async () => {
      await expect(
        svc.cancelSession(
          { id: 1, roles: ['instructor'], orgId: 1 },
          1,
          REASON,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('gives 403 when mentorship is off for the course', async () => {
      queue(session(48 * HOUR), false);
      await expect(svc.cancelSession(orgAdmin, 1, REASON)).rejects.toThrow(
        ForbiddenException,
      );
      expect(applyCancellation).not.toHaveBeenCalled();
    });

    it('gives 409 if the session was rescheduled mid-cancel', async () => {
      queue(session(48 * HOUR));
      applyCancellation.mockImplementation(async (_i, _r, _b, opts) =>
        opts.beforeCancel({ slotAvailabilityId: 123, completedAt: null }),
      );
      await expect(svc.cancelSession(orgAdmin, 1, REASON)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
