import { Injectable, Logger } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class AttendanceWorkerTriggerService {
  private readonly logger = new Logger(AttendanceWorkerTriggerService.name);

  // simple in-memory signal bus
  private readonly trigger$ = new Subject<void>();

  private lastTriggeredAt = 0;

  triggerNow() {
    const now = Date.now();

    if (now - this.lastTriggeredAt < 3000) {
      return;
    }

    this.lastTriggeredAt = now;
    this.logger.log('🔔 Attendance worker triggered by webhook');
    this.trigger$.next();
  }

  onTrigger() {
    return this.trigger$.asObservable();
  }
}
