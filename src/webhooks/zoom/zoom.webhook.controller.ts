import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { webcrypto } from 'crypto';
import { Throttle } from '@nestjs/throttler';
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

async function verifyZoomSignature(req: Request): Promise<boolean> {
  const timestamp = req.headers['x-zm-request-timestamp'] as string;
  const signature = req.headers['x-zm-signature'] as string;

  if (!timestamp || !signature) return false;

  const rawBody = (req as any).rawBody;
  if (!rawBody) return false;

  const message = `v0:${timestamp}:${rawBody}`;
  const secret = process.env.ZOOM_WEBHOOK_SECRET!;
  const encoder = new TextEncoder();

  const key = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await webcrypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message),
  );

  const expected = `v0=${Buffer.from(signatureBuffer).toString('hex')}`;

  return expected === signature;
}

@Controller('webhooks/zoom')
export class ZoomWebhookController {
  private readonly logger = new Logger(ZoomWebhookController.name);

  constructor(
    private readonly recordingWorkerTrigger: RecordingWorkerTriggerService,
  ) {}

  @Public()
  @Throttle({
    default: {
      limit: 20,
      ttl: 60,
    },
  })
  @Post()
  async handleZoomEvent(@Req() req: Request, @Res() res: Response) {
    const body = req.body;
    const event = body?.event;

    // --------------------------------
    // URL VALIDATION
    // --------------------------------
    if (event === 'endpoint.url_validation') {
      const plainToken = body.payload?.plainToken;

      if (!plainToken) {
        return res.status(400).send();
      }
      const encryptedToken = crypto
        .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET!)
        .update(plainToken)
        .digest('hex');

      return res.status(200).json({
        plainToken,
        encryptedToken,
      });
    }

    const eventType = body?.event;
    const eventId =
      body?.event_id ??
      crypto
        .createHash('sha256')
        .update(
          `${req.headers['x-zm-request-timestamp']}:${req.headers['x-zm-signature']}`,
        )
        .digest('hex');

    this.logger.debug({
      msg: 'Zoom webhook rawBody diagnostics',
      hasRawBody: Boolean((req as any).rawBody),
      rawBodyType: typeof (req as any).rawBody,
      rawBodyLength:
        typeof (req as any).rawBody === 'string'
          ? (req as any).rawBody.length
          : Buffer.isBuffer((req as any).rawBody)
            ? (req as any).rawBody.length
            : null,
    });

    try {
      await db.execute(sql`
    INSERT INTO zuvy_zoom_webhook_events (
      event_id,
      event_type,
      meeting_id,
      payload,
      processing_status
    )
    VALUES (
      ${eventId},
      ${eventType},
      ${body?.payload?.object?.id?.toString()},
      ${body},
      'RECEIVED'
    )
  `);
    } catch (err: any) {
      // Duplicate event → already received or processed
      this.logger.debug(`Duplicate Zoom event ignored: ${eventId}`);
      return res.status(200).send();
    }

    // --------------------------------
    //  Signature validation (skip only for URL validation)
    // --------------------------------
    if (event !== 'endpoint.url_validation') {
      const valid = await verifyZoomSignature(req);
      if (!valid) {
        this.logger.warn('Invalid Zoom webhook signature');
        await db.execute(sql`
      UPDATE zuvy_zoom_webhook_events
      SET
        processing_status = 'FAILED',
        processing_error = 'Invalid signature'
      WHERE event_id = ${eventId}
    `);
        return res.status(401).send();
      }
    }

    try {
      // --------------------------------
      // RECORDING COMPLETED (CORE)
      // --------------------------------
      if (event === 'recording.completed') {
        const payload = body.payload;
        const { meetingId, meetingUuid } = extractMeetingIdentifiers(payload);

        this.logger.log(` Recording completed for meeting ${meetingId}`);

        // 1️ Find session
        const session = await db.query.zuvySessions.findFirst({
          where: (s, { eq }) => eq(s.zoomMeetingId, meetingId),
        });

        if (!session) {
          this.logger.warn(`Session not found for meeting ${meetingId}`);
          return res.status(200).send();
        }

        // 2️ Insert NEW recording row per UUID (restart-safe)
        await db.execute(sql`
    INSERT INTO zuvy_session_recordings (
      session_id,
      zoom_meeting_id,
      zoom_meeting_uuid,
      status,
      recording_start,
      recording_end,
      segments_count,
      retry_count
    )
    VALUES (
      ${session.id},
      ${meetingId},
      ${meetingUuid},
      'DISCOVERED',
      ${payload.object.start_time},
      ${payload.object.recording_files?.[0]?.recording_end},
      ${payload.object.recording_count || 0},
      0
    )
    ON CONFLICT (session_id, zoom_meeting_uuid)
    DO UPDATE SET
    status = 'DISCOVERED',
    retry_count = 0,
    next_retry_at = NULL,
    last_error = NULL
  `);

        this.recordingWorkerTrigger.triggerNow();

        await db.execute(sql`
        UPDATE zuvy_zoom_webhook_events
        SET processing_status = 'PROCESSED'
        WHERE event_id = ${eventId}
      `);

        return res.status(200).send();
      }

      // --------------------------------
      // MEETING ENDED (OPTIONAL BUT GOOD)
      // --------------------------------
      if (event === 'meeting.ended') {
        const payload = body.payload;
        const { meetingId, meetingUuid } = extractMeetingIdentifiers(payload);

        this.logger.log(` Meeting ended: ${meetingId}`);

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
      ON CONFLICT (session_id, zoom_meeting_uuid) DO NOTHING
    `);

        this.recordingWorkerTrigger.triggerNow();

        await db.execute(sql`
        UPDATE zuvy_zoom_webhook_events
        SET processing_status = 'PROCESSED'
        WHERE event_id = ${eventId}
      `);

        return res.status(200).send();
      }
    } catch (error: any) {
      await db.execute(sql`
        UPDATE zuvy_zoom_webhook_events
        SET
          processing_status = 'FAILED',
          processing_error = ${error.message}
        WHERE event_id = ${eventId}
      `);
      throw error; // let Nest log it
    }

    // --------------------------------
    // EVERYTHING ELSE → ACK
    // --------------------------------
    this.logger.debug(`Ignored Zoom event: ${event}`);
    return res.status(200).send();
  }
}
