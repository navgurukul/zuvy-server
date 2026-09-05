import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
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
import { resolveDownloadAuth } from './recording-download-auth';
import { RecordingS3Service } from './recording-s3.service';

const RECORDING_WORKER_ENABLED =
  process.env.RECORDING_WORKER_ENABLED === 'true';

const YOUTUBE_UPLOAD_ENABLED = process.env.YOUTUBE_UPLOAD_ENABLED === 'true';

// S3 durable-storage leg. Off by default — while disabled, jobs skip
// straight from MERGED to the YouTube upload leg exactly as before.
const S3_DUAL_UPLOAD_ENABLED = process.env.S3_DUAL_UPLOAD_ENABLED === 'true';

// Deletes Zoom's cloud copy (moves to Zoom's trash) once the S3 copy is
// checksum-verified. Off by default — a destructive call against an
// external system, opt in deliberately per environment.
const ZOOM_DELETE_AFTER_S3_ENABLED =
  process.env.ZOOM_DELETE_AFTER_S3_ENABLED === 'true';

// Nightly job that checks for YouTube videos that were uploaded fine but
// later broke (takedown, strike, channel issue) and restores/re-uploads
// them from the Glacier S3 copy. Off by default. Never touches the primary
// upload pipeline — only rows already status = 'COMPLETED'.
const RECORDING_HEALTH_CHECK_ENABLED =
  process.env.RECORDING_HEALTH_CHECK_ENABLED === 'true';

const GLACIER_RESTORE_DAYS = Number(process.env.GLACIER_RESTORE_DAYS) || 7;

const MAX_RETRIES = 5;

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
  // Zoom's `rec/webhook_download/...` URLs only accept the `download_token`
  // issued alongside the `recording.completed` webhook — not our S2S OAuth
  // API token. Captured at ingest time; absent for segments backfilled from
  // a live REST API refetch (those carry a `rec/download/...` URL instead,
  // which does accept the OAuth token).
  download_token?: string;
};

@Injectable()
export class RecordingWorkerService implements OnModuleInit {
  private readonly logger = new Logger(RecordingWorkerService.name);
  private youtube: any;
  private isWorkerRunning = false;

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

