import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AfeReportService } from './afe-report.service';
import { afeReportConfig, configProblem } from './afe-report.config';

/**
 * Emails the AFE Career Tours report every Monday from 9 AM India time,
 * covering Monday 9 AM to Monday 9 AM. Checks every hour (so a server that was
 * down on Monday catches up); does nothing unless AFE_REPORT_ENABLED=true. Every app
 * server runs this check, but the zuvy_afe_report_runs table (migration 0048)
 * lets only one of them send each report.
 */
@Injectable()
export class AfeReportJob implements OnModuleInit {
  private readonly logger = new Logger(AfeReportJob.name);
  private running = false;
  private warnedMisconfigured = false;

  constructor(private readonly service: AfeReportService) {}

  onModuleInit() {
    const config = afeReportConfig();
    if (!config.enabled) {
      this.logger.log(
        'AFE report email is off (AFE_REPORT_ENABLED is not "true").',
      );
      return;
    }
    const problem = configProblem(config);
    this.logger.log(
      problem
        ? `AFE report email is on but can't run: ${problem}.`
        : `AFE report email is on: every Monday from 9:00 IST to ${config.recipients.join(', ')}` +
            (config.start
              ? `, first report from ${config.start.toISOString()}.`
              : '.'),
    );
  }

  @Cron('5 * * * *', { timeZone: 'Asia/Kolkata' })
  async hourlyCheck() {
    const config = afeReportConfig();
    if (!config.enabled) return;
    // A slow run must not overlap the next check on the same server.
    if (this.running) return;
    this.running = true;
    try {
      const outcome = await this.service.sendIfDue(new Date());
      if (outcome === 'misconfigured' && !this.warnedMisconfigured) {
        this.warnedMisconfigured = true;
        this.logger.warn(
          `AFE report email can't run: ${configProblem(config)}.`,
        );
      }
    } catch (error: any) {
      // e.g. migration 0048 not applied yet
      this.logger.error(`AFE report check failed: ${error?.message ?? error}`);
    } finally {
      this.running = false;
    }
  }
}
