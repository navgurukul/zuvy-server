import { rescheduleRequestListMessage } from './notification-messages';

describe('reschedule request line in the notification list', () => {
  const stored =
    'A student asked to move their session to 11 Nov 2026, 5:00 pm. Reply by 6 Nov 2026, 6:00 pm, or the session stays as booked.';

  it("keeps the new time and reply-by deadline, with the student's name", () => {
    expect(rescheduleRequestListMessage(stored, 'Riya Sharma')).toBe(
      'Riya Sharma asked to move their session to 11 Nov 2026, 5:00 pm. Reply by 6 Nov 2026, 6:00 pm, or the session stays as booked.',
    );
  });

  it('keeps the stored line as is when the name is unknown', () => {
    expect(rescheduleRequestListMessage(stored, null)).toBe(stored);
    expect(rescheduleRequestListMessage(stored, undefined)).toBe(stored);
  });

  it('older requests (stored empty) keep the generic line', () => {
    expect(rescheduleRequestListMessage('', 'Riya Sharma')).toBe(
      'Riya Sharma requested to reschedule this mentorship session.',
    );
    expect(rescheduleRequestListMessage('', null)).toBe('');
  });
});
