import { Injectable, Logger, ForbiddenException } from '@nestjs/common';
import * as crypto from 'crypto';
import { db } from '../../db';
import { eq, sql } from 'drizzle-orm';
import {
  zuvySessions,
  zuvyBatches,
  licenseAssignments,
  zuvySessionRecordings,
} from '../../../drizzle/schema';

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

      case 'meeting.started':
        return this.handleMeetingStarted(event);

      case 'meeting.ended':
        return this.handleMeetingEnded(event);

      default:
        this.logger.debug(`Ignoring Zoom event: ${type}`);
    }
  }

  // ==============================
  // meeting.started
  // ==============================
  private async handleMeetingStarted(event: any) {
    const meetingId = event.payload?.object?.id.toString();
    const hostEmail = event.payload?.object?.host_id; // zoom user id or email

    if (!meetingId) return;

    this.logger.log(`Meeting started: ${meetingId}`);

    // Validate that this session has a license assignment

    //   const result = await db.execute(sql`
    //   SELECT s.id, b.instructor_id, s.start_time, s.end_time, la.licenseId
    //   FROM ${zuvySessions} s
    //   JOIN ${zuvyBatches} b ON s.batch_id = b.id
    //   LEFT JOIN ${licenseAssignments} la ON s.id = la.session_id
    //   WHERE s.zoom_meeting_id = ${meetingId}
    //   LIMIT 1
    // `);

    const result = await db
      .select({
        id: zuvySessions.id,
        instructorId: zuvyBatches.instructorId,
        startTime: zuvySessions.startTime,
        endTime: zuvySessions.endTime,
        licenseId: licenseAssignments.licenseId,
      })
      .from(zuvySessions)
      .innerJoin(zuvyBatches, eq(zuvySessions.batchId, zuvyBatches.id))
      .leftJoin(
        licenseAssignments,
        eq(zuvySessions.id, licenseAssignments.sessionId),
      )
      .where(eq(zuvySessions.zoomMeetingId, meetingId))
      .limit(1);

    const session = result[0];

    if (!session) {
      this.logger.warn(
        `Started meeting ${meetingId} not found in zuvy_sessions or linked batch`,
      );
      return;
    }

    if (!session.licenseId) {
      this.logger.error(
        `No license assigned for started meeting ${meetingId}. Instructor: ${session.instructorId}`,
      );
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

    //   await db.execute(sql`
    //   UPDATE zuvy_session_recordings
    //   SET
    //     status = 'DISCOVERED',
    //     next_retry_at = NOW()
    //   WHERE zoom_meeting_uuid = ${normalizedUuid}
    // `);

    await db
      .update(zuvySessionRecordings)
      .set({
        status: 'DISCOVERED',
        nextRetryAt: new Date().toISOString(),
      } as any)
      .where(eq(zuvySessionRecordings.zoomMeetingUuid, normalizedUuid));
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
