jest.mock('../../../db', () => ({ db: {} }));

import { ForbiddenException } from '@nestjs/common';
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
  const service = new AdminMentorSessionService();

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
});
