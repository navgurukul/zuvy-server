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
import { spawn } from 'child_process';

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

  @Interval(600000) // every 10 minutes
  async discoverMissedRecordings() {
    if (!RECORDING_WORKER_ENABLED) return;

    this.logger.log('Running fallback Zoom recording discovery');

    const sessions = await db.execute(sql`
    SELECT id, zoom_meeting_id, zoom_meeting_uuid
    FROM zuvy_sessions
    WHERE is_zoom_meet = true
      AND zoom_meeting_id IS NOT NULL
      AND start_time::timestamp > NOW() - INTERVAL '24 hours'
  `);

    for (const session of sessions.rows) {
      try {
        const recordings = await this.zoomService.getZoomRecordingFilesSafe({
          meetingId: session.zoom_meeting_id as string,
          meetingUuid: session.zoom_meeting_uuid as string,
        });

        const mp4Files =
          recordings?.recording_files?.filter(
            (f: any) => f.file_type === 'MP4',
          ) || [];

        if (!mp4Files.length) continue;

        const uuid = recordings.uuid;

        await db.execute(sql`
        INSERT INTO zuvy_session_recordings (
          session_id,
          zoom_meeting_id,
          zoom_meeting_uuid,
          status,
          retry_count
        )
        VALUES (
          ${session.id},
          ${session.zoom_meeting_id},
          ${uuid},
          'DISCOVERED',
          0
        )
        ON CONFLICT (session_id, zoom_meeting_uuid)
        DO NOTHING
      `);

        this.logger.log(
          `Fallback recording discovered for session ${session.id}`,
        );
      } catch (err) {
        this.logger.warn(`Fallback discovery failed for session ${session.id}`);
      }
    }
  }

  // =====================================================
  // PICK ONE JOB (ROW-LOCKED, SAFE FOR MULTI-INSTANCE)
  // =====================================================
  private async pickJob(): Promise<RecordingJob | null> {
    const result = await db.execute(sql`
    UPDATE zuvy_session_recordings
    SET
      status = CASE
        WHEN status IN ('DISCOVERED', 'FAILED') THEN 'PROCESSING_METADATA'
        WHEN status = 'METADATA_READY' THEN 'PROCESSING_DOWNLOAD'
        WHEN status = 'DOWNLOADED' THEN 'MERGING'
        WHEN status = 'MERGED' THEN 'PROCESSING_UPLOAD'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM zuvy_session_recordings
      WHERE status IN (
        'DISCOVERED',
        'FAILED',
        'METADATA_READY',
        'DOWNLOADED',
        'MERGED'
      )
        AND status NOT LIKE 'PROCESSING_%'
        AND status NOT IN ('COMPLETED', 'PERMANENT_FAILED')
        AND retry_count < ${MAX_RETRIES}
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);

    return (result.rows?.[0] as RecordingJob) ?? null;
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

        case 'MERGING':
          await this.mergeSegments(job);
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

    // Prevent reprocessing if already merged or uploaded
    const existing = await db.execute(sql`
  SELECT merged_file_path, status
  FROM zuvy_session_recordings
  WHERE id = ${job.id}
`);

    if (
      existing.rows?.[0]?.merged_file_path ||
      existing.rows?.[0]?.status === 'COMPLETED'
    ) {
      this.logJob('debug', job, 'Already processed. Skipping metadata.');
      return;
    }

    // =====================================================
    // PRE-CONDITIONS BEFORE FETCHING RECORDINGS
    // =====================================================

    // 1️ Official End Time Check (+ 15 min grace)
    const session = await db.query.zuvySessions.findFirst({
      where: (s, { eq }) => eq(s.id, job.session_id),
      columns: { endTime: true },
    });

    if (!session?.endTime) {
      this.logJob('debug', job, 'Session endTime not found');
      return;
    }

    const graceMinutes = 15;
    const readyAt = new Date(
      new Date(session.endTime).getTime() + graceMinutes * 60000,
    );

    if (new Date() < readyAt) {
      this.logJob('debug', job, 'Official end time not reached');
      return;
    }

    // 2️ Check required webhooks
    const webhookCheck = await db.execute(sql`
  SELECT
    bool_or(event_type = 'meeting.ended') as meeting_ended,
    bool_or(event_type = 'recording.completed') as recording_completed
  FROM zuvy_zoom_webhook_events
  WHERE meeting_id = ${job.zoom_meeting_id}
`);

    const row = webhookCheck.rows?.[0];

    if (!row?.meeting_ended || !row?.recording_completed) {
      this.logJob('debug', job, 'Required webhooks not yet received');
      return;
    }

    // 3️ Check if meeting still live
    const isLive = await this.zoomService.isMeetingLiveViaDashboard(
      job.zoom_meeting_uuid || job.zoom_meeting_id,
    );

    if (isLive) {
      this.logJob('debug', job, 'Meeting still live');
      return;
    }

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

        // recResp = await this.zoomService.getZoomRecordingFilesSafe({
        //   meetingId: job.zoom_meeting_id,
        //   meetingUuid: job.zoom_meeting_uuid,
        // });

        recResp = await this.zoomService.getZoomRecordingFilesByUuid(
          job.zoom_meeting_uuid,
        );

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

    const mp4Files = recResp?.recording_files
      ?.filter((f: any) => f.file_type === 'MP4')
      ?.sort(
        (a: any, b: any) =>
          new Date(a.recording_start).getTime() -
          new Date(b.recording_start).getTime(),
      );

    // Zoom responded, but recording not ready yet
    if (!mp4Files || mp4Files.length === 0) {
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
  zoom_recording_manifest = ${JSON.stringify(mp4Files)},
  segments_count = ${mp4Files.length},
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

    // 1️ Read manifest (all segments)
    const manifestResult = await db.execute(sql`
    SELECT zoom_recording_manifest
    FROM zuvy_session_recordings
    WHERE id = ${job.id}
  `);

    let manifest = manifestResult.rows?.[0]?.zoom_recording_manifest;

    // handle jsonb string
    if (typeof manifest === 'string') {
      manifest = JSON.parse(manifest);
    }

    if (!manifest || !Array.isArray(manifest) || manifest.length === 0) {
      throw new Error('Recording manifest missing or empty');
    }

    const localPaths: string[] = [];

    // 2️ Download each segment sequentially
    for (const segment of manifest) {
      this.logger.log(`Downloading segment ${segment.id} for job ${job.id}`);

      const segmentPath = path.join(
        tempDir,
        `${job.session_id}-${segment.id}.mp4`,
      );

      if (!fs.existsSync(segmentPath)) {
        // await this.downloadRecordingToFile(
        //   job.zoom_meeting_id,
        //   segment.id,
        //   segmentPath,
        //   job,
        // );
        await this.downloadDirect(segment.download_url, segmentPath);
      }

      localPaths.push(segmentPath);

      this.logger.log(`Segment ${segment.id} downloaded to ${segmentPath}`);
    }

    // 3️ Store downloaded segment paths in DB
    await db.execute(sql`
UPDATE zuvy_session_recordings
SET
  local_segment_paths = ${JSON.stringify(localPaths)},
  segments_count = ${localPaths.length},
  status = 'DOWNLOADED',
  updated_at = NOW()
WHERE id = ${job.id}
`);

    this.logger.log(
      `Downloaded ${localPaths.length} segments for job ${job.id}`,
    );
  }

  // =====================================================
  // STEP 3 — MERGE SEGMENTS INTO SINGLE MP4
  // =====================================================
  private async mergeSegments(job: any) {
    // SAFETY CHECK: ensure no other active recordings for same session
    // const allRecordings = await db.execute(sql`
    //   SELECT id, merged_file_path
    //   FROM zuvy_session_recordings
    //   WHERE session_id = ${job.session_id}
    //     AND id != ${job.id}
    //     AND status NOT IN ('COMPLETED' ,'FAILED', 'PERMANENT_FAILED', 'MERGED')
    // `);
    const blockingRecordings = await db.execute(sql`
  SELECT id, status
  FROM zuvy_session_recordings
  WHERE session_id = ${job.session_id}
    AND id != ${job.id}
    AND status IN (
      'DISCOVERED',
      'PROCESSING_METADATA',
      'METADATA_READY',
      'PROCESSING_DOWNLOAD',
      'DOWNLOADING'
    )
`);

    if (blockingRecordings.rows.length > 0) {
      this.logJob(
        'log',
        job,
        'Waiting for other recording segments before merging',
        { remainingSegments: blockingRecordings.rows.length },
      );
      return;
    }

    const tempDir = path.join(process.cwd(), 'temp-recordings');

    const result = await db.execute(sql`
    SELECT local_segment_paths
    FROM zuvy_session_recordings
    WHERE id = ${job.id}
  `);

    const rawPaths = result.rows?.[0]?.local_segment_paths;

    if (!rawPaths || !Array.isArray(rawPaths)) {
      throw new Error('No downloaded segments found for merging');
    }

    const segmentPaths: string[] = rawPaths as string[];

    if (!segmentPaths.length) {
      throw new Error('Segment list is empty');
    }

    const listFilePath = path.join(tempDir, `${job.session_id}-concat.txt`);
    const mergedPath = path.join(
      tempDir,
      `${job.session_id}-${job.id}-merged.mp4`,
    );

    // Create concat file
    const concatFileContent = segmentPaths
      .map((p) => `file '${p.replace(/'/g, "'\\''")}'`)
      .join('\n');

    fs.writeFileSync(listFilePath, concatFileContent);

    // Run ffmpeg
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFilePath,
        '-c',
        'copy',
        mergedPath,
      ]);

      ffmpeg.stderr.on('data', (data) => {
        this.logger.debug(`FFmpeg: ${data}`);
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
    });

    // Cleanup (safe - Windows may temporarily lock files)
    try {
      fs.unlinkSync(listFilePath);
    } catch (e) {
      this.logger.warn(`Could not delete concat file ${listFilePath}`);
    }

    segmentPaths.forEach((p) => {
      try {
        fs.unlinkSync(p);
      } catch {
        this.logger.warn(`Could not delete segment ${p}`);
      }
    });

    await db.execute(sql`
UPDATE zuvy_session_recordings
SET
  merged_file_path = ${mergedPath},
  status = 'MERGED',
  updated_at = NOW()
WHERE id = ${job.id}
`);

    // If this session has only one recording, mark it as final
    const count = await db.execute(sql`
      SELECT COUNT(*)::int as total
      FROM zuvy_session_recordings
      WHERE session_id = ${job.session_id}
        AND status IN ('MERGED','COMPLETED')
    `);

    //   if (count.rows?.[0]?.total === 1) {
    //     await db.execute(sql`
    //   UPDATE zuvy_sessions
    //   SET final_video_path = ${mergedPath}
    //   WHERE id = ${job.session_id}
    // `);
    //   }

    await this.trySessionMerge(job.session_id);
  }

  // =====================================================
  // OPTIONAL: MERGE MULTIPLE RECORDINGS FOR SAME SESSION
  // (SOME ZOOM MEETINGS SPLIT RECORDINGS INTO MULTIPLE FILES)
  // =====================================================

  private async trySessionMerge(sessionId: number) {
    const sessionRow = await db.execute(sql`
    SELECT id, final_video_path
    FROM zuvy_sessions
    WHERE id = ${sessionId}
    FOR UPDATE
  `);

    if (sessionRow.rows?.[0]?.final_video_path) {
      this.logger.debug(
        `Session ${sessionId} already finalised. Skipping session merge.`,
      );
      return;
    }

    const rows = await db.execute(sql`
    SELECT id, merged_file_path
    FROM zuvy_session_recordings
    WHERE session_id = ${sessionId}
      AND merged_file_path IS NOT NULL
      AND status = 'MERGED'
  `);

    if (!rows.rows.length) return;

    const segments = rows.rows.map((r: any) => r.merged_file_path);

    if (segments.length === 1) return; // No merge needed

    const session = await db.query.zuvySessions.findFirst({
      where: (s, { eq }) => eq(s.id, sessionId),
    });

    if (!session) return;

    const tempDir = path.join(process.cwd(), 'temp-recordings');

    const listFile = path.join(tempDir, `${sessionId}-session.txt`);
    const finalPath = path.join(tempDir, `${sessionId}-final.mp4`);

    if (segments.length <= 1) {
      // No need to merge if there's only one segment or none
      return;
    }

    const concat = segments.map((p: string) => `file '${p}'`).join('\n');

    fs.writeFileSync(listFile, concat);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-f',
        'concat',
        '-safe',
        '0',
        '-i',
        listFile,
        '-c',
        'copy',
        finalPath,
      ]);

      ffmpeg.stderr.on('data', (d) => this.logger.debug(`FFmpeg: ${d}`));

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`Session merge failed: ${code}`));
      });
    });

    await db.execute(sql`
    UPDATE zuvy_sessions
    SET final_video_path = ${finalPath}
    WHERE id = ${sessionId}
  `);

    this.logger.log(`Session ${sessionId} final video created`);
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
      timeout: 0,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
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

  private async downloadDirect(url: string, finalPath: string) {
    const tempPath = `${finalPath}.part`;
    const writer = fs.createWriteStream(tempPath);

    const response = await axios({
      method: 'get',
      url,
      responseType: 'stream',
      timeout: 0,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
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
    });
  }
  // =====================================================
  // STEP 4 — UPLOAD MERGED FILE TO YOUTUBE
  // =====================================================
  private async uploadToYoutube(job: any) {
    if (!YOUTUBE_UPLOAD_ENABLED) {
      this.logJob('warn', job, 'YouTube upload disabled by env flag');
      return;
    }

    // Safety: ensure merged_file_path exists
    const session = await db.execute(sql`
      SELECT final_video_path, final_uploaded
      FROM zuvy_sessions
      WHERE id = ${job.session_id}
    `);

    if (!session.rows?.[0]?.final_video_path) {
      this.logJob('warn', job, 'Final session video missing. Skipping upload.');
      return;
    }

    // Idempotency guard
    if (
      session.rows?.[0]?.final_uploaded ||
      session.rows?.[0]?.youtube_video_id
    ) {
      this.logger.log(`Session ${job.session_id} already uploaded`);
      return;
    }

    // Fetch merged file path from DB
    const filePath: string = session.rows[0].final_video_path as string;

    if (!fs.existsSync(filePath)) {
      throw new Error('Merged file not found');
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
          status: {
            privacyStatus: 'unlisted',
          },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
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
    UPDATE zuvy_sessions
    SET
    youtube_video_id = ${videoId},
    final_uploaded = true
    WHERE id = ${job.session_id}
    `);

    await db.execute(sql`
    UPDATE zuvy_session_recordings
    SET status = 'COMPLETED'
    WHERE session_id = ${job.session_id}
    `);

    // Cleanup merged file
    const rows = await db.execute(sql`
    SELECT merged_file_path
    FROM zuvy_session_recordings
    WHERE session_id = ${job.session_id}
    `);

    for (const r of rows.rows) {
      try {
        fs.unlinkSync(r.merged_file_path as string);
      } catch {}
    }
    try {
      fs.unlinkSync(filePath);
    } catch {}

    this.logJob('log', job, 'YouTube upload completed successfully');
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
