import * as fs from 'fs';
import * as path from 'path';

export const OUTPUT_DIR = path.join(__dirname, 'output');

// RFC 2606 reserves .invalid — guaranteed to never resolve to a real domain,
// so these emails can never collide with a real user's address.
export const EMAIL_DOMAIN = 'zuvy-loadtest.invalid';
export const EMAIL_PATTERN = /^zt-[a-z0-9]+-\d{3,6}@zuvy-loadtest\.invalid$/i;

export function ensureOutputDir() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

export function parseArgs(argv: string[]): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};
  for (const raw of argv.slice(2)) {
    if (!raw.startsWith('--')) continue;
    const [key, ...rest] = raw.slice(2).split('=');
    args[key] = rest.length > 0 ? rest.join('=') : true;
  }
  return args;
}

function csvEscape(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function writeCsv(
  filePath: string,
  headers: string[],
  rows: Record<string, unknown>[],
) {
  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((h) => csvEscape(row[h])).join(',')),
  ];
  fs.writeFileSync(filePath, lines.join('\n') + '\n', 'utf8');
}

export function readCsv(filePath: string): Record<string, string>[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (inQuotes) {
        if (c === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          current += c;
        }
      } else if (c === '"') {
        inQuotes = true;
      } else if (c === ',') {
        fields.push(current);
        current = '';
      } else {
        current += c;
      }
    }
    fields.push(current);
    return fields;
  };

  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] ?? '';
    });
    return row;
  });
}
