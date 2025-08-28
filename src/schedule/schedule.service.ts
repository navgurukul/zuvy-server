import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  userTokens,
  zuvySessions,
  zuvyBatchEnrollments,
  users,
  zuvyStudentAttendance,
  zuvyStudentAttendanceRecords,
  zuvyOutsourseAssessments
} from '../../drizzle/schema';
import { db } from '../db/index';
import { eq, sql, isNull, and, gte, lt, inArray, or, notExists, gt } from 'drizzle-orm';
import { google } from 'googleapis';
import { ClassesService } from '../controller/classes/classes.service';
import { ZoomService } from '../services/zoom/zoom.service';
import { TrackingService } from '../controller/progress/tracking.service';
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
    private readonly trackingService: TrackingService
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
    } catch (e:any) {
      this.logger.warn(`Failed to initialize YouTube client: ${e.message}`);
    }
  }

  @Cron('0 */6 * * *')
  async backfillInvitedStudentsAttendanceMidnight() {
    this.logger.log('Midnight cron: Backfilling attendance & recordings (orchestrator)');
    try {
      // Fetch completed Zoom sessions (regardless of s3link)
      const completedZoomSessions = await db
        .select({ id: zuvySessions.id, meetingId: zuvySessions.meetingId, zoomMeetingId: zuvySessions.zoomMeetingId, batchId: zuvySessions.batchId, bootcampId: zuvySessions.bootcampId, invitedStudents: zuvySessions.invitedStudents, isZoomMeet: zuvySessions.isZoomMeet, startTime: zuvySessions.startTime, s3link: zuvySessions.s3link })
        .from(zuvySessions)
        .where(and(or(
            eq(zuvySessions.status, 'completed'),
            // Checks if the current UTC time is greater than the stored endTime
            lt(sql`${zuvySessions.endTime}::timestamptz`, sql`now()`)
        ), eq(zuvySessions.isZoomMeet, true), notExists(
            db.select()
              .from(zuvyStudentAttendance)
              .where(eq(zuvyStudentAttendance.meetingId, zuvySessions.meetingId))
          )));
      this.logger.log(`Found ${completedZoomSessions.length} completed Zoom sessions for backfill ${completedZoomSessions}`);
      if (completedZoomSessions.length !== 0) {
      // Sessions missing aggregated attendance
      const meetingIds = completedZoomSessions.map(s => s.meetingId).filter(Boolean);
      const existingAttendance = meetingIds.length
        ? await db.select({ meetingId: zuvyStudentAttendance.meetingId }).from(zuvyStudentAttendance).where(inArray(zuvyStudentAttendance.meetingId, meetingIds))
        : [];
      const existingSet = new Set(existingAttendance.map(e => e.meetingId));
      const sessionsMissingAttendance = completedZoomSessions.filter(s => !existingSet.has(s.meetingId));

      // Step 1: backfill attendance for sessionsMissingAttendance
      if (sessionsMissingAttendance.length) {
        await this.backfillAttendanceForSessions(sessionsMissingAttendance);
      } else {
        this.logger.log('No sessions missing attendance');
      }
    }
      // Sessions missing recordings (s3link null or 'not found')
      let sessionS3linkNull = await db
        .select({ id: zuvySessions.id, s3link: zuvySessions.s3link, meetingId: zuvySessions.meetingId })
        .from(zuvySessions)
        .where(and(or(
            eq(zuvySessions.status, 'completed'),
            // Checks if the current UTC time is greater than the stored endTime
            lt(sql`${zuvySessions.endTime}::timestamptz`, sql`now()`)
        ), eq(zuvySessions.isZoomMeet, true), isNull(zuvySessions.s3link)));
      // list the zuvySessions collect the meetingId for the sessionS3linkNull i want output as a array
      const sessionS3linkNullArray = sessionS3linkNull.map(s => s.meetingId);
      

      // Step 2: fetch recordings for sessionsMissingRecordings
      if (sessionS3linkNullArray.length) {
        await this.fetchAndStoreRecordingsForSessions(sessionS3linkNullArray);
      } else {
        this.logger.log('No sessions missing recordings');
      }
    } catch (error:any) {
      this.logger.error(`Unexpected error in backfillInvitedStudentsAttendanceMidnight: ${error.message}`);
    }
  }

  // Helper: compute attendance and insert aggregated + per-student records for provided sessions
  private async backfillAttendanceForSessions(sessionsMissingAttendance: any[]) {
    try {
      const zoomIds = sessionsMissingAttendance.map(s => s.zoomMeetingId).filter(Boolean);
      if (!zoomIds.length) {
        this.logger.log('No zoomMeetingIds to backfill for attendance');
        return;
      }
      this.logger.log(`Backfilling attendance for ${zoomIds.length} Zoom meetings`);
      const compute = await this.zoomService.computeAttendance75(zoomIds as any);
      const computeAny: any = compute;
      if (!computeAny.success) {
        this.logger.error(`computeAttendance75 failed (batch): ${computeAny.error}`);
        return;
      }

      // Normalize compute results
      let resultsArray: any[] = [];
      if (Array.isArray(computeAny.data)) resultsArray = computeAny.data;
      else if (computeAny.data && Array.isArray((computeAny.data as any).data)) resultsArray = (computeAny.data as any).data;
      else if (computeAny.data) resultsArray = [computeAny.data];

      // Pre-build map
      const sessionsByZoomId = new Map<string | number, any>();
      for (const s of sessionsMissingAttendance) sessionsByZoomId.set(s.zoomMeetingId as any, s);

      // Prefetch existing per-session student records
      const sessionIdList = sessionsMissingAttendance.map(s => s.id);
      const existingRecordsRaw = sessionIdList.length
        ? await db.select({ sessionId: zuvyStudentAttendanceRecords.sessionId, userId: zuvyStudentAttendanceRecords.userId })
            .from(zuvyStudentAttendanceRecords)
            .where(inArray(zuvyStudentAttendanceRecords.sessionId, sessionIdList))
        : [];
      const existingRecordsMap = new Map<number, Set<any>>();
      for (const r of existingRecordsRaw) {
        const sid = Number((r as any).sessionId);
        const set = existingRecordsMap.get(sid) ?? new Set<number>();
        set.add((r as any).userId as any);
        existingRecordsMap.set(sid, set);
      }

      const perStudentRecords: any[] = [];

      for (const result of resultsArray) {
        const meetingKey = result?.data?.meetingId ?? result.meetingId;
        const meetingIdMatch = sessionsByZoomId.get(meetingKey);
        if (!meetingIdMatch) continue;
        try {
          await db.insert(zuvyStudentAttendance).values({
            meetingId: meetingIdMatch.meetingId,
            attendance: result.data.attendance,
            batchId: meetingIdMatch.batchId,
            bootcampId: meetingIdMatch.bootcampId
          }).catch(() => null);

          const invited = Array.isArray(meetingIdMatch.invitedStudents) ? meetingIdMatch.invitedStudents : [];
          const invitedByEmail = new Map(invited.map((i: any) => [(i.email || '').toLowerCase(), i]));
          const attendanceArray = Array.isArray(result.data.attendance) ? result.data.attendance : [];
          const sessionDate = meetingIdMatch.startTime ? new Date(meetingIdMatch.startTime) : new Date();

          const existingUserSet = existingRecordsMap.get(meetingIdMatch.id) ?? new Set<any>();
          const addedUserSet = new Set<any>();

          for (const att of attendanceArray) {
            const email = (att.email || '').toLowerCase();
            const invitedInfo: any = invitedByEmail.get(email);
            if (!invitedInfo || !invitedInfo.userId) continue;
            const uid = invitedInfo.userId;
            if (existingUserSet.has(uid) || addedUserSet.has(uid)) continue;
            addedUserSet.add(uid);
            perStudentRecords.push({
              userId: uid,
              batchId: meetingIdMatch.batchId,
              bootcampId: meetingIdMatch.bootcampId,
              sessionId: meetingIdMatch.id,
              attendanceDate: sessionDate,
              status: att.attendance === 'present' ? 'present' : 'absent',
              duration: att.duration || 0
            });
          }
        } catch (innerErr:any) {
          this.logger.warn(`Failed to process attendance for meeting ${meetingKey}: ${innerErr?.message ?? innerErr}`);
        }
      }

      // Bulk insert per-student records
      if (perStudentRecords.length) {
        const CHUNK_SIZE = 1000;
        for (let i = 0; i < perStudentRecords.length; i += CHUNK_SIZE) {
          const slice = perStudentRecords.slice(i, i + CHUNK_SIZE);
          try {
            await db.insert(zuvyStudentAttendanceRecords).values(slice);
          } catch (bulkErr:any) {
            this.logger.error(`Bulk insert failure for records ${i}-${i+slice.length-1}: ${bulkErr.message}`);
          }
        }
        this.logger.log(`Inserted ${perStudentRecords.length} per-student attendance records.`);
        try {
          const affectedBatchIds = Array.from(new Set(perStudentRecords.map(r => r.batchId).filter(Boolean)));
          for (const bid of affectedBatchIds) {
            await this.trackingService.recomputeBatchAttendancePercentages(bid as number);
          }
        } catch (recErr:any) {
          this.logger.warn(`Failed to recompute attendance percentages after backfill: ${recErr.message}`);
        }
      }
    } catch (err:any) {
      this.logger.error(`Error in backfillAttendanceForSessions: ${err.message}`);
    }
  }

  // Helper: download video to temp
  private async downloadVideoToTemp(downloadUrl: string, fileId: string): Promise<string> {
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `${fileId}.mp4`);
    const writer = fs.createWriteStream(filePath);

    return new Promise(async (resolve, reject) => {
      try {
        const response = await axios({ method: 'get', url: downloadUrl, responseType: 'stream', maxRedirects: 5 });

        if ((response.headers['content-type'] || '').includes('application/json')) {
          let errData = '';
          response.data.on('data', (c: any) => errData += c);
          response.data.on('end', () => reject(new Error(`Zoom returned JSON error: ${errData}`)));
          return;
        }

        response.data.pipe(writer);
        writer.on('finish', () => resolve(filePath));
        writer.on('error', (err) => reject(err));
        response.data.on('error', (err: any) => { writer.end(); reject(err); });
      } catch (err:any) {
        reject(err);
      }
    });
  }

  // Helper: upload file to YouTube and return video id
  private async uploadToYouTube(filePath: string, title: string): Promise<string> {
    const fileSize = fs.statSync(filePath).size;
    const res = await this.youtube.videos.insert(
      {
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title, description: 'Automated session recording upload', tags: ['session', 'recording'] },
          status: { privacyStatus: 'unlisted' }
        },
        media: { body: fs.createReadStream(filePath) }
      },
      { onUploadProgress: (evt: any) => { const progress = (evt.bytesRead / fileSize) * 100; this.logger.log(`YouTube upload ${Math.round(progress)}%`); } }
    );
    return res.data.id;
  }

  // Handle single session: fetch Zoom recording playable/download URL, download, upload to YouTube and update DB
  private async handleSingleRecording(sessionId: number, meetingId: string | number, title?: string) {
    this.logger.log(`Processing session ${sessionId} (meetingId=${meetingId})`);
    try {
      const recResp = await this.zoomService.getZoomRecordingFiles(meetingId);
      const videoFile = recResp.recording_files.find(
      (file) => file.file_type === 'MP4' && file.recording_type.includes('shared_screen_with_speaker_view')
    );
    const uuid = recResp.uuid;
      if (!videoFile) {
      this.logger.warn(`No suitable MP4 recording found for Zoom ID ${meetingId}. Marking as 'not_found'.`);
      await db.update(zuvySessions).set({ s3link: null } as any).where(eq(zuvySessions.id, sessionId));
      return;
    }

    // 2. Download the video to a temporary file
      const fileId = `${meetingId}_${Date.now()}`;
      const tempPath =  await this.downloadVideoToTemp(videoFile.download_url, videoFile.id);
      try {
        const videoTitle = title ?? `Session Recording - ${meetingId}`;
        const ytId = await this.uploadToYouTube(tempPath, videoTitle);
        if (!ytId) {
        throw new Error('YouTube upload returned no video ID');
      }
        const youTubeUrl = `https://www.youtube.com/watch?v=${ytId}`;
        await db.update(zuvySessions).set({ s3link: youTubeUrl, youtubeVideoId: ytId , status: 'completed'} as any).where(eq(zuvySessions.id, sessionId));
        this.logger.log(`Stored YouTube URL and ID for session ${sessionId}`);

        // 5. Delete the recording from Zoom Cloud
      await this.zoomService.deleteFromZoomCloud(uuid, videoFile.id);
      this.logger.log(`Successfully deleted recording from Zoom for meeting ${meetingId}.`);
      } finally {
        try { fs.unlinkSync(tempPath); } catch (e) { /* ignore */ }
      }
    } catch (e:any) {
      this.logger.error(`Failed handling recording for session ${sessionId}: ${e.message}`);
      // mark as null to avoid retries if permanent
      try { await db.update(zuvySessions).set({ s3link: null, youtubeVideoId: null } as any).where(eq(zuvySessions.id, sessionId)); } catch (_) {}
    }
  }

  // Helper: fetch recordings and update session s3link for provided sessions
  private async fetchAndStoreRecordingsForSessions(sessionsMissingRecordings: any[]) {
    try {
      // Accept either array of meetingIds or array of session objects
      const meetingIds = (sessionsMissingRecordings || [])
        .map((s: any) => (s && typeof s === 'object') ? (s.zoomMeetingId ?? s.meetingId) : s)
        .filter(Boolean);

      if (!meetingIds.length) {
        this.logger.log('No meetingIds to fetch recordings for');
        return;
      }

      // Load sessions from DB that match the meetingIds and still need s3link
      const sessionsToProcess = await db
        .select({ id: zuvySessions.id, meetingId: zuvySessions.meetingId, zoomMeetingId: zuvySessions.zoomMeetingId, title: zuvySessions.title })
        .from(zuvySessions)
        .where(and(inArray(zuvySessions.meetingId, meetingIds), or(isNull(zuvySessions.s3link), eq(zuvySessions.s3link, 'not found'))));

      if (!sessionsToProcess.length) {
        this.logger.log('No sessions found matching provided meetingIds to process');
        return;
      }

      for (const session of sessionsToProcess) {
        await this.handleSingleRecording(Number(session.id), session.zoomMeetingId || session.meetingId, session.title);
      }
    } catch (err:any) {
      this.logger.error(`Error in fetchAndStoreRecordingsForSessions: ${err.message}`);
    }
  }
}
