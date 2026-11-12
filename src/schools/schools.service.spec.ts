// Keep unit tests off the real database and auth stack.
jest.mock('src/db', () => ({ db: {} }));
jest.mock('src/auth/auth.service', () => ({ AuthService: class {} }));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { db } from 'src/db';
import { SchoolsService } from './schools.service';

const LF = String.fromCharCode(10);
const HEADER = 'udise_code,school_name,state,district';

const csvWith = (count: number, extra: string[] = []) =>
  [
    HEADER,
    ...Array.from(
      { length: count },
      (_, i) => `${String(36070700000 + i)},School ${i},TELANGANA,hyderabad`,
    ),
    ...extra,
  ].join(LF);

const rolesAre = (roles: string[]) => ({
  getUserRoles: jest.fn().mockResolvedValue(roles),
});

// db.selectDistinct(...).from(...)[.where().orderBy()] returns `pairs`.
const mockPlaces = (pairs: Array<{ state: string; district: string }>) => {
  const query: any = Promise.resolve(pairs);
  query.where = () => ({ orderBy: async () => pairs });
  const selectDistinct = jest.fn(() => ({ from: () => query }));
  (db as any).selectDistinct = selectDistinct;
  return selectDistinct;
};

describe('SchoolsService.importCsv', () => {
  const mockDb = db as any;

  // insert().values(batch).onConflictDoUpdate().returning() reports, per
  // row, whether it was inserted (xmax = 0) or updated.
  const mockUpsert = (existing: Set<string>) => {
    const batches: any[][] = [];
    mockDb.insert = jest.fn(() => ({
      values: (batch: any[]) => {
        batches.push(batch);
        return {
          onConflictDoUpdate: () => ({
            returning: async () =>
              batch.map((row) => ({ inserted: !existing.has(row.udiseCode) })),
          }),
        };
      },
    }));
    return batches;
  };

  beforeEach(() => mockPlaces([{ state: 'Telangana', district: 'Hyderabad' }]));

  it('allows only super admins and does not touch the database otherwise', async () => {
    const service = new SchoolsService(rolesAre(['admin']) as any);
    mockDb.insert = jest.fn();
    await expect(service.importCsv(5, csvWith(1))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('turns a broken file into a 400', async () => {
    const service = new SchoolsService(rolesAre(['super_admin']) as any);
    mockDb.insert = jest.fn();
    await expect(
      service.importCsv(1, 'udise_code,school_name'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it('upserts in batches of 1000 and counts added vs updated', async () => {
    const service = new SchoolsService(rolesAre(['super_admin']) as any);
    const batches = mockUpsert(new Set(['36070700000', '36070700001']));

    const result = await service.importCsv(1, csvWith(2500, ['bad,row,x,y']));

    expect(batches.map((b) => b.length)).toEqual([1000, 1000, 500]);
    expect(result.data).toMatchObject({
      totalRows: 2501,
      inserted: 2498,
      updated: 2,
      skipped: 1,
      moreErrors: 0,
    });
    expect(result.data.errors).toEqual([
      expect.objectContaining({ row: 2502 }),
    ]);
    expect(result.message).toBe(
      '2498 schools added, 2 updated, 1 rows skipped',
    );
  });

  it("saves the list's spelling of the state and city", async () => {
    const service = new SchoolsService(rolesAre(['super_admin']) as any);
    const batches = mockUpsert(new Set());
    await service.importCsv(1, csvWith(1));
    expect(batches[0][0]).toMatchObject({
      state: 'Telangana',
      district: 'Hyderabad',
    });
  });

  it('returns at most 100 row errors and counts the rest', async () => {
    const service = new SchoolsService(rolesAre(['super_admin']) as any);
    mockUpsert(new Set());
    const bad = Array.from({ length: 150 }, (_, i) => `x${i},A,B,C`);

    const result = await service.importCsv(1, csvWith(1, bad));

    expect(result.data.skipped).toBe(150);
    expect(result.data.errors).toHaveLength(100);
    expect(result.data.moreErrors).toBe(50);
  });
});

describe('SchoolsService dropdowns', () => {
  const pairs = [
    { state: 'Bihar', district: 'Patna' },
    { state: 'Telangana', district: 'Hyderabad' },
    { state: 'Telangana', district: 'Warangal' },
  ];

  it('lists states and the cities of a state, in any letter case', async () => {
    mockPlaces(pairs);
    const service = new SchoolsService({} as any);
    await expect(service.listStates()).resolves.toEqual({
      status: 'success',
      data: ['Bihar', 'Telangana'],
    });
    await expect(service.listCities(' telangana ')).resolves.toEqual({
      status: 'success',
      data: ['Hyderabad', 'Warangal'],
    });
    await expect(service.listCities('Goa')).resolves.toEqual({
      status: 'success',
      data: [],
    });
  });

  it('reads the states and cities from the database once per 10 minutes', async () => {
    const selectDistinct = mockPlaces(pairs);
    const service = new SchoolsService({} as any);
    await Promise.all([
      service.listStates(),
      service.listStates(),
      service.listCities('Bihar'),
    ]);
    await service.listStates();
    expect(selectDistinct).toHaveBeenCalledTimes(1);
  });

  it("finds a state and city in any letter case, with the list's spelling", async () => {
    mockPlaces(pairs);
    const service = new SchoolsService({} as any);
    await expect(
      service.findPlace('telangana', ' HYDERABAD '),
    ).resolves.toEqual({ state: 'Telangana', city: 'Hyderabad' });
    await expect(service.findPlace('Telangana', 'Patna')).resolves.toBeNull();
    await expect(service.findPlace('Goa', 'Panaji')).resolves.toBeNull();
  });

  it('returns no schools for an unknown state or city without a query', async () => {
    mockPlaces(pairs);
    (db as any).select = jest.fn();
    const service = new SchoolsService({} as any);
    await expect(
      service.listSchools({ state: 'Telangana', city: 'Nowhere' }),
    ).resolves.toMatchObject({ data: [], total: 0 });
    expect((db as any).select).not.toHaveBeenCalled();
  });
});
