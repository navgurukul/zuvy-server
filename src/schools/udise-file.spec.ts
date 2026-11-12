import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { importSchoolFile } from './udise-file';
import { PlaceNames, SchoolRow } from './school-rows';

const LF = String.fromCharCode(10);
const CRLF = String.fromCharCode(13, 10);

// Same columns, order and style as the UDISE "Basic Details of Schools"
// file from the India Data Portal (shortened after udise_school_code).
const HEADER =
  'id,state_name,state_code,district_name,district_code,subdistrict_name,subdistrict_code,cluster_name,village_name,village_code,pincode,ward,school_name,udise_school_code,school_category,school_type,management,year_of_establishment,longitude,latitude,status,location_type,class_from,class_to';
const row = (
  id: number,
  state: string,
  district: string,
  name: string,
  code: string,
  status = 'Operational',
) =>
  `${id},${state},35,${district},None,"Brc, Block",None,Cluster,Village ${id},1,744207,"",${name},${code},Primary,Co. Educational,Department of Education,1974,92.5,10.7,${status},Rural,1.0,5.0`;

describe('importSchoolFile', () => {
  let dir: string;
  let file: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'udise-'));
    file = join(dir, 'basic-details-of-schools.csv');
    writeFileSync(
      file,
      [
        HEADER,
        row(0, 'Telangana', 'Hyderabad', 'ZPHS MADHAPUR', '36070700101'),
        row(
          1,
          'Telangana',
          'Hyderabad',
          `"GOVT HIGH${LF}SCHOOL"`,
          '36070700102',
        ),
        row(2, 'Uttar Pradesh', 'Agra', 'PS AGRA', '9010100101'),
        row(3, 'Telangana', 'Warangal', 'BAD CODE SCHOOL', '123'),
        row(4, 'Telangana', 'Hyderabad', 'SAME CODE AGAIN', '36070700101'),
        row(
          5,
          'Telangana',
          'Hyderabad',
          'CLOSED SCHOOL',
          '36070700109',
          'Closed',
        ),
        row(
          6,
          'Delhi',
          'New Delhi',
          'GOVT. SARVODAYA VIDYALAYA',
          '070501ND201',
        ),
        '',
      ].join(CRLF),
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('checks the file without saving anything (dry run)', async () => {
    const stats = await importSchoolFile({ filePath: file });
    expect(stats).toMatchObject({
      totalRows: 7,
      valid: 4,
      skipped: 3,
      inserted: 0,
      updated: 0,
      leadingZeroAdded: 1,
      states: { Telangana: 2, 'Uttar Pradesh': 1, Delhi: 1 },
    });
    expect(stats.skipReasons).toEqual({
      'UDISE code must be 11 digits or capital letters': 1,
      'Duplicate UDISE code': 1,
      'Not operational': 1,
    });
    expect(stats.examples.map((e) => e.row)).toEqual([5, 6, 7]);
  });

  it('saves the good schools in batches and adds up the counts', async () => {
    const batches: SchoolRow[][] = [];
    const stats = await importSchoolFile({
      filePath: file,
      batchSize: 2,
      saveBatch: async (rows) => {
        batches.push(rows);
        return { inserted: rows.length - 1, updated: 1 };
      },
    });
    expect(batches.map((b) => b.length)).toEqual([2, 2]);
    expect(stats.inserted).toBe(2);
    expect(stats.updated).toBe(2);
    const saved = batches.flat();
    expect(saved.map((s) => s.udiseCode)).toEqual([
      '36070700101',
      '36070700102',
      '09010100101',
      '070501ND201',
    ]);
    expect(saved[1].schoolName).toBe('GOVT HIGH SCHOOL');
    expect(saved[0]).toMatchObject({
      block: 'Brc, Block',
      village: 'Village 0',
      pincode: '744207',
      management: 'Department of Education',
      classFrom: 1,
      classTo: 5,
    });
  });

  it('loads only the states asked for, in any letter case', async () => {
    const saved: SchoolRow[] = [];
    const stats = await importSchoolFile({
      filePath: file,
      states: ['uttar pradesh', 'DELHI'],
      saveBatch: async (rows) => {
        saved.push(...rows);
        return { inserted: rows.length, updated: 0 };
      },
    });
    expect(saved.map((s) => s.state)).toEqual(['Uttar Pradesh', 'Delhi']);
    // Every Telangana row, even the bad and closed ones.
    expect(stats.otherStates).toBe(5);
    expect(stats.skipped).toBe(0);
  });

  it('uses the spelling of places already in the list', async () => {
    const saved: SchoolRow[] = [];
    await importSchoolFile({
      filePath: file,
      states: ['Telangana'],
      places: new PlaceNames([{ state: 'TELANGANA', district: 'HYDERABAD' }]),
      saveBatch: async (rows) => {
        saved.push(...rows);
        return { inserted: rows.length, updated: 0 };
      },
    });
    expect(saved[0]).toMatchObject({
      state: 'TELANGANA',
      district: 'HYDERABAD',
    });
  });

  it('rejects a file without the school columns', async () => {
    const other = join(dir, 'other.csv');
    writeFileSync(other, 'id,year,state_name' + LF + '1,2022-23,Bihar');
    await expect(importSchoolFile({ filePath: other })).rejects.toThrow(
      'Missing column(s)',
    );
  });
});
