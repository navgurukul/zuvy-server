import { CsvRecordReader, parseCsv } from './csv';
import {
  PlaceNames,
  SchoolCsvError,
  mapColumns,
  normalizeUdiseCode,
  parseSchoolCsv,
  placeKey,
  toSchoolRow,
} from './school-rows';

const LF = String.fromCharCode(10);
const CR = String.fromCharCode(13);
const CRLF = CR + LF;
const BOM = String.fromCharCode(0xfeff);
const lines = (...rows: string[]) => rows.join(LF);

// Feeds text to the streaming reader in pieces of `size` characters.
const readInPieces = (text: string, size: number) => {
  const reader = new CsvRecordReader();
  const records: string[][] = [];
  for (let i = 0; i < text.length; i += size) {
    records.push(...reader.push(text.slice(i, i + size)));
  }
  return [...records, ...reader.end()];
};

describe('parseCsv', () => {
  it('reads plain rows with LF or CRLF line ends', () => {
    expect(parseCsv(['a,b', '1,2'].join(LF))).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseCsv(['a,b', '1,2', ''].join(CRLF))).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });

  it('handles quotes, commas and line breaks inside quoted fields', () => {
    const text = lines(
      'name,note',
      '"Govt School, Ward 3","said ""hello"""',
      `"Two${LF}lines",x`,
    );
    expect(parseCsv(text)).toEqual([
      ['name', 'note'],
      ['Govt School, Ward 3', 'said "hello"'],
      [`Two${LF}lines`, 'x'],
    ]);
  });

  it('skips a byte order mark and blank lines', () => {
    expect(parseCsv(BOM + lines('a', '', '1', ''))).toEqual([['a'], ['1']]);
  });

  it('reads an empty quoted field', () => {
    expect(parseCsv('a,"",c')).toEqual([['a', '', 'c']]);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv(lines('a', '"oops'))).toThrow('never closed');
  });
});

describe('CsvRecordReader (reading a big file in pieces)', () => {
  const text =
    BOM +
    [
      'id,name,note',
      '1,"Gsss Model, Hutbay","say ""hi"""',
      `2,"PVT SCHOOL${LF}NAYAKBANDHA ",x`,
      '3,plain,""',
      '',
      '4,last,end',
    ].join(CRLF);

  it('gives the same records whatever the piece size', () => {
    const whole = parseCsv(text);
    expect(whole).toHaveLength(5);
    expect(whole[1]).toEqual(['1', 'Gsss Model, Hutbay', 'say "hi"']);
    // Size 1 splits every "" pair and every CRLF across two pieces.
    for (const size of [1, 2, 3, 7, 64]) {
      expect(readInPieces(text, size)).toEqual(whole);
    }
  });

  it('accepts a closing quote as the very last character', () => {
    expect(readInPieces('a,"b"', 1)).toEqual([['a', 'b']]);
  });
});

describe('placeKey and normalizeUdiseCode', () => {
  it('matches places ignoring case and extra spaces', () => {
    expect(placeKey('  andhra   pradesh ')).toBe('ANDHRA PRADESH');
    expect(placeKey('Andhra Pradesh')).toBe(placeKey('ANDHRA PRADESH'));
  });

  it('adds back a dropped leading zero and uppercases letters', () => {
    expect(normalizeUdiseCode(' 9010100101 ')).toBe('09010100101');
    expect(normalizeUdiseCode('36070700101')).toBe('36070700101');
    expect(normalizeUdiseCode('070501nd201')).toBe('070501ND201');
  });
});

describe('toSchoolRow with the UDISE "Basic Details of Schools" file', () => {
  // The real header (shortened to the columns that matter, same names).
  const header = [
    'id',
    'state_name',
    'state_code',
    'district_name',
    'subdistrict_name',
    'village_name',
    'pincode',
    'school_name',
    'udise_school_code',
    'management',
    'status',
    'class_from',
    'class_to',
  ];
  const columns = mapColumns(header);
  const record = (overrides: Record<string, string> = {}) => {
    const values: Record<string, string> = {
      id: '0',
      state_name: 'Andaman and Nicobar Islands',
      state_code: '35',
      district_name: 'Andamans',
      subdistrict_name: 'Brc-Little Andaman',
      village_name: 'Ramakrishnapur',
      pincode: '744207',
      school_name: 'GOVT SENIOR SECONDARY SCHOOL RAMAKRISHNAPUR',
      udise_school_code: '35010300101',
      management: 'Department of Education',
      status: 'Operational',
      class_from: '1.0',
      class_to: '12.0',
      ...overrides,
    };
    return header.map((h) => values[h]);
  };

  it('maps every column and keeps the file spelling of places', () => {
    expect(toSchoolRow(record(), columns)).toEqual({
      school: {
        udiseCode: '35010300101',
        schoolName: 'GOVT SENIOR SECONDARY SCHOOL RAMAKRISHNAPUR',
        state: 'Andaman and Nicobar Islands',
        district: 'Andamans',
        block: 'Brc-Little Andaman',
        village: 'Ramakrishnapur',
        pincode: '744207',
        management: 'Department of Education',
        classFrom: 1,
        classTo: 12,
      },
    });
  });

  it('adds back the leading zero (states 01-09)', () => {
    const result = toSchoolRow(
      record({ state_name: 'Uttar Pradesh', udise_school_code: '9010100101' }),
      columns,
    );
    expect(result).toMatchObject({ school: { udiseCode: '09010100101' } });
  });

  it('accepts the few official codes that contain letters', () => {
    const result = toSchoolRow(
      record({ udise_school_code: '070501ND201' }),
      columns,
    );
    expect(result).toMatchObject({ school: { udiseCode: '070501ND201' } });
  });

  it('puts a name broken over two lines on one line', () => {
    const result = toSchoolRow(
      record({ school_name: `PVT AAROH PUBLIC SCHOOL${LF}CHAMPARAN ${LF}` }),
      columns,
    );
    expect(result).toMatchObject({
      school: { schoolName: 'PVT AAROH PUBLIC SCHOOL CHAMPARAN' },
    });
  });

  it('leaves a pincode of 0 and unknown classes empty but keeps the school', () => {
    const result = toSchoolRow(
      record({ pincode: '0', class_from: '', class_to: 'x' }),
      columns,
    );
    expect(result).toMatchObject({
      school: { pincode: null, classFrom: null, classTo: null },
    });
  });

  it('skips schools that are not operational', () => {
    expect(toSchoolRow(record({ status: 'Closed' }), columns)).toEqual({
      reason: 'Not operational (status "Closed")',
    });
  });

  it('skips a bad UDISE code, name, state or district', () => {
    const reason = (o: Record<string, string>) =>
      (toSchoolRow(record(o), columns) as { reason: string }).reason;
    expect(reason({ udise_school_code: '12345' })).toContain('11 digits');
    expect(reason({ udise_school_code: '3501030010!' })).toContain('11 digits');
    expect(reason({ school_name: ' ' })).toContain('School name');
    expect(reason({ state_name: '' })).toContain('State');
    expect(reason({ district_name: '' })).toContain('District');
  });
});

