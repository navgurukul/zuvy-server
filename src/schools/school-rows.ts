import { parseCsv } from './csv';

export interface SchoolRow {
  udiseCode: string;
  schoolName: string;
  state: string;
  district: string;
  block: string | null;
  village: string | null;
  pincode: string | null;
  management: string | null;
  classFrom: number | null;
  classTo: number | null;
}

export interface RowError {
  row: number; // row in the file, header = row 1 (blank lines not counted)
  reason: string;
}

/** Trims and turns runs of spaces and line breaks into one space. */
export const cleanText = (value: string) => value.replace(/\s+/g, ' ').trim();

/** States and cities are matched ignoring letter case and extra spaces. */
export const placeKey = (value: string) => cleanText(value).toUpperCase();

/**
 * UDISE codes are 11 characters, normally digits. A few real schools have
 * letters in theirs in the official data (e.g. 070501ND201, New Delhi).
 */
export const UDISE_CODE_PATTERN = /^[0-9A-Z]{11}$/;

/** Uppercases a code and adds back the leading zero that spreadsheets drop
 * from numeric codes of states 01-09 (10 digits -> 11). */
export const normalizeUdiseCode = (value: string) => {
  const code = value.trim().toUpperCase();
  return /^[0-9]{10}$/.test(code) ? `0${code}` : code;
};

type Field = keyof SchoolRow | 'status';

// Accepted column names (lowercase, spaces and hyphens read as "_"). The
// second group are the names used in the UDISE "Basic Details of Schools"
// file, so it can be loaded as downloaded.
const HEADER_ALIASES: Record<string, Field> = {
  udise_code: 'udiseCode',
  udisecode: 'udiseCode',
  udise: 'udiseCode',
  udise_sch_code: 'udiseCode',
  school_name: 'schoolName',
  schoolname: 'schoolName',
  school: 'schoolName',
  state: 'state',
  district: 'district',
  city: 'district',
  block: 'block',
  village: 'village',
  pincode: 'pincode',
  pin_code: 'pincode',
  pin: 'pincode',
  management: 'management',
  class_from: 'classFrom',
  class_to: 'classTo',
  status: 'status',

  udise_school_code: 'udiseCode',
  state_name: 'state',
  district_name: 'district',
  subdistrict_name: 'block',
  block_name: 'block',
  village_name: 'village',
};

const REQUIRED: Field[] = ['udiseCode', 'schoolName', 'state', 'district'];
const COLUMN_LABELS: Partial<Record<Field, string>> = {
  udiseCode: 'udise_code',
  schoolName: 'school_name',
};

export class SchoolCsvError extends Error {}

export type ColumnMap = Map<Field, number>;

/** Finds the school columns in a header row. */
export function mapColumns(header: string[]): ColumnMap {
  const columns: ColumnMap = new Map();
  header.forEach((name, index) => {
    const key =
      HEADER_ALIASES[
        name
          .trim()
          .toLowerCase()
          .replace(/[\s-]+/g, '_')
      ];
    if (key && !columns.has(key)) columns.set(key, index);
  });
  const missing = REQUIRED.filter((key) => !columns.has(key));
  if (missing.length) {
    throw new SchoolCsvError(
      `Missing column(s): ${missing.map((k) => COLUMN_LABELS[k] ?? k).join(', ')}. Required: udise_code, school_name, state, district (or city).`,
    );
  }
  return columns;
}

// Optional details never cause a school to be skipped: a value that
// doesn't fit is cut to length or left empty.
const optionalText = (value: string) => cleanText(value).slice(0, 100) || null;

// Indian pincodes are 6 digits and don't start with 0 (the UDISE file has
// "0" for unknown).
const pincodeOrNull = (value: string) => {
  const pin = value.trim();
  return /^[1-9][0-9]{5}$/.test(pin) ? pin : null;
};

// Classes 0 (pre-primary) to 12. The UDISE file writes them as "1.0".
const classOrNull = (value: string) => {
  const text = value.trim();
  const n = Number(text);
  return text !== '' && Number.isInteger(n) && n >= 0 && n <= 12 ? n : null;
};

