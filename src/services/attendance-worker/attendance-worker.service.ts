import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { sql, eq } from 'drizzle-orm';
import { db } from '../../db/index';
import {
  zuvySessions,
  zuvyStudentAttendance,
  zuvyStudentAttendanceRecords,
} from '../../../drizzle/schema';
import { ZoomService } from '../zoom/zoom.service';
import { TrackingService } from '../../controller/progress/tracking.service';
import { AttendanceWorkerTriggerService } from './attendance-worker-trigger.service';

const ATTENDANCE_WORKER_ENABLED =
  process.env.ATTENDANCE_WORKER_ENABLED === 'true';

const MAX_RETRIES = 5;

type AttendanceJob = {
  id: number;
  session_id: number;
  zoom_meeting_id: string;
  zoom_meeting_uuid?: string | null;
  batch_id?: number | null;
  bootcamp_id?: number | null;
  status: string;
  retry_count: number;
};

@Injectable()
export class AttendanceWorkerService implements OnModuleInit {
  private readonly logger = new Logger(AttendanceWorkerService.name);
  private isWorkerRunning = false;

  onModuleInit() {
    this.trigger.onTrigger().subscribe(async () => {
      try {
        this.logger.log(
          '⚡ Immediate attendance worker execution triggered by webhook',
        );
        await this.runWorkerOnce();
      } catch (err) {
        this.logger.error('Triggered attendance worker execution failed', err);
      }
    });

    if (ATTENDANCE_WORKER_ENABLED) {
      setInterval(async () => {
        try {
          await this.runWorkerOnce();
        } catch (err) {
          this.logger.error(
            'Scheduled attendance worker execution failed',
            err,
          );
        }
      }, 5000);
    }
  }

  constructor(
    private readonly zoomService: ZoomService,
    private readonly trackingService: TrackingService,
    private readonly trigger: AttendanceWorkerTriggerService,
  ) {}

