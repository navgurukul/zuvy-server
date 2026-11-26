jest.mock('../../../db', () => ({ db: {} }));

import {
  daySessionState,
  feedbackText,
  joinStatus,
} from './admin-mentor-session-export.service';

describe('admin mentor session export helpers', () => {
  describe('feedbackText', () => {
    it('reads the text out of feedback JSON', () => {
      expect(feedbackText('Great session')).toBe('Great session');
      expect(feedbackText({ comment: 'Helpful' })).toBe('Helpful');
      expect(feedbackText({ a: 1 })).toBe('{"a":1}');
      expect(feedbackText(null)).toBe('');
    });
  });

  describe('joinStatus', () => {
    const start = new Date('2026-10-18T12:30:00Z');
    const end = new Date('2026-10-18T13:15:00Z');
    const after = new Date('2026-10-18T14:00:00Z');
    const during = new Date('2026-10-18T12:50:00Z');
    const at = (min: number) => new Date(start.getTime() + min * 60 * 1000);
    const base = {
      cancelled: false,
      slotStart: start,
      slotEnd: end,
      mentorJoinedAt: null as Date | null,
      studentJoinedAt: null as Date | null,
    };

    it('is blank for a cancelled session', () => {
      expect(
        joinStatus({ ...base, cancelled: true, mentorJoinedAt: at(0) }, after),
      ).toBe('');
    });

    it('says both joined when both were on time', () => {
      expect(
        joinStatus(
          { ...base, mentorJoinedAt: at(-2), studentJoinedAt: at(3) },
          after,
        ),
      ).toBe('Both joined');
    });

    it('shows how late the later person was', () => {
      expect(
        joinStatus(
          { ...base, mentorJoinedAt: at(0), studentJoinedAt: at(8) },
          after,
        ),
      ).toBe('Joined late (8 min)');
    });

    it('marks a no-show only once the session has ended', () => {
      const onlyMentor = { ...base, mentorJoinedAt: at(0) };
      expect(joinStatus(onlyMentor, during)).toBe('');
      expect(joinStatus(onlyMentor, after)).toBe('Student no-show');
      expect(joinStatus({ ...base, studentJoinedAt: at(1) }, after)).toBe(
        'Mentor no-show',
      );
    });

    it('is blank when there is no join data at all', () => {
      expect(joinStatus(base, after)).toBe('');
    });

    it('prefers the recorded attendance outcome', () => {
      expect(joinStatus({ ...base, outcome: 'NOBODY_JOINED' }, after)).toBe(
        'Nobody joined',
      );
      expect(
        joinStatus(
          { ...base, mentorJoinedAt: at(0), outcome: 'MENTOR_NO_SHOW' },
          after,
        ),
      ).toBe('Mentor no-show');
      expect(joinStatus({ ...base, outcome: 'BOTH_JOINED' }, after)).toBe(
        'Both joined',
      );
    });
  });

  describe('daySessionState', () => {
    const start = new Date('2026-11-20T12:30:00Z');
    const end = new Date('2026-11-20T13:15:00Z');
    const at = (min: number) => new Date(start.getTime() + min * 60 * 1000);
    const base = {
      lifecycleState: 'SCHEDULED',
      slotStart: start,
      slotEnd: end,
      completedAt: null as Date | null,
      mentorJoinedAt: null as Date | null,
      studentJoinedAt: null as Date | null,
    };

    it('is upcoming and scheduled before the start', () => {
      expect(daySessionState(base, at(-30))).toEqual({
        status: 'upcoming',
        attendance: 'Scheduled',
        canCancel: true,
      });
    });

    it('waits 5 minutes before flagging who has not joined', () => {
      expect(daySessionState(base, at(3)).attendance).toBe('In progress');
      expect(daySessionState(base, at(6)).attendance).toBe('Mentor not joined');
      expect(
        daySessionState({ ...base, mentorJoinedAt: at(0) }, at(6)).attendance,
      ).toBe('Student not joined');
      expect(
        daySessionState(
          { ...base, mentorJoinedAt: at(0), studentJoinedAt: at(1) },
          at(6),
        ),
      ).toEqual({
        status: 'in_progress',
        attendance: 'In progress',
        canCancel: true,
      });
    });

    it('shows the result once the session is over, and no cancel', () => {
      expect(
        daySessionState(
          {
            ...base,
            lifecycleState: 'COMPLETED',
            completedAt: at(40),
            mentorJoinedAt: at(0),
            studentJoinedAt: at(1),
          },
          at(60),
        ),
      ).toEqual({
        status: 'completed',
        attendance: 'Both joined',
        canCancel: false,
      });
      expect(
        daySessionState(
          { ...base, lifecycleState: 'MISSED', outcome: 'STUDENT_NO_SHOW' },
          at(60),
        ),
      ).toEqual({
        status: 'missed',
        attendance: 'Student no-show',
        canCancel: false,
      });
    });
  });
});
