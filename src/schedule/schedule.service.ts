import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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

/**
 * ScheduleService - Automated session recording and attendance processing
 * 
 * This service automatically processes completed Zuvy sessions to:
 * 1. Fetch video recording links from Google Calendar
 * 2. Calculate student attendance based on Google Meet reports
 * 3. Update database with s3links and attendance data
 * 
 * Processing Schedule:
 * - Runs every 1 hour to process sessions
 * - Processes all completed sessions without s3link
 */
@Injectable()
export class ScheduleService {
  // Core service properties
  private readonly logger = new Logger(ScheduleService.name); 
  private processingActive = false; // Prevent concurrent processing
  
  constructor() {
    this.logger.log('ScheduleService initialized - will run every hour');
  }

  /**
   * Cron job that runs every hour to process sessions
   * Pattern: 0 * * * * (every hour at minute 0)
   */
@Cron('*/2 * * * *')  async processSessionsHourly() {
    this.logger.log('Hourly cron triggered: Starting session processing');
    
    if (this.processingActive) {
      this.logger.log('Skipping: Previous processing still active');
      return;
    }

    this.processingActive = true;
    try {
      // Fetch sessions that need processing
      const sessions = await this.fetchSessions();
      this.logger.log(`Found ${sessions.length} sessions to process`);
      
      if (sessions.length > 0) {
        await this.processSessions(sessions);
      } else {
        this.logger.log('No sessions to process');
      }
      
    } catch (error) {
      this.logger.error(`Error in hourly processing: ${error.message}`);
    } finally {
      this.processingActive = false;
    }
  }

  /**
   * Fetches sessions that need processing from database
   * Returns completed sessions without s3link (need video recording URL)
   */
  private async fetchSessions() {
    this.logger.log('Fetching sessions from database');
    let sessions = await db.select()
      .from(zuvySessions)
      .where(
        and(
          isNull(zuvySessions.s3link),
          eq(zuvySessions.status, 'completed')
        )
      );
    this.logger.log(`Found ${sessions.length} sessions matching criteria`);
    return sessions;
  }

  /**
   * Processes all sessions sequentially with 1-second delays
   * Prevents API rate limiting and ensures stable processing
   */
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

