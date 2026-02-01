import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { ZoomService } from '../services/zoom/zoom.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { google } from 'googleapis';

const RECORDING_WORKER_ENABLED =
  process.env.RECORDING_WORKER_ENABLED === 'true';

const YOUTUBE_UPLOAD_ENABLED = process.env.YOUTUBE_UPLOAD_ENABLED === 'true';

const MAX_RETRIES = 5;

type RecordingJob = {
  id: number;
  session_id: number;
  zoom_meeting_id: string;
  zoom_meeting_uuid?: string | null;
  zoom_recording_id?: string | null;
  status: string;
  retry_count: number;
  drive_link?: string | null;
};

@Injectable()
export class RecordingWorkerService {
  private readonly logger = new Logger(RecordingWorkerService.name);
  private youtube: any;

  constructor(private readonly zoomService: ZoomService) {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'https://developers.google.com/oauthplayground',
    );

    oAuth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_YT_REFRESH_TOKEN,
    });

    this.youtube = google.youtube({
      version: 'v3',
      auth: oAuth2Client,
    });
  }
  /////////////helper function for logging job details/////////////
  private logJob(
    level: 'log' | 'warn' | 'error' | 'debug',
    job: RecordingJob,
    message: string,
    extra?: Record<string, any>,
  ) {
    this.logger[level]({
      msg: message,
      jobId: job.id,
      sessionId: job.session_id,
      status: job.status,
      retry: job.retry_count,
      ...extra,
    });
  }

  // =====================================================
  // WORKER LOOP (FEATURE-FLAG PROTECTED)
  // =====================================================
  @Interval(5000)
  async runWorkerOnce() {
    this.logger.log('⏱ Recording worker tick');

    if (!RECORDING_WORKER_ENABLED) {
      this.logger.debug('Recording worker disabled by env flag');
      return;
    }

    const job = await this.pickJob();
    if (!job) {
      this.logger.debug('No recording jobs found');
      return;
    }

    this.logger.log(`Picked recording job ${job.id}`);
    await this.processJob(job);
  }

  // =====================================================
  // PICK ONE JOB (ROW-LOCKED, SAFE FOR MULTI-INSTANCE)
  // =====================================================
  private async pickJob(): Promise<RecordingJob | null> {
    const result = await db.execute(sql`
      SELECT *
      FROM zuvy_session_recordings
      WHERE status IN ('DISCOVERED', 'FAILED', 'METADATA_READY', 'DOWNLOADING')
        AND status != 'PERMANENT_FAILED'
        AND status NOT LIKE 'PROCESSING_%'
        AND retry_count < ${MAX_RETRIES}
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

    const job = result.rows?.[0] as RecordingJob | undefined;
    if (!job) return null;

    // Soft-lock via status
    let nextStatus = job.status;

    if (job.status === 'DISCOVERED' || job.status === 'FAILED') {
      nextStatus = 'PROCESSING_METADATA';
    } else if (job.status === 'METADATA_READY') {
      nextStatus = 'PROCESSING_DOWNLOAD';
    } else if (job.status === 'DOWNLOADING') {
      nextStatus = 'PROCESSING_UPLOAD';
    }

    await db.execute(sql`
    UPDATE zuvy_session_recordings
    SET
      status = ${nextStatus},
      updated_at = NOW()
    WHERE id = ${job.id}
  `);

    return { ...job, status: nextStatus };
  }

  // =====================================================
  // STATE MACHINE
  // =====================================================
  private async processJob(job: any) {
    try {
      const status = String(job.status).trim().toUpperCase();

      this.logJob('log', job, 'Processing recording job');

      switch (status) {
        case 'PROCESSING_METADATA':
          await this.fetchZoomMetadata(job);
          break;

        case 'PROCESSING_DOWNLOAD':
          await this.downloadRecording(job);
          break;

        case 'PROCESSING_UPLOAD':
          await this.uploadToYoutube(job);
          break;

        case 'PERMANENT_FAILED':
          this.logger.warn(
            `Skipping permanently failed recording job ${job.id}`,
          );
          return;

        default:
          this.logger.warn(
            `Unknown recording job status "${job.status}" for job ${job.id}`,
          );
          return;
      }
    } catch (error: any) {
      await this.markFailed(job, error);
    }
  }

  // =====================================================
  // RETRY BACKOFF HELPER (EXPONENTIAL + JITTER)
  // =====================================================
  private computeNextRetry(retryCount: number): Date {
    const baseSeconds = Math.min(
      60 * Math.pow(2, retryCount), // 1m, 2m, 4m, 8m...
      15 * 60, // cap at 15 minutes
    );

    const jitter = Math.floor(Math.random() * 30); // 0–30s
    return new Date(Date.now() + (baseSeconds + jitter) * 1000);
  }

  // =====================================================
  // STEP 1 — FETCH ZOOM METADATA
  // =====================================================
  private async fetchZoomMetadata(job: any) {
    let recResp: any;

    try {
      // Prefer UUID (production-grade, Zoom-safe)
      if (job.zoom_meeting_uuid) {
        this.logJob('debug', job, 'Fetching Zoom recordings via UUID');

        recResp = await this.zoomService.getZoomRecordingFilesByUuid(
          job.zoom_meeting_uuid,
        );
        recResp.source = 'uuid';
      } else {
        // Fallback for old sessions
        this.logger.warn(
          `UUID missing for job ${job.id}, falling back to meetingId`,
        );

        recResp = await this.zoomService.getZoomRecordingFilesSafe({
          meetingId: job.zoom_meeting_id,
          meetingUuid: job.zoom_meeting_uuid,
        });
        recResp.source = 'meetingId';
      }
    } catch (err: any) {
      /**
       * CRITICAL FIX
       * Zoom returns 404 when:
       * - meeting has not ended
       * - recording is not generated yet
       *
       * This is NOT a failure.
       */
      if (err?.response?.status === 404) {
        this.logger.log(
          `Recording not available yet for job ${job.id} (meeting likely not ended). Deferring without retry penalty.`,
        );

        await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          status = 'DISCOVERED',
          next_retry_at = NOW() + INTERVAL '10 minutes'
        WHERE id = ${job.id}
      `);

        return;
      }

      // Any other error is a real failure
      throw err;
    }

    const mp4 = recResp?.recording_files
      ?.filter((f: any) => f.file_type === 'MP4')
      ?.sort(
        (a: any, b: any) =>
          new Date(b.recording_end).getTime() -
          new Date(a.recording_end).getTime(),
      )?.[0];

    // Zoom responded, but recording not ready yet
    if (!mp4) {
      const nextRetryCount = job.retry_count + 1;

      // TERMINAL FAILURE (real retries only)
      if (nextRetryCount >= MAX_RETRIES) {
        this.logger.error(
          `Recording permanently failed for job ${job.id} after ${nextRetryCount} attempts`,
        );

        await db.execute(sql`
          UPDATE zuvy_session_recordings
          SET
            status = 'PERMANENT_FAILED',
            retry_count = ${nextRetryCount},
            last_error = 'Recording never became available on Zoom'
          WHERE id = ${job.id}
        `);

        return;
      }

      // RETRY LATER
      const nextRetry = this.computeNextRetry(job.retry_count);

      this.logJob('warn', job, 'Recording not ready yet; deferring');

      await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          status = 'FAILED',
          retry_count = retry_count + 1,
          next_retry_at = ${nextRetry}
        WHERE id = ${job.id}
      `);

      return;
    }

    // Success — recording found
    this.logJob('log', job, 'Zoom recording discovered', {
      source: recResp.source,
    });

    await db.execute(sql`
    UPDATE zuvy_session_recordings
    SET
      zoom_recording_id = ${mp4.id},
      status = 'METADATA_READY'
    WHERE id = ${job.id}
  `);
  }

  // =====================================================
  // STEP 2 — DOWNLOAD TO TEMP (NO ZoomService CHANGE)
  // =====================================================
  private async downloadRecording(job: any) {
    const tempDir = path.join(process.cwd(), 'temp-recordings');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const finalPath = path.join(
      tempDir,
      `${job.session_id}-${job.zoom_recording_id}.mp4`,
    );

    if (!fs.existsSync(finalPath)) {
      await this.downloadRecordingToFile(
        job.zoom_meeting_id,
        job.zoom_recording_id,
        finalPath,
        job,
      );
    }

    await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET status = 'DOWNLOADING'
      WHERE id = ${job.id}
    `);
  }

  // =====================================================
  // DOWNLOAD HELPER (LOCAL, SAFE, .part STRATEGY)
  // =====================================================
  private async downloadRecordingToFile(
    meetingId: string | number,
    recordingFileId: string,
    finalPath: string,
    job?: any,
  ) {
    let recResp;

    if (job?.zoom_meeting_uuid) {
      recResp = await this.zoomService.getZoomRecordingFilesByUuid(
        job.zoom_meeting_uuid,
      );
    } else {
      recResp = await this.zoomService.getZoomRecordingFiles(meetingId);
    }

    const file = recResp?.recording_files?.find(
      (f: any) => f.id === recordingFileId,
    );

    if (!file?.download_url) {
      throw new Error('Zoom download URL not found');
    }

    const tempPath = `${finalPath}.part`;
    const writer = fs.createWriteStream(tempPath);

    const response = await axios({
      method: 'get',
      url: file.download_url,
      responseType: 'stream',
      maxRedirects: 5,
    });

    return new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);

      writer.on('finish', () => {
        fs.renameSync(tempPath, finalPath);
        resolve();
      });

      writer.on('error', (err) => {
        try {
          fs.unlinkSync(tempPath);
        } catch {}
        reject(err);
      });

      response.data.on('error', reject);
    });
  }

  // =====================================================
  // STEP 3 — UPLOAD TO YOUTUBE (IDEMPOTENT)
  // =====================================================
  private async uploadToYoutube(job: any) {
    if (!YOUTUBE_UPLOAD_ENABLED) {
      this.logJob('warn', job, 'YouTube upload disabled by env flag');
      return;
    }

    // Idempotency guard
    if (job.drive_link) {
      this.logger.log(`Job ${job.id} already uploaded, skipping`);
      return;
    }

    const filePath = path.join(
      process.cwd(),
      'temp-recordings',
      `${job.session_id}-${job.zoom_recording_id}.mp4`,
    );

    if (!fs.existsSync(filePath)) {
      throw new Error('Downloaded file not found');
    }

    const fileSize = fs.statSync(filePath).size;

    const res = await this.youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title: `Session ${job.session_id}`,
            description: 'Automated session recording upload',
          },
          status: { privacyStatus: 'unlisted' },
        },
        media: { body: fs.createReadStream(filePath) },
      },
      {
        onUploadProgress: (evt: any) => {
          const progress = Math.round((evt.bytesRead / fileSize) * 100);
          this.logger.log(`YouTube upload ${progress}%`);
        },
      },
    );

    const videoId = res.data.id;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

    await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET
        status = 'COMPLETED',
        drive_link = ${videoUrl}
      WHERE id = ${job.id}
    `);

    fs.unlinkSync(filePath); // cleanup
  }

  // =====================================================
  // FAILURE HANDLING (RETRY SAFE)
  // =====================================================
  private async markFailed(job: RecordingJob, error: Error) {
    const nextRetryCount = job.retry_count + 1;
    const isTerminal = nextRetryCount >= MAX_RETRIES;

    this.logJob('error', job, 'Recording job failed', {
      error: error.message,
      terminal: isTerminal,
    });

    await db.execute(sql`
    UPDATE zuvy_session_recordings
    SET
      status = ${isTerminal ? 'PERMANENT_FAILED' : 'FAILED'},
      retry_count = ${nextRetryCount},
      last_error = ${error.message},
      next_retry_at = ${isTerminal ? null : this.computeNextRetry(job.retry_count)},
      updated_at = NOW()
    WHERE id = ${job.id}
  `);
  }
}
