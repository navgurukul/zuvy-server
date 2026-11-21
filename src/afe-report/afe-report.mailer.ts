import { Injectable } from '@nestjs/common';
import * as AWS from 'aws-sdk';
import {
  BuiltReport,
  XLSX_CONTENT_TYPE,
  periodLabel,
} from './afe-report.excel';

// nodemailer has no type definitions in this project; only its MIME builder
// is used (to attach the Excel file), not its transports.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const MailComposer = require('nodemailer/lib/mail-composer');

export interface ReportEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Finished tours per tour and language, largest first. */
export function tourCounts(report: BuiltReport) {
  const counts = new Map<
    string,
    { tour: string; language: string; count: number }
  >();
  for (const row of report.rows) {
    const key = `${row.courseContent}\u0000${row.language}`;
    const entry = counts.get(key) ?? {
      tour: row.courseContent,
      language: row.language,
      count: 0,
    };
    entry.count += 1;
    counts.set(key, entry);
  }
  return [...counts.values()].sort(
    (a, b) =>
      b.count - a.count ||
      a.tour.localeCompare(b.tour) ||
      a.language.localeCompare(b.language),
  );
}

export function reportEmail(
  report: BuiltReport,
  options: { test?: boolean } = {},
): ReportEmail {
  const n = report.rows.length;
  const finished = `${n} finished tour${n === 1 ? '' : 's'}`;
  const period = periodLabel(report);
  const subject = `${options.test ? '[TEST] ' : ''}AFE Career Tours report: ${period} (${finished})`;
  const counts = tourCounts(report);
  const schedule = options.test
    ? 'This is a test email sent from the Zuvy admin API; it is not part of the weekly schedule.'
    : 'Zuvy sends this report automatically every Monday at 9 AM (India time); each one covers the week since the previous Monday 9 AM.';
  const rowMeaning =
    'Each row is one student who signed up with a Student ID (without an email) and finished one tour, i.e. submitted its feedback form; every finished tour appears in exactly one report.';

  const tableRows = counts
    .map(
      (c) =>
        `<tr><td style="padding:4px 12px 4px 0">${escapeHtml(c.tour)}</td>` +
        `<td style="padding:4px 12px 4px 0">${escapeHtml(c.language)}</td>` +
        `<td style="padding:4px 0;text-align:right">${c.count}</td></tr>`,
    )
    .join('');
  const notes = report.notes.length
    ? `<p><b>Notes</b></p><ul>${report.notes.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`
    : '';
  const html =
    `<p>Hello,</p>` +
    `<p>Attached is the AFE Career Tours report for tours finished <b>${escapeHtml(period)}</b> (India time): <b>${finished}</b>.</p>` +
    (counts.length
      ? `<table style="border-collapse:collapse"><tr><th style="text-align:left;padding-right:12px">Tour</th>` +
        `<th style="text-align:left;padding-right:12px">Language</th><th style="text-align:right">Finished</th></tr>${tableRows}</table>`
      : '') +
    notes +
    `<p>${escapeHtml(rowMeaning)} The second sheet of the file explains each column.</p>` +
    `<p>${escapeHtml(schedule)}</p><p>Zuvy</p>`;

  const text = [
    'Hello,',
    '',
    `Attached is the AFE Career Tours report for tours finished ${period} (India time): ${finished}.`,
    '',
    ...counts.map((c) => `- ${c.tour} (${c.language}): ${c.count}`),
    ...(report.notes.length
      ? ['', 'Notes:', ...report.notes.map((x) => `- ${x}`)]
      : []),
    '',
    `${rowMeaning} The second sheet of the file explains each column.`,
    '',
    schedule,
    '',
    'Zuvy',
  ].join('\n');

  return { subject, html, text };
}

@Injectable()
export class AfeReportMailer {
  /**
   * Sends through the app's SES account (SES_* settings) as a raw message,
   * because the plain SES call used elsewhere can't carry attachments. The SES
   * credentials therefore need the ses:SendRawEmail permission.
   */
  async send(mail: {
    to: string[];
    email: ReportEmail;
    attachment: { filename: string; content: Buffer };
  }): Promise<string> {
    const from = process.env.SES_FROM_EMAIL;
    const raw: Buffer = await new MailComposer({
      from: { name: 'Zuvy', address: from },
      to: mail.to,
      subject: mail.email.subject,
      text: mail.email.text,
      html: mail.email.html,
      attachments: [
        {
          filename: mail.attachment.filename,
          content: mail.attachment.content,
          contentType: XLSX_CONTENT_TYPE,
        },
      ],
    })
      .compile()
      .build();

    // Own client with explicit credentials: other code changes the global
    // AWS config at runtime.
    const ses = new AWS.SES({
      accessKeyId: process.env.SES_ACCESS_KEY_ID,
      secretAccessKey: process.env.SES_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION,
    });
    const result = await ses
      .sendRawEmail({
        Source: from,
        Destinations: mail.to,
        RawMessage: { Data: raw },
      })
      .promise();
    return result.MessageId;
  }
}
