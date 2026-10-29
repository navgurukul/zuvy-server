import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

// Mirrors RecordingWorkerTriggerService's pattern: a decoupled signal bus so
// GmailMonitorService can wake the YouTube health check up immediately on a
// candidate violation email, instead of waiting for the 2 AM cron
// (runNightlyRecordingHealthCheck). Debounced much harder than the webhook
// trigger's 3s (see recording-worker-trigger.service.ts) because a health
// check walks up to 1000 rows per table against the YouTube API — a burst of
// related notification emails (e.g. multiple draft-autosave-like history
// entries, or several distinct notices about the same incident) must collapse
// into one run, not one per email.
@Injectable()
export class YoutubeHealthCheckTriggerService {
  private readonly logger = new Logger(YoutubeHealthCheckTriggerService.name);
  private readonly trigger$ = new Subject<string>();
  private lastTriggeredAt = 0;
  private readonly DEBOUNCE_MS = 5 * 60 * 1000;

  triggerNow(reason: string) {
    const now = Date.now();
    if (now - this.lastTriggeredAt < this.DEBOUNCE_MS) {
      this.logger.log(
        `[YOUTUBE_HEALTH] Skipping Gmail-triggered health check (debounced, last ran ${Math.round(
          (now - this.lastTriggeredAt) / 1000,
        )}s ago): ${reason}`,
      );
      return;
    }
    this.lastTriggeredAt = now;
    this.logger.warn(
      `[YOUTUBE_HEALTH] Gmail-triggered immediate health check: ${reason}`,
    );
    this.trigger$.next(reason);
  }

  onTrigger() {
    return this.trigger$.asObservable();
  }
}
