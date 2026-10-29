const QUOTE = 34; // "
const COMMA = 44; // ,
const LF = 10; // line feed
const CR = 13; // carriage return
const BOM = 0xfeff; // UTF-8 byte order mark (Excel adds it)

/**
 * CSV reader that can be fed a file piece by piece, so even the 400 MB
 * UDISE school file is read without loading it whole. Handles commas,
 * double quotes ("" inside quotes), CRLF or LF line ends, line breaks
 * inside quoted fields, and a byte order mark. Blank lines are skipped.
 * A quote or a line end split across two pieces is handled too.
 */
export class CsvRecordReader {
  private row: string[] = [];
  private field = '';
  private inQuotes = false;
  // Saw a quote inside a quoted field: the next character decides whether
  // it was "" (a literal quote) or the end of the quoted part.
  private quotePending = false;
  // The last record ended with CR: an LF right after it belongs to it.
  private skipLf = false;
  private started = false;

  /** Reads the next piece of text and returns the records it completed. */
  push(chunk: string): string[][] {
    const records: string[][] = [];
    let i = 0;
    if (!this.started) {
      this.started = true;
      if (chunk.charCodeAt(0) === BOM) i = 1;
    }
    let start = i; // first character not yet added to the field

    for (; i < chunk.length; i++) {
      const c = chunk.charCodeAt(i);
      if (this.skipLf) {
        this.skipLf = false;
        if (c === LF) {
          start = i + 1;
          continue;
        }
      }
      if (this.quotePending) {
        this.quotePending = false;
        if (c === QUOTE) {
          this.field += '"';
          start = i + 1;
          continue;
        }
        this.inQuotes = false; // that quote closed the field; read c below
        start = i;
      }
      if (this.inQuotes) {
        if (c === QUOTE) {
          this.field += chunk.slice(start, i);
          this.quotePending = true;
          start = i + 1;
        }
        continue;
      }
      if (c === QUOTE) {
        this.field += chunk.slice(start, i);
        this.inQuotes = true;
        start = i + 1;
      } else if (c === COMMA) {
        this.field += chunk.slice(start, i);
        this.row.push(this.field);
        this.field = '';
        start = i + 1;
      } else if (c === LF || c === CR) {
        this.field += chunk.slice(start, i);
        this.endRecord(records);
        this.skipLf = c === CR;
        start = i + 1;
      }
    }
    this.field += chunk.slice(start);
    return records;
  }

  /** Call once at the end of the input; returns the last record, if any. */
  end(): string[][] {
    if (this.inQuotes && !this.quotePending) {
      throw new Error('The CSV has a quote (") that is never closed');
    }
    this.inQuotes = false;
    this.quotePending = false;
    const records: string[][] = [];
    if (this.field !== '' || this.row.length > 0) this.endRecord(records);
    return records;
  }

  private endRecord(records: string[][]) {
    this.row.push(this.field);
    this.field = '';
    const blank = this.row.length === 1 && this.row[0].trim() === '';
    if (!blank) records.push(this.row);
    this.row = [];
  }
}

/** Reads a whole CSV text (used for uploads, which are small). */
export function parseCsv(text: string): string[][] {
  const reader = new CsvRecordReader();
  return [...reader.push(text), ...reader.end()];
}
