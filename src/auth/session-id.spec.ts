// Keep unit tests off the real database and Google client.
jest.mock('../db', () => ({ db: {} }));
jest.mock('src/user-tokens/user-tokens.service', () => ({
  UserTokensService: class {},
}));
jest.mock('src/rbac/utility', () => ({ ResourceList: {} }));

import { db } from '../db';
import { zuvySessionCounters } from '../../drizzle/schema';
import { AuthService } from './auth.service';
import { formatCtSessionId, sessionDate } from './session-id';

const CT_ID = /^CT_IN_[0-9]{8}_[0-9A-Z]{11}_[0-9]{7}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('Career Tours session IDs', () => {
  it('uses the date in India, not UTC', () => {
    // 23:59:59 and 00:00:00 IST on the night of 27-28 Oct 2026.
    expect(sessionDate(new Date('2026-10-27T18:29:59Z'))).toBe('20261027');
    expect(sessionDate(new Date('2026-10-27T18:30:00Z'))).toBe('20261028');
    expect(sessionDate(new Date('2026-01-05T06:00:00Z'))).toBe('20260105');
  });

  it('builds CT_IN_<date>_<UDISE>_<7-digit number>', () => {
    expect(formatCtSessionId('20261028', '36070700101', 25)).toBe(
      'CT_IN_20261028_36070700101_0000025',
    );
    expect(formatCtSessionId('20261028', '070501ND201', 1)).toBe(
      'CT_IN_20261028_070501ND201_0000001',
    );
  });

  it('stays valid for the spec: letters, digits and underscores, up to 100 characters', () => {
    const id = formatCtSessionId('20261028', '36070700101', 9999999);
    expect(id).toMatch(CT_ID);
    expect(id.length).toBeLessThanOrEqual(100);
    // A number past 9,999,999 in one school in one day only grows longer.
    expect(formatCtSessionId('20261028', '36070700101', 12345678)).toBe(
      'CT_IN_20261028_36070700101_12345678',
    );
  });
});

describe('AuthService.newSessionId', () => {
  const mockDb = db as any;
  const service = new AuthService({} as any, {} as any) as any;

  // insert(counters).values().onConflictDoUpdate().returning() gives the
  // next number for the school and day.
  const counterReturns = (result: Promise<any>) => {
    const values = jest.fn(() => ({
      onConflictDoUpdate: () => ({ returning: () => result }),
    }));
    mockDb.insert = jest.fn((table) => {
      expect(table).toBe(zuvySessionCounters);
      return { values };
    });
    return values;
  };

  it("gives a student with a school a CT ID with that school's next number", async () => {
    const values = counterReturns(Promise.resolve([{ lastNumber: 25 }]));
    const id = await service.newSessionId('36070700101');
    expect(id).toBe(`CT_IN_${sessionDate()}_36070700101_0000025`);
    expect(values).toHaveBeenCalledWith({
      sessionDate: sessionDate(),
      udiseCode: '36070700101',
      lastNumber: 1,
    });
  });

  it('gives a login without a school a random UUID, without the counter', async () => {
    mockDb.insert = jest.fn();
    await expect(service.newSessionId(null)).resolves.toMatch(UUID);
    await expect(service.newSessionId(undefined)).resolves.toMatch(UUID);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('never blocks a login: a counter problem falls back to a UUID', async () => {
    counterReturns(Promise.reject(new Error('db down')));
    await expect(service.newSessionId('36070700101')).resolves.toMatch(UUID);
  });
});
