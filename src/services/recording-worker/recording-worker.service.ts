import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { sql } from 'drizzle-orm';
import { db } from '../../db/index';
import { ZoomService } from '../zoom/zoom.service';
import { OnModuleInit } from '@nestjs/common';
import { RecordingWorkerTriggerService } from './recording-worker-trigger.service';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { google } from 'googleapis';
import { Subject } from 'rxjs';

const RECORDING_WORKER_ENABLED =
  process.env.RECORDING_WORKER_ENABLED === 'true';

const YOUTUBE_UPLOAD_ENABLED = process.env.YOUTUBE_UPLOAD_ENABLED === 'true';

const MAX_RETRIES = 5;

type RecordingJob = {
  id: number;
  session_id?: number;
  mentor_booking_id?: number;
  zoom_meeting_id: string;
  zoom_meeting_uuid?: string | null;
  zoom_recording_id?: string | null;
  status: string;
  retry_count: number;
  drive_link?: string | null;
  table: 'session' | 'mentor';
};

@Injectable()
export class RecordingWorkerService implements OnModuleInit {
  private readonly logger = new Logger(RecordingWorkerService.name);
  private youtube: any;

  onModuleInit() {
    this.trigger.onTrigger().subscribe(async () => {
      try {
        this.logger.log('⚡ Immediate worker execution triggered by webhook');
        await this.runWorkerOnce(); // reuse existing logic
      } catch (err) {
        this.logger.error('Triggered worker execution failed', err);
      }
    });

    if (RECORDING_WORKER_ENABLED) {
      setInterval(async () => {
        try {
          await this.runWorkerOnce();
        } catch (err) {
          this.logger.error('Scheduled recording worker execution failed', err);
        }
      }, 5000);
    }
  }

