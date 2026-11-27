jest.mock('../../db', () => ({ db: {} }));

import { classifyParticipant } from './mentor-join.service';

const booking = {
  mentorEmail: 'K.Archana@navgurukul.org',
  studentEmail: 'archana21@navgurukul.org',
  studentName: 'Archana',
};
const HOST = 'host-zoom-id';

describe('classifyParticipant', () => {
  it('mentor by email (case-insensitive)', () => {
    expect(
      classifyParticipant({ email: 'k.archana@navgurukul.org' }, HOST, booking),
    ).toBe('mentor');
  });

  it('mentor as meeting host, even with another email', () => {
    expect(
      classifyParticipant(
        { id: HOST, email: 'shared@zoom.org' },
        HOST,
        booking,
      ),
    ).toBe('mentor');
  });

  it('student by email', () => {
    expect(
      classifyParticipant(
        { email: 'archana21@navgurukul.org', user_name: 'x' },
        HOST,
        booking,
      ),
    ).toBe('student');
  });

  it('student by name when Zoom sends no email', () => {
    expect(
      classifyParticipant({ email: '', user_name: ' archana ' }, HOST, booking),
    ).toBe('student');
  });

  it('an admin with their own email is not counted, even with the same name', () => {
    expect(
      classifyParticipant(
        { email: 'admin@navgurukul.org', user_name: 'Archana' },
        HOST,
        booking,
      ),
    ).toBeNull();
  });

  it('an unknown guest is not counted', () => {
    expect(
      classifyParticipant({ user_name: 'Someone' }, HOST, booking),
    ).toBeNull();
  });
});
