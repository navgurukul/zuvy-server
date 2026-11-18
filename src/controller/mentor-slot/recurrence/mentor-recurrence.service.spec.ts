// generateRecurringSlots's new self-overlap check (MDA-17) runs before
// db.transaction is ever opened, so it's testable in isolation without
// mocking the transaction/license-assignment machinery further down the
// method — db.transaction is mocked to throw if reached, which doubles as
// proof the check actually short-circuits before it.
const dbSelectResults: unknown[] = [];

jest.mock('../../../db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(dbSelectResults.shift()),
        }),
      }),
    }),
    transaction: () => {
      throw new Error(
        'db.transaction should not be reached for a self-overlap',
      );
    },
  },
}));

import { BadRequestException } from '@nestjs/common';
import { MentorRecurrenceService } from './mentor-recurrence.service';

describe('MentorRecurrenceService.generateRecurringSlots — self-overlap check (MDA-17)', () => {
  const fakeZoomLicenseService = {
    syncLicensedUsersFromZoom: jest.fn().mockResolvedValue(undefined),
    assignLicense: jest.fn(),
    createLicenseAssignment: jest.fn(),
  };

  beforeEach(() => {
    dbSelectResults.length = 0;
    jest.clearAllMocks();
  });

  it('rejects occurrences that overlap each other, before ever opening a transaction', async () => {
    dbSelectResults.push([{ id: 1, mentorUserId: 41027n }]);
    const service = new MentorRecurrenceService(fakeZoomLicenseService as any);

    // DTSTART 10:00, every 30 minutes, 1h-long slots -> 10:00-11:00 and
    // 10:30-11:30 overlap each other.
    await expect(
      service.generateRecurringSlots({
        mentorSlotManagementId: 1,
        slotStart: new Date('2026-01-01T10:00:00.000Z'),
        slotEnd: new Date('2026-01-01T11:00:00.000Z'),
        recurrenceRule:
          'DTSTART:20260101T100000Z\nRRULE:FREQ=MINUTELY;INTERVAL=30',
        recurrenceEndDate: new Date('2026-01-01T11:30:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows non-overlapping occurrences through to the (mocked) transaction', async () => {
    dbSelectResults.push([{ id: 1, mentorUserId: 41027n }]);

    const service = new MentorRecurrenceService(fakeZoomLicenseService as any);

    // Daily occurrences, 1h-long slots -> never overlap each other.
    await expect(
      service.generateRecurringSlots({
        mentorSlotManagementId: 1,
        slotStart: new Date('2026-01-01T10:00:00.000Z'),
        slotEnd: new Date('2026-01-01T11:00:00.000Z'),
        recurrenceRule: 'DTSTART:20260101T100000Z\nRRULE:FREQ=DAILY;COUNT=2',
        recurrenceEndDate: new Date('2026-01-03T00:00:00.000Z'),
      }),
      // Reaching the mocked db.transaction's throw confirms the self-overlap
      // check correctly let these through instead of false-positiving.
    ).rejects.toThrow('db.transaction should not be reached');
  });
});
