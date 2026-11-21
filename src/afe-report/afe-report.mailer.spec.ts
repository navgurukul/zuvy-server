const sendRawEmail = jest.fn();
const sesConstructor = jest.fn();
jest.mock('aws-sdk', () => ({
  SES: jest.fn().mockImplementation((options) => {
    sesConstructor(options);
    return {
      sendRawEmail: (params) => ({ promise: () => sendRawEmail(params) }),
    };
  }),
}));

import { AfeReportMailer, reportEmail, tourCounts } from './afe-report.mailer';
import { BuiltReport, REPORT_EPOCH } from './afe-report.excel';
import { ReportRow } from './afe-report.rows';

const row = (over: Partial<ReportRow>): ReportRow =>
  ({
    courseContent: 'Robotics Fulfillment Center Tour',
    language: 'Hindi',
    ...over,
  }) as ReportRow;

const report = (over: Partial<BuiltReport> = {}): BuiltReport => ({
  from: new Date('2026-11-17T03:35:00.000Z'),
  to: new Date('2026-11-20T03:35:00.000Z'),
  generatedAt: new Date('2026-11-20T03:35:01.000Z'),
  rows: [
    row({}),
    row({}),
    row({
      courseContent: 'AWS Data Center Tour: Uncovering Cloud Computing',
      language: 'English',
    }),
  ],
  notes: ['3 video(s) in "<b>Tour</b>" have no length set'],
  ...over,
});

describe('reportEmail', () => {
  it('summarises the period and the finished tours', () => {
    const email = reportEmail(report());
    expect(email.subject).toBe(
      'AFE Career Tours report: 17 Nov 2026, 9:05 am to 20 Nov 2026, 9:05 am (3 finished tours)',
    );
    expect(email.html).toContain('<b>3 finished tours</b>');
    expect(email.text).toContain(
      '- Robotics Fulfillment Center Tour (Hindi): 2',
    );
    expect(email.text).toContain(
      '- AWS Data Center Tour: Uncovering Cloud Computing (English): 1',
    );
    expect(email.text).toContain('every Monday at 9 AM');
    expect(email.text).toContain('signed up with a Student ID');
  });

  it('escapes HTML in names and notes', () => {
    const email = reportEmail(report());
    expect(email.html).toContain('&lt;b&gt;Tour&lt;/b&gt;');
    expect(email.html).not.toContain('<b>Tour</b>');
  });

  it('first report, empty report, test email', () => {
    const email = reportEmail(report({ from: REPORT_EPOCH, rows: [] }), {
      test: true,
    });
    expect(email.subject).toMatch(
      /^\[TEST\] AFE Career Tours report: from the start to 20 Nov 2026.*\(0 finished tours\)$/,
    );
    expect(email.html).not.toContain('<table');
    expect(email.text).toContain('not part of the weekly schedule');
    expect(reportEmail(report({ rows: [row({})] })).subject).toMatch(
      /\(1 finished tour\)$/,
    );
  });

  it('counts per tour and language, largest first', () => {
    expect(tourCounts(report())).toEqual([
      { tour: 'Robotics Fulfillment Center Tour', language: 'Hindi', count: 2 },
      {
        tour: 'AWS Data Center Tour: Uncovering Cloud Computing',
        language: 'English',
        count: 1,
      },
    ]);
  });
});

describe('AfeReportMailer', () => {
  const env = { ...process.env };
  beforeEach(() => {
    sendRawEmail.mockReset().mockResolvedValue({ MessageId: 'msg-1' });
    sesConstructor.mockReset();
    Object.assign(process.env, {
      SES_FROM_EMAIL: 'noreply@zuvy.org',
      SES_ACCESS_KEY_ID: 'key-id',
      SES_SECRET_ACCESS_KEY: 'secret',
      AWS_REGION: 'ap-south-1',
    });
  });
  afterAll(() => {
    process.env = env;
  });

  it('sends one raw SES email with the Excel file attached', async () => {
    const messageId = await new AfeReportMailer().send({
      to: ['join-zuvy@navgurukul.org'],
      email: { subject: 'Report', html: '<p>Hi</p>', text: 'Hi' },
      attachment: {
        filename: 'report.xlsx',
        content: Buffer.from('xlsx-bytes'),
      },
    });
    expect(messageId).toBe('msg-1');
    expect(sesConstructor).toHaveBeenCalledWith({
      accessKeyId: 'key-id',
      secretAccessKey: 'secret',
      region: 'ap-south-1',
    });
    const params = sendRawEmail.mock.calls[0][0];
    expect(params.Source).toBe('noreply@zuvy.org');
    expect(params.Destinations).toEqual(['join-zuvy@navgurukul.org']);
    const mime = params.RawMessage.Data.toString('utf8');
    expect(mime).toMatch(/^From: Zuvy <noreply@zuvy\.org>/m);
    expect(mime).toMatch(/^To: join-zuvy@navgurukul\.org/m);
    expect(mime).toMatch(/^Subject: Report/m);
    expect(mime).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(mime).toContain('filename=report.xlsx');
    expect(mime).toContain(Buffer.from('xlsx-bytes').toString('base64'));
  });

  it('passes SES errors on', async () => {
    sendRawEmail.mockRejectedValue(
      new Error('not authorized to perform ses:SendRawEmail'),
    );
    await expect(
      new AfeReportMailer().send({
        to: ['a@b.org'],
        email: { subject: 's', html: 'h', text: 't' },
        attachment: { filename: 'r.xlsx', content: Buffer.from('x') },
      }),
    ).rejects.toThrow('ses:SendRawEmail');
  });
});
