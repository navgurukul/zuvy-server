import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { AfeReportRepository } from './afe-report.repository';
import { AfeReportMailer, reportEmail } from './afe-report.mailer';
import {
  BuiltReport,
  REPORT_EPOCH,
  buildWorkbook,
  reportFileName,
} from './afe-report.excel';
import {
  addDays,
  buildReportRows,
  istMidnight,
  reportNotes,
} from './afe-report.rows';
import {
  afeReportConfig,
  configProblem,
  planReport,
} from './afe-report.config';

export type SendOutcome =
  | 'off'
  | 'misconfigured'
  | 'not due'
  | 'claimed elsewhere'
  | 'sent'
  | 'failed';

@Injectable()
export class AfeReportService {
  private readonly logger = new Logger(AfeReportService.name);

  constructor(
    private readonly repo: AfeReportRepository,
    private readonly mailer: AfeReportMailer,
  ) {}

  /** The report of tours finished in [from, to). */
  async buildReport(orgId: number, from: Date, to: Date): Promise<BuiltReport> {
    const { tours, skipped } = await this.repo.loadTours(orgId);
    const finishes = await this.repo.loadFinishes(tours, from, to);

    const userIds = [...new Set(finishes.map((f) => f.userId))];
    const finishedTours = [...new Set(finishes.map((f) => f.moduleId))]
      .map((id) => tours.get(id))
      .filter(Boolean);
    const formChapterIds = finishedTours.flatMap((t) =>
      [t.signup?.chapterId, t.feedback.chapterId].filter(
        (id) => id !== undefined,
      ),
    );
    const videoChapterIds = finishedTours.flatMap((t) =>
      t.videos.map((v) => v.chapterId),
    );

    // One query at a time: the app shares a single database connection.
    const learners = await this.repo.loadLearners(userIds);
    const answers = await this.repo.loadAnswers(userIds, formChapterIds);
    const watchedVideos = await this.repo.loadWatchedVideos(
      userIds,
      videoChapterIds,
    );
    const sessions = await this.repo.loadSessions(userIds, to);

    const rows = buildReportRows(tours, {
      finishes,
      learners,
      answers,
      watchedVideos,
      sessions,
    });
    return {
      from,
      to,
      generatedAt: new Date(),
      rows,
      notes: reportNotes(rows, finishes, tours, skipped),
    };
  }

  /**
   * Called by the hourly job: sends the next report if it is due. Safe to run
   * on every server at once; only the one that claims the period sends it.
   */
  async sendIfDue(now: Date): Promise<SendOutcome> {
    const config = afeReportConfig();
    if (!config.enabled) return 'off';
    if (configProblem(config)) return 'misconfigured';

    const abandoned = await this.repo.abandonStale(now);
    if (abandoned) {
      this.logger.warn(
        `Marked ${abandoned} unfinished AFE report run(s) as failed; the period will be retried.`,
      );
    }
    const lastSent = await this.repo.latestSent();
    const lastAttempt = await this.repo.latestAttempt();
    const plan = planReport(now, lastSent, lastAttempt, config.start);
    if (!plan.due) return 'not due';

    const runId = await this.repo.claim(plan.from, plan.to);
    if (runId === null) return 'claimed elsewhere';

    let report: BuiltReport;
    try {
      report = await this.buildReport(config.orgId, plan.from, plan.to);
      const content = await buildWorkbook(report);
      await this.mailer.send({
        to: config.recipients,
        email: reportEmail(report),
        attachment: { filename: reportFileName(report), content },
      });
    } catch (error: any) {
      this.logger.error(
        `AFE report for run ${runId} failed: ${error?.message ?? error}`,
      );
      await this.repo
        .markFailed(runId, String(error?.message ?? error))
        .catch(() => undefined);
      return 'failed';
    }

    // The email is out. If recording that fails, the run would later count as
    // abandoned and be sent again, so try twice and say so loudly.
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.repo.markSent(runId, report.rows.length, config.recipients);
        break;
      } catch (error: any) {
        this.logger.error(
          `AFE report run ${runId} was emailed but could not be marked sent (attempt ${attempt}): ${error?.message ?? error}`,
        );
      }
    }
    this.logger.log(
      `AFE report sent to ${config.recipients.join(', ')}: ${report.rows.length} finished tour(s), run ${runId}.`,
    );
    return 'sent';
  }

  /** Period from optional "YYYY-MM-DD" days (India time, both inclusive). */
  resolvePeriod(fromDay?: string, toDay?: string, now = new Date()) {
    const day = (value: string) => {
      try {
        return istMidnight(value);
      } catch {
        throw new BadRequestException(`${value} is not a valid date`);
      }
    };
    const from = fromDay ? day(fromDay) : REPORT_EPOCH;
    const to = toDay ? addDays(day(toDay), 1) : now;
    if (from.getTime() >= to.getTime()) {
      throw new BadRequestException('"from" must be on or before "to"');
    }
    return { from, to: to.getTime() > now.getTime() ? now : to };
  }

  private orgIdOrThrow(): number {
    const { orgId } = afeReportConfig();
    if (!orgId) {
      throw new BadRequestException(
        'AFE_REPORT_ORG_ID is not set on this server',
      );
    }
    return orgId;
  }

  /** The Excel file for a period, without emailing or recording anything. */
  async previewFile(fromDay?: string, toDay?: string) {
    const { from, to } = this.resolvePeriod(fromDay, toDay);
    const report = await this.buildReport(this.orgIdOrThrow(), from, to);
    return {
      filename: reportFileName(report),
      content: await buildWorkbook(report),
      rows: report.rows.length,
    };
  }

  /** Emails the report for a period to the given address only; not recorded. */
  async sendTest(email: string, fromDay?: string, toDay?: string) {
    const { from, to } = this.resolvePeriod(fromDay, toDay);
    const report = await this.buildReport(this.orgIdOrThrow(), from, to);
    const messageId = await this.mailer.send({
      to: [email],
      email: reportEmail(report, { test: true }),
      attachment: {
        filename: reportFileName(report),
        content: await buildWorkbook(report),
      },
    });
    return { sentTo: email, rows: report.rows.length, messageId };
  }
}
