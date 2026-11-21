import * as ExcelJS from 'exceljs';
import {
  BuiltReport,
  COLUMN_SOURCES,
  REPORT_EPOCH,
  buildWorkbook,
  periodLabel,
  reportFileName,
} from './afe-report.excel';
import { REPORT_COLUMNS, ReportRow } from './afe-report.rows';

const row: ReportRow = {
  studentName: 'Chaganti Chandrika',
  studentId: '73302',
  email: 'chandrika@example.com',
  state: '',
  city: '',
  schoolName: '',
  schoolUdise: '',
  grade: '8',
  schoolType: 'KGBV',
  courseContent: 'Robotics Fulfillment Center Tour',
  sessionId: 'CT_IN_20261028_36060100101_0000001',
  completionDate: new Date('2026-10-28T14:43:14.000Z'), // 8:13:14 PM IST
  studentCount: 4,
  dataCollectionMethod: 'Classroom aggregation',
  unitType: 'Students',
  itpAvg: 4,
  totalWatchTimeSeconds: 4641,
  sessionCompletedFlag: 1,
  teacherFeedbackText: '',
  dataSource: 'Zuvy Platform',
  facilitatorName: '',
  language: 'Telugu',
  partnerName: 'Zuvy',
};

const report = (over: Partial<BuiltReport> = {}): BuiltReport => ({
  from: new Date('2026-11-17T03:35:00.000Z'), // 17 Nov 9:05 AM IST
  to: new Date('2026-11-20T03:35:00.000Z'), // 20 Nov 9:05 AM IST
  generatedAt: new Date('2026-11-20T03:35:01.000Z'),
  rows: [row],
  notes: ['A note'],
  ...over,
});

async function read(buffer: Buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any); // exceljs' Buffer type predates Node 22's
  return wb;
}

describe('buildWorkbook', () => {
  it('writes the client’s 23 columns in order, then one row per finished tour', async () => {
    const wb = await read(await buildWorkbook(report()));
    const sheet = wb.getWorksheet('Report');
    const headers = (sheet.getRow(1).values as any[]).slice(1);
    expect(headers).toEqual([
      'Student Name',
      'Student ID',
      'Email',
      'State',
      'City',
      'School name',
      'School UDISE',
      "Student's grade",
      'Enter school type',
      'Course content',
      'Session ID',
      'completion_date',
      'student_count',
      'data_collection_method',
      'unit_type',
      'itp_avg',
      'total_watch_time_seconds',
      'session_completed_flag',
      'teacher_feedback_text',
      'data_source',
      'facilitator_name',
      'language',
      'partner_name',
    ]);
    expect(sheet.rowCount).toBe(2);
    const data = sheet.getRow(2);
    expect(data.getCell(1).value).toBe('Chaganti Chandrika');
    expect(data.getCell(2).value).toBe('73302'); // text, not a number
    expect(data.getCell(13).value).toBe(4);
    expect(data.getCell(16).value).toBe(4);
    expect(data.getCell(17).value).toBe(4641);
    expect(data.getCell(18).value).toBe(1);
  });

  it('writes completion_date as an Excel date showing India time', async () => {
    const wb = await read(await buildWorkbook(report()));
    const cell = wb.getWorksheet('Report').getRow(2).getCell(12);
    expect((cell.value as Date).toISOString()).toBe('2026-10-28T20:13:14.000Z');
    expect(cell.numFmt).toBe('mm/dd/yyyy", "h:mm:ss AM/PM');
  });

  it('an empty itp_avg is an empty cell', async () => {
    const wb = await read(
      await buildWorkbook(report({ rows: [{ ...row, itpAvg: null }] })),
    );
    expect(wb.getWorksheet('Report').getRow(2).getCell(16).value).toBeNull();
  });

  it('has an explanation sheet with the period, notes and every column', async () => {
    const wb = await read(await buildWorkbook(report()));
    const about = wb.getWorksheet('About this report');
    const text = about.getSheetValues().flat().filter(Boolean).join('\n');
    expect(text).toContain('17 Nov 2026');
    expect(text).toContain('A note');
    for (const c of REPORT_COLUMNS) {
      expect(text).toContain(c.header);
      expect(COLUMN_SOURCES[c.header]).toBeTruthy();
    }
  });

  it('an empty report still has the header row', async () => {
    const wb = await read(await buildWorkbook(report({ rows: [] })));
    expect(wb.getWorksheet('Report').rowCount).toBe(1);
  });
});

describe('labels', () => {
  it('file name and period, for a regular and the first report', () => {
    expect(reportFileName(report())).toBe(
      'AFE-Career-Tours-report_2026-11-17_to_2026-11-20.xlsx',
    );
    expect(reportFileName(report({ from: REPORT_EPOCH }))).toBe(
      'AFE-Career-Tours-report_up-to_2026-11-20.xlsx',
    );
    // A period ending exactly at midnight is named after its last full day.
    expect(
      reportFileName(report({ to: new Date('2026-11-19T18:30:00.000Z') })),
    ).toBe('AFE-Career-Tours-report_2026-11-17_to_2026-11-19.xlsx');
    expect(periodLabel(report({ from: REPORT_EPOCH }))).toMatch(
      /^from the start to 20 Nov 2026/,
    );
    expect(periodLabel(report())).toMatch(
      /^17 Nov 2026, 9:05 am to 20 Nov 2026, 9:05 am$/i,
    );
  });
});
