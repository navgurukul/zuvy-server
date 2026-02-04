import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

@Injectable()
export class ZoomWebhookService {
  private readonly logger = new Logger(ZoomWebhookService.name);

  private readonly secret = process.env.ZOOM_WEBHOOK_SECRET!;

  // ==============================
  // Signature verification
  // ==============================
  verifySignature(body: any, signature: string, timestamp: string) {
    const message = `v0:${timestamp}:${JSON.stringify(body)}`;
    const hash = crypto
      .createHmac('sha256', this.secret)
      .update(message)
      .digest('hex');

    const expected = `v0=${hash}`;

    if (signature !== expected) {
      this.logger.error('Invalid Zoom webhook signature');
      throw new ForbiddenException('Invalid signature');
    }
  }

  // ==============================
  // URL validation
  // ==============================
  generateValidationResponse(token: string) {
    return crypto.createHmac('sha256', this.secret).update(token).digest('hex');
  }

  // ==============================
  // Event dispatcher
  // ==============================
  async processEvent(event: any) {
    const type = event.event;

    switch (type) {
      case 'recording.completed':
        return this.handleRecordingCompleted(event);

      case 'meeting.ended':
        return this.handleMeetingEnded(event);

      default:
        this.logger.debug(`Ignoring Zoom event: ${type}`);
    }
  }

  // ==============================
  // recording.completed
  // ==============================
  private async handleRecordingCompleted(event: any) {
    const uuid = event.payload?.object?.uuid;
    if (!uuid) return;

    const normalizedUuid = uuid.replace(/\//g, '');

    this.logger.log(`Recording completed for Zoom UUID ${normalizedUuid}`);

    await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET
        status = 'DISCOVERED',
        next_retry_at = NOW()
      WHERE zoom_meeting_uuid = ${normalizedUuid}
    `);
  }

  // ==============================
  // meeting.ended (optional but useful)
  // ==============================
  private async handleMeetingEnded(event: any) {
    const uuid = event.payload?.object?.uuid;
    if (!uuid) return;

    const normalizedUuid = uuid.replace(/\//g, '');

    this.logger.log(`Meeting ended: ${normalizedUuid}`);
  }
}
