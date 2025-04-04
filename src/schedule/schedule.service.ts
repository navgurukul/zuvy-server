import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  userTokens,
  zuvySessions,
  zuvyBatchEnrollments,
  users,
  zuvyStudentAttendance
} from '../../drizzle/schema';
import { db } from '../db/index';
import { eq, sql, isNull, and, gte, lt } from 'drizzle-orm';
import { google } from 'googleapis';

const { OAuth2 } = google.auth;
const auth2Client = new OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_SECRET,
  process.env.GOOGLE_REDIRECT
);

@Injectable()
export class ScheduleService {
  private readonly logger = new Logger(ScheduleService.name);
  private lastProcessedTime: Date = new Date(0);
  private processingActive = false;
  private currentInterval: number;
  private timeoutId: NodeJS.Timeout;
  private conditions:any = [
    { min: 0, max: 1, interval: 200 * 60 * 1000 }, // 200 minutes
    { min: 2, max: 5, interval: 100 * 60 * 1000 }, // 100 minutes
    { min: 6, max: 9, interval: 60 * 60 * 1000 },  // 60 minutes
    { min: 10, max: 19, interval: 30 * 60 * 1000 },  // 30 minutes
    { min: 20, max: 25, interval: 20 * 60 * 1000 }, // 20 minutes
    { min: 26, max: 31, interval: 10 * 60 * 1000 }, // 10 minutes
  ];

  constructor() {
    // Initialize the interval when the service starts
    this.handleDynamicScheduling();
  }

  @Cron('0 */6 * * *') // Runs every 6 hours
  async handleDynamicScheduling() {
    this.logger.log('Running main function to determine interval');
    if (this.processingActive) {
      this.logger.log('Skipping: Previous job still running');
      return;
    }

    this.processingActive = true;
    try {
      const now = new Date();
      const [startOfDay, endOfDay] = this.getDayBounds(now);
      const sessions = await this.fetchSessions(startOfDay, endOfDay);
      this.logger.log(`Fetched ${sessions.length} sessions`);
      const shouldProcess = this.shouldProcessSessions(sessions.length, now);
      if (!shouldProcess) {
        this.logger.log(
          `Skipping processing - Session count: ${sessions.length}, Last run: ${Math.floor(
            (now.getTime() - this.lastProcessedTime.getTime()) / 60000
          )} mins ago`
        );
        return;
      }

      // Determine the interval based on session count
      this.currentInterval = this.getIntervalBasedOnSessionCount(sessions.length);
      this.logger.log(`Setting interval to ${this.currentInterval / 60000} minutes`);

      // Clear any existing timeout
      this.resetTimeout();
      // Start the recursive timeout
      this.startRecursiveTimeout(sessions);

      this.lastProcessedTime = now;
    } catch (error) {
      this.logger.error(`Scheduling error: ${error.message}`);
    } finally {
      this.processingActive = false;
    }
  }

  private getDayBounds(date: Date): [Date, Date] {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(24, 59, 59, 999);
    return [startOfDay, endOfDay];
  }

  private async fetchSessions(startOfDay: Date, endOfDay: Date) {
    let red = await db.select()
      .from(zuvySessions)
      .where(
        and(
          isNull(zuvySessions.s3link),
          eq(zuvySessions.status, 'completed'),
          gte(zuvySessions.startTime, startOfDay.toISOString()),
          lt(zuvySessions.startTime, endOfDay.toISOString()),
        )
      );
    return red;
  }

  private shouldProcessSessions(sessionCount: number, now: Date): boolean {
    const timeSinceLastRun = now.getTime() - this.lastProcessedTime.getTime();
    for (const condition of this.conditions) {
        if (sessionCount >= condition.min && sessionCount <= condition.max) {
            return timeSinceLastRun >= condition.interval;
        }
    }

    // Default case if no conditions match
    return timeSinceLastRun >= 1 * 60 * 1000; // 1 minute
  }

  private getIntervalBasedOnSessionCount(sessionCount: number): number {
    for (const condition of this.conditions) {
      if (sessionCount >= condition.min && sessionCount <= condition.max) {
            return condition.interval;
        }
    }
    // Default case if no conditions match
    return 2 * 60 * 1000; // 1 minute
  }

