import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { Public } from 'src/auth/decorators/public.decorator';
import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { RecordingWorkerTriggerService } from '../../services/recording-worker/recording-worker-trigger.service';

function extractMeetingIdentifiers(payload: any) {
  const meeting = payload?.object || {};

  return {
    meetingId: meeting.id?.toString(),
    meetingUuid: meeting.uuid,
    topic: meeting.topic,
    startTime: meeting.start_time,
  };
}

@Controller('webhooks/zoom')
export class ZoomWebhookController {
  private readonly logger = new Logger(ZoomWebhookController.name);

  constructor(
    private readonly recordingWorkerTrigger: RecordingWorkerTriggerService,
  ) {}

  @Public()
  @Post()
  async handleZoomEvent(@Req() req: Request, @Res() res: Response) {
    const body = req.body;
    const event = body?.event;

    // --------------------------------
    // 1️⃣ URL VALIDATION (already works)
    // --------------------------------
    if (event === 'endpoint.url_validation') {
      const plainToken = body.payload?.plainToken;

      const encryptedToken = crypto
        .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET!)
        .update(plainToken)
        .digest('hex');

      return res.status(200).json({ plainToken, encryptedToken });
    }

    // --------------------------------
    // 2️⃣ RECORDING COMPLETED (CORE)
    // --------------------------------
    if (event === 'recording.completed') {
      const payload = body.payload;
      const { meetingId, meetingUuid } = extractMeetingIdentifiers(payload);

      this.logger.log(`🎥 Recording completed for meeting ${meetingId}`);

      await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET
        status = 'DISCOVERED',
        retry_count = 0,
        last_error = NULL,
        next_retry_at = NULL
      WHERE zoom_meeting_id = ${meetingId}
         OR zoom_meeting_uuid = ${meetingUuid}
    `);

      this.recordingWorkerTrigger.triggerNow();

      return res.status(200).send();
    }

    // --------------------------------
    // 3️⃣ MEETING ENDED (OPTIONAL BUT GOOD)
    // --------------------------------
    if (event === 'meeting.ended') {
      const payload = body.payload;
      const { meetingId, meetingUuid } = extractMeetingIdentifiers(payload);

      this.logger.log(`🛑 Meeting ended: ${meetingId}`);

      // Optional: ensure recording job exists
      await db.execute(sql`
      INSERT INTO zuvy_session_recordings (
        session_id,
        zoom_meeting_id,
        zoom_meeting_uuid,
        status
      )
      SELECT
        s.id,
        ${meetingId},
        ${meetingUuid},
        'DISCOVERED'
      FROM zuvy_sessions s
      WHERE s.zoom_meeting_id = ${meetingId}
      ON CONFLICT (session_id) DO NOTHING
    `);

      this.recordingWorkerTrigger.triggerNow();

      return res.status(200).send();
    }

    // --------------------------------
    // 4️⃣ EVERYTHING ELSE → ACK
    // --------------------------------
    this.logger.debug(`Ignored Zoom event: ${event}`);
    return res.status(200).send();
  }
}
