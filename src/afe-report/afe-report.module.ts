import { Module } from '@nestjs/common';
import { AuthModule } from 'src/auth/auth.module';
import { AfeReportController } from './afe-report.controller';
import { AfeReportJob } from './afe-report.job';
import { AfeReportMailer } from './afe-report.mailer';
import { AfeReportRepository } from './afe-report.repository';
import { AfeReportService } from './afe-report.service';

/**
 * AFE Career Tours report: an Excel file of every tour finished in the
 * AFE-Career-Tours organisation, emailed every 3 days (see AfeReportJob and
 * docs/AFE_CAREER_TOURS_REPORT.md).
 */
@Module({
  imports: [AuthModule],
  controllers: [AfeReportController],
  providers: [
    AfeReportRepository,
    AfeReportMailer,
    AfeReportService,
    AfeReportJob,
  ],
})
export class AfeReportModule {}
