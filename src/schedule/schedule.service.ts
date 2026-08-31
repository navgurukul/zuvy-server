import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  userTokens,
  zuvySessions,
  zuvyBatchEnrollments,
  users,
  zuvyStudentAttendance,
  zuvyOutsourseAssessments,
} from '../../drizzle/schema';
import { db } from '../db/index';
import {
  eq,
  sql,
  isNull,
  and,
  gte,
  lt,
  inArray,
  or,
  notExists,
  gt,
} from 'drizzle-orm';
import { google } from 'googleapis';
import { ClassesService } from '../controller/classes/classes.service';
import { ZoomService } from '../services/zoom/zoom.service';
import { AttendanceWorkerTriggerService } from '../services/attendance-worker/attendance-worker-trigger.service';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const { OAuth2 } = google.auth;

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private youtube: any;

  constructor(
    private readonly classesService: ClassesService,
    private readonly zoomService: ZoomService,
    private readonly attendanceWorkerTrigger: AttendanceWorkerTriggerService,
  ) {
    this.logger.log('ScheduleService initialized');
    try {
      // Initialize the YouTube API client
      const oAuth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground', // Must match your GCP setup
      );

      // Set the refresh token you obtained
      oAuth2Client.setCredentials({
        refresh_token: process.env.GOOGLE_YT_REFRESH_TOKEN,
      });

      this.youtube = google.youtube({
        version: 'v3',
        auth: oAuth2Client,
      });

      this.logger.log('YouTube client initialized');
    } catch (e: any) {
      this.logger.warn(`Failed to initialize YouTube client: ${e.message}`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async activateDueZoomSessions() {
    try {
      await this.classesService.activateScheduledZoomSessions();
    } catch (error: any) {
      this.logger.error(
        `Failed to activate due Zoom sessions: ${error.message}`,
      );
    }
  }

  // Guards against a host (or a Zoom account admin) manually disabling the
  // waiting room any time between meeting creation and the session actually
  // starting — activateDueZoomSessions only applies the policy once, at
  // creation, so nothing else would otherwise catch that drift.
  @Cron(CronExpression.EVERY_MINUTE)
  async reaffirmZoomWaitingRoomPolicy() {
    try {
      await this.classesService.reaffirmWaitingRoomPolicyForActiveSessions();
    } catch (error: any) {
      this.logger.error(
        `Failed to reaffirm Zoom waiting room policy: ${error.message}`,
      );
    }
  }

  // @Cron('*/5 * * * *')
  @Cron('0 */6 * * *')
  async backfillInvitedStudentsAttendanceMidnight() {
    this.logger.log(
      'Midnight cron: Backfilling attendance & recordings (orchestrator)',
    );
    try {
      // Fetch completed Zoom sessions (regardless of s3link)
      const completedZoomSessions = await db
        .select({
          id: zuvySessions.id,
          meetingId: zuvySessions.meetingId,
          zoomMeetingId: zuvySessions.zoomMeetingId,
          batchId: zuvySessions.batchId,
          bootcampId: zuvySessions.bootcampId,
          invitedStudents: zuvySessions.invitedStudents,
          isZoomMeet: zuvySessions.isZoomMeet,
          startTime: zuvySessions.startTime,
          s3link: zuvySessions.s3link,
        })
        .from(zuvySessions)
        .where(
          and(
            or(
              eq(zuvySessions.status, 'completed'),
              // Checks if the current UTC time is greater than the stored endTime
              lt(sql`${zuvySessions.endTime}::timestamptz`, sql`now()`),
            ),
            eq(zuvySessions.isZoomMeet, true),
            notExists(
              db
                .select()
                .from(zuvyStudentAttendance)
                .where(
                  eq(zuvyStudentAttendance.meetingId, zuvySessions.meetingId),
                ),
            ),
          ),
        );
      this.logger.log(
        `Found ${completedZoomSessions.length} completed Zoom sessions for backfill ${completedZoomSessions}`,
      );
      if (completedZoomSessions.length !== 0) {
        // Sessions missing aggregated attendance
        const meetingIds = completedZoomSessions
          .map((s) => s.meetingId)
          .filter(Boolean);
        const existingAttendance = meetingIds.length
          ? await db
              .select({ meetingId: zuvyStudentAttendance.meetingId })
              .from(zuvyStudentAttendance)
              .where(inArray(zuvyStudentAttendance.meetingId, meetingIds))
          : [];
        const existingSet = new Set(existingAttendance.map((e) => e.meetingId));
        const sessionsMissingAttendance = completedZoomSessions.filter(
          (s) => !existingSet.has(s.meetingId),
        );

        // Step 1: DISCOVER attendance jobs (do NOT compute here).
        // Actual computation happens in AttendanceWorkerService, triggered
        // instantly by the Zoom meeting.ended webhook; this cron is only a
        // safety net for sessions whose webhook was missed.
        if (sessionsMissingAttendance.length) {
          for (const session of sessionsMissingAttendance) {
            if (!session.zoomMeetingId) continue;
            await db.execute(sql`
              INSERT INTO zuvy_session_attendance_jobs (
                session_id, zoom_meeting_id, batch_id, bootcamp_id
              )
              SELECT ${session.id}, ${session.zoomMeetingId}, ${session.batchId}, ${session.bootcampId}
              WHERE NOT EXISTS (
                SELECT 1
                FROM zuvy_session_attendance_jobs
                WHERE session_id = ${session.id}
                  AND zoom_meeting_id = ${session.zoomMeetingId}
              )
            `);
          }
          this.attendanceWorkerTrigger.triggerNow();
          this.logger.log(
            `Discovered ${sessionsMissingAttendance.length} attendance jobs`,
          );
        } else {
          this.logger.log('No sessions missing attendance');
        }
      }
      // Sessions missing recordings (s3link null or 'not found')
      let sessionS3linkNull = await db
        .select({
          id: zuvySessions.id,
          s3link: zuvySessions.s3link,
          meetingId: zuvySessions.meetingId,
        })
        .from(zuvySessions)
        .where(
          and(
            or(
              eq(zuvySessions.status, 'completed'),
              // Checks if the current UTC time is greater than the stored endTime
              lt(sql`${zuvySessions.endTime}::timestamptz`, sql`now()`),
            ),
            eq(zuvySessions.isZoomMeet, true),
            isNull(zuvySessions.s3link),
          ),
        );
      // list the zuvySessions collect the meetingId for the sessionS3linkNull i want output as a array
      const sessionS3linkNullArray = sessionS3linkNull.map((s) => s.meetingId);

      // Step 2: fetch recordings for sessionsMissingRecordings
      // if (sessionS3linkNullArray.length) {
      //   await this.fetchAndStoreRecordingsForSessions(sessionS3linkNullArray);
      // } else {
      //   this.logger.log('No sessions missing recordings');
      // }
      // Step 2: DISCOVER recordings (do NOT process)
      if (sessionS3linkNullArray.length) {
        for (const meetingId of sessionS3linkNullArray) {
          const session = completedZoomSessions.find(
            (s) => s.meetingId === meetingId || s.zoomMeetingId === meetingId,
          );
          if (!session?.zoomMeetingId) continue;

          await db.execute(sql`
            INSERT INTO zuvy_session_recordings (session_id, zoom_meeting_id)
            SELECT ${session.id}, ${session.zoomMeetingId}
            WHERE NOT EXISTS (
              SELECT 1
              FROM zuvy_session_recordings
              WHERE session_id = ${session.id}
                AND zoom_meeting_id = ${session.zoomMeetingId}
            )
          `);
        }
        this.logger.log(
          `Discovered ${sessionS3linkNullArray.length} recording jobs`,
        );
      } else {
        this.logger.log('No sessions missing recordings');
      }
    } catch (error: any) {
      this.logger.error(
        `Unexpected error in backfillInvitedStudentsAttendanceMidnight: ${error.message}`,
      );
    }
  }

  // Helper: download video to temp
  private async downloadVideoToTemp(
    downloadUrl: string,
    fileId: string,
  ): Promise<string> {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${fileId}.mp4`);
    const writer = fs.createWriteStream(filePath);

    return new Promise(async (resolve, reject) => {
      try {
        const response = await axios({
          method: 'get',
          url: downloadUrl,
          responseType: 'stream',
          maxRedirects: 5,
        });

        if (
          (response.headers['content-type'] || '').includes('application/json')
        ) {
          let errData = '';
          response.data.on('data', (c: any) => (errData += c));
          response.data.on('end', () =>
            reject(new Error(`Zoom returned JSON error: ${errData}`)),
          );
          return;
        }

        response.data.pipe(writer);
        writer.on('finish', () => resolve(filePath));
        writer.on('error', (err) => reject(err));
        response.data.on('error', (err: any) => {
          writer.end();
          reject(err);
        });
      } catch (err: any) {
        reject(err);
      }
    });
  }

  // Helper: upload file to YouTube and return video id
  private async uploadToYouTube(
    filePath: string,
    title: string,
  ): Promise<string> {
    const fileSize = fs.statSync(filePath).size;
    const res = await this.youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: {
            title,
            description: 'Automated session recording upload',
            tags: ['session', 'recording'],
          },
          status: { privacyStatus: 'unlisted' },
        },
        media: { body: fs.createReadStream(filePath) },
      },
      {
        onUploadProgress: (evt: any) => {
          const progress = (evt.bytesRead / fileSize) * 100;
          this.logger.log(`YouTube upload ${Math.round(progress)}%`);
        },
      },
    );
    return res.data.id;
  }

  // Handle single session: fetch Zoom recording playable/download URL, download, upload to YouTube and update DB
  private async handleSingleRecording() {
    throw new Error(
      'handleSingleRecording is deprecated. RecordingWorkerService owns this logic.',
    );
  }

  // private async handleSingleRecording(
  //   sessionId: number,
  //   meetingId: string | number,
  //   title?: string,
  // ) {
  //   this.logger.log(`Processing session ${sessionId} (meetingId=${meetingId})`);
  //   try {
  //     const recResp = await this.zoomService.getZoomRecordingFiles(meetingId);
  //     const videoFile = recResp.recording_files.find(
  //       (file) =>
  //         file.file_type === 'MP4' &&
  //         file.recording_type.includes('shared_screen_with_speaker_view'),
  //     );
  //     const uuid = recResp.uuid;
  //     if (!videoFile) {
  //       this.logger.warn(
  //         `No suitable MP4 recording found for Zoom ID ${meetingId}. Marking as 'not_found'.`,
  //       );
  //       await db
  //         .update(zuvySessions)
  //         .set({ s3link: null } as any)
  //         .where(eq(zuvySessions.id, sessionId));
  //       return;
  //     }

  //     // 2. Download the video to a temporary file
  //     const fileId = `${meetingId}_${Date.now()}`;
  //     const tempPath = await this.downloadVideoToTemp(
  //       videoFile.download_url,
  //       videoFile.id,
  //     );
  //     try {
  //       const videoTitle = title ?? `Session Recording - ${meetingId}`;
  //       const ytId = await this.uploadToYouTube(tempPath, videoTitle);
  //       if (!ytId) {
  //         throw new Error('YouTube upload returned no video ID');
  //       }
  //       const youTubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
  //       await db
  //         .update(zuvySessions)
  //         .set({
  //           s3link: youTubeUrl,
  //           youtubeVideoId: ytId,
  //           status: 'completed',
  //         } as any)
  //         .where(eq(zuvySessions.id, sessionId));
  //       this.logger.log(`Stored YouTube URL and ID for session ${sessionId}`);

  //       // 5. Delete the recording from Zoom Cloud
  //       await this.zoomService.deleteFromZoomCloud(uuid, videoFile.id);
  //       this.logger.log(
  //         `Successfully deleted recording from Zoom for meeting ${meetingId}.`,
  //       );
  //     } finally {
  //       try {
  //         fs.unlinkSync(tempPath);
  //       } catch (e) {
  //         /* ignore */
  //       }
  //     }
  //   } catch (e: any) {
  //     this.logger.error(
  //       `Failed handling recording for session ${sessionId}: ${e.message}`,
  //     );
  //     // mark as null to avoid retries if permanent
  //     try {
  //       await db
  //         .update(zuvySessions)
  //         .set({ s3link: null, youtubeVideoId: null } as any)
  //         .where(eq(zuvySessions.id, sessionId));
  //     } catch (_) {}
  //   }
  // }

  // Helper: fetch recordings and update session s3link for provided sessions

  private async fetchAndStoreRecordingsForSessions() {
    this.logger.warn(
      'fetchAndStoreRecordingsForSessions is deprecated and should not be called',
    );
  }

  // private async fetchAndStoreRecordingsForSessions(
  //   sessionsMissingRecordings: any[],
  // ) {
  //   try {
  //     // Accept either array of meetingIds or array of session objects
  //     const meetingIds = (sessionsMissingRecordings || [])
  //       .map((s: any) =>
  //         s && typeof s === 'object' ? s.zoomMeetingId ?? s.meetingId : s,
  //       )
  //       .filter(Boolean);

  //     if (!meetingIds.length) {
  //       this.logger.log('No meetingIds to fetch recordings for');
  //       return;
  //     }

  //     // Load sessions from DB that match the meetingIds and still need s3link
  //     const sessionsToProcess = await db
  //       .select({
  //         id: zuvySessions.id,
  //         meetingId: zuvySessions.meetingId,
  //         zoomMeetingId: zuvySessions.zoomMeetingId,
  //         title: zuvySessions.title,
  //       })
  //       .from(zuvySessions)
  //       .where(
  //         and(
  //           inArray(zuvySessions.meetingId, meetingIds),
  //           or(
  //             isNull(zuvySessions.s3link),
  //             eq(zuvySessions.s3link, 'not found'),
  //           ),
  //         ),
  //       );

  //     if (!sessionsToProcess.length) {
  //       this.logger.log(
  //         'No sessions found matching provided meetingIds to process',
  //       );
  //       return;
  //     }

  //     for (const session of sessionsToProcess) {
  //       await this.handleSingleRecording(
  //         Number(session.id),
  //         session.zoomMeetingId || session.meetingId,
  //         session.title,
  //       );
  //     }
  //   } catch (err: any) {
  //     this.logger.error(
  //       `Error in fetchAndStoreRecordingsForSessions: ${err.message}`,
  //     );
  //   }
  // }

  // TEMP — LOCAL TEST ONLY
  async manualCronTest() {
    await this.backfillInvitedStudentsAttendanceMidnight();
  }
}