/** One CSV record as a school, or the reason it can't be used. */
export function toSchoolRow(
  values: string[],
  columns: ColumnMap,
): { school: SchoolRow } | { reason: string } {
  const cell = (key: Field) =>
    columns.has(key) ? values[columns.get(key)] ?? '' : '';

  const status = cleanText(cell('status'));
  if (status && status.toLowerCase() !== 'operational') {
    return { reason: `Not operational (status "${status}")` };
  }

  const rawCode = cell('udiseCode').trim();
  const udiseCode = normalizeUdiseCode(rawCode);
  if (!UDISE_CODE_PATTERN.test(udiseCode)) {
    return {
      reason: `UDISE code must be 11 digits or capital letters (got "${rawCode}")`,
    };
  }
  const schoolName = cleanText(cell('schoolName'));
  if (!schoolName || schoolName.length > 255) {
    return { reason: 'School name is missing or longer than 255 characters' };
  }
  const state = cleanText(cell('state'));
  if (!state || state.length > 100) {
    return { reason: 'State is missing or longer than 100 characters' };
  }
  const district = cleanText(cell('district'));
  if (!district || district.length > 100) {
    return {
      reason: 'District / city is missing or longer than 100 characters',
    };
  }

  return {
    school: {
      udiseCode,
      schoolName,
      state,
      district,
      block: optionalText(cell('block')),
      village: optionalText(cell('village')),
      pincode: pincodeOrNull(cell('pincode')),
      management: optionalText(cell('management')),
      classFrom: classOrNull(cell('classFrom')),
      classTo: classOrNull(cell('classTo')),
    },
  };
}

/**
 * Keeps one spelling per state and per city. A school whose state or city
 * matches a known one, ignoring case and spaces, takes the known spelling,
 * so "HYDERABAD" in an upload doesn't become a second "Hyderabad" in the
 * dropdown.
 */
export class PlaceNames {
  private states = new Map<string, string>();
  private districts = new Map<string, string>();

  constructor(known: Array<{ state: string; district: string }> = []) {
    known.forEach((place) => this.canonical(place.state, place.district));
  }

  canonical(state: string, district: string) {
    const stateKey = placeKey(state);
    if (!this.states.has(stateKey)) this.states.set(stateKey, state);
    const districtKey = `${stateKey}|${placeKey(district)}`;
    if (!this.districts.has(districtKey)) {
      this.districts.set(districtKey, district);
    }
    return {
      state: this.states.get(stateKey),
      district: this.districts.get(districtKey),
    };
  }

  apply(school: SchoolRow): SchoolRow {
    const place = this.canonical(school.state, school.district);
    return place.state === school.state && place.district === school.district
      ? school
      : { ...school, ...place };
  }
}

/**
 * Reads a school list CSV (an upload). Required columns: udise_code,
 * school_name, state, district (or city). Optional: block, village,
 * pincode, management, class_from, class_to, status. Bad rows are
 * reported and skipped; the rest are returned ready to save.
 */
export function parseSchoolCsv(text: string): {
  rows: SchoolRow[];
  errors: RowError[];
  totalRows: number;
} {
  let table: string[][];
  try {
    table = parseCsv(text);
  } catch (error) {
    throw new SchoolCsvError(error.message);
  }
  if (table.length < 2) {
    throw new SchoolCsvError(
      'The CSV needs a header row and at least one school',
    );
  }

  const columns = mapColumns(table[0]);
  const rows: SchoolRow[] = [];
  const errors: RowError[] = [];
  const firstSeen = new Map<string, number>();

  for (let i = 1; i < table.length; i++) {
    const line = i + 1;
    const result = toSchoolRow(table[i], columns);
    if ('reason' in result) {
      errors.push({ row: line, reason: result.reason });
      continue;
    }
    const { school } = result;
    const earlier = firstSeen.get(school.udiseCode);
    if (earlier) {
      errors.push({
        row: line,
        reason: `Duplicate UDISE code ${school.udiseCode} (already on row ${earlier})`,
      });
      continue;
    }
    firstSeen.set(school.udiseCode, line);
    rows.push(school);
  }

  return { rows, errors, totalRows: table.length - 1 };
}
