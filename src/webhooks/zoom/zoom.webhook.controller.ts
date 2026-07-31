import { Controller, Post, Req, Res, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { webcrypto } from 'crypto';
import { Throttle } from '@nestjs/throttler';
import { Public } from 'src/auth/decorators/public.decorator';
import { sql } from 'drizzle-orm';
import { db } from '../../db';
import { RecordingWorkerTriggerService } from '../../services/recording-worker/recording-worker-trigger.service';
import { RecordingWorkerService } from '../../services/recording-worker/recording-worker.service';
import { AttendanceWorkerTriggerService } from '../../services/attendance-worker/attendance-worker-trigger.service';

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
    private readonly recordingWorkerService: RecordingWorkerService,
    private readonly attendanceWorkerTrigger: AttendanceWorkerTriggerService,
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

    const eventType = body?.event || body?.event_type || 'unknown';
    const meetingObjId = body?.payload?.object?.id?.toString() || '';
    const meetingObjUuid = body?.payload?.object?.uuid || '';
    const fileId = body?.payload?.object?.recording_files?.[0]?.id || '';

    const eventId =
      body?.event_id ||
      `${req.headers['x-zm-request-timestamp'] || Date.now()}_${eventType}_${meetingObjId}_${meetingObjUuid}_${fileId}`;

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
        const recordingFiles = payload.object.recording_files || [];

        this.logger.log({
          msg: 'Recording completed — ingesting instance',
          meetingId,
          meetingUuid,
          mp4Segments: recordingFiles.filter((f: any) => f.file_type === 'MP4')
            .length,
        });

        // A given zoom_meeting_id belongs to either a class session or a
        // mentor booking (never both) — check both, ingest into whichever
        // owns it. ingestRecordingCompleted() merges this instance's
        // segments into any prior instances for the same owner instead of
        // overwriting them (see RecordingWorkerService.ingestRecordingCompleted).
        const cleanId = String(meetingId || '').replace(/\D/g, '');

        const session = await db.query.zuvySessions.findFirst({
          where: (s, { or, eq, sql: dSql }) =>
            or(
              eq(s.zoomMeetingId, meetingId),
              eq(s.meetingId, meetingId),
              dSql`REPLACE(${s.zoomMeetingId}, ' ', '') = ${cleanId}`,
              dSql`REPLACE(${s.meetingId}, ' ', '') = ${cleanId}`,
            ),
          columns: { id: true },
        });

        if (session) {
          await this.recordingWorkerService.ingestRecordingCompleted({
            table: 'session',
            ownerId: session.id,
            meetingId,
            meetingUuid,
            recordingFiles,
            fallbackStartTime: payload.object.start_time,
          });
          this.recordingWorkerTrigger.triggerNow();
        }

        const mentorBooking = await db.query.zuvyMentorSlotBooking.findFirst({
          where: (b, { or, eq, sql: dSql }) =>
            or(
              eq(b.zoomMeetingId, meetingId),
              dSql`REPLACE(${b.zoomMeetingId}, ' ', '') = ${cleanId}`,
            ),
          columns: { id: true },
        });

        if (mentorBooking) {
          await this.recordingWorkerService.ingestRecordingCompleted({
            table: 'mentor',
            ownerId: mentorBooking.id,
            meetingId,
            meetingUuid,
            recordingFiles,
            fallbackStartTime: payload.object.start_time,
          });
          this.recordingWorkerTrigger.triggerNow();
        }

        if (!session && !mentorBooking) {
          this.logger.warn(
            `No session or mentor booking found for meeting ${meetingId}`,
          );
        }

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

        // Ensure a recording job exists (one row per owner going forward —
        // ingestRecordingCompleted() is what merges further instances in).
        await db.execute(sql`
          INSERT INTO zuvy_session_recordings (
            session_id,
            zoom_meeting_id,
            zoom_meeting_uuid,
            status,
            retry_count
          )
          SELECT
            s.id,
          ${meetingId},
          ${meetingUuid},
          'DISCOVERED',
          0
          FROM zuvy_sessions s
          WHERE s.zoom_meeting_id = ${meetingId}
            AND NOT EXISTS (
              SELECT 1 FROM zuvy_session_recordings r WHERE r.session_id = s.id
            )
          `);

        await db.execute(sql`
          INSERT INTO zuvy_mentor_session_recordings (
            mentor_booking_id,
            zoom_meeting_id,
            zoom_meeting_uuid,
            status,
            retry_count
          )
          SELECT
            b.id,
          ${meetingId},
          ${meetingUuid},
          'DISCOVERED',
          0
          FROM zuvy_mentor_slot_booking b
          WHERE b.zoom_meeting_id = ${meetingId}
            AND NOT EXISTS (
              SELECT 1 FROM zuvy_mentor_session_recordings m WHERE m.mentor_booking_id = b.id
            )
          `);

        this.recordingWorkerTrigger.triggerNow();

        // Ensure attendance job exists — deferred a few minutes so Zoom's
        // participant report has time to finish populating after the meeting ends.
        await db.execute(sql`
          INSERT INTO zuvy_session_attendance_jobs (
            session_id,
            zoom_meeting_id,
            zoom_meeting_uuid,
            batch_id,
            bootcamp_id,
            status,
            next_retry_at,
            retry_count
          )
          SELECT
            s.id,
          ${meetingId},
          ${meetingUuid},
          s.batch_id,
          s.bootcamp_id,
          'DISCOVERED',
          NOW() + INTERVAL '3 minutes',
          0
          FROM zuvy_sessions s
          WHERE s.zoom_meeting_id = ${meetingId}
            AND NOT EXISTS (
            SELECT 1
              FROM zuvy_session_attendance_jobs a
              WHERE a.session_id = s.id
                AND (
              a.zoom_meeting_id = ${meetingId}
                  OR a.zoom_meeting_uuid = ${meetingUuid}
            )
          )
          `);

        this.attendanceWorkerTrigger.triggerNow();

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