  private resetTimeout() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.logger.log('Previous timeout cleared');
    }
  }

  private startRecursiveTimeout(sessions: any[]) {
    this.timeoutId = setTimeout(async () => {
      try {
        await this.processSessions(sessions);
      } catch (error) {
        this.logger.error(`Error processing sessions: ${error}`);
      }
      this.startRecursiveTimeout(sessions); // Recursively call itself
    }, this.currentInterval);
  }

  private async processSessions(sessions: any[]) {
    this.logger.log(`Processing ${sessions.length} sessions with delayed execution`);
    let index = 0;

    const processNext = async () => {
      if (index >= sessions.length) {
        this.logger.log("All sessions processed");
        return;
      }
      const session = sessions[index];
      index++;
      try {
        await this.processSingleSession(session);
      } catch (error) {
        this.logger.error(`Error processing session: ${error}`);
      }

      setTimeout(processNext, 1000); // Delay of 1 second between each session
    };

    processNext();
  }

  private async processSingleSession(session: any) {
    try {
      if (!session) {
        return;
      }
      const userTokenData = await this.getUserTokens(session.creator);
      if (!userTokenData) {
        this.logger.warn(`No tokens found for creator: ${session.creator}`);
        return;
      }

      auth2Client.setCredentials({
        access_token: userTokenData.accessToken,
        refresh_token: userTokenData.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });
      if (session.meetingId && session.status === 'completed') {
        await this.updateSessionLink(calendar, session);
        await this.handleOldSessions(session);
        let oldAttendance = await db.select().from(zuvyStudentAttendance).where(eq(zuvyStudentAttendance.meetingId, session.meetingId));
        if (oldAttendance.length > 0) {
          let [errAtten, dataAttendance] = await this.getAttendanceByBatchId(session.batchId, session.creator);
          if (errAtten) {
            this.logger.error(`Attendance error: ${errAtten}`);
          } 
          this.logger.log(`Attendance: ${JSON.stringify(dataAttendance)}`);
          if (Array.isArray(dataAttendance)) {
            this.logger.error(`Attendance error: ${dataAttendance}`);
          } else if ('data' in dataAttendance) {
            await db.insert(zuvyStudentAttendance).values({attendance: dataAttendance.data, meetingId: session.meetingId, batchId: session.batchId, bootcampId: session.bootcampId }).execute();
          }
        }
      }
    } catch (error) {
      this.logger.error(`Session error: ${error}`);
    }
  }

  private async getUserTokens(email: string) {
    const result = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userEmail, email));
    return result.length ? result[0] : null;
  }

  private async updateSessionLink(calendar: any, session: any) {
    const eventDetails = await calendar.events.get({
      calendarId: 'primary',
      eventId: session.meetingId,
    });
    const videoAttachment = eventDetails.data.attachments?.find(
      (a: any) => a.mimeType === 'video/mp4'
    );
    if (videoAttachment) {
      let updateData: any = { s3link: videoAttachment.fileUrl };
      await db.update(zuvySessions)
        .set(updateData)
        .where(eq(zuvySessions.id, session.id));
    }
  }

  private async handleOldSessions(session: any) {
    if (new Date(session.startTime) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
      let updateData: any = { s3link: 'not found' };
      await db.update(zuvySessions)
        .set(updateData)
        .where(eq(zuvySessions.id, session.id));
    }
  }

  private async getAttendanceByBatchId(batchId: string, creatorEmail: string) {
    try {
      const students = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, Number(batchId)));

      const userData = await db.select().from(users).where(eq(users.email, creatorEmail));
      if (!userData.length) {
        this.logger.warn(`No user found for email: ${creatorEmail}`);
        return[{ status: 'error', message: 'User not found' }];
      }

      const tokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, Number(userData[0].id)));

      if (!tokens.length) return [{ status: 'error', message: 'Unable to fetch tokens' }];

      auth2Client.setCredentials({
        access_token: tokens[0].accessToken,
        refresh_token: tokens[0].refreshToken,
      });

      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      const meetings = await db
        .select()
        .from(zuvySessions)
        .where(and(eq(zuvySessions.batchId, Number(batchId)), eq(zuvySessions.status, 'completed')));

      const [errorAttendance, attendance] = await this.calculateAttendance(client, meetings, students);
      if (errorAttendance) return [errorAttendance];
      return [null,{ data: attendance, status: 'success' }];
    } catch (error) {
      throw new Error(`Error fetching attendance: ${error.message}`);
    }
  }

  private async calculateAttendance(client: any, meetings: any[], students: any[]) {
    const attendanceByTitle: Record<string, any> = {};

    for (const meeting of meetings) {
      const response = await client.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${meeting.meetingId}`,
      });

      const attendance = {};
      for (const student of students) {
        const user = await db
          .select()
          .from(users)
          .where(sql`${users.id} = ${student.userId}`);

        attendance[user[0].email] = { email: user[0].email };
      }
      let adminData;
      response.data.items?.forEach((item: any) => {
        const event = item.events[0];
        const email = event.parameters.find((param: any) => param.name === 'identifier')?.value || '';
        const duration = event.parameters.find((param: any) => param.name === 'duration_seconds')?.intValue || '';
        if (email.includes('@zuvy.org')){
          adminData = {email, duration};
        }
      });
      if (!adminData) return;

      response.data.items?.forEach((item: any) => {
        const event = item.events[0];
        const email = event.parameters.find((param: any) => param.name === 'identifier')?.value || '';
        const duration = event.parameters.find((param: any) => param.name === 'duration_seconds')?.intValue || '';
        const status = (duration >= 0.75 * adminData.duration) ? 'present' : 'absent';        
        if (!attendance[email]) attendance[email] = {};
        attendance[email][`duration`] = duration;
        attendance[email][`attendance`] = status;
      });


      Object.entries(attendance)?.forEach(([email, record]) => {
        if (!attendanceByTitle[email]) attendanceByTitle[email] = {};
        Object.assign(attendanceByTitle[email], record);
      });
    
    }
    let attendanceOfStudents = [];
    for (let student in attendanceByTitle){
      if (student.length > 0){
        attendanceOfStudents.push({...attendanceByTitle[student], email: student });
      }
    }
    return [null, attendanceOfStudents];
  }
}