  constructor(
    private readonly zoomService: ZoomService,
    private readonly trigger: RecordingWorkerTriggerService,
  ) {
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

  private getTableName(job: RecordingJob): string {
    return job.table === 'mentor'
      ? 'zuvy_mentor_session_recordings'
      : 'zuvy_session_recordings';
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
      mentorBookingId: job.mentor_booking_id,
      table: job.table,
      status: job.status,
      retry: job.retry_count,
      ...extra,
    });
  }

  // =====================================================
  // WORKER LOOP (FEATURE-FLAG PROTECTED)
  // =====================================================
  async runWorkerOnce() {
    // this.logger.debug('⏱ Recording worker tick');

    if (!RECORDING_WORKER_ENABLED) {
      this.logger.debug('Recording worker disabled by env flag');
      return;
    }

    const job = await this.pickJob();
    if (!job) {
      // this.logger.debug('No recording jobs found');
      return;
    }

    this.logger.log(`Picked recording job ${job.id}`);
    await this.processJob(job);
  }

  // =====================================================
  // PICK ONE JOB (ROW-LOCKED, SAFE FOR MULTI-INSTANCE)
  // =====================================================
  private async pickJob(): Promise<RecordingJob | null> {
    // First try session recordings
    let result = await db.execute(sql`
    UPDATE zuvy_session_recordings
    SET
      status = CASE
        WHEN status IN ('DISCOVERED', 'FAILED') THEN 'PROCESSING_METADATA'
        WHEN status = 'METADATA_READY' THEN 'PROCESSING_DOWNLOAD'
        WHEN status = 'DOWNLOADING' THEN 'DOWNLOADED'
        WHEN status = 'DOWNLOADED' THEN 'MERGING'
        WHEN status = 'MERGED' THEN 'PROCESSING_UPLOAD'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM zuvy_session_recordings
      WHERE status IN ('DISCOVERED', 'FAILED', 'METADATA_READY', 'DOWNLOADING', 'DOWNLOADED', 'MERGED')
        AND status NOT LIKE 'PROCESSING_%'
        AND status != 'PERMANENT_FAILED'
        AND retry_count < ${MAX_RETRIES}
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *, 'session' as table
  `);

    if (result.rows?.[0]) {
      return { ...result.rows[0], table: 'session' } as RecordingJob;
    }

    // Then try mentor recordings
    result = await db.execute(sql`
    UPDATE zuvy_mentor_session_recordings
    SET
      status = CASE
        WHEN status IN ('DISCOVERED', 'FAILED') THEN 'PROCESSING_METADATA'
        WHEN status = 'METADATA_READY' THEN 'PROCESSING_DOWNLOAD'
        WHEN status = 'DOWNLOADING' THEN 'PROCESSING_UPLOAD'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM zuvy_mentor_session_recordings
      WHERE status IN ('DISCOVERED', 'FAILED', 'METADATA_READY', 'DOWNLOADING')
        AND status NOT LIKE 'PROCESSING_%'
        AND status != 'PERMANENT_FAILED'
        AND retry_count < ${MAX_RETRIES}
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *, 'mentor' as table
  `);

    if (result.rows?.[0]) {
      return { ...result.rows[0], table: 'mentor' } as RecordingJob;
    }

    return null;
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

        case 'DOWNLOADED':
          await this.mergeRecording(job);
          break;

        case 'MERGED':
          await this.uploadToYoutube(job);
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

        if (job.table === 'mentor') {
          await db.execute(sql`
            UPDATE zuvy_mentor_session_recordings
            SET
              status = 'DISCOVERED',
              next_retry_at = NOW() + INTERVAL '10 minutes'
            WHERE id = ${job.id}
          `);
        } else {
          await db.execute(sql`
            UPDATE zuvy_session_recordings
            SET
              status = 'DISCOVERED',
              next_retry_at = NOW() + INTERVAL '10 minutes'
            WHERE id = ${job.id}
          `);
        }

        return;
      }

      // Any other error is a real failure
      throw err;
    }

    // Log all available recording files for debugging
    const allMp4Files =
      recResp?.recording_files?.filter((f: any) => f.file_type === 'MP4') || [];
    this.logJob('log', job, 'Available MP4 recording files', {
      count: allMp4Files.length,
      types: allMp4Files.map((f: any) => ({
        id: f.id,
        recordingType: f.recording_type,
        fileSize: f.file_size,
        recordingEnd: f.recording_end,
      })),
    });

    // Prioritize recording selection: prefer speaker views over shared screen
    // This ensures we get complete, properly encoded videos
    let mp4 = allMp4Files
      ?.filter((f: any) => !f.recording_type.includes('chat'))
      ?.sort((a: any, b: any) => {
        // Priority order: speaker_view > shared_screen_with_speaker_view > others
        const getTypePriority = (type: string): number => {
          if (type === 'speaker_view') return 0;
          if (type.includes('shared_screen_with_speaker')) return 1;
          if (type === 'gallery_view') return 2;
          return 3;
        };

        const priorityDiff =
          getTypePriority(a.recording_type) - getTypePriority(b.recording_type);
        if (priorityDiff !== 0) return priorityDiff;

        // Secondary sort: latest recording first
        return (
          new Date(b.recording_end).getTime() -
          new Date(a.recording_end).getTime()
        );
      })?.[0];

    this.logJob('log', job, 'Selected MP4 recording', {
      recordingType: mp4?.recording_type,
      fileSize: mp4?.file_size,
      recordingId: mp4?.id,
    });

    // Zoom responded, but recording not ready yet
    if (!mp4) {
      const nextRetryCount = job.retry_count + 1;

      // TERMINAL FAILURE (real retries only)
      if (nextRetryCount >= MAX_RETRIES) {
        this.logger.error(
          `Recording permanently failed for job ${job.id} after ${nextRetryCount} attempts`,
        );

        if (job.table === 'mentor') {
          await db.execute(sql`
            UPDATE zuvy_mentor_session_recordings
            SET
              status = 'PERMANENT_FAILED',
              retry_count = ${nextRetryCount},
              last_error = 'Recording never became available on Zoom'
            WHERE id = ${job.id}
          `);
        } else {
          await db.execute(sql`
            UPDATE zuvy_session_recordings
            SET
              status = 'PERMANENT_FAILED',
              retry_count = ${nextRetryCount},
              last_error = 'Recording never became available on Zoom'
            WHERE id = ${job.id}
          `);
        }

        return;
      }

      // RETRY LATER
      const nextRetry = this.computeNextRetry(job.retry_count);

      this.logJob('warn', job, 'Recording not ready yet; deferring');

      if (job.table === 'mentor') {
        await db.execute(sql`
          UPDATE zuvy_mentor_session_recordings
          SET
            status = 'FAILED',
            retry_count = retry_count + 1,
            next_retry_at = ${nextRetry}
          WHERE id = ${job.id}
        `);
      } else {
        await db.execute(sql`
          UPDATE zuvy_session_recordings
          SET
            status = 'FAILED',
            retry_count = retry_count + 1,
            next_retry_at = ${nextRetry}
          WHERE id = ${job.id}
        `);
      }

      return;
    }

    // Success — recording found
    this.logJob('log', job, 'Zoom recording discovered', {
      source: recResp.source,
    });

    if (job.table === 'mentor') {
      await db.execute(sql`
        UPDATE zuvy_mentor_session_recordings
        SET
          zoom_recording_id = ${mp4.id},
          status = 'METADATA_READY'
        WHERE id = ${job.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          zoom_recording_id = ${mp4.id},
          status = 'METADATA_READY'
        WHERE id = ${job.id}
      `);
    }
  }

  // =====================================================
  // STEP 2 — DOWNLOAD TO TEMP (NO ZoomService CHANGE)
  // =====================================================
  private getRecordingFileName(job: any): string {
    const prefix =
      job.table === 'mentor'
        ? `mentor-${job.mentor_booking_id}`
        : `${job.session_id}`;
    return `${prefix}-${job.zoom_recording_id}.mp4`;
  }

  private async downloadRecording(job: any) {
    const tempDir = path.join(process.cwd(), 'temp-recordings');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const finalPath = path.join(tempDir, this.getRecordingFileName(job));

    const lockPath = `${finalPath}.lock`;

    if (fs.existsSync(lockPath)) {
      this.logger.warn(`Download already in progress for job ${job.id}`);
      return;
    }

    fs.writeFileSync(lockPath, process.pid.toString());

    try {
      if (!fs.existsSync(finalPath)) {
        await this.downloadRecordingToFile(
          job.zoom_meeting_id,
          job.zoom_recording_id,
          finalPath,
          job,
        );
      }

      if (job.table === 'mentor') {
        await db.execute(sql`
          UPDATE zuvy_mentor_session_recordings
          SET status = 'DOWNLOADING'
          WHERE id = ${job.id}
        `);
      } else {
        await db.execute(sql`
          UPDATE zuvy_session_recordings
          SET status = 'DOWNLOADING'
          WHERE id = ${job.id}
        `);
      }
    } finally {
      try {
        fs.unlinkSync(lockPath);
      } catch {}
    }
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

    // Append access token to download URL for authentication
    const accessToken = await this.zoomService.getAccessToken();
    const downloadUrl = `${file.download_url}?access_token=${accessToken}`;

    const tempPath = `${finalPath}.part`;
    const writer = fs.createWriteStream(tempPath);

    const response = await axios({
      method: 'get',
      url: downloadUrl,
      responseType: 'stream',
      maxRedirects: 5,
      timeout: 0,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    // Validate response before piping
    if (response.status !== 200) {
      throw new Error(`Zoom download returned status ${response.status}`);
    }

    const contentType = response.headers['content-type'] || '';
    if (
      !contentType.includes('video') &&
      !contentType.includes('octet-stream')
    ) {
      throw new Error(`Invalid content-type for download: ${contentType}`);
    }

    return new Promise<void>((resolve, reject) => {
      response.data.pipe(writer);

      writer.on('finish', () => {
        // Validate downloaded file
        try {
          const stats = fs.statSync(tempPath);
          const expectedSize = parseInt(file.file_size || '0');

          this.logJob('log', job, 'Download complete - validating file', {
            downloadedSize: stats.size,
            expectedSize: expectedSize,
            filePath: finalPath,
            recordingType: file.recording_type,
          });

          // Check minimum file size (anything under 100KB is suspicious for a video)
          if (stats.size < 102400) {
            fs.unlinkSync(tempPath);
            reject(
              new Error(
                `Downloaded file too small (${stats.size} bytes) - likely error response or incomplete download`,
              ),
            );
            return;
          }

          // Allow 5% tolerance for file size variance
          if (expectedSize > 0) {
            const tolerance = expectedSize * 0.05;
            const minSize = expectedSize - tolerance;
            const maxSize = expectedSize + tolerance;

            if (stats.size < minSize || stats.size > maxSize) {
              this.logger.warn(
                `File size variance detected: expected ~${expectedSize}, got ${stats.size} (tolerance: ±5%)`,
              );
              // Continue anyway since video might have been re-encoded or metadata varies
            }
          }

          fs.renameSync(tempPath, finalPath);
          resolve();
        } catch (err) {
          try {
            fs.unlinkSync(tempPath);
          } catch {}
          reject(err);
        }
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
  // VIDEO FILE VALIDATION (FFPROBE-BASED)
  // =====================================================
  private async validateVideoFile(filePath: string): Promise<void> {
    try {
      const { execSync } = require('child_process');

      try {
        // Check if ffprobe is available
        execSync('ffprobe -version', { stdio: 'ignore' });
      } catch {
        this.logger.warn(
          'ffprobe not available, skipping detailed video validation',
        );
        return; // Skip validation if ffprobe not available
      }

      // Use ffprobe to extract video metadata
      const ffprobeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=codec_type,codec_name,width,height,r_frame_rate,duration -of default=noprint_wrappers=1 "${filePath}"`;

      let output: string;
      try {
        output = execSync(ffprobeCmd, { encoding: 'utf-8' }).toString();
      } catch (err: any) {
        throw new Error(`ffprobe failed to read file: ${err.message}`);
      }

      if (!output.includes('codec_type=v')) {
        throw new Error('No video stream detected in file');
      }

      if (!output.includes('codec_name')) {
        throw new Error(
          'Video codec information missing - file may be corrupted',
        );
      }

      // Parse basic info
      const lines = output.split('\n');
      let hasValidCodec = false;
      let duration = 0;

      for (const line of lines) {
        if (line.includes('codec_name')) {
          hasValidCodec = true;
        }
        if (line.startsWith('duration=')) {
          try {
            duration = parseFloat(line.split('=')[1]) || 0;
          } catch {}
        }
      }

      if (!hasValidCodec) {
        throw new Error(
          'Video codec not detected - file may be corrupted or incomplete',
        );
      }

      // For Zoom recordings, minimum duration should be > 5 seconds
      if (duration > 0 && duration < 5) {
        throw new Error(
          `Video duration too short (${duration.toFixed(2)}s) - file may be incomplete or corrupted`,
        );
      }

      this.logger.debug(
        `Video validation passed for ${filePath}: duration=${duration.toFixed(2)}s`,
      );
    } catch (err: any) {
      throw new Error(`Video validation error: ${err.message}`);
    }
  }

  private async mergeRecording(job: any) {
    this.logJob('log', job, 'Starting merge step');

    const tempDir = path.join(process.cwd(), 'temp-recordings');

    const inputPath = path.join(tempDir, this.getRecordingFileName(job));

    if (!fs.existsSync(inputPath)) {
      throw new Error('Recording file missing for merge');
    }

    const mergedPath = inputPath.replace('.mp4', '-merged.mp4');

    // If already merged, skip
    if (fs.existsSync(mergedPath)) {
      this.logJob('log', job, 'Merged file already exists');
    } else {
      const { execSync } = require('child_process');

      try {
        execSync(`ffmpeg -y -i "${inputPath}" -c copy "${mergedPath}"`, {
          stdio: 'ignore',
        });
      } catch (err: any) {
        throw new Error(`FFmpeg merge failed: ${err.message}`);
      }
    }

    // Update DB
    if (job.table === 'mentor') {
      await db.execute(sql`
      UPDATE zuvy_mentor_session_recordings
      SET
        merged_file_path = ${mergedPath},
        status = 'MERGED'
      WHERE id = ${job.id}
    `);
    } else {
      await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET
        merged_file_path = ${mergedPath},
        status = 'MERGED'
      WHERE id = ${job.id}
    `);
    }

    this.logJob('log', job, 'Merge completed', {
      mergedPath,
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

    const rec = await db.execute(sql`
  SELECT merged_file_path
  FROM ${sql.raw(this.getTableName(job))}
  WHERE id = ${job.id}
`);

    const mergedPath = rec.rows?.[0]?.merged_file_path as string | null;

    const filePath: string =
      mergedPath ||
      path.join(
        process.cwd(),
        'temp-recordings',
        this.getRecordingFileName(job),
      );

    if (!fs.existsSync(filePath)) {
      throw new Error('Merged file not found for upload');
    }

    const fileSize = fs.statSync(filePath).size;

    // Validate file size (YouTube minimum is 0 bytes, but let's check for reasonable size)
    if (fileSize < 1024) {
      // Less than 1KB is suspicious
      throw new Error(`File too small (${fileSize} bytes), likely corrupted`);
    }

    // Validate file extension
    if (!filePath.toLowerCase().endsWith('.mp4')) {
      throw new Error('File is not MP4 format');
    }

    // Validate file integrity with ffprobe if available
    try {
      await this.validateVideoFile(filePath);
    } catch (validationError: any) {
      this.logJob('error', job, 'Video file validation failed', {
        error: validationError.message,
        filePath,
        fileSize,
      });
      throw new Error(
        `Video file validation failed: ${validationError.message}. This file likely cannot be processed by YouTube.`,
      );
    }

    this.logJob('log', job, 'Starting YouTube upload', {
      fileSize: fileSize,
      filePath: filePath,
    });

    try {
      const res = await this.youtube.videos.insert(
        {
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title:
                job.table === 'mentor'
                  ? `Mentor session ${job.mentor_booking_id}`
                  : `Session ${job.session_id}`,
              description: 'Automated session recording upload',
            },
            status: { privacyStatus: 'unlisted' },
          },
          media: { body: fs.createReadStream(filePath) },
        },
        {
          onUploadProgress: (evt: any) => {
            const progress = Math.round((evt.bytesRead / fileSize) * 100);
            this.logger.log(`YouTube upload ${progress}% for job ${job.id}`);
          },
        },
      );

      const videoId = res.data.id;
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

      this.logJob('log', job, 'YouTube upload completed successfully', {
        videoId: videoId,
        videoUrl: videoUrl,
      });

      if (job.table === 'mentor') {
        await db.execute(sql`
          UPDATE zuvy_mentor_session_recordings
          SET
            status = 'COMPLETED',
            drive_file_id = ${videoId},
            drive_link = ${videoUrl}
          WHERE id = ${job.id}
        `);
      } else {
        await db.execute(sql`
          UPDATE zuvy_session_recordings
          SET
            status = 'COMPLETED',
            drive_file_id = ${videoId},
            drive_link = ${videoUrl}
          WHERE id = ${job.id}
        `);
      }

      fs.unlinkSync(filePath); // cleanup
    } catch (error: any) {
      this.logJob('error', job, 'YouTube upload failed', {
        error: error.message,
        code: error.code,
        response: error.response?.data,
      });

      // Check for specific YouTube errors
      if (error.code === 403) {
        throw new Error('YouTube quota exceeded or access denied');
      } else if (error.code === 400) {
        throw new Error(
          'Invalid request to YouTube API - possibly corrupted file',
        );
      } else if (error.message?.includes('Processing abandoned')) {
        throw new Error(
          'YouTube processing abandoned - file may be corrupted or violate policies',
        );
      }

      // Re-throw the error to be handled by the failure logic
      throw error;
    }
  }

  // =====================================================
  // FAILURE HANDLING (RETRY SAFE)
  // =====================================================
  private async markFailed(job: RecordingJob, error: Error) {
    const nextRetryCount = job.retry_count + 1;
    const isTerminal = nextRetryCount >= MAX_RETRIES;
    const nextRetry = this.computeNextRetry(job.retry_count);

    this.logJob('error', job, 'Recording job failed', {
      error: error.message,
      terminal: isTerminal,
      retryCount: nextRetryCount,
    });

    if (job.table === 'mentor') {
      await db.execute(
        isTerminal
          ? sql`
              UPDATE zuvy_mentor_session_recordings
              SET
                status = 'PERMANENT_FAILED',
                retry_count = ${nextRetryCount},
                last_error = ${error.message}
              WHERE id = ${job.id}
            `
          : sql`
              UPDATE zuvy_mentor_session_recordings
              SET
                status = 'FAILED',
                retry_count = ${nextRetryCount},
                next_retry_at = ${nextRetry},
                last_error = ${error.message}
              WHERE id = ${job.id}
            `,
      );
    } else {
      await db.execute(
        isTerminal
          ? sql`
              UPDATE zuvy_session_recordings
              SET
                status = 'PERMANENT_FAILED',
                retry_count = ${nextRetryCount},
                last_error = ${error.message}
              WHERE id = ${job.id}
            `
          : sql`
              UPDATE zuvy_session_recordings
              SET
                status = 'FAILED',
                retry_count = ${nextRetryCount},
                next_retry_at = ${nextRetry},
                last_error = ${error.message}
              WHERE id = ${job.id}
            `,
      );
    }
  }
}