      // 1-second delay between sessions to avoid API rate limits
      setTimeout(processNext, 1000);
    };

    processNext();
  }

  /**
   * Processes a single session: updates s3link and calculates attendance
   * Main workflow: fetch tokens → update recording link → calculate attendance
   */
  private async processSingleSession(session: any) {
    try {
      if (!session) {
        return;
      }
      // Get OAuth2 tokens for the session creator
      const userTokenData = await this.getUserTokens(session.creator);
      if (!userTokenData) {
        this.logger.warn(`No tokens found for creator: ${session.creator}`);
        return;
      }

      // Set up Google API authentication
      auth2Client.setCredentials({
        access_token: userTokenData.accessToken,
        refresh_token: userTokenData.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });

      if (session.meetingId && session.status === 'completed') {
        // Step 1: Update session with recording link
        await this.updateSessionLink(calendar, session);
        // Step 2: Handle old sessions (mark as 'not found' if >3 days)
        await this.handleOldSessions(session);
        
        // Step 3: Calculate and store attendance if not already done
        const existing = await db
          .select()
          .from(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, session.meetingId));
        if (existing.length === 0) {
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

  /**
   * Retrieves OAuth2 tokens for a user by email
   * Required for Google API authentication
   */
  private async getUserTokens(email: string) {
    this.logger.log(`Fetching user tokens for email: ${email}`);
    const result = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userEmail, email));
    
    if (result.length) {
      this.logger.log(`Successfully found tokens for user: ${email}`);
    } else {
      this.logger.warn(`No tokens found for user: ${email}`);
    }
    return result.length ? result[0] : null;
  }

  /**
   * Updates session with video recording link from Google Calendar
   * Uses dual approach: OAuth2 first, then JWT with domain delegation if needed
   */
  private async updateSessionLink(calendar: any, session: any) {
    this.logger.log(`Starting updateSessionLink for session: ${session.id}, meetingId: ${session.meetingId}`);
    try {
      // 1. First check for recording using the existing calendar client
      this.logger.log(`Attempting to get calendar event details for meetingId: ${session.meetingId}`);
      const eventDetails = await calendar.events.get({
        calendarId: 'primary',
        eventId: session.meetingId,
      });
      const videoAttachment = eventDetails.data.attachments?.find(
        (a: any) => a.mimeType === 'video/mp4'
      );
      
      if (videoAttachment) {
        this.logger.log(`Found video attachment via OAuth2 method for session: ${session.id}`);
        let updateData: any = { s3link: videoAttachment.fileUrl };
        await db.update(zuvySessions)
          .set(updateData)
          .where(eq(zuvySessions.id, session.id));
        this.logger.log(`Successfully updated s3link via OAuth2 for session: ${session.id}`);
        return;
      }

      this.logger.log(`No video attachment found via OAuth2, trying JWT approach for session: ${session.id}`);
      // 2. If no recording found, try the JWT approach
      const userData = await db.select().from(users).where(eq(users.email, session.creator));
      if (!userData.length) {
        this.logger.warn(`No user found for email: ${session.creator}`);
        return;
      }

      const tokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, Number(userData[0].id)));

      if (!tokens.length) {
        this.logger.warn('Unable to fetch tokens for JWT approach');
        return;
      }

      this.logger.log(`Fetching admin activities for meetingId: ${session.meetingId}`);
      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      const response = await client.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${session.meetingId}`,
      });
      const items = response.data.items || [];

      // 3. Extract host email
      const organizerParam = items[0]?.events?.[0]?.parameters?.find(p => p.name === 'organizer_email');
      const hostEmail = organizerParam?.value;

      if (!hostEmail) {
        this.logger.warn(`No host email found for session: ${session.meetingId}`);
        return;
      }

      this.logger.log(`Found host email: ${hostEmail}, creating JWT client`);
      // 4. Create JWT client as host
      const { PRIVATE_KEY, CLIENT_EMAIL } = process.env;
      const formattedPrivateKey = PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
      const jwtClient = new google.auth.JWT({
        email: CLIENT_EMAIL,
        key: formattedPrivateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/calendar.events.readonly',
        ],
        subject: hostEmail,
      });
      await jwtClient.authorize();
      this.logger.log(`JWT client authorized successfully for host: ${hostEmail}`);

      // 5. Get event attachments with JWT client
      const jwtCalendar = google.calendar({ version: 'v3', auth: jwtClient });
      const { data: event } = await jwtCalendar.events.get({
        calendarId: 'primary',
        eventId: session.meetingId,
        fields: 'attachments(fileId,mimeType,fileUrl)',
      });
      const videoAttach = event.attachments?.find((a: any) => a.mimeType === 'video/mp4');
      
      if (videoAttach) {
        this.logger.log(`Found video attachment via JWT method for session: ${session.id}`);
        let updateData: any = { s3link: videoAttach.fileUrl };
        await db.update(zuvySessions)
          .set(updateData)
          .where(eq(zuvySessions.id, session.id));
        this.logger.log(`Successfully updated s3link via JWT for session: ${session.id}`);
      } else {
        this.logger.warn(`No video recording found for session: ${session.meetingId}`);
      }
    } catch (error) {
      this.logger.error(`Error updating session link for session ${session.id}: ${error.message}`);
    }
  }

  private async handleOldSessions(session: any) {
    this.logger.log(`Checking if session is older than 3 days: ${session.id}`);
    if (new Date(session.startTime) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
      this.logger.log(`Session ${session.id} is older than 3 days, marking as 'not found'`);
      let updateData: any = { s3link: 'not found' };
      await db.update(zuvySessions)
        .set(updateData)
        .where(eq(zuvySessions.id, session.id));
      this.logger.log(`Updated old session ${session.id} with s3link: 'not found'`);
    } else {
      this.logger.log(`Session ${session.id} is within 3-day window, keeping as is`);
    }
  }

  private async getAttendanceByBatchId(batchId, creatorEmail: string) {
    this.logger.log(`Starting getAttendanceByBatchId for batchId: ${batchId}, creator: ${creatorEmail}`);
    try {
      const students = await db
        .select()
        .from(zuvyBatchEnrollments)
        .where(eq(zuvyBatchEnrollments.batchId, Number(batchId)));
      
      this.logger.log(`Found ${students.length} students in batch ${batchId}`);

      const userData = await db.select().from(users).where(eq(users.email, creatorEmail));
      if (!userData.length) {
        this.logger.warn(`No user found for email: ${creatorEmail}`);
        return[{ status: 'error', message: 'User not found' }];
      }

      const tokens = await db
        .select()
        .from(userTokens)
        .where(eq(userTokens.userId, Number(userData[0].id)));

      if (!tokens.length) {
        this.logger.warn(`No tokens found for user: ${creatorEmail}`);
        return [{ status: 'error', message: 'Unable to fetch tokens' }];
      }

      this.logger.log(`Setting up OAuth2 credentials for user: ${creatorEmail}`);
      auth2Client.setCredentials({
        access_token: tokens[0].accessToken,
        refresh_token: tokens[0].refreshToken,
      });

      const client = google.admin({ version: 'reports_v1', auth: auth2Client });
      const meetings = await db
        .select()
        .from(zuvySessions)
        .where(and(eq(zuvySessions.batchId, Number(batchId)), eq(zuvySessions.status, 'completed')));

      this.logger.log(`Found ${meetings.length} completed meetings for batch ${batchId}`);

      const [errorAttendance, attendance] = await this.calculateAttendance(client, meetings, students);
      if (errorAttendance) {
        this.logger.error(`Error calculating attendance: ${JSON.stringify(errorAttendance)}`);
        return [errorAttendance];
      }
      this.logger.log(`Successfully calculated attendance for batch ${batchId}`);
      return [null,{ data: attendance, status: 'success' }];
    } catch (error) {
      this.logger.error(`Error in getAttendanceByBatchId: ${error.message}`);
      throw new Error(`Error fetching attendance: ${error.message}`);
    }
  }

  private async calculateAttendance(client: any, meetings: any[], students: any[]) {
    this.logger.log(`Starting calculateAttendance for ${meetings.length} meetings and ${students.length} students`);
    let {PRIVATE_KEY, CLIENT_EMAIL} = process.env

    const attendanceByTitle: Record<string, any> = {};
    for (const meeting of meetings) {
      this.logger.log(`Processing meeting: ${meeting.meetingId}`);
      const response = await client.activities.list({
        userKey:         'all',
        applicationName: 'meet',
        eventName:       'call_ended',
        maxResults:      1000,
        filters:         `calendar_event_id==${meeting.meetingId}`,
      });
      const items = response.data.items || [];
  
      // 2️⃣ Extract the host’s email from the first log entry
      const organizerParam = items[0].events?.[0].parameters?.find(p => p.name === 'organizer_email');
      const hostEmail = organizerParam?.value;
      const formattedPrivateKey = PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
      const jwtClient = new google.auth.JWT({
        email:   CLIENT_EMAIL,
        key:     formattedPrivateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/calendar.events.readonly',
        ],
        subject: hostEmail
      })
      await jwtClient.authorize();
      const calendar = google.calendar({ version: 'v3', auth: jwtClient });
      const drive    = google.drive({ version: 'v3', auth: jwtClient });
      const { data: event } = await calendar.events.get({
        calendarId: 'primary',
        eventId:    meeting.meetingId,
        fields:     'attachments(fileId,mimeType)',
      });
      const videoAttach = event.attachments?.find(
        (a: any) => a.mimeType === 'video/mp4'
      );
      if (!videoAttach) {
        console.warn(`No recording for ${meeting.meetingId}, skipping.`);
        continue;
      }
  
      // 3️⃣ Fetch the recording’s duration from Drive metadata
      const { data: fileMeta } = await drive.files.get({
        fileId: videoAttach.fileId,
        fields: 'videoMediaMetadata(durationMillis)'
      });
      const durationMillisStr = fileMeta.videoMediaMetadata?.durationMillis;

      const durationMillis = Number(durationMillisStr) || 0;

      const totalSeconds = durationMillis / 1000;
    const cutoff       = totalSeconds * 0.75;
    const attendance: Record<string, { email: string; duration: number; attendance: string }> = {};
    for (const student of students) {
      const user = await db
          .select()
          .from(users)
          .where(sql`${users.id} = ${BigInt(student.userId)}`);

        attendance[user[0].email] = {
          email:      user[0].email,
          duration:   0,
          attendance: 'absent'
        };
    }

    response.data.items?.forEach((item: any) => {
      const e      = item.events[0];
      const email  = e.parameters.find((p: any) => p.name === 'identifier')?.value;
      const secs   = e.parameters.find((p: any) => p.name === 'duration_seconds')?.intValue || 0;
      if (email && attendance[email]) {
        attendance[email].duration += Number(secs);
      }
    });
    for (const rec of Object.values(attendance)) {
      rec.attendance = rec.duration >= cutoff ? 'present' : 'absent';
    }
    for (const [email, rec] of Object.entries(attendance)) {
      attendanceByTitle[email] = {
        ...(attendanceByTitle[email] || {}),
        ...rec
      };
    }
  }

  // 7️⃣ Flatten for return
  const attendanceOfStudents = Object.values(attendanceByTitle);
  return [ null, attendanceOfStudents ];
  }

  async getSessionAttendanceAndS3Link(
    session: any,
    students: any[],
  ): Promise<any> {
    try {
      const userData = await db.select().from(users).where(eq(users.email, session.creator));
      if (!userData.length) {
        this.logger.warn(`No user found for email: ${session.creator}`);
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
      // 1. Fetch Google Meet activity logs for this session
      const response = await client.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${session.meetingId}`,
      });
      const items = response.data.items || [];

      // 2. Extract host email
      const organizerParam = items[0]?.events?.[0]?.parameters?.find(p => p.name === 'organizer_email');
      const hostEmail = organizerParam?.value;

      // 3. Create JWT client as host
      const { PRIVATE_KEY, CLIENT_EMAIL } = process.env;
      const formattedPrivateKey = PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
      const jwtClient = new google.auth.JWT({
        email: CLIENT_EMAIL,
        key: formattedPrivateKey,
        scopes: [
          'https://www.googleapis.com/auth/drive.metadata.readonly',
          'https://www.googleapis.com/auth/calendar.events.readonly',
        ],
        subject: hostEmail,
      });
      await jwtClient.authorize();

      // 4. Get event attachments (find video/mp4)
      const calendar = google.calendar({ version: 'v3', auth: jwtClient });
      const { data: event } = await calendar.events.get({
        calendarId: 'primary',
        eventId: session.meetingId,
        fields: 'attachments(fileId,mimeType,fileUrl)',
      });
      const videoAttach = event.attachments?.find((a: any) => a.mimeType === 'video/mp4');
      const s3link = videoAttach?.fileUrl || null;
      
      // If no recording is available, return a proper message
      if (!s3link) {
        return [{ status: 'error', message: 'Recording not yet updated. You can download attendance once recording is available' }];
      }
      let totalSeconds = 0;
      if (videoAttach) {
        const drive = google.drive({ version: 'v3', auth: jwtClient });
        const { data: fileMeta } = await drive.files.get({
          fileId: videoAttach.fileId,
          fields: 'videoMediaMetadata(durationMillis)',
        });
        const durationMillis = Number(fileMeta.videoMediaMetadata?.durationMillis) || 0;
        totalSeconds = durationMillis / 1000;
      }

      // 6. Calculate attendance for each student
      const cutoff = totalSeconds * 0.75;
      const attendance: Record<string, { email: string; duration: number; attendance: string }> = {};
      for (const student of students) {
        const user = student.user;
        attendance[user.email] = {
          email: user.email,
          duration: 0,
          attendance: 'absent',
        };
      }
      response.data.items?.forEach((item: any) => {
        const e = item.events[0];
        const email = e.parameters.find((p: any) => p.name === 'identifier')?.value;
        const secs = e.parameters.find((p: any) => p.name === 'duration_seconds')?.intValue || 0;
        if (email && attendance[email]) {
          attendance[email].duration += Number(secs);
        }
      });
      for (const rec of Object.values(attendance)) {
        rec.attendance = rec.duration >= cutoff ? 'present' : 'absent';
        let user = students.find((student) => student.user.email === rec.email);
        if (user && rec.attendance === 'present') {
          let newData = await db.select().from(zuvyBatchEnrollments)
            .where(sql`${zuvyBatchEnrollments.userId} = ${BigInt(user.userId)} AND ${zuvyBatchEnrollments.batchId} = ${session.batchId}`);
          await db.update(zuvyBatchEnrollments).set({
            attendance: newData[0].attendance ? newData[0].attendance + 1 : 1,
          }). where(sql`${zuvyBatchEnrollments.userId} = ${BigInt(user.userId)} AND ${zuvyBatchEnrollments.batchId} = ${session.batchId}`);
        } 
      }
      // 7. Return attendance and s3link
      return [null, { s3link, attendance: Object.values(attendance), totalSeconds }];
    } catch (error) {
      console.error(error);
      return [{ status: 'error', message: 'Error fetching session data' }];
    }
  }
}