      setInterval(
        async () => {
          try {
            await this.auditS3Coverage();
          } catch (err) {
            this.logger.error('S3 coverage audit failed', err);
          }
        },
        60 * 60 * 1000,
      );
    }
  }

  constructor(
    private readonly zoomService: ZoomService,
    private readonly trigger: RecordingWorkerTriggerService,
    private readonly recordingS3: RecordingS3Service,
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
    // Segment-count-aware: if a job is reopened with more segments than a
    // prior merge (e.g. a second recording instance arrived after upload),
    // this naturally avoids colliding with — and silently reusing — a stale
    // merged file left over from the earlier, incomplete segment set.
    const segmentsCount = job.segments_count || 0;
    return `${this.getRecordingPrefix(job)}-merged-${segmentsCount}.mp4`;
  }

  // Shared by uploadToS3 and uploadToYoutube — both need the local merged
  // file, preferring the DB-recorded path and falling back to the
  // deterministic temp-recordings path if that's missing/stale.
  private resolveMergedFilePath(job: any, freshRow: any): string {
    const mergedPath = freshRow?.merged_file_path as string | null;
    const fallbackMerged = path.join(
      process.cwd(),
      'temp-recordings',
      this.getMergedFileName(job),
    );

    let filePath = mergedPath;
    if (!filePath || !fs.existsSync(filePath)) {
      filePath = fallbackMerged;
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Merged file not found: ${filePath}`);
    }

    return filePath;
  }

  // Mirrors the LMS's Bootcamp -> Module -> Chapter hierarchy so a chapter
  // ID maps straight to its recording(s) for restoration. Mentor-session
  // recordings have no bootcamp/module/chapter link (zuvyMentorSlotBooking
  // only ties to organizationId), so they get their own namespace instead.
  private async buildRecordingS3Key(job: any): Promise<string> {
    if (job.table === 'session') {
      const sessionRow = await db.execute(sql`
        SELECT bootcamp_id, module_id, chapter_id FROM zuvy_sessions WHERE id = ${job.session_id}
      `);
      const { bootcamp_id, module_id, chapter_id } = sessionRow.rows[0] as any;
      return `bootcamps/${bootcamp_id}/modules/${module_id}/chapters/${chapter_id}/recordings/${job.id}.mp4`;
    }

    const bookingRow = await db.execute(sql`
      SELECT organization_id FROM zuvy_mentor_slot_booking WHERE id = ${job.mentor_booking_id}
    `);
    const { organization_id } = bookingRow.rows[0] as any;
    return `mentor-sessions/${organization_id}/${job.mentor_booking_id}/recordings/${job.id}.mp4`;
  }

  private getTypePriority(type = ''): number {
    if (type === 'speaker_view') return 0;
    if (type.includes('shared_screen_with_speaker')) return 1;
    if (type === 'gallery_view') return 2;
    return 3;
  }

  private buildSegmentManifest(
    files: any[],
    meetingUuid?: string | null,
    downloadToken?: string | null,
  ) {
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
        meeting_uuid: f.meeting_uuid || meetingUuid || f.meeting_id,
        download_token: downloadToken || undefined,
      }));
  }

  // =====================================================
  // INGEST recording.completed (MERGES MULTIPLE INSTANCES OF
  // THE SAME MEETING INTO ONE ROW INSTEAD OF OVERWRITING)
  // =====================================================
  async ingestRecordingCompleted(params: {
    table: 'session' | 'mentor';
    ownerId: number;
    meetingId: string;
    meetingUuid: string | null;
    recordingFiles: any[];
    fallbackStartTime?: string | null;
    downloadToken?: string | null;
  }) {
    const tableName =
      params.table === 'mentor'
        ? 'zuvy_mentor_session_recordings'
        : 'zuvy_session_recordings';
    const ownerColumn =
      params.table === 'mentor' ? 'mentor_booking_id' : 'session_id';

    const newManifest = this.buildSegmentManifest(
      params.recordingFiles,
      params.meetingUuid,
      params.downloadToken,
    );

    this.logger.log({
      msg: 'ingestRecordingCompleted: instance received',
      table: params.table,
      ownerId: params.ownerId,
      meetingId: params.meetingId,
      meetingUuid: params.meetingUuid,
      newSegmentIds: newManifest.map((s) => s.id),
    });

    // Wrapped in a transaction with a row lock (SELECT ... FOR UPDATE) so two
    // instances of the same meeting arriving close together — or a webhook
    // landing while the worker is mid-pipeline on this same row — can't race:
    // without this, a plain read-then-write here can lose one side's merge
    // (this is what happened for session 1928 / meeting 85638002558 — the
    // second instance's segment silently replaced the first's instead of
    // being combined with it).
    await db.transaction(async (tx) => {
      const existing = await tx.execute(sql`
        SELECT * FROM ${sql.raw(tableName)}
        WHERE ${sql.raw(ownerColumn)} = ${params.ownerId}
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
      `);

      const row: any = existing.rows?.[0];

      // No row yet for this owner — plain first-instance insert.
      if (!row) {
        this.logger.log({
          msg: 'ingestRecordingCompleted: no existing row, inserting fresh',
          table: params.table,
          ownerId: params.ownerId,
          meetingUuid: params.meetingUuid,
          segmentCount: newManifest.length,
        });

        await tx.execute(sql`
          INSERT INTO ${sql.raw(tableName)} (
            ${sql.raw(ownerColumn)},
            zoom_meeting_id,
            zoom_meeting_uuid,
            zoom_recording_id,
            zoom_recording_manifest,
            ingested_meeting_uuids,
            metadata_verified,
            status,
            recording_start,
            recording_end,
            segments_count,
            retry_count
          ) VALUES (
            ${params.ownerId},
            ${params.meetingId},
            ${params.meetingUuid},
            ${newManifest[0]?.id ?? null},
            ${JSON.stringify(newManifest)},
            ${JSON.stringify(params.meetingUuid ? [params.meetingUuid] : [])},
            TRUE,
            'DISCOVERED',
            ${newManifest[0]?.recording_start ?? params.fallbackStartTime ?? null},
            ${newManifest[newManifest.length - 1]?.recording_end ?? null},
            ${newManifest.length},
            0
          )
        `);
        return;
      }

      const ingestedUuids = this.parseJsonArray<string>(
        row.ingested_meeting_uuids,
      );

      // Idempotent: this exact instance was already folded in (webhook redelivery).
      if (params.meetingUuid && ingestedUuids.includes(params.meetingUuid)) {
        this.logger.log({
          msg: 'ingestRecordingCompleted: instance already ingested, no-op',
          rowId: row.id,
          meetingUuid: params.meetingUuid,
        });
        return;
      }

      const existingManifest = this.parseJsonArray<RecordingSegment>(
        row.zoom_recording_manifest,
      );
      const segmentMap = new Map<string, RecordingSegment>();
      for (const seg of existingManifest) {
        if (seg?.id) segmentMap.set(seg.id, seg);
      }
      for (const seg of newManifest) {
        if (seg?.id) segmentMap.set(seg.id, seg);
      }
      const combinedManifest = Array.from(segmentMap.values()).sort(
        (a, b) =>
          new Date(a.recording_start || 0).getTime() -
          new Date(b.recording_start || 0).getTime(),
      );
      const updatedIngestedUuids = params.meetingUuid
        ? Array.from(new Set([...ingestedUuids, params.meetingUuid]))
        : ingestedUuids;

      const currentStatus = String(row.status || '').toUpperCase();

      this.logger.log({
        msg: 'ingestRecordingCompleted: merging into existing row',
        rowId: row.id,
        currentStatus,
        existingSegmentIds: existingManifest.map((s) => s.id),
        newSegmentIds: newManifest.map((s) => s.id),
        combinedSegmentCount: combinedManifest.length,
        ingestedUuidsBefore: ingestedUuids,
        ingestedUuidsAfter: updatedIngestedUuids,
      });

      if (currentStatus === 'COMPLETED') {
        // New segments arrived after this session was already uploaded —
        // reopen it, send it back through download/merge/upload with the
        // full combined segment set, and queue the old video for deletion.
        await tx.execute(sql`
          UPDATE ${sql.raw(tableName)}
          SET
            zoom_meeting_id = ${params.meetingId},
            zoom_meeting_uuid = ${params.meetingUuid},
            zoom_recording_id = ${combinedManifest[0]?.id ?? null},
            zoom_recording_manifest = ${JSON.stringify(combinedManifest)},
            ingested_meeting_uuids = ${JSON.stringify(updatedIngestedUuids)},
            metadata_verified = TRUE,
            segments_count = ${combinedManifest.length},
            recording_start = ${combinedManifest[0]?.recording_start ?? row.recording_start},
            recording_end = ${combinedManifest[combinedManifest.length - 1]?.recording_end ?? row.recording_end},
            status = 'METADATA_READY',
            merged_file_path = NULL,
            is_final_merged = FALSE,
            previous_drive_file_id = ${row.drive_file_id ?? row.previous_drive_file_id ?? null},
            drive_file_id = NULL,
            drive_link = NULL,
            updated_at = NOW()
          WHERE id = ${row.id}
        `);
        return;
      }

      if (currentStatus === 'FAILED' || currentStatus === 'PERMANENT_FAILED') {
        // New data arrived for a job that had given up — worth a fresh attempt.
        await tx.execute(sql`
          UPDATE ${sql.raw(tableName)}
          SET
            zoom_meeting_id = ${params.meetingId},
            zoom_meeting_uuid = ${params.meetingUuid},
            zoom_recording_id = ${combinedManifest[0]?.id ?? null},
            zoom_recording_manifest = ${JSON.stringify(combinedManifest)},
            ingested_meeting_uuids = ${JSON.stringify(updatedIngestedUuids)},
            metadata_verified = TRUE,
            segments_count = ${combinedManifest.length},
            recording_start = ${combinedManifest[0]?.recording_start ?? row.recording_start},
            recording_end = ${combinedManifest[combinedManifest.length - 1]?.recording_end ?? row.recording_end},
            status = 'METADATA_READY',
            retry_count = 0,
            last_error = NULL,
            updated_at = NOW()
          WHERE id = ${row.id}
        `);
        return;
      }

      // Still mid-pipeline / not yet processed — just fold the new segments in.
      // mergeRecording() re-reads the row fresh before merging, so an in-flight
      // job naturally picks up the fuller manifest on its current or next pass.
      await tx.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET
          zoom_meeting_id = ${params.meetingId},
          zoom_meeting_uuid = ${params.meetingUuid},
          zoom_recording_id = ${combinedManifest[0]?.id ?? null},
          zoom_recording_manifest = ${JSON.stringify(combinedManifest)},
          ingested_meeting_uuids = ${JSON.stringify(updatedIngestedUuids)},
          metadata_verified = TRUE,
          segments_count = ${combinedManifest.length},
          recording_start = ${combinedManifest[0]?.recording_start ?? row.recording_start},
          recording_end = ${combinedManifest[combinedManifest.length - 1]?.recording_end ?? row.recording_end},
          updated_at = NOW()
        WHERE id = ${row.id}
      `);
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
    if (!RECORDING_WORKER_ENABLED) {
      // this.logger.debug('Recording worker disabled by env flag');
      return;
    }

    if (this.isWorkerRunning) {
      // this.logger.debug('Recording worker already running, skipping tick.');
      return;
    }

    this.isWorkerRunning = true;

    try {
      while (true) {
        const job = await this.pickJob();

        if (!job) {
          break;
        }

        // this.logger.log(`Picked recording job ${job.id}`);
        await this.processJob(job);
      }
    } finally {
      this.isWorkerRunning = false;
    }
  }

  // =====================================================
  // PICK ONE JOB (ROW-LOCKED, SAFE FOR MULTI-INSTANCE)
  // =====================================================
  private async pickJob(): Promise<RecordingJob | null> {
    // First try session recordings
    console.log('pickJob:-Picking a recording job');
    let result = await db.execute(sql`
    UPDATE zuvy_session_recordings
    SET
      status = CASE
        WHEN status IN ('DISCOVERED', 'FAILED') THEN 'PROCESSING_METADATA'
        WHEN status = 'METADATA_READY' THEN 'PROCESSING_DOWNLOAD'
        WHEN status = 'DOWNLOADING' THEN 'DOWNLOADED'
        WHEN status = 'DOWNLOADED' THEN 'MERGING'
        WHEN status = 'MERGED' THEN 'PROCESSING_S3_UPLOAD'
        WHEN status = 'S3_UPLOADED' THEN 'PROCESSING_YOUTUBE_UPLOAD'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM zuvy_session_recordings
      WHERE status IN ('DISCOVERED', 'FAILED', 'METADATA_READY', 'DOWNLOADING', 'DOWNLOADED', 'MERGED', 'S3_UPLOADED', 'YOUTUBE_PROCESSING')
        AND status NOT LIKE 'PROCESSING_%'
        AND status != 'PERMANENT_FAILED'
        AND (drive_link IS NULL OR status = 'YOUTUBE_PROCESSING')
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
        WHEN status = 'DOWNLOADING' THEN 'DOWNLOADED'
        WHEN status = 'DOWNLOADED' THEN 'MERGING'
        WHEN status = 'MERGED' THEN 'PROCESSING_S3_UPLOAD'
        WHEN status = 'S3_UPLOADED' THEN 'PROCESSING_YOUTUBE_UPLOAD'
        ELSE status
      END,
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM zuvy_mentor_session_recordings
      WHERE status IN ('DISCOVERED', 'FAILED', 'METADATA_READY', 'DOWNLOADING', 'DOWNLOADED', 'MERGED', 'S3_UPLOADED', 'YOUTUBE_PROCESSING')
        AND status NOT LIKE 'PROCESSING_%'
        AND status != 'PERMANENT_FAILED'
        AND (drive_link IS NULL OR status = 'YOUTUBE_PROCESSING')
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
      console.log(
        `processJob:-Processing recording job ${job.id} with status ${job.status}`,
      );
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
        // pickJob always converts MERGED away before dispatch; kept as a
        // defensive fallback so a stale/manually-set row still progresses.
        case 'PROCESSING_S3_UPLOAD':
          await this.uploadToS3(job);
          break;

        case 'S3_UPLOADED':
        case 'PROCESSING_YOUTUBE_UPLOAD':
          await this.uploadToYoutube(job);
          break;

        case 'PROCESSING_UPLOAD':
          // Legacy: a job already mid-flight in this state at deploy time
          // skips straight to YouTube, bypassing the new S3 leg for that one
          // job. One-time, acceptable edge case for in-flight jobs only.
          this.logger.warn(
            `Job ${job.id} is in legacy PROCESSING_UPLOAD state, skipping S3 leg`,
          );
          await this.uploadToYoutube(job);
          break;

        case 'YOUTUBE_PROCESSING':
          await this.verifyYoutubeProcessing(job);
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
    // pickJob()'s snapshot can be stale by the time this actually runs (e.g.
    // picked right after a bootstrap insert, before any webhook landed) — a
    // slow in-flight call here must not blind-overwrite a manifest that
    // ingestRecordingCompleted() has since merged from multiple instances.
    // Re-read fresh, same discipline mergeRecording() already follows.
    const freshTable =
      job.table === 'mentor'
        ? sql.raw('zuvy_mentor_session_recordings')
        : sql.raw('zuvy_session_recordings');
    const fresh = await db.execute(sql`
      SELECT * FROM ${freshTable} WHERE id = ${job.id}
    `);
    if (fresh.rows?.[0]) {
      job = { ...job, ...fresh.rows[0] };
    }

    // ---------------------------------------------------
    // Metadata already provided by webhook
    // ---------------------------------------------------
    if (
      job.metadata_verified === true &&
      job.zoom_recording_id &&
      job.zoom_recording_manifest &&
      job.segments_count > 0
    ) {
      this.logJob(
        'log',
        job,
        'Metadata already present from webhook. Skipping Zoom API.',
      );

      if (job.table === 'mentor') {
        await db.execute(sql`
        UPDATE zuvy_mentor_session_recordings
        SET
          status = 'METADATA_READY'
        WHERE id = ${job.id}
          AND status = 'PROCESSING_METADATA'
      `);
      } else {
        await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          status = 'METADATA_READY'
        WHERE id = ${job.id}
          AND status = 'PROCESSING_METADATA'
      `);
      }

      return;
    }

    let recResp: any;

    try {
      this.logJob(
        'debug',
        job,
        'Fetching all Zoom meeting instances and recordings',
        {
          meetingId: job.zoom_meeting_id,
        },
      );

      recResp = await this.zoomService.getAllMeetingRecordings(
        job.zoom_meeting_id,
      );
      recResp.source = 'allInstances';
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

    const fetchedManifest = this.buildSegmentManifest(
      recResp?.recording_files || [],
      job.zoom_meeting_uuid,
    );

    const existingManifest = this.parseJsonArray<RecordingSegment>(
      job.zoom_recording_manifest,
    );
    const segmentMap = new Map<string, RecordingSegment>();
    for (const seg of existingManifest) {
      if (seg?.id) segmentMap.set(seg.id, seg);
    }
    for (const seg of fetchedManifest) {
      if (!seg?.id) continue;
      // Live REST refetches never carry a download_token (Zoom only issues
      // it via the webhook), so don't let a refresh erase one we already
      // captured for this same segment id.
      const previous = segmentMap.get(seg.id);
      segmentMap.set(seg.id, {
        ...seg,
        download_token: seg.download_token || previous?.download_token,
      });
    }

    const manifest = Array.from(segmentMap.values()).sort(
      (a, b) =>
        new Date(a.recording_start || 0).getTime() -
        new Date(b.recording_start || 0).getTime(),
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

    // Guarded on metadata_verified = FALSE: the Zoom API round-trip above
    // takes real time, and a webhook can land and merge in the meantime —
    // this write must not clobber that. If it already flipped to verified,
    // this becomes a no-op instead of overwriting a merged manifest.
    if (job.table === 'mentor') {
      await db.execute(sql`
        UPDATE zuvy_mentor_session_recordings
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
    console.log(`Downloading recording for job ${job}...`);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const manifest = this.parseJsonArray<RecordingSegment>(
      job.zoom_recording_manifest,
    );
    const segments: RecordingSegment[] = manifest.length
      ? manifest
      : job.zoom_recording_id
        ? [{ id: job.zoom_recording_id, meeting_uuid: job.zoom_meeting_uuid }]
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
            segment.id,
            finalPath,
            job,
            segment.meeting_uuid,
            segment,
          );
        }

        downloadedPaths.push(path.basename(finalPath));
      }

      if (job.table === 'mentor') {
        await db.execute(sql`
          UPDATE zuvy_mentor_session_recordings
          SET
            local_segment_paths = ${JSON.stringify(downloadedPaths)},
            segments_count = ${downloadedPaths.length},
            status = 'DOWNLOADING'
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
    recordingFileId: string,
    finalPath: string,
    job?: any,
    segmentMeetingUuid?: string | null,
    segmentObj?: RecordingSegment | null,
  ) {
    let recResp;

    this.logger.log(
      `Downloading recording file ${recordingFileId} for job ${job?.id || 'unknown'} (UUID: ${segmentMeetingUuid || job?.zoom_meeting_uuid})...`,
    );

    const uuidToUse = segmentMeetingUuid || job?.zoom_meeting_uuid;

    try {
      if (uuidToUse) {
        recResp = await this.zoomService.getZoomRecordingFilesByUuid(uuidToUse);
      } else {
        recResp = await this.zoomService.getZoomRecordingFiles(meetingId);
      }
    } catch (err: any) {
      this.logger.warn(
        `Zoom API recording lookup failed for UUID ${uuidToUse}: ${err.message}`,
      );
    }

    const file = recResp?.recording_files?.find(
      (f: any) => f.id === recordingFileId,
    );

    const rawDownloadUrl = file?.download_url || segmentObj?.download_url;

    if (!rawDownloadUrl) {
      throw new Error(
        `Zoom download URL not found (segment ${recordingFileId}, uuid ${uuidToUse || 'none'})`,
      );
    }

    const authDecision = resolveDownloadAuth(
      rawDownloadUrl,
      segmentObj?.download_token,
    );

    let downloadUrl: string;
    switch (authDecision.kind) {
      case 'already-authed':
        downloadUrl = rawDownloadUrl;
        break;
      case 'webhook-token':
        downloadUrl = `${rawDownloadUrl}?access_token=${authDecision.token}`;
        break;
      case 'oauth-token': {
        const accessToken = await this.zoomService.getAccessToken();
        downloadUrl = `${rawDownloadUrl}?access_token=${accessToken}`;
        break;
      }
    }

    this.logJob('log', job, 'Resolved recording download auth', {
      recordingFileId,
      urlKind: rawDownloadUrl.includes('/webhook_download/')
        ? 'webhook_download'
        : 'rest_download',
      authKind: authDecision.kind,
    });

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
          const targetFile = file || segmentObj;
          const expectedSize = Number(targetFile?.file_size || 0);

          this.logJob('log', job, 'Download complete - validating file', {
            downloadedSize: stats.size,
            expectedSize: expectedSize,
            filePath: finalPath,
            recordingType: targetFile?.recording_type,
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
      console.log(`Validating video file ${filePath} with ffprobe...`);
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
    console.log(`Merging recording for job ${job.id}...`);

    const table =
      job.table === 'mentor'
        ? sql.raw('zuvy_mentor_session_recordings')
        : sql.raw('zuvy_session_recordings');

    const rec = await db.execute(sql`
    SELECT *
    FROM ${table}
    WHERE id = ${job.id}
  `);

    if (!rec.rows?.length) {
      throw new Error(`Recording job ${job.id} not found`);
    }

    // Always use fresh DB state
    job = {
      ...job,
      ...rec.rows[0],
    };

    const tempDir = path.join(process.cwd(), 'temp-recordings');
    const localSegmentPaths = this.parseJsonArray<string>(
      job.local_segment_paths,
    );
    const inputPaths = localSegmentPaths.length
      ? localSegmentPaths.map((storedPath) => {
          // If the stored absolute path already exists, use it.
          if (path.isAbsolute(storedPath) && fs.existsSync(storedPath)) {
            return storedPath;
          }

          // Otherwise rebuild it using the current runtime temp directory.
          return path.join(tempDir, path.basename(storedPath));
        })
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
          fs.copyFileSync(inputPaths[0], mergedPath);
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
            } catch (copyErr: any) {
              this.logger.warn(
                `FFmpeg stream copy concat failed for job ${job.id}, falling back to re-encoding concat: ${copyErr.message}`,
              );
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
                  'fast',
                  '-crf',
                  '23',
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

    // Validate the merged video file output before declaring MERGED status
    try {
      await this.validateVideoFile(mergedPath);
    } catch (valErr: any) {
      this.logger.error(
        `Merged video validation failed for job ${job.id}: ${valErr.message}`,
      );
      throw new Error(`Merged video file is invalid: ${valErr.message}`);
    }

    // Update DB
    const relativeSegmentPaths = inputPaths.map((p) => path.basename(p));
    if (job.table === 'mentor') {
      await db.execute(sql`
      UPDATE zuvy_mentor_session_recordings
      SET
        local_segment_paths = ${JSON.stringify(relativeSegmentPaths)},
        segments_count = ${relativeSegmentPaths.length},
        merged_file_path = ${mergedPath},
        is_final_merged = TRUE,
        status = 'MERGED'
      WHERE id = ${job.id}
    `);
    } else {
      await db.execute(sql`
      UPDATE zuvy_session_recordings
      SET
        local_segment_paths = ${JSON.stringify(relativeSegmentPaths)},
        segments_count = ${relativeSegmentPaths.length},
        merged_file_path = ${mergedPath},
        is_final_merged = TRUE,
        status = 'MERGED'
      WHERE id = ${job.id}
    `);
    }

    this.logJob('log', job, 'Merge completed and verified', {
      mergedPath,
      segmentCount: inputPaths.length,
    });
  }
  // =====================================================
  // STEP 3 — UPLOAD TO YOUTUBE (IDEMPOTENT)
  // =====================================================
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

  /**
   * Check 2 mandatory conditions before uploading to YouTube:
   * 1. Session scheduled end time + 5 minutes must have passed.
   * 2. Zoom meeting must not be live/ongoing AND no recordings are currently processing on Zoom Cloud.
   */
  private async checkPreUploadEligibility(
    job: any,
  ): Promise<{ eligible: boolean; reason?: string }> {
    // ---------------------------------------------------
    // Condition 1: Session scheduled End Time + 5 minutes
    // ---------------------------------------------------
    let sessionEndTime: Date | null = null;
    try {
      if (job.table === 'mentor' && job.mentor_booking_id) {
        const mentorRow = await db.execute(sql`
          SELECT end_time FROM zuvy_mentor_slot_booking WHERE id = ${job.mentor_booking_id}
        `);
        if (mentorRow.rows?.[0]?.end_time) {
          sessionEndTime = new Date(mentorRow.rows[0].end_time as any);
        }
      } else if (job.session_id) {
        const sessionRow = await db.execute(sql`
          SELECT end_time FROM zuvy_sessions WHERE id = ${job.session_id}
        `);
        if (sessionRow.rows?.[0]?.end_time) {
          sessionEndTime = new Date(sessionRow.rows[0].end_time as any);
        }
      }
    } catch (err: any) {
      this.logger.warn(
        `Failed to fetch session end time for job ${job.id}: ${err.message}`,
      );
    }

    const now = Date.now();

    if (sessionEndTime && !isNaN(sessionEndTime.getTime())) {
      const cutoffTime = sessionEndTime.getTime() + 5 * 60 * 1000;
      if (now < cutoffTime) {
        const minutesRemaining = Math.ceil((cutoffTime - now) / (1000 * 60));
        return {
          eligible: false,
          reason: `Session scheduled end time + 5 minutes has not passed yet (${minutesRemaining}m remaining until ${new Date(cutoffTime).toISOString()}).`,
        };
      }
    } else {
      // Fallback if DB end_time is missing: check recording_end + 5 minutes
      const manifest = this.parseJsonArray<RecordingSegment>(
        job.zoom_recording_manifest,
      );
      const lastSegment = manifest[manifest.length - 1];
      const lastEndTimeStr = lastSegment?.recording_end || job.recording_end;

      if (lastEndTimeStr) {
        const lastEndTime = new Date(lastEndTimeStr).getTime();
        const cutoffTime = lastEndTime + 5 * 60 * 1000;
        if (now < cutoffTime) {
          const minutesRemaining = Math.ceil((cutoffTime - now) / (1000 * 60));
          return {
            eligible: false,
            reason: `Recording quiet window (5 minutes after last segment end) has not passed yet (${minutesRemaining}m remaining).`,
          };
        }
      }
    }

    // ---------------------------------------------------
    // Condition 2: Session Live OR Zoom Cloud Recording Processing
    // ---------------------------------------------------
    try {
      const isLive = await this.zoomService.isMeetingLiveViaDashboard(
        job.zoom_meeting_id,
      );
      if (isLive) {
        return {
          eligible: false,
          reason: `Zoom meeting ${job.zoom_meeting_id} is currently live / ongoing on Zoom.`,
        };
      }
    } catch (liveErr: any) {
      this.logger.warn(
        `Live meeting check error for job ${job.id}: ${liveErr.message}`,
      );
    }

    try {
      const isProcessing = await this.zoomService.isRecordingProcessingOnZoom(
        job.zoom_meeting_id,
      );
      if (isProcessing) {
        return {
          eligible: false,
          reason: `A cloud recording for Zoom meeting ${job.zoom_meeting_id} is currently processing on Zoom Cloud.`,
        };
      }
    } catch (procErr: any) {
      this.logger.warn(
        `Zoom cloud processing check error for job ${job.id}: ${procErr.message}`,
      );
    }

    return { eligible: true };
  }

  // =====================================================
  // S3 DURABLE STORAGE (runs before the YouTube upload)
  // =====================================================
  private async uploadToS3(job: any) {
    if (!S3_DUAL_UPLOAD_ENABLED) {
      // Feature not turned on for this environment — behave exactly as
      // before and go straight to the YouTube leg.
      await db.execute(sql`
        UPDATE ${sql.raw(this.getTableName(job))}
        SET status = 'PROCESSING_YOUTUBE_UPLOAD', updated_at = NOW()
        WHERE id = ${job.id}
      `);
      return;
    }

    const rec = await db.execute(sql`
      SELECT *
      FROM ${sql.raw(this.getTableName(job))}
      WHERE id = ${job.id}
    `);
    const freshRow = rec.rows?.[0] as any;
    job = { ...job, ...freshRow };

    // Idempotency guard
    if (job.s3_verified === true) {
      this.logJob(
        'log',
        job,
        'S3 upload already verified, advancing to YouTube leg',
      );
      await db.execute(sql`
        UPDATE ${sql.raw(this.getTableName(job))}
        SET status = 'S3_UPLOADED', updated_at = NOW()
        WHERE id = ${job.id}
      `);
      return;
    }

    const currentStatus = String(job.status || '').toUpperCase();
    if (
      currentStatus !== 'MERGED' &&
      currentStatus !== 'PROCESSING_S3_UPLOAD'
    ) {
      throw new Error(
        `Cannot upload job ${job.id} to S3 until recordings are merged into 1 video (current status: ${job.status})`,
      );
    }
    if (job.is_final_merged !== true) {
      throw new Error(
        `Cannot upload job ${job.id} to S3 until all recordings are merged into a single video file`,
      );
    }

    const filePath = this.resolveMergedFilePath(job, freshRow);
    const fileSize = fs.statSync(filePath).size;
    const tableName = this.getTableName(job);

    const key = job.s3_key || (await this.buildRecordingS3Key(job));

    this.logJob('log', job, 'Starting S3 upload', { key, fileSize });

    if (this.recordingS3.isMultipartRequired(fileSize)) {
      const { etag, uploadId } = await this.recordingS3.uploadMultipart(
        key,
        filePath,
        fileSize,
        job.s3_multipart_upload_id,
        async (currentUploadId, parts) => {
          // Persist progress after every part so a crash/restart resumes
          // from the last completed part instead of starting over.
          await db.execute(sql`
            UPDATE ${sql.raw(tableName)}
            SET
              s3_key = ${key},
              s3_multipart_upload_id = ${currentUploadId},
              s3_uploaded_parts = ${JSON.stringify(parts)}
            WHERE id = ${job.id}
          `);
        },
      );

      await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET
          status = 'S3_UPLOADED',
          s3_bucket = ${this.recordingS3.getBucket()},
          s3_key = ${key},
          s3_uploaded_at = NOW(),
          s3_verified = TRUE,
          s3_multipart_upload_id = NULL,
          s3_uploaded_parts = '[]'::jsonb
        WHERE id = ${job.id}
      `);
      this.logJob('log', job, 'S3 multipart upload verified', { key, etag });
    } else {
      const checksum = await this.recordingS3.computeSha256(filePath);
      const { etag, checksumSha256 } = await this.recordingS3.uploadSinglePart(
        key,
        filePath,
        checksum.base64,
      );

      await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET
          status = 'S3_UPLOADED',
          s3_bucket = ${this.recordingS3.getBucket()},
          s3_key = ${key},
          s3_checksum_sha256 = ${checksumSha256},
          s3_uploaded_at = NOW(),
          s3_verified = TRUE
        WHERE id = ${job.id}
      `);
      this.logJob('log', job, 'S3 upload verified', {
        key,
        etag,
        checksum: checksumSha256,
      });
    }

    if (job.table === 'session') {
      await db.execute(sql`
        UPDATE zuvy_sessions
        SET
          recording_s3_bucket = ${this.recordingS3.getBucket()},
          recording_s3_key = ${key}
        WHERE id = ${job.session_id}
      `);
    }

    if (ZOOM_DELETE_AFTER_S3_ENABLED) {
      // Best-effort — never let Zoom-side cleanup block the pipeline.
      try {
        await this.zoomService.deleteFromZoomCloud(
          job.zoom_meeting_uuid || job.zoom_meeting_id,
          job.zoom_recording_id,
        );
        await db.execute(sql`
          UPDATE ${sql.raw(tableName)}
          SET zoom_deleted_at = NOW()
          WHERE id = ${job.id}
        `);
        this.logJob(
          'log',
          job,
          'Deleted Zoom cloud recording after S3 verification',
        );
      } catch (zoomDelErr: any) {
        this.logJob('warn', job, 'Failed to delete Zoom cloud recording', {
          error: zoomDelErr?.message ?? String(zoomDelErr),
        });
      }
    }
  }

  private async uploadToYoutube(job: any) {
    console.log(`Uploading recording for job ${job.id} to YouTube...`);
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

    const rec = await db.execute(sql`
  SELECT *
  FROM ${sql.raw(this.getTableName(job))}
  WHERE id = ${job.id}
`);
    job = {
      ...job,
      ...rec.rows[0],
    };

    // Strict Guard: Until recordings are merged into 1 video, upload to YouTube is blocked
    const currentStatus = String(job.status || '').toUpperCase();
    const youtubeEligibleStatuses = [
      'MERGED',
      'PROCESSING_UPLOAD', // legacy
      'S3_UPLOADED',
      'PROCESSING_YOUTUBE_UPLOAD',
    ];
    if (!youtubeEligibleStatuses.includes(currentStatus)) {
      throw new Error(
        `Cannot upload job ${job.id} to YouTube until recordings are merged into 1 video (current status: ${job.status})`,
      );
    }

    if (job.is_final_merged !== true) {
      throw new Error(
        `Cannot upload job ${job.id} to YouTube until all recordings are merged into a single video file`,
      );
    }

    // Mandatory Pre-Upload Eligibility Check (Condition 1: End time + 5min, Condition 2: Session active or Zoom cloud recording processing)
    const eligibility = await this.checkPreUploadEligibility(job);
    if (!eligibility.eligible) {
      this.logJob(
        'warn',
        job,
        `Deferring YouTube upload: ${eligibility.reason}`,
      );

      const deferTime = new Date(Date.now() + 3 * 60 * 1000);
      const tableName = this.getTableName(job);

      await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET
          status = 'METADATA_READY',
          next_retry_at = ${deferTime}
        WHERE id = ${job.id}
      `);
      return;
    }

    // Final Instance Sync: Re-check Zoom API to capture all past meeting instances
    try {
      const allRecs = await this.zoomService.getAllMeetingRecordings(
        job.zoom_meeting_id,
      );
      const latestManifest = this.buildSegmentManifest(
        allRecs?.recording_files || [],
        job.zoom_meeting_uuid,
      );
      const currentManifest = this.parseJsonArray<RecordingSegment>(
        job.zoom_recording_manifest,
      );

      const segmentMap = new Map<string, RecordingSegment>();
      for (const seg of currentManifest) {
        if (seg?.id) segmentMap.set(seg.id, seg);
      }
      for (const seg of latestManifest) {
        if (!seg?.id) continue;
        // Same reasoning as the mid-pipeline refetch above: preserve a
        // previously captured webhook download_token across this REST sync.
        const previous = segmentMap.get(seg.id);
        segmentMap.set(seg.id, {
          ...seg,
          download_token: seg.download_token || previous?.download_token,
        });
      }
      const combinedManifest = Array.from(segmentMap.values()).sort(
        (a, b) =>
          new Date(a.recording_start || 0).getTime() -
          new Date(b.recording_start || 0).getTime(),
      );

      if (combinedManifest.length > currentManifest.length) {
        this.logJob(
          'log',
          job,
          'Discovered new recording segments during pre-upload check. Re-opening job to download and merge all segments into 1 video.',
          {
            oldCount: currentManifest.length,
            newCount: combinedManifest.length,
          },
        );

        const tableName = this.getTableName(job);
        await db.execute(sql`
          UPDATE ${sql.raw(tableName)}
          SET
            zoom_recording_manifest = ${JSON.stringify(combinedManifest)},
            segments_count = ${combinedManifest.length},
            status = 'METADATA_READY',
            merged_file_path = NULL,
            is_final_merged = FALSE
          WHERE id = ${job.id}
        `);
        return;
      }
    } catch (syncErr: any) {
      this.logger.warn(
        `Final instance sync warning for job ${job.id}: ${syncErr.message}`,
      );
    }

    const filePath = this.resolveMergedFilePath(job, rec.rows?.[0]);

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

    const { videoId, videoUrl } = await this.insertYoutubeVideo(
      job,
      filePath,
      fileSize,
    );

    // Best-effort cleanup of a superseded video — this job was reopened
    // because a later recording instance arrived after a prior upload.
    // Never let a cleanup failure block recording the new upload as done.
    const previousDriveFileId = job.previous_drive_file_id as
      | string
      | null
      | undefined;
    if (previousDriveFileId) {
      try {
        await this.youtube.videos.delete({ id: previousDriveFileId });
        this.logJob('log', job, 'Deleted superseded YouTube video', {
          previousDriveFileId,
        });
      } catch (delErr: any) {
        this.logJob('warn', job, 'Failed to delete superseded YouTube video', {
          previousDriveFileId,
          error: delErr?.message ?? String(delErr),
        });
      }
    }

    // Status goes to YOUTUBE_PROCESSING, not COMPLETED, and the local file
    // is NOT deleted yet — videos.insert() returning an id only means the
    // upload was accepted, not that YouTube's async review/transcoding
    // succeeded. Deleting the last local copy here (as this used to do)
    // meant a later takedown or processing failure left nothing
    // recoverable anywhere. verifyYoutubeProcessing() confirms
    // `processingStatus === 'succeeded'` before marking COMPLETED and
    // deleting the file.
    if (job.table === 'mentor') {
      await db.execute(sql`
        UPDATE zuvy_mentor_session_recordings
        SET
          status = 'YOUTUBE_PROCESSING',
          drive_file_id = ${videoId},
          drive_link = ${videoUrl},
          previous_drive_file_id = NULL
        WHERE id = ${job.id}
      `);
    } else {
      await db.execute(sql`
        UPDATE zuvy_session_recordings
        SET
          status = 'YOUTUBE_PROCESSING',
          drive_file_id = ${videoId},
          drive_link = ${videoUrl},
          previous_drive_file_id = NULL
        WHERE id = ${job.id}
      `);

      await db.execute(sql`
        UPDATE zuvy_sessions
        SET
          youtube_video_id = ${videoId},
          s3link = ${videoUrl},
          final_uploaded = TRUE
        WHERE id = ${job.session_id}
      `);
    }
  }

  // Shared by uploadToYoutube() and the Glacier-restore re-upload flow
  // (pollAndCompleteRestores()) — the actual videos.insert() call, title
  // resolution, and YouTube-specific error translation, with nothing about
  // *why* the upload is happening (fresh upload vs. restore re-upload).
  private async insertYoutubeVideo(
    job: any,
    filePath: string,
    fileSize: number,
  ): Promise<{ videoId: string; videoUrl: string }> {
    this.logJob('log', job, 'Starting YouTube upload', { fileSize, filePath });

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

      return { videoId, videoUrl };
    } catch (error: any) {
      this.logJob('error', job, '[YOUTUBE_UPLOAD_FAILED]', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        response: error.response?.data,
        errors: error.response?.data?.error?.errors,
        stack: error.stack,
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
  // VERIFY YOUTUBE ASYNC PROCESSING (not just the insert() response)
  // =====================================================
  private async verifyYoutubeProcessing(job: any) {
    const rec = await db.execute(sql`
      SELECT *
      FROM ${sql.raw(this.getTableName(job))}
      WHERE id = ${job.id}
    `);
    const freshRow = rec.rows?.[0] as any;
    job = { ...job, ...freshRow };

    if (!job.drive_file_id) {
      throw new Error(
        `Job ${job.id} is in YOUTUBE_PROCESSING with no drive_file_id recorded`,
      );
    }

    const res = await this.youtube.videos.list({
      part: ['status', 'processingDetails'],
      id: [job.drive_file_id],
    });

    const video = res.data?.items?.[0];
    if (!video) {
      throw new Error(
        `YouTube returned no video for id ${job.drive_file_id} (job ${job.id})`,
      );
    }

    const uploadStatus = video.status?.uploadStatus;
    const processingStatus = video.processingDetails?.processingStatus;

    if (uploadStatus === 'rejected' || processingStatus === 'failed') {
      throw new Error(
        `YouTube ${uploadStatus === 'rejected' ? 'rejected' : 'failed processing'} video ${job.drive_file_id} for job ${job.id} — needs manual re-upload`,
      );
    }

    if (processingStatus === 'succeeded' && uploadStatus === 'processed') {
      const filePath = this.resolveMergedFilePath(job, freshRow);

      await db.execute(sql`
        UPDATE ${sql.raw(this.getTableName(job))}
        SET status = 'COMPLETED'
        WHERE id = ${job.id}
      `);

      try {
        fs.unlinkSync(filePath);
      } catch (err: any) {
        this.logger.warn(
          `Unable to delete merged file ${filePath}: ${err?.message ?? String(err)}`,
        );
      }

      this.logJob('log', job, 'YouTube processing verified, job completed');
      return;
    }

    // Still processing — recheck later without touching retry_count/status,
    // so pickJob doesn't immediately re-pick this row and busy-loop within
    // the same worker tick.
    await db.execute(sql`
      UPDATE ${sql.raw(this.getTableName(job))}
      SET next_retry_at = NOW() + interval '30 seconds'
      WHERE id = ${job.id}
    `);
  }

  // =====================================================
  // PERIODIC AUDIT: confirm every COMPLETED job has a verified S3 copy
  // =====================================================
  private async auditS3Coverage() {
    for (const tableName of [
      'zuvy_session_recordings',
      'zuvy_mentor_session_recordings',
    ]) {
      const missing = await db.execute(sql`
        SELECT id, session_id, mentor_booking_id, s3_key
        FROM ${sql.raw(tableName)}
        WHERE status = 'COMPLETED' AND (s3_verified IS NOT TRUE)
        LIMIT 500
      `);

      if (missing.rows?.length) {
        this.logger.error(
          `[S3_AUDIT] ${missing.rows.length} completed row(s) in ${tableName} missing a verified S3 copy (showing up to 500): ${missing.rows
            .map((r: any) => r.id)
            .join(', ')}`,
        );
      }

      const withKey = await db.execute(sql`
        SELECT id, s3_key
        FROM ${sql.raw(tableName)}
        WHERE status = 'COMPLETED' AND s3_verified IS TRUE AND s3_key IS NOT NULL
        LIMIT 500
      `);

      for (const row of (withKey.rows || []) as any[]) {
        try {
          const head = await this.recordingS3.headObject(row.s3_key);
          if (!head.exists) {
            this.logger.error(
              `[S3_AUDIT] ${tableName} id=${row.id} has s3_verified=TRUE but object ${row.s3_key} is missing from S3`,
            );
          }
        } catch (err: any) {
          this.logger.error(
            `[S3_AUDIT] Failed to check S3 object for ${tableName} id=${row.id}: ${err?.message ?? err}`,
          );
        }
      }
    }
  }

  // =====================================================
  // NIGHTLY: YOUTUBE HEALTH CHECK + GLACIER RESTORE
  //
  // Only ever acts on rows already status = 'COMPLETED' — never touches the
  // primary Zoom -> S3 -> YouTube upload pipeline above. Each phase is
  // independently try/caught so one phase's failure never blocks the rest.
  // =====================================================
  @Cron('0 2 * * *', { timeZone: 'Asia/Kolkata' })
  async runNightlyRecordingHealthCheck() {
    if (!RECORDING_HEALTH_CHECK_ENABLED) {
      return;
    }

    try {
      await this.checkYoutubeChannelHealth();
    } catch (err: any) {
      this.logger.error(
        `[YOUTUBE_HEALTH] Channel health check phase failed: ${err?.message ?? err}`,
      );
    }

    try {
      await this.runYoutubeHealthCheckRotation();
    } catch (err: any) {
      this.logger.error(
        `[YOUTUBE_HEALTH] Health-check rotation phase failed: ${err?.message ?? err}`,
      );
    }

    try {
      await this.pollAndCompleteRestores();
    } catch (err: any) {
      this.logger.error(
        `[YOUTUBE_HEALTH] Restore-polling phase failed: ${err?.message ?? err}`,
      );
    }
  }

  // Cheap, single-call check: does the upload channel itself still exist and
  // accept uploads? Only acts on an unambiguous signal (zero channels
  // returned, or a 401/403) — a generic/transient error is logged and
  // skipped, never treated as evidence of channel loss.
  private async checkYoutubeChannelHealth(): Promise<void> {
    let channelsFound: number | null = null;

    try {
      const res = await this.youtube.channels.list({
        part: ['id'],
        mine: true,
      });
      channelsFound = res.data?.items?.length ?? 0;
    } catch (err: any) {
      const status = err?.code || err?.response?.status;
      if (status === 401 || status === 403) {
        channelsFound = 0;
      } else {
        this.logger.warn(
          `[YOUTUBE_HEALTH] Channel health check failed with an ambiguous error, skipping this run: ${err?.message ?? err}`,
        );
        return;
      }
    }

    if (channelsFound > 0) {
      return;
    }

    this.logger.error(
      '[YOUTUBE_HEALTH] YouTube channel is unreachable (no channels returned / credentials revoked) — flagging every completed recording on it for restore',
    );

    for (const tableName of [
      'zuvy_session_recordings',
      'zuvy_mentor_session_recordings',
    ]) {
      const flagged = await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET youtube_lost_detected_at = COALESCE(youtube_lost_detected_at, NOW())
        WHERE status = 'COMPLETED' AND drive_file_id IS NOT NULL AND restore_status IS NULL
        RETURNING *
      `);

      for (const row of (flagged.rows || []) as any[]) {
        await this.initiateRestoreForRow(tableName, row);
      }
    }
  }

  // Rotating, bounded sample so every completed recording eventually gets
  // checked without spiking YouTube API quota in one run. Flags a video as
  // lost only on the two unambiguous signals from the durability strategy
  // doc (missing / rejected) — a Content ID claim, mute, or geo-block is not
  // a restore trigger, since re-uploading wouldn't fix any of those anyway.
  private async runYoutubeHealthCheckRotation(): Promise<void> {
    for (const tableName of [
      'zuvy_session_recordings',
      'zuvy_mentor_session_recordings',
    ]) {
      const result = await db.execute(sql`
        SELECT *
        FROM ${sql.raw(tableName)}
        WHERE status = 'COMPLETED' AND restore_status IS NULL
        ORDER BY youtube_last_checked_at ASC NULLS FIRST
        LIMIT 1000
      `);

      for (const row of (result.rows || []) as any[]) {
        if (!row.drive_file_id) continue;

        let lost = false;
        try {
          const res = await this.youtube.videos.list({
            part: ['status'],
            id: [row.drive_file_id],
          });
          const item = res.data?.items?.[0];
          lost = !item || item.status?.uploadStatus === 'rejected';
        } catch (err: any) {
          // Don't stamp youtube_last_checked_at on a transient failure —
          // leave it at the front of the rotation for tomorrow instead of
          // losing its place for a full cycle.
          this.logger.warn(
            `[YOUTUBE_HEALTH] Failed to check video ${row.drive_file_id} (${tableName} id=${row.id}): ${err?.message ?? err}`,
          );
          continue;
        }

        await db.execute(sql`
          UPDATE ${sql.raw(tableName)}
          SET youtube_last_checked_at = NOW()
          WHERE id = ${row.id}
        `);

        if (lost) {
          await this.initiateRestoreForRow(tableName, row);
        }
      }
    }
  }

  // Shared by the channel check and the rotation check.
  private async initiateRestoreForRow(
    tableName: string,
    row: any,
  ): Promise<void> {
    if (row.s3_verified !== true) {
      this.logger.error(
        `[YOUTUBE_HEALTH] ${tableName} id=${row.id} lost its YouTube video but has no verified S3 copy to restore from — needs manual attention`,
      );
      return;
    }

    const tier = await this.computeRestoreTier(tableName, row);

    try {
      await this.recordingS3.initiateRestore(
        row.s3_key,
        tier,
        GLACIER_RESTORE_DAYS,
      );
      await db.execute(sql`
        UPDATE ${sql.raw(tableName)}
        SET
          restore_status = 'IN_PROGRESS',
          restore_tier = ${tier},
          restore_requested_at = NOW(),
          youtube_lost_detected_at = COALESCE(youtube_lost_detected_at, NOW())
        WHERE id = ${row.id}
      `);
      this.logger.warn(
        `[YOUTUBE_HEALTH] ${tableName} id=${row.id} lost its YouTube video, initiated Glacier restore (tier=${tier})`,
      );
    } catch (err: any) {
      this.logger.error(
        `[YOUTUBE_HEALTH] Failed to initiate restore for ${tableName} id=${row.id}: ${err?.message ?? err}`,
      );
    }
  }

  // Simple, robust heuristic — keys off zuvy_sessions.start_time (unambiguous
  // timestamp semantics) rather than zuvyBootcamps.duration (unit isn't
  // specified in the schema). A bootcamp with a recent or future session is
  // treated as active and gets faster (pricier) retrieval; an archived
  // bootcamp gets the cheapest tier. Mentor recordings have no bootcamp
  // concept to key off, so they always get the cheap default.
  private async computeRestoreTier(
    tableName: string,
    row: any,
  ): Promise<'Standard' | 'Bulk'> {
    if (tableName !== 'zuvy_session_recordings' || !row.session_id) {
      return 'Bulk';
    }

    const sessionRow = await db.execute(sql`
      SELECT bootcamp_id FROM zuvy_sessions WHERE id = ${row.session_id}
    `);
    const bootcampId = (sessionRow.rows?.[0] as any)?.bootcamp_id;
    if (!bootcampId) return 'Bulk';

    const latest = await db.execute(sql`
      SELECT MAX(start_time::timestamptz) as latest FROM zuvy_sessions WHERE bootcamp_id = ${bootcampId}
    `);
    const latestStart = (latest.rows?.[0] as any)?.latest;
    if (!latestStart) return 'Bulk';

    const daysSince =
      (Date.now() - new Date(latestStart).getTime()) / (1000 * 60 * 60 * 24);
    return daysSince <= 45 ? 'Standard' : 'Bulk';
  }

  // For rows with restore_status = 'IN_PROGRESS': check if the Glacier
  // restore has completed, and if so, download the restored copy, validate
  // it, and re-upload it to YouTube as a new video (the old drive_file_id is
  // dead — this can't be a resumed upload).
  private async pollAndCompleteRestores(): Promise<void> {
    for (const tableName of [
      'zuvy_session_recordings',
      'zuvy_mentor_session_recordings',
    ]) {
      const result = await db.execute(sql`
        SELECT * FROM ${sql.raw(tableName)} WHERE restore_status = 'IN_PROGRESS'
      `);

      for (const row of (result.rows || []) as any[]) {
        const job = {
          ...row,
          table:
            tableName === 'zuvy_mentor_session_recordings'
              ? 'mentor'
              : 'session',
        };

        try {
          const status = await this.recordingS3.getRestoreStatus(row.s3_key);
          if (!status.available) {
            continue; // still restoring — checked again tomorrow night
          }

          const localPath = path.join(
            process.cwd(),
            'temp-recordings',
            `restored-${row.id}.mp4`,
          );
          await this.recordingS3.downloadObject(row.s3_key, localPath);
          await this.validateVideoFile(localPath);

          const fileSize = fs.statSync(localPath).size;
          const { videoId, videoUrl } = await this.insertYoutubeVideo(
            job,
            localPath,
            fileSize,
          );

          await db.execute(sql`
            UPDATE ${sql.raw(tableName)}
            SET
              drive_file_id = ${videoId},
              drive_link = ${videoUrl},
              restore_status = 'AVAILABLE'
            WHERE id = ${row.id}
          `);

          if (tableName === 'zuvy_session_recordings') {
            await db.execute(sql`
              UPDATE zuvy_sessions
              SET youtube_video_id = ${videoId}, s3link = ${videoUrl}, final_uploaded = TRUE
              WHERE id = ${row.session_id}
            `);
          }

          try {
            fs.unlinkSync(localPath);
          } catch (err: any) {
            this.logger.warn(
              `Unable to delete restored file ${localPath}: ${err?.message ?? err}`,
            );
          }

          this.logJob(
            'log',
            job,
            'Recovered recording restored from Glacier and re-uploaded to YouTube',
            { videoId },
          );
        } catch (err: any) {
          this.logger.error(
            `[YOUTUBE_HEALTH] Restore/re-upload failed for ${tableName} id=${row.id}: ${err?.message ?? err}`,
          );
          await db.execute(sql`
            UPDATE ${sql.raw(tableName)}
            SET restore_status = 'FAILED'
            WHERE id = ${row.id}
          `);
        }
      }
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

    if (isTerminal) {
      // Best-effort: don't leave an abandoned multipart upload silently
      // accruing S3 storage cost once this job gives up for good.
      try {
        const rec = await db.execute(sql`
          SELECT s3_key, s3_multipart_upload_id
          FROM ${sql.raw(this.getTableName(job))}
          WHERE id = ${job.id}
        `);
        const row = rec.rows?.[0] as any;
        if (row?.s3_multipart_upload_id) {
          await this.recordingS3.abortMultipartUpload(
            row.s3_key,
            row.s3_multipart_upload_id,
          );
        }
      } catch (abortErr: any) {
        this.logger.warn(
          `Failed to check/abort multipart upload for job ${job.id}: ${abortErr?.message ?? abortErr}`,
        );
      }
    }

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
              AND status = ${job.status}
            `
          : sql`
              UPDATE zuvy_mentor_session_recordings
              SET
                status = 'FAILED',
                retry_count = ${nextRetryCount},
                next_retry_at = ${nextRetry},
                last_error = ${error.message}
              WHERE id = ${job.id}
              AND status = ${job.status}
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
