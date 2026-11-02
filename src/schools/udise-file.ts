// Relative imports only: scripts/import-schools.ts loads this file with
// plain ts-node, outside Nest.
import { createReadStream } from 'fs';
import { CsvRecordReader } from './csv';
import {
  ColumnMap,
  PlaceNames,
  RowError,
  SchoolCsvError,
  SchoolRow,
  mapColumns,
  placeKey,
  toSchoolRow,
} from './school-rows';

export interface FileImportOptions {
  filePath: string;
  /** Load only these states (any letter case). Empty: all states. */
  states?: string[];
  batchSize?: number;
  /** Known state and city spellings, so no second spelling is created. */
  places?: PlaceNames;
  /** Saves one batch. Leave it out to only check the file (dry run). */
  saveBatch?: (rows: SchoolRow[]) => Promise<{
    inserted: number;
    updated: number;
  }>;
  /** Called after each batch. */
  onProgress?: (stats: FileImportStats) => void;
}

export interface FileImportStats {
  /** Schools in the file (records after the header). */
  totalRows: number;
  /** Schools that passed the checks (and were saved, unless a dry run). */
  valid: number;
  inserted: number;
  updated: number;
  /** Codes that had lost their leading zero and got it back. */
  leadingZeroAdded: number;
  /** Left out because of the `states` option. */
  otherStates: number;
  skipped: number;
  /** Skipped rows per reason, e.g. "UDISE code must be 11 digits": 3. */
  skipReasons: Record<string, number>;
  /** The first skipped rows, to show what went wrong. */
  examples: RowError[];
  /** Valid schools per state. */
  states: Record<string, number>;
}

const MAX_EXAMPLES = 20;

/**
 * Streams a school list CSV, such as the UDISE "Basic Details of Schools"
 * file (about 14 lakh schools, 400 MB), checks every row and hands the
 * good ones over in batches. Memory use stays small whatever the size.
 */
export async function importSchoolFile(
  options: FileImportOptions,
): Promise<FileImportStats> {
  const batchSize = options.batchSize ?? 1000;
  const only = options.states?.length
    ? new Set(options.states.map(placeKey))
    : null;
  const stats: FileImportStats = {
    totalRows: 0,
    valid: 0,
    inserted: 0,
    updated: 0,
    leadingZeroAdded: 0,
    otherStates: 0,
    skipped: 0,
    skipReasons: {},
    examples: [],
    states: {},
  };

  let columns: ColumnMap | null = null;
  let recordNumber = 0; // the header is record 1
  let batch: SchoolRow[] = [];
  // Every code seen so far (about 70 MB for the full file): the first row
  // with a code wins, as in uploads, wherever the batches split.
  const seenCodes = new Set<string>();

  const skip = (row: number, reason: string) => {
    stats.skipped++;
    const kind = reason.split(' (')[0];
    stats.skipReasons[kind] = (stats.skipReasons[kind] ?? 0) + 1;
    if (stats.examples.length < MAX_EXAMPLES) {
      stats.examples.push({ row, reason });
    }
  };

  const flush = async () => {
    if (!batch.length) return;
    if (options.saveBatch) {
      const saved = await options.saveBatch(batch);
      stats.inserted += saved.inserted;
      stats.updated += saved.updated;
    }
    batch = [];
    options.onProgress?.(stats);
  };

  const handle = async (values: string[]) => {
    recordNumber++;
    if (!columns) {
      columns = mapColumns(values);
      return;
    }
    stats.totalRows++;
    // Rows of other states are left out before any other check.
    if (only && !only.has(placeKey(values[columns.get('state')] ?? ''))) {
      stats.otherStates++;
      return;
    }
    const result = toSchoolRow(values, columns);
    if ('reason' in result) {
      skip(recordNumber, result.reason);
      return;
    }
    let school = result.school;
    if (seenCodes.has(school.udiseCode)) {
      skip(recordNumber, `Duplicate UDISE code (${school.udiseCode})`);
      return;
    }
    if (options.places) school = options.places.apply(school);
    if ((values[columns.get('udiseCode')] ?? '').trim().length === 10) {
      stats.leadingZeroAdded++;
    }
    stats.valid++;
    stats.states[school.state] = (stats.states[school.state] ?? 0) + 1;
    batch.push(school);
    seenCodes.add(school.udiseCode);
    if (batch.length >= batchSize) await flush();
  };

  const reader = new CsvRecordReader();
  const stream = createReadStream(options.filePath, {
    encoding: 'utf8',
    highWaterMark: 1 << 20,
  });
  for await (const chunk of stream) {
    for (const record of reader.push(chunk as string)) await handle(record);
  }
  for (const record of reader.end()) await handle(record);
  if (!columns) throw new SchoolCsvError('The file is empty');
  await flush();
  return stats;
}
