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
import { eq, sql, isNull, and, gte, lt, inArray, or } from 'drizzle-orm';
import { google } from 'googleapis';
import { ClassesService } from '../controller/classes/classes.service';
import { ZoomService } from '../services/zoom/zoom.service';
import { TrackingService } from '../controller/progress/tracking.service';

const { OAuth2 } = google.auth;
const auth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT
);

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name); 

  constructor(private readonly classesService: ClassesService, private readonly zoomService: ZoomService, private readonly trackingService: TrackingService) {}

  @Cron('0 */6 * * *')
  async backfillInvitedStudentsAttendanceMidnight() {
    this.logger.log('Midnight cron: Backfilling attendance & recordings (orchestrator)');
    try {
      // Fetch completed Zoom sessions (regardless of s3link)
      const completedZoomSessions = await db
        .select({ id: zuvySessions.id, meetingId: zuvySessions.meetingId, zoomMeetingId: zuvySessions.zoomMeetingId, batchId: zuvySessions.batchId, bootcampId: zuvySessions.bootcampId, invitedStudents: zuvySessions.invitedStudents, isZoomMeet: zuvySessions.isZoomMeet, startTime: zuvySessions.startTime, s3link: zuvySessions.s3link })
        .from(zuvySessions)
        .where(and(eq(zuvySessions.status, 'completed'), eq(zuvySessions.isZoomMeet, true)));

      if (!completedZoomSessions.length) {
        this.logger.log('No completed Zoom sessions found for backfill');
        return;
      }

      // Sessions missing aggregated attendance
      const meetingIds = completedZoomSessions.map(s => s.meetingId).filter(Boolean);
      const existingAttendance = meetingIds.length
        ? await db.select({ meetingId: zuvyStudentAttendance.meetingId }).from(zuvyStudentAttendance).where(inArray(zuvyStudentAttendance.meetingId, meetingIds))
        : [];
      const existingSet = new Set(existingAttendance.map(e => e.meetingId));
      const sessionsMissingAttendance = completedZoomSessions.filter(s => !existingSet.has(s.meetingId));

      // Sessions missing recordings (s3link null or 'not found')
      const sessionsMissingRecordings = completedZoomSessions.filter(s => !s.s3link || s.s3link === 'not found');

      // Step 1: backfill attendance for sessionsMissingAttendance
      if (sessionsMissingAttendance.length) {
        await this.backfillAttendanceForSessions(sessionsMissingAttendance);
      } else {
        this.logger.log('No sessions missing attendance');
      }

      // Step 2: fetch recordings for sessionsMissingRecordings
      if (sessionsMissingRecordings.length) {
        await this.fetchAndStoreRecordingsForSessions(sessionsMissingRecordings);
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

  // Helper: fetch recordings and update session s3link for provided sessions
  private async fetchAndStoreRecordingsForSessions(sessionsMissingRecordings: any[]) {
    try {
      const zoomIdsForRecordings = sessionsMissingRecordings.map(s => s.zoomMeetingId).filter(Boolean);
      if (!zoomIdsForRecordings.length) {
        this.logger.log('No zoomMeetingIds to fetch recordings for');
        return;
      }
      this.logger.log(`Fetching recordings for ${zoomIdsForRecordings.length} meetings`);
      const recResp: any = await this.zoomService.getMeetingRecordingsBatch(zoomIdsForRecordings as any);
      if (recResp && recResp.success && Array.isArray(recResp.data)) {
        for (const item of recResp.data) {
          const meetingZoomId = item.meetingId;
          const recordings = item.recordings || null;
          const match = sessionsMissingRecordings.find(s => s.zoomMeetingId === meetingZoomId);
          if (!match) continue;
          if (recordings) {
            try {
              await db.update(zuvySessions)
                .set({ s3link: recordings } as any)
                .where(and(eq(zuvySessions.id, match.id), or(isNull(zuvySessions.s3link), eq(zuvySessions.s3link, 'not found'))));
            } catch (uErr:any) {
              this.logger.warn(`Failed updating recording link for session ${match.id}: ${uErr?.message ?? uErr}`);
            }
          }
        }
      }
    } catch (err:any) {
      this.logger.error(`Error in fetchAndStoreRecordingsForSessions: ${err.message}`);
    }
  }
}
