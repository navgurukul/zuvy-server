import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  userTokens,
  zuvySessions,
  zuvyBatchEnrollments,
  users
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

  @Cron('0 */1 * * *')  
  async handleDynamicScheduling() {
    this.logger.log('Running dynamic scheduling');
    if (this.processingActive) {
      this.logger.log('Skipping: Previous job still running');
      return;
    }

    this.processingActive = true;
    try {
      const now = new Date();
      const [startOfDay, endOfDay] = this.getDayBounds(now);

      const sessions = await this.fetchSessions(startOfDay, endOfDay);
      sessions.length = 40;
      const shouldProcess = this.shouldProcessSessions(sessions.length, now);
      console.log({shouldProcess});
      if (!shouldProcess) {
        this.logger.log(
          `Skipping processing - Session count: ${sessions.length }, Last run: ${Math.floor(
            (now.getTime() - this.lastProcessedTime.getTime()) / 60000
          )} mins ago`
        );
        return;
      }

      await this.processSessions(sessions);
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
    endOfDay.setHours(23, 59, 59, 999);

    return [startOfDay, endOfDay];
  }

  private async fetchSessions(startOfDay: Date, endOfDay: Date) {
    return db.select()
      .from(zuvySessions)
      .where(
        and(
          isNull(zuvySessions.s3link),
          gte(zuvySessions.startTime, startOfDay.toISOString()),
          lt(zuvySessions.startTime, endOfDay.toISOString()),
        )
      );
  }

  private shouldProcessSessions(sessionCount: number, now: Date): boolean {
    const timeSinceLastRun = now.getTime() - this.lastProcessedTime.getTime();

    if (sessionCount === 1) return timeSinceLastRun >= 50 * 60 * 1000;
    if (sessionCount >= 2 && sessionCount <= 3) return timeSinceLastRun >= 30 * 60 * 1000;
    if (sessionCount >= 4 && sessionCount <= 6) return timeSinceLastRun >= 20 * 60 * 1000;
    if (sessionCount >= 7 && sessionCount <= 8) return timeSinceLastRun >= 15 * 60 * 1000;
    if (sessionCount >= 20 && sessionCount <= 25) return timeSinceLastRun >= 10 * 60 * 1000;
    if (sessionCount >= 26 && sessionCount <= 31) return timeSinceLastRun >= 4 * 60 * 1000;
    return timeSinceLastRun >= 2 * 60 * 1000;
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
        this.logger.error(`Error processing session ${session.id}: ${error.message}`);
      }

      setTimeout(processNext, 1000); // Delay of 1 second between each session
    };

    processNext();
  }

  private async processSingleSession(session: any) {
    try {
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
        await this.getAttendanceByBatchId(session.batchId, session.creator);
      }
    } catch (error) {
      this.logger.error(`Session ${session.id} error: ${error.message}`);
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
    console.log({videoAttachment});
    if (videoAttachment) {
      let updateData:any = { s3link: videoAttachment.fileUrl }
      await db.update(zuvySessions)
        .set(updateData)
        .where(eq(zuvySessions.id, session.id));
    }
  }

  private async handleOldSessions(session: any) {
    if (new Date(session.startTime) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
      let updateData:any =  { s3link: 'not found' }
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
        return;
      }

      const tokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, Number(userData[0].id)));

      if (!tokens.length) return { status: 'error', message: 'Unable to fetch tokens' };

      auth2Client.setCredentials({
        access_token: tokens[0].accessToken,
        refresh_token: tokens[0].refreshToken,
      });

      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      const meetings = await db
        .select()
        .from(zuvySessions)
        .where(eq(zuvySessions.batchId, Number(batchId)));

      const attendance = await this.calculateAttendance(client, meetings, students);
      return { attendanceByTitle: Object.values(attendance), status: 'success' };
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

      response.data.items.forEach((item: any) => {
        const event = item.events[0];
        const email = event.parameters.find((param: any) => param.name === 'identifier')?.value || '';
        const duration = event.parameters.find((param: any) => param.name === 'duration_seconds')?.intValue || '';
        const status = duration ? 'present' : 'absent';

        if (!attendance[email]) attendance[email] = {};
        attendance[email][`meeting_${meeting.title}_duration_seconds`] = duration;
        attendance[email][`meeting_${meeting.title}_attendance`] = status;
        console.log({email: attendance[email]})
      });

      Object.entries(attendance).forEach(([email, record]) => {
        if (!attendanceByTitle[email]) attendanceByTitle[email] = {};
        Object.assign(attendanceByTitle[email], record);
      });
    }

    return attendanceByTitle;
  }
}