  private logJob(
    level: 'log' | 'warn' | 'error' | 'debug',
    job: AttendanceJob,
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
  async runWorkerOnce() {
    if (!ATTENDANCE_WORKER_ENABLED) {
      return;
    }

    if (this.isWorkerRunning) {
      return;
    }

    this.isWorkerRunning = true;

    try {
      while (true) {
        const job = await this.pickJob();

        if (!job) {
          break;
        }

        await this.processJob(job);
      }
    } finally {
      this.isWorkerRunning = false;
    }
  }

  // =====================================================
  // PICK ONE JOB (ROW-LOCKED, SAFE FOR MULTI-INSTANCE)
  // =====================================================
  private async pickJob(): Promise<AttendanceJob | null> {
    const result = await db.execute(sql`
    UPDATE zuvy_session_attendance_jobs
    SET
      status = 'PROCESSING',
      updated_at = NOW()
    WHERE id = (
      SELECT id
      FROM zuvy_session_attendance_jobs
      WHERE status IN ('DISCOVERED', 'FAILED')
        AND status != 'PERMANENT_FAILED'
        AND retry_count < ${MAX_RETRIES}
        AND (next_retry_at IS NULL OR next_retry_at <= NOW())
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `);

    if (result.rows?.[0]) {
      return result.rows[0] as unknown as AttendanceJob;
    }

    return null;
  }

  // =====================================================
  // PROCESS ONE JOB
  // =====================================================
  private async processJob(job: AttendanceJob) {
    try {
      this.logJob('log', job, 'Processing attendance job');
      await this.computeAndPersistAttendance(job);
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

    const jitter = Math.floor(Math.random() * 30); // 0-30s
    return new Date(Date.now() + (baseSeconds + jitter) * 1000);
  }

  // =====================================================
  // FETCH ZOOM ATTENDANCE, PERSIST, RECOMPUTE BATCH %
  // =====================================================
  private async computeAndPersistAttendance(job: AttendanceJob) {
    const compute = await this.zoomService.computeAttendance75(
      job.zoom_meeting_id,
    );

    if (!compute.success) {
      throw new Error(compute.error || 'computeAttendance75 failed');
    }

    const data: any = compute.data;

    // Meeting is still live — defer without penalty, same as the recording
    // worker deferring on a "not ready yet" Zoom response.
    if (data?.live || data?.skipped) {
      this.logJob(
        'log',
        job,
        'Meeting still live; deferring attendance computation',
      );

      await db.execute(sql`
        UPDATE zuvy_session_attendance_jobs
        SET
          status = 'DISCOVERED',
          next_retry_at = NOW() + INTERVAL '5 minutes'
        WHERE id = ${job.id}
      `);

      return;
    }

    const attendanceArray: any[] = Array.isArray(data?.attendance)
      ? data.attendance
      : [];

    const sessionRows = await db
      .select({
        id: zuvySessions.id,
        meetingId: zuvySessions.meetingId,
        batchId: zuvySessions.batchId,
        bootcampId: zuvySessions.bootcampId,
        invitedStudents: zuvySessions.invitedStudents,
        startTime: zuvySessions.startTime,
      })
      .from(zuvySessions)
      .where(eq(zuvySessions.id, job.session_id))
      .limit(1);

    if (!sessionRows.length) {
      throw new Error(
        `Session ${job.session_id} not found for attendance job ${job.id}`,
      );
    }

    const session = sessionRows[0];
    const batchId = job.batch_id ?? session.batchId;
    const bootcampId = job.bootcamp_id ?? session.bootcampId;

    // zuvy_student_attendance keys off the session's own meetingId (not the
    // Zoom meeting id used to query the Zoom API), matching the prior cron behavior.
    await db
      .insert(zuvyStudentAttendance)
      .values({
        meetingId: session.meetingId,
        attendance: attendanceArray,
        batchId,
        bootcampId,
      } as any)
      .catch(() => null);

    const invited = Array.isArray(session.invitedStudents)
      ? session.invitedStudents
      : [];
    const invitedByEmail = new Map(
      invited.map((i: any) => [(i.email || '').toLowerCase(), i]),
    );

    const existingRecordsRaw = await db
      .select({ userId: zuvyStudentAttendanceRecords.userId })
      .from(zuvyStudentAttendanceRecords)
      .where(eq(zuvyStudentAttendanceRecords.sessionId, job.session_id));
    const existingUserSet = new Set(existingRecordsRaw.map((r) => r.userId));

    const sessionDate = session.startTime
      ? new Date(session.startTime)
      : new Date();
    const addedUserSet = new Set<any>();
    const perStudentRecords: any[] = [];

    for (const att of attendanceArray) {
      const email = (att.email || '').toLowerCase();
      const invitedInfo: any = invitedByEmail.get(email);
      if (!invitedInfo || !invitedInfo.userId) continue;
      const uid = invitedInfo.userId;
      if (existingUserSet.has(uid) || addedUserSet.has(uid)) continue;
      addedUserSet.add(uid);
      perStudentRecords.push({
        userId: uid,
        batchId,
        bootcampId,
        sessionId: job.session_id,
        attendanceDate: sessionDate,
        status: att.attendance === 'present' ? 'present' : 'absent',
        duration: att.duration || 0,
      });
    }

    if (perStudentRecords.length) {
      await db.insert(zuvyStudentAttendanceRecords).values(perStudentRecords);
    }

    // Recompute unconditionally once this session finishes processing: a
    // newly-completed session grows the denominator (total completed
    // classes) for every enrolled student even when nobody's individual
    // attendance record changed (e.g. nobody who joined was new, or nobody
    // joined at all) — gating this on perStudentRecords.length left the
    // cached percentage frozen at its pre-session value in that case.
    if (batchId) {
      try {
        await this.trackingService.recomputeBatchAttendancePercentages(batchId);
      } catch (recErr: any) {
        this.logger.warn(
          `Failed to recompute attendance percentages for batch ${batchId}: ${recErr.message}`,
        );
      }
    }

    await db.execute(sql`
      UPDATE zuvy_session_attendance_jobs
      SET
        status = 'COMPLETED',
        attendance_computed_at = NOW(),
        updated_at = NOW()
      WHERE id = ${job.id}
    `);

    this.logJob('log', job, 'Attendance computed and persisted', {
      recordCount: perStudentRecords.length,
    });
  }

  // =====================================================
  // FAILURE HANDLING (RETRY SAFE)
  // =====================================================
  private async markFailed(job: AttendanceJob, error: Error) {
    const nextRetryCount = job.retry_count + 1;
    const isTerminal = nextRetryCount >= MAX_RETRIES;
    const nextRetry = this.computeNextRetry(job.retry_count);

    this.logJob('error', job, 'Attendance job failed', {
      error: error.message,
      terminal: isTerminal,
      retryCount: nextRetryCount,
    });

    await db.execute(
      isTerminal
        ? sql`
            UPDATE zuvy_session_attendance_jobs
            SET
              status = 'PERMANENT_FAILED',
              retry_count = ${nextRetryCount},
              last_error = ${error.message}
            WHERE id = ${job.id}
          `
        : sql`
            UPDATE zuvy_session_attendance_jobs
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