describe('PlaceNames', () => {
  it('reuses the known spelling of a state and city', () => {
    const places = new PlaceNames([
      { state: 'Telangana', district: 'Hyderabad' },
    ]);
    expect(places.canonical('TELANGANA', ' hyderabad ')).toEqual({
      state: 'Telangana',
      district: 'Hyderabad',
    });
  });

  it('remembers the first spelling of a new place', () => {
    const places = new PlaceNames();
    places.canonical('Bihar', 'Patna');
    expect(places.canonical('BIHAR', 'PATNA')).toEqual({
      state: 'Bihar',
      district: 'Patna',
    });
  });

  it('treats the same city name in two states as two cities', () => {
    const places = new PlaceNames([{ state: 'Bihar', district: 'Aurangabad' }]);
    expect(places.canonical('Maharashtra', 'AURANGABAD').district).toBe(
      'AURANGABAD',
    );
  });
});

describe('parseSchoolCsv (uploads)', () => {
  const header = 'udise_code,school_name,state,district,block,pincode';

  it('reads valid rows and keeps the spelling given', () => {
    const result = parseSchoolCsv(
      lines(
        header,
        '36070700101,  ZPHS   Madhapur ,Telangana,Hyderabad,Serilingampally,500081',
        '36070700102,Govt High School,Telangana,Hyderabad,,',
      ),
    );
    expect(result.errors).toEqual([]);
    expect(result.totalRows).toBe(2);
    expect(result.rows[0]).toEqual({
      udiseCode: '36070700101',
      schoolName: 'ZPHS Madhapur',
      state: 'Telangana',
      district: 'Hyderabad',
      block: 'Serilingampally',
      village: null,
      pincode: '500081',
      management: null,
      classFrom: null,
      classTo: null,
    });
    expect(result.rows[1]).toMatchObject({ block: null, pincode: null });
  });

  it('accepts alternative column names in any order', () => {
    const result = parseSchoolCsv(
      lines(
        'State Name,City,School,UDISE Code',
        'Bihar,Patna,UMS Patna,10280100101',
      ),
    );
    expect(result.rows[0]).toMatchObject({
      udiseCode: '10280100101',
      schoolName: 'UMS Patna',
      state: 'Bihar',
      district: 'Patna',
    });
  });

  it('skips and reports bad rows and duplicates, keeping the good ones', () => {
    const result = parseSchoolCsv(
      lines(
        header,
        '36070700101,School A,Telangana,Hyderabad,,',
        '123,School B,Telangana,Hyderabad,,',
        '36070700103,,Telangana,Hyderabad,,',
        '36070700104,School D,,Hyderabad,,',
        '36070700105,School E,Telangana,,,',
        '36070700106,School F,Telangana,Hyderabad,,5000',
        '36070700101,School A again,Telangana,Hyderabad,,',
      ),
    );
    expect(result.totalRows).toBe(7);
    expect(result.rows.map((r) => r.udiseCode)).toEqual([
      '36070700101',
      '36070700106',
    ]);
    // A bad pincode is left empty instead of losing the school.
    expect(result.rows[1].pincode).toBeNull();
    expect(result.errors.map((e) => e.row)).toEqual([3, 4, 5, 6, 8]);
    expect(result.errors[0].reason).toContain('11 digits');
    expect(result.errors[1].reason).toContain('School name');
    expect(result.errors[2].reason).toContain('State');
    expect(result.errors[3].reason).toContain('District');
    expect(result.errors[4].reason).toContain('already on row 2');
  });

  it('rejects a file without the required columns', () => {
    expect(() =>
      parseSchoolCsv(lines('udise_code,school_name', '36070700101,A')),
    ).toThrow(SchoolCsvError);
    expect(() =>
      parseSchoolCsv(lines('udise_code,school_name', '36070700101,A')),
    ).toThrow('Missing column(s): state, district');
    expect(() => parseSchoolCsv(lines('state,district', 'A,B'))).toThrow(
      'Missing column(s): udise_code, school_name',
    );
  });

  it('rejects a file with only a header', () => {
    expect(() => parseSchoolCsv(header)).toThrow(SchoolCsvError);
  });
});
