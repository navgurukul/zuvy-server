import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index';
import { zuvyBatchEnrollments } from '../../../drizzle/schema';
import { TrackingService } from 'src/controller/progress/tracking.service';

/**
 * Safety net for the cached `zuvy_batch_enrollments.attendance` column.
 *
 * That cache is normally refreshed by the Zoom-webhook attendance worker as
 * sessions are processed, but nothing recomputes it when attendance is
 * changed through other paths (legacy Google Meet import, manual session
 * edits, enrollment changes, etc). Rather than chasing every write site,
 * this job recomputes every batch nightly so any missed invalidation heals
 * within 24h instead of drifting silently.
 */
@Injectable()
export class AttendanceReconciliationJob {
  private readonly logger = new Logger(AttendanceReconciliationJob.name);
  private isRunning = false;

  constructor(private readonly trackingService: TrackingService) {}

  @Cron('0 2 * * *') // daily at 02:00
  async reconcileAllBatches() {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const rows = await db
        .selectDistinct({ batchId: zuvyBatchEnrollments.batchId })
        .from(zuvyBatchEnrollments)
        .where(sql`${zuvyBatchEnrollments.batchId} is not null`);

      const batchIds = rows.map((r) => r.batchId).filter(Boolean) as number[];
      this.logger.log(
        `Nightly attendance reconciliation starting for ${batchIds.length} batches`,
      );

      let failures = 0;
      for (const batchId of batchIds) {
        const result =
          await this.trackingService.recomputeBatchAttendancePercentages(
            batchId,
          );
        if (!result?.success) {
          failures++;
          this.logger.warn(
            `Attendance reconciliation failed for batch ${batchId}: ${result?.error}`,
          );
        }
      }

      this.logger.log(
        `Nightly attendance reconciliation finished: ${batchIds.length - failures}/${batchIds.length} batches updated`,
      );
    } catch (err: any) {
      this.logger.error(
        `Nightly attendance reconciliation failed: ${err?.message ?? err}`,
      );
    } finally {
      this.isRunning = false;
    }
  }
}
