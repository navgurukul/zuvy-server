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
const FINAL_UPLOAD_GRACE_MINUTES = Number(
  process.env.RECORDING_FINAL_UPLOAD_GRACE_MINUTES || 5,
);

type RecordingJob = {
  id: number;
  session_id?: number;
  mentor_booking_id?: number;
  zoom_meeting_id: string;
  zoom_meeting_uuid?: string | null;
  zoom_recording_id?: string | null;
  zoom_recording_manifest?: RecordingSegment[] | string | null;
  local_segment_paths?: string[] | string | null;
  status: string;
  retry_count: number;
  drive_link?: string | null;
  table: 'session' | 'mentor';
};

type RecordingSegment = {
  id: string;
  download_url?: string;
  recording_type?: string;
  file_type?: string;
  file_size?: number;
  recording_start?: string;
  recording_end?: string;
  meeting_uuid?: string;
};

class RecordingDeferredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordingDeferredError';
  }
}

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

  private parseJsonArray<T>(value: T[] | string | null | undefined): T[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private getRecordingPrefix(job: any): string {
    return job.table === 'mentor'
      ? `mentor-${job.mentor_booking_id}`
      : `${job.session_id}`;
  }

  private getSegmentFileName(
    job: any,
    segment: RecordingSegment,
    index: number,
  ) {
    const safeId = String(segment.id || `segment-${index + 1}`).replace(
      /[^a-zA-Z0-9_-]/g,
      '_',
    );

    return `${this.getRecordingPrefix(job)}-${String(index + 1).padStart(
      2,
      '0',
    )}-${safeId}.mp4`;
  }

  private getMergedFileName(job: any): string {
    return `${this.getRecordingPrefix(job)}-merged.mp4`;
  }

  private getTypePriority(type = ''): number {
    if (type === 'speaker_view') return 0;
    if (type.includes('shared_screen_with_speaker')) return 1;
    if (type === 'gallery_view') return 2;
    return 3;
  }

  private buildSegmentManifest(files: any[], meetingUuid?: string | null) {
    const mp4Files = (files || [])
      .filter((f: any) => f.file_type === 'MP4')
      .filter((f: any) => !String(f.recording_type || '').includes('chat'));

    const grouped = new Map<string, any[]>();
    for (const file of mp4Files) {
      const key = `${file.recording_start || ''}|${file.recording_end || ''}`;
      const existing = grouped.get(key) || [];
      existing.push(file);
      grouped.set(key, existing);
    }

    return Array.from(grouped.values())
      .map(
        (group) =>
          group.sort((a, b) => {
            const priority =
              this.getTypePriority(a.recording_type) -
              this.getTypePriority(b.recording_type);

            if (priority !== 0) return priority;
            return Number(b.file_size || 0) - Number(a.file_size || 0);
          })[0],
      )
      .sort(
        (a, b) =>
          new Date(a.recording_start || 0).getTime() -
          new Date(b.recording_start || 0).getTime(),
      )
      .map((f) => ({
        id: f.id,
        download_url: f.download_url,
        recording_type: f.recording_type,
        file_type: f.file_type,
        file_size: f.file_size,
        recording_start: f.recording_start,
        recording_end: f.recording_end,
        meeting_uuid: meetingUuid || f.meeting_id,
      }));
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
      WHERE (
          (
            status IN ('DISCOVERED', 'FAILED', 'METADATA_READY', 'DOWNLOADING', 'DOWNLOADED', 'MERGED')
            AND status NOT LIKE 'PROCESSING_%'
          )
          OR (
            status IN ('PROCESSING_METADATA', 'PROCESSING_DOWNLOAD', 'MERGING', 'PROCESSING_UPLOAD')
            AND updated_at < NOW() - INTERVAL '15 minutes'
          )
        )
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
      WHERE (
          (
            status IN ('DISCOVERED', 'FAILED', 'METADATA_READY', 'DOWNLOADING')
            AND status NOT LIKE 'PROCESSING_%'
          )
          OR (
            status IN ('PROCESSING_METADATA', 'PROCESSING_DOWNLOAD', 'PROCESSING_UPLOAD')
            AND updated_at < NOW() - INTERVAL '15 minutes'
          )
        )
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
        case 'MERGING':
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
      if (error?.name === 'RecordingDeferredError') {
        this.logJob('log', job, error.message);
        return;
      }

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
    const existingManifest = this.parseJsonArray<RecordingSegment>(
      job.zoom_recording_manifest,
    );

    if (job.table === 'session' && existingManifest.length) {
      const primaryMp4 = existingManifest[0];

      await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          zoom_recording_id = ${primaryMp4.id},
          segments_count = ${existingManifest.length},
          metadata_verified = TRUE,
          recording_start = ${existingManifest[0]?.recording_start || null},
          recording_end = ${existingManifest[existingManifest.length - 1]?.recording_end || null},
          status = 'METADATA_READY',
          updated_at = NOW()
        WHERE id = ${job.id}
      `);

      this.logJob('log', job, 'Using stored Zoom recording manifest', {
        segmentCount: existingManifest.length,
        recordingIds: existingManifest.map((segment) => segment.id),
      });

      return;
    }

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

    const manifest = this.buildSegmentManifest(
      recResp?.recording_files || [],
      job.zoom_meeting_uuid,
    );

    this.logJob('log', job, 'Available MP4 recording files', {
      count:
        recResp?.recording_files?.filter((f: any) => f.file_type === 'MP4')
          ?.length || 0,
      selectedSegments: manifest.length,
      types: manifest.map((f: any) => ({
        id: f.id,
        recordingType: f.recording_type,
        fileSize: f.file_size,
        recordingStart: f.recording_start,
        recordingEnd: f.recording_end,
      })),
    });

    const primaryMp4 = manifest[0];

    this.logJob('log', job, 'Selected MP4 recording segments', {
      segmentCount: manifest.length,
      recordingIds: manifest.map((segment) => segment.id),
    });

    // Zoom responded, but recording not ready yet
    if (!manifest.length) {
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
          zoom_recording_id = ${primaryMp4.id},
          status = 'METADATA_READY'
        WHERE id = ${job.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          zoom_recording_id = ${primaryMp4.id},
          zoom_recording_manifest = ${JSON.stringify(manifest)},
          segments_count = ${manifest.length},
          metadata_verified = TRUE,
          recording_start = ${manifest[0]?.recording_start || null},
          recording_end = ${manifest[manifest.length - 1]?.recording_end || null},
          status = 'METADATA_READY'
        WHERE id = ${job.id}
      `);
    }
  }

  // =====================================================
  // STEP 2 — DOWNLOAD TO TEMP (NO ZoomService CHANGE)
  // =====================================================
  private getRecordingFileName(job: any): string {
    return `${this.getRecordingPrefix(job)}-${job.zoom_recording_id}.mp4`;
  }

  private async downloadRecording(job: any) {
    const tempDir = path.join(process.cwd(), 'temp-recordings');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const manifest = this.parseJsonArray<RecordingSegment>(
      job.zoom_recording_manifest,
    );
    const segments = manifest.length
      ? manifest
      : job.zoom_recording_id
        ? [{ id: job.zoom_recording_id }]
        : [];

    if (!segments.length) {
      throw new Error('No Zoom recording segments found for download');
    }

    const lockPath = path.join(
      tempDir,
      `${this.getRecordingPrefix(job)}.download.lock`,
    );

    if (fs.existsSync(lockPath)) {
      this.logger.warn(`Download already in progress for job ${job.id}`);
      return;
    }

    fs.writeFileSync(lockPath, process.pid.toString());

    try {
      const downloadedPaths: string[] = [];

      for (const [index, segment] of segments.entries()) {
        const finalPath = path.join(
          tempDir,
          this.getSegmentFileName(job, segment, index),
        );

        if (!fs.existsSync(finalPath)) {
          await this.downloadRecordingToFile(
            job.zoom_meeting_id,
            segment,
            finalPath,
            job,
          );
        }

        downloadedPaths.push(finalPath);
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
          SET
            local_segment_paths = ${JSON.stringify(downloadedPaths)},
            segments_count = ${downloadedPaths.length},
            status = 'DOWNLOADING'
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
    recordingSegmentOrId: RecordingSegment | string,
    finalPath: string,
    job?: any,
  ) {
    let recResp;
    const recordingSegment =
      typeof recordingSegmentOrId === 'string'
        ? ({ id: recordingSegmentOrId } as RecordingSegment)
        : recordingSegmentOrId;
    const recordingFileId = recordingSegment.id;

    if (recordingSegment.meeting_uuid) {
      recResp = await this.zoomService.getZoomRecordingFilesByUuid(
        recordingSegment.meeting_uuid,
      );
    } else if (job?.zoom_meeting_uuid) {
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
    const localSegmentPaths = this.parseJsonArray<string>(
      job.local_segment_paths,
    );
    const inputPaths = localSegmentPaths.length
      ? localSegmentPaths
      : [path.join(tempDir, this.getRecordingFileName(job))];

    const missingPath = inputPaths.find(
      (inputPath) => !fs.existsSync(inputPath),
    );
    if (missingPath) {
      throw new Error(`Recording segment missing for merge: ${missingPath}`);
    }

    const mergedPath = path.join(tempDir, this.getMergedFileName(job));

    // If already merged, skip
    if (fs.existsSync(mergedPath)) {
      this.logJob('log', job, 'Merged file already exists');
    } else {
      const { execFileSync } = require('child_process');

      try {
        if (inputPaths.length === 1) {
          execFileSync(
            'ffmpeg',
            ['-y', '-i', inputPaths[0], '-c', 'copy', mergedPath],
            { stdio: 'ignore' },
          );
        } else {
          const concatListPath = path.join(
            tempDir,
            `${this.getRecordingPrefix(job)}-concat.txt`,
          );
          const concatList = inputPaths
            .map(
              (inputPath) =>
                `file '${inputPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`,
            )
            .join('\n');

          fs.writeFileSync(concatListPath, concatList);

          try {
            try {
              execFileSync(
                'ffmpeg',
                [
                  '-y',
                  '-f',
                  'concat',
                  '-safe',
                  '0',
                  '-i',
                  concatListPath,
                  '-c',
                  'copy',
                  mergedPath,
                ],
                { stdio: 'ignore' },
              );
            } catch {
              execFileSync(
                'ffmpeg',
                [
                  '-y',
                  '-f',
                  'concat',
                  '-safe',
                  '0',
                  '-i',
                  concatListPath,
                  '-c:v',
                  'libx264',
                  '-preset',
                  'veryfast',
                  '-c:a',
                  'aac',
                  mergedPath,
                ],
                { stdio: 'ignore' },
              );
            }
          } finally {
            try {
              fs.unlinkSync(concatListPath);
            } catch {}
          }
        }
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
        is_final_merged = FALSE,
        status = 'MERGED'
      WHERE id = ${job.id}
    `);
    }

    this.logJob('log', job, 'Merge completed', {
      mergedPath,
      segmentCount: inputPaths.length,
    });
  }
  // =====================================================
  // STEP 3 — UPLOAD TO YOUTUBE (IDEMPOTENT)
  // =====================================================
  private async getSingleJobUploadPath(job: any): Promise<string> {
    const rec = await db.execute(sql`
      SELECT merged_file_path
      FROM ${sql.raw(this.getTableName(job))}
      WHERE id = ${job.id}
    `);

    const mergedPath = rec.rows?.[0]?.merged_file_path as string | null;

    return (
      mergedPath ||
      path.join(
        process.cwd(),
        'temp-recordings',
        this.getRecordingFileName(job),
      )
    );
  }

  private async deferSessionUpload(
    job: RecordingJob,
    reason: string,
    minutes = 5,
  ): Promise<never> {
    await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET
        status = 'MERGED',
        next_retry_at = NOW() + (${minutes} || ' minutes')::interval,
        last_error = ${reason},
        updated_at = NOW()
      WHERE id = ${job.id}
    `);

    throw new RecordingDeferredError(reason);
  }

  private async assertSessionReadyForFinalUpload(job: RecordingJob) {
    const sessionResult = await db.execute(sql`
      SELECT id, end_time, status, youtube_video_id, s3link, final_uploaded
      FROM zuvy_sessions
      WHERE id = ${job.session_id}
      LIMIT 1
    `);

    const session = sessionResult.rows?.[0] as any;
    if (!session) {
      throw new Error(`Session ${job.session_id} not found`);
    }

    if (session.final_uploaded && session.youtube_video_id) {
      await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          status = 'COMPLETED',
          drive_file_id = ${session.youtube_video_id},
          drive_link = ${session.s3link},
          updated_at = NOW()
        WHERE session_id = ${job.session_id}
          AND status IN ('MERGED', 'PROCESSING_UPLOAD')
      `);

      this.logJob('log', job, 'Session already has final YouTube upload', {
        videoId: session.youtube_video_id,
      });
      throw new RecordingDeferredError(
        `Session ${job.session_id} is already uploaded`,
      );
    }

    const readiness = await db.execute(sql`
      SELECT (
        CASE
          WHEN ${session.end_time} IS NOT NULL THEN
            ${session.end_time}::timestamptz
              + (${FINAL_UPLOAD_GRACE_MINUTES} || ' minutes')::interval <= NOW()
          ELSE
            ${session.status} = 'completed'
        END
      ) AS ready
    `);

    if (!readiness.rows?.[0]?.ready) {
      await this.deferSessionUpload(
        job,
        `Session ${job.session_id} has not ended yet; final upload deferred`,
        FINAL_UPLOAD_GRACE_MINUTES,
      );
    }

    return;
  }

  private async getSessionUploadPath(job: RecordingJob): Promise<string> {
    await this.assertSessionReadyForFinalUpload(job);

    const rec = await db.execute(sql`
      SELECT merged_file_path
      FROM zuvy_session_recordings
      WHERE id = ${job.id}
      LIMIT 1
    `);

    const mergedPath = rec.rows?.[0]?.merged_file_path as string | null;

    if (!mergedPath) {
      throw new Error(`Merged file path missing for job ${job.id}`);
    }

    await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET is_final_merged = TRUE, updated_at = NOW()
      WHERE id = ${job.id}
    `);

    return mergedPath;
  }

  private async concatRecordings(
    inputPaths: string[],
    outputPath: string,
    prefix: string,
  ) {
    const { execFileSync } = require('child_process');

    if (inputPaths.length === 1) {
      execFileSync(
        'ffmpeg',
        ['-y', '-i', inputPaths[0], '-c', 'copy', outputPath],
        { stdio: 'ignore' },
      );
      return;
    }

    const tempDir = path.dirname(outputPath);
    const concatListPath = path.join(tempDir, `${prefix}-final-concat.txt`);
    const concatList = inputPaths
      .map(
        (inputPath) =>
          `file '${inputPath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`,
      )
      .join('\n');

    fs.writeFileSync(concatListPath, concatList);

    try {
      execFileSync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          concatListPath,
          '-c',
          'copy',
          outputPath,
        ],
        { stdio: 'ignore' },
      );
    } finally {
      try {
        fs.unlinkSync(concatListPath);
      } catch {}
    }
  }

  private async getYoutubeUploadTitle(job: RecordingJob): Promise<string> {
    if (job.table === 'session') {
      const result = await db.execute(sql`
        SELECT title
        FROM zuvy_sessions
        WHERE id = ${job.session_id}
           OR zoom_meeting_id = ${job.zoom_meeting_id}
           OR meeting_id = ${job.zoom_meeting_id}
           OR zoom_meeting_uuid = ${job.zoom_meeting_uuid}
        LIMIT 1
      `);

      const title = String(result.rows?.[0]?.title || '').trim();
      if (title) return title;
    }

    return job.table === 'mentor'
      ? `Mentor session ${job.mentor_booking_id}`
      : `Session ${job.session_id}`;
  }

  private extractYoutubeVideoId(job: RecordingJob): string | null {
    if ((job as any).drive_file_id) return String((job as any).drive_file_id);
    if (!job.drive_link) return null;

    try {
      const url = new URL(job.drive_link);
      return url.searchParams.get('v');
    } catch {
      const match = job.drive_link.match(/[?&]v=([^&]+)/);
      return match?.[1] || null;
    }
  }

  private async updateYoutubeTitleIfNeeded(job: RecordingJob) {
    const videoId = this.extractYoutubeVideoId(job);
    if (!videoId) return;

    const videoTitle = await this.getYoutubeUploadTitle(job);
    if (!videoTitle || videoTitle === `Session ${job.session_id}`) return;

    await this.youtube.videos.update({
      part: ['snippet'],
      requestBody: {
        id: videoId,
        snippet: {
          title: videoTitle,
          description: 'Automated session recording upload',
          categoryId: '27',
        },
      },
    });

    this.logJob('log', job, 'YouTube title synchronized', {
      videoId,
      videoTitle,
    });
  }

  private async uploadToYoutube(job: any) {
    if (!YOUTUBE_UPLOAD_ENABLED) {
      this.logJob('warn', job, 'YouTube upload disabled by env flag');
      return;
    }

    // Idempotency guard
    if (job.drive_link) {
      await this.updateYoutubeTitleIfNeeded(job);
      this.logger.log(`Job ${job.id} already uploaded, skipping`);
      return;
    }

    const filePath =
      job.table === 'session'
        ? await this.getSessionUploadPath(job)
        : await this.getSingleJobUploadPath(job);

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
      const videoTitle = await this.getYoutubeUploadTitle(job);

      this.logJob('log', job, 'Resolved YouTube upload title', {
        videoTitle,
      });

      const res = await this.youtube.videos.insert(
        {
          part: ['snippet', 'status'],
          requestBody: {
            snippet: {
              title: videoTitle,
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
          WHERE session_id = ${job.session_id}
            AND status IN ('MERGED', 'PROCESSING_UPLOAD', 'COMPLETED')
        `);

        await db.execute(sql`
          UPDATE zuvy_sessions
          SET
            youtube_video_id = ${videoId},
            s3link = ${videoUrl},
            final_video_path = ${filePath},
            final_uploaded = TRUE
          WHERE id = ${job.session_id}
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
