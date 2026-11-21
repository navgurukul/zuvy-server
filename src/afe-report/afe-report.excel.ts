import * as ExcelJS from 'exceljs';
import {
  REPORT_COLUMNS,
  ReportRow,
  formatIst,
  istDate,
  istWallClock,
} from './afe-report.rows';

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Reports with this start cover everything so far.
export const REPORT_EPOCH = new Date(0);

export interface BuiltReport {
  from: Date; // inclusive; REPORT_EPOCH = from the start
  to: Date; // exclusive
  generatedAt: Date;
  rows: ReportRow[];
  notes: string[];
}

/** Where each column comes from, shown on the workbook's second sheet. */
export const COLUMN_SOURCES: Record<string, string> = {
  'Student Name':
    'Name on the Zuvy account; if empty, the name typed in the tour sign-up form.',
  'Student ID': "The student's unique Zuvy user id (a number).",
  Email:
    'These students signed up without an email; filled only if they typed one in the tour sign-up form.',
  State: 'Chosen at sign-up.',
  City: 'Chosen at sign-up (the UDISE district).',
  'School name':
    'Chosen at sign-up, or typed if the school was not in the list.',
  'School UDISE':
    'UDISE code of the school chosen at sign-up; empty if the student typed a school not in the list.',
  "Student's grade":
    'Tour sign-up form. Several grades when a teacher ticked more than one.',
  'Enter school type': 'Tour sign-up form, in English.',
  'Course content': 'The tour the student finished.',
  'Session ID':
    'The login session in which the tour was finished: CT_IN_<date>_<UDISE>_<number> (NUDISE in place of the UDISE code when the school is not in the list). Empty for tours finished before session IDs started (28 Oct 2026).',
  completion_date:
    'When the student submitted the tour feedback form (India time). Each finished tour is in exactly one report.',
  student_count:
    '"How many students are watching with you" from the tour sign-up form; 1 if the answer is not a number from 1 to 500.',
  data_collection_method:
    'Classroom aggregation when student_count is more than 1, otherwise Individual.',
  unit_type: 'Students; Teachers only for a teacher who watched alone.',
  itp_avg:
    'Average of feedback Q5 (star rating, 1-5) and Q6 (likely to recommend, 0-10, converted to 1-5: 0 = 1, 10 = 5), one decimal. Empty if neither was answered.',
  total_watch_time_seconds:
    'Total length of the tour videos the student finished.',
  session_completed_flag:
    '1 if the student finished every video of the tour, otherwise 0.',
  teacher_feedback_text:
    'Free-text answers of the feedback form (favourite part, suggestions); filled for teachers only.',
  data_source: 'Always Zuvy Platform.',
  facilitator_name: 'Not collected in the forms; empty.',
  language: 'Language of the course.',
  partner_name: 'Always Zuvy.',
};

export function periodLabel(report: Pick<BuiltReport, 'from' | 'to'>): string {
  return report.from.getTime() === REPORT_EPOCH.getTime()
    ? `from the start to ${formatIst(report.to)}`
    : `${formatIst(report.from)} to ${formatIst(report.to)}`;
}

export function reportFileName(
  report: Pick<BuiltReport, 'from' | 'to'>,
): string {
  // `to` is exclusive; name the file after the last day it covers.
  const lastDay = istDate(new Date(report.to.getTime() - 1));
  return report.from.getTime() === REPORT_EPOCH.getTime()
    ? `AFE-Career-Tours-report_up-to_${lastDay}.xlsx`
    : `AFE-Career-Tours-report_${istDate(report.from)}_to_${lastDay}.xlsx`;
}

export async function buildWorkbook(report: BuiltReport): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Zuvy';
  workbook.created = report.generatedAt;

  const sheet = workbook.addWorksheet('Report', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = REPORT_COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  for (const row of report.rows) {
    sheet.addRow({
      ...row,
      // Excel has no time zones: write the Indian wall-clock time.
      completionDate: istWallClock(row.completionDate),
      itpAvg: row.itpAvg ?? null, // a truly empty cell, not ""
    });
  }
  sheet.getColumn('completionDate').numFmt = 'mm/dd/yyyy", "h:mm:ss AM/PM';
  const header = sheet.getRow(1);
  header.font = { bold: true };
  header.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFDCE6F1' },
  };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: REPORT_COLUMNS.length },
  };

  const about = workbook.addWorksheet('About this report');
  about.columns = [
    { key: 'a', width: 26 },
    { key: 'b', width: 110 },
  ];
  const addPair = (a: string, b: string, bold = false) => {
    const r = about.addRow({ a, b });
    if (bold) r.font = { bold: true };
    r.getCell('b').alignment = { wrapText: true, vertical: 'top' };
    r.getCell('a').alignment = { vertical: 'top' };
  };
  addPair('AFE Career Tours report', '', true);
  addPair('Period (India time)', periodLabel(report));
  addPair('Generated', formatIst(report.generatedAt));
  addPair('Finished tours', String(report.rows.length));
  addPair(
    'One row is',
    'one student who signed up with a Student ID (without an email) and finished one tour, i.e. submitted the tour feedback form in this period. Google sign-in accounts, staff accounts and test courses are not included.',
  );
  for (const note of report.notes) addPair('Note', note);
  about.addRow({});
  addPair('Column', 'Where it comes from', true);
  for (const c of REPORT_COLUMNS)
    addPair(c.header, COLUMN_SOURCES[c.header] ?? '');

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer as ArrayBuffer);
}
