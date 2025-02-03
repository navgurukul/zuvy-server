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
import pLimit from 'p-limit';

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

  // Run every 10 minutes but control actual execution
  @Cron('*/10 * * * *')
  async handleDynamicScheduling() {
    if (this.processingActive) {
      this.logger.log('Skipping: Previous job still running');
      return;
    }

    try {
      this.processingActive = true;
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(now);
      endOfDay.setHours(23, 59, 59, 999);

      // Get today's sessions
      const sessions = await db.select()
        .from(zuvySessions)
        .where(and(
          isNull(zuvySessions.s3link),
          gte(zuvySessions.startTime, startOfDay.toISOString()),
          lt(zuvySessions.startTime, endOfDay.toISOString())
        ));

      // Determine processing interval
      const sessionCount = sessions.length;
      const timeSinceLastRun = now.getTime() - this.lastProcessedTime.getTime();
      
      const shouldProcess =
        sessionCount === 1
          ? timeSinceLastRun >= 50 * 60 * 1000 // 50 min interval for sessionCount == 1
          : sessionCount >= 2 && sessionCount <= 6
          ? timeSinceLastRun >= 30 * 60 * 1000 // 30 min interval for sessionCount 2-6
          : sessionCount >= 7 && sessionCount <= 13
          ? timeSinceLastRun >= 20 * 60 * 1000 // 20 min interval for sessionCount 7-13
          : sessionCount >= 14 && sessionCount <= 19
          ? timeSinceLastRun >= 15 * 60 * 1000 // 15 min interval for sessionCount 14-19
          : sessionCount >= 10 && sessionCount <= 25
          ? timeSinceLastRun >= 20 * 60 * 1000 // 10 min interval for sessionCount 20-25
          : sessionCount >= 7 && sessionCount <= 31
          ? timeSinceLastRun >= 4 * 60 * 1000 // 4 min interval for sessionCount 26-31
          : timeSinceLastRun >= 2 * 60 * 1000; // 2 min interval for sessionCount > 31 (default)
          
      if (!shouldProcess) {
        this.logger.log(`Skipping processing - Session count: ${sessionCount}, Last run: ${Math.floor(timeSinceLastRun/60000)} mins ago`);
        return;
      }

      await this.processSessions(sessions);
      this.lastProcessedTime = new Date();
    } catch (error) {
      this.logger.error(`Scheduling error: ${error.message}`);
    } finally {
      this.processingActive = false;
    }
  }

  private async processSessions(sessions: any[]) {
    const concurrencyLimit = pLimit(3); // Process 3 sessions concurrently
    const processingPromises = sessions.map(session => 
      concurrencyLimit(() => this.processSingleSession(session))
    );

    await Promise.all(processingPromises);
    this.logger.log(`Processed ${sessions.length} sessions with concurrency control`);
  }

  private async processSingleSession(session: any) {
    try {
      // Update Google Drive link
      const userTokenData = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userEmail, session.creator));

      if (!userTokenData.length) {
        this.logger.warn(`No tokens found for creator: ${session.creator}`);
        return;
      }

      auth2Client.setCredentials({
        access_token: userTokenData[0].accessToken,
        refresh_token: userTokenData[0].refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });
      
      if (session.meetingId) {
        const eventDetails = await calendar.events.get({
          calendarId: 'primary',
          eventId: session.meetingId,
        });

        if (eventDetails.data.attachments) {
          const videoAttachment = eventDetails.data.attachments.find(
            (a: any) => a.mimeType === 'video/mp4'
          );

          if (videoAttachment) {
            let updateData:any = { s3link: videoAttachment.fileUrl }
            await db
              .update(zuvySessions)
              .set(updateData)
              .where(eq(zuvySessions.id, session.id));
          }
        }

        // Update attendance
        await this.getAttendanceByBatchId(session.batchId, session.creator);

        // Handle old sessions
        if (new Date(session.startTime) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
          let updateData:any = { s3link: 'not found' }
          await db
            .update(zuvySessions)
            .set(updateData)
            .where(eq(zuvySessions.id, session.id));
        }
      }
    } catch (error) {
      this.logger.error(`Session ${session.id} error: ${error.message}`);
    }
  }

  // Modified getAttendanceByBatchId from previous implementation
  private async getAttendanceByBatchId(batchId: string, creatorEmail: string) {
    try {
      const fetchedStudents = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, Number(batchId)));

      const userData = await db
        .select()
        .from(users)
        .where(eq(users.email, creatorEmail));

      if (!userData.length) {
        this.logger.warn(`No user found for email: ${creatorEmail}`);
        return;
      }

      const fetchedTokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, Number(userData[0].id)));

      if (!fetchedTokens || fetchedTokens.length === 0) {
        return { status: 'error', message: 'Unable to fetch tokens' };
      }
      const auth2Client = new google.auth.OAuth2();
      auth2Client.setCredentials({
        access_token: fetchedTokens[0].accessToken,
        refresh_token: fetchedTokens[0].refreshToken,
      });

      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      const allMeetings = await db
        .select()
        .from(zuvySessions)
        .where(eq(zuvySessions.batchId, Number(batchId)));
      const attendanceByTitle = {};

      for (const singleMeeting of allMeetings) {
        const response = await client.activities.list({
          userKey: 'all',
          applicationName: 'meet',
          eventName: 'call_ended',
          maxResults: 1000,
          filters: `calendar_event_id==${singleMeeting.meetingId}`,
        });

        const meetingAttendance = {};

        for (const student of fetchedStudents) {
          const emailFetched = await db
            .select()
            .from(users)
            .where(sql`${users.id} = ${student.userId}`);
          meetingAttendance[emailFetched[0].email] = {
            email: emailFetched[0].email,
          };
        }

        const extractedData = response.data.items.map((item) => {
          const event = item.events[0];
          const durationSeconds =
            event.parameters.find((param) => param.name === 'duration_seconds')
              ?.intValue || '';
          const email =
            event.parameters.find((param) => param.name === 'identifier')
              ?.value || '';
          const attendanceStatus = durationSeconds ? 'present' : 'absent';
          if (!meetingAttendance[email]) {
            meetingAttendance[email] = {};
          }

          meetingAttendance[email][
            `meeting_${singleMeeting.title}_duration_seconds`
          ] = durationSeconds;
          meetingAttendance[email][
            `meeting_${singleMeeting.title}_attendance`
          ] = attendanceStatus;

          return {
            email,
            duration: durationSeconds,
            attendance: attendanceStatus,
          };
        });

        Object.values(meetingAttendance).forEach((student) => {
          const email = student['email'];
          if (!attendanceByTitle[email]) {
            attendanceByTitle[email] = {};
          }
          Object.assign(attendanceByTitle[email], student);
        });
      }

      const formattedAttendance = Object.values(attendanceByTitle);
      return { attendanceByTitle: formattedAttendance, status: 'success' };
    } catch (error) {
      throw new Error(`Error executing request: ${error.message}`);
    }
  }
}
