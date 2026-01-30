import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { db } from '../db/index';
import { ZoomService } from '../services/zoom/zoom.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { google } from 'googleapis';

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

  // =====================================================
  // WORKER LOOP (FEATURE-FLAG PROTECTED)
  // =====================================================
  @Interval(5000)
  async runWorkerOnce() {
    if (process.env.RECORDING_WORKER_ENABLED !== 'true') return;

    const job = await this.pickJob();
    if (!job) return;

    await this.processJob(job);
  }

  // =====================================================
  // PICK ONE JOB (ROW-LOCKED, SAFE FOR MULTI-INSTANCE)
  // =====================================================
  private async pickJob() {
    const result = await db.execute(sql`
      SELECT *
      FROM zuvy_session_recordings
      WHERE status IN ('DISCOVERED', 'METADATA_READY', 'DOWNLOADING', 'FAILED')
        AND retry_count < 5
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);

    return result.rows?.[0];
  }

  // =====================================================
  // STATE MACHINE
  // =====================================================
  private async processJob(job: any) {
    try {
      switch (job.status) {
        case 'DISCOVERED':
          await this.fetchZoomMetadata(job);
          break;

        case 'METADATA_READY':
          await this.downloadRecording(job);
          break;

        case 'DOWNLOADING':
          await this.uploadToYoutube(job);
          break;
      }
    } catch (error: any) {
      await this.markFailed(job, error);
    }
  }

  // =====================================================
  // STEP 1 — FETCH ZOOM METADATA
  // =====================================================
  private async fetchZoomMetadata(job: any) {
    let recResp;

    // ✅ Prefer UUID (production-grade)
    if (job.zoom_meeting_uuid) {
      this.logger.log(`Fetching recordings via UUID for job ${job.id}`);
      recResp = await this.zoomService.getZoomRecordingFilesByUUID(
        job.zoom_meeting_uuid,
      );
    } else {
      // ⚠️ Fallback for old sessions
      this.logger.warn(
        `UUID missing for job ${job.id}, falling back to meetingId`,
      );
      recResp = await this.zoomService.getZoomRecordingFiles(
        job.zoom_meeting_id,
      );
    }

    const mp4 = recResp?.recording_files?.find(
      (f: any) => f.file_type === 'MP4',
    );

    if (!mp4) {
      throw new Error('No MP4 recording found on Zoom');
    }

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
      recResp = await this.zoomService.getZoomRecordingFilesByUUID(
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
  private async markFailed(job: any, error: Error) {
    this.logger.error(`Recording job ${job.id} failed`, error.stack);

    await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET
        status = 'FAILED',
        retry_count = retry_count + 1,
        last_error = ${error.message}
      WHERE id = ${job.id}
    `);
  }
}
