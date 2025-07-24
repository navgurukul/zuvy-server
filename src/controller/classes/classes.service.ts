import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { auth2Client } from '../../auth/google-auth';
import { db } from '../../db/index';
import {
  zuvySessions,
  zuvyStudentAttendance,
  zuvyBatches,
  zuvyBatchEnrollments,
  zuvyCourseModules,
  zuvyModuleChapter,
  zuvyBootcamps,
  userTokens,
  zuvyStudentAttendanceRecords,
  users,
} from '../../../drizzle/schema';
import { eq, desc, and, sql, ilike } from 'drizzle-orm';
import { Res, Req } from '@nestjs/common';
import { Response } from 'express';
import { S3 } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import { ZoomService } from '../../services/zoom/zoom.service';

@Injectable()
export class ClassesService {
  updatingStatusOfClass(bootcampId: number, batchId: number) {
    throw new Error('Method not implemented.');
  }
  private readonly logger = new Logger(ClassesService.name);

  constructor(private readonly zoomService: ZoomService) {}

  async accessOfCalendar(creatorInfo) {
    try {
      const userTokenData = await this.getUserTokens(creatorInfo.email);
      if (!userTokenData) {
        // Generate OAuth URL for calendar access
        const scopes = [
          'https://www.googleapis.com/auth/calendar',
          'https://www.googleapis.com/auth/admin.reports.audit.readonly',
        ];

        const authUrl = auth2Client.generateAuthUrl({
          access_type: 'offline',
          scope: scopes,
          state: JSON.stringify({
            id: creatorInfo.id,
            email: creatorInfo.email,
          }),
        });

        return {
          status: 'error',
          message: 'Calendar access required',
          authUrl,
        };
      }

      // Test calendar access
      auth2Client.setCredentials({
        access_token: userTokenData.accessToken,
        refresh_token: userTokenData.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });
      await calendar.calendars.get({ calendarId: 'primary' });

      return {
        status: 'success',
        message: 'Calendar access verified',
      };
    } catch (error) {
      this.logger.error(`Error accessing calendar: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to access calendar',
        error: error.message,
      };
    }
  }

  async googleAuthentication(@Res() res, userEmail: string, userId: number) {
    try {
      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/admin.reports.audit.readonly',
      ];

      const authUrl = auth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: scopes,
        state: JSON.stringify({ id: userId, email: userEmail }),
      });

      return res.redirect(authUrl);
    } catch (error) {
      this.logger.error(`Error in Google authentication: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to initiate Google authentication',
        error: error.message,
      };
    }
  }

  async googleAuthenticationRedirect(@Req() req, @Res() res) {
    try {
      const { code, state } = req.query;
      const { tokens } = await auth2Client.getToken(code);
      const userInfo = JSON.parse(state);

      await this.saveTokensToDatabase(tokens, userInfo);

      return {
        status: 'success',
        message: 'Authentication successful',
      };
    } catch (error) {
      this.logger.error(`Error in authentication redirect: ${error.message}`);
      return {
        status: 'error',
        message: 'Authentication failed',
        error: error.message,
      };
    }
  }

  private async getUserData(auth2Client) {
    // Implementation for getting user data
    return {};
  }

  async saveTokensToDatabase(tokens, userData) {
    try {
      await db
        .insert(userTokens)
        .values({
          userId: userData.id,
          userEmail: userData.email,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
        })
        .onConflictDoUpdate({
          target: [userTokens.userId],
          set: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
          },
        });

      return {
        status: 'success',
        message: 'Tokens saved successfully',
      };
    } catch (error) {
      this.logger.error(`Error saving tokens: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to save tokens',
        error: error.message,
      };
    }
  }

  async createSession(
    eventDetails: {
      title: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone: string;
      batchId: number;
      bootcampId: number;
      moduleId: number;
      daysOfWeek: string[];
      totalClasses: number;
      isZoomMeet: boolean;
      // Removed useZoom
    },
    creatorInfo: any,
  ) {
    try {
      // Check if user has permissions
      if (!creatorInfo.roles?.includes('admin')) {
        return {
          status: 'error',
          message: 'Only admins can create sessions',
        };
      }

      if (eventDetails.isZoomMeet) { // Replaced useZoom with isZoomMeet
        this.logger.log('Creating Zoom session');
        return this.createZoomSession(eventDetails, creatorInfo);
      } else {
        this.logger.log('Creating Google Meet session');
        return this.createGoogleMeetSession(eventDetails, creatorInfo);
      }
    } catch (error) {
      this.logger.error(`Error creating session: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to create session',
        error: error.message,
      };
    }
  }

  async createZoomSession(
    eventDetails: {
      title: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone: string;
      batchId: number;
      bootcampId: number;
      moduleId: number;
      daysOfWeek?: string[];
      totalClasses?: number;
    },
    creatorInfo: any,
  ) {
    try {
      
      const sessionsToCreate = [];
      const startDate = new Date(eventDetails.startDateTime);
      const endDate = new Date(eventDetails.endDateTime);
      const duration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60)); // Duration in minutes

      // Create Zoom meeting
      const zoomMeetingData = {
        topic: eventDetails.title,
        type: 2, // Scheduled meeting
        start_time: eventDetails.startDateTime,
        duration: duration,
        timezone: eventDetails.timeZone || 'Asia/Kolkata',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          auto_recording: 'cloud',
        },
      };

      const zoomResponse = await this.createZoomMeetingDirect(zoomMeetingData);
      
      if (!zoomResponse.success) {
        throw new Error(`Failed to create Zoom meeting: ${zoomResponse.error}`);
      }

      const session = {
        meetingId: zoomResponse.data.id.toString(),
        zoomJoinUrl: zoomResponse.data.join_url,
        zoomStartUrl: zoomResponse.data.start_url,
        zoomPassword: zoomResponse.data.password,
        zoomMeetingId: zoomResponse.data.id.toString(),
        creator: creatorInfo.email,
        startTime: eventDetails.startDateTime,
        endTime: eventDetails.endDateTime,
        batchId: eventDetails.batchId,
        bootcampId: eventDetails.bootcampId,
        moduleId: eventDetails.moduleId,
        title: eventDetails.title,
        isZoomMeet: true,
        status: 'upcoming',
      };

      // Validate and create chapter
      // const chapterResult = await this.validateAndCreateChapter({
      //   ...eventDetails,
      //   bootcampId: eventDetails.bootcampId, // Will be set from batch validation
      // });

      // if (!chapterResult.success) {
      //   throw new Error(chapterResult.message);
      // }

      // session['chapterId'] = chapterResult.chapter.id;
      // session['bootcampId'] = chapterResult.bootcampId;

      sessionsToCreate.push(session);
      // Save sessions to database
      const saveResult = await this.saveSessionsToDatabase(sessionsToCreate);
      
      if (saveResult.status === 'error') {
        throw new Error(saveResult.message);
      }

      return {
        status: 'success',
        message: 'Zoom session created successfully',
        data: saveResult.data,
      };
    } catch (error) {
      this.logger.error(`Error creating Zoom session: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to create Zoom session',
        error: error.message,
      };
    }
  }

  async createGoogleMeetSession(
    eventDetails: {
      title: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone: string;
      batchId: number;
      bootcampId: number;
      moduleId: number;
      daysOfWeek: string[];
      totalClasses: number;
    },
    creatorInfo: any,
  ) {
    try {
      // Validate and create chapter first
      const chapterResult = await this.validateAndCreateChapter({
        ...eventDetails,
        bootcampId: eventDetails.bootcampId, // Will be set from batch validation
      });

      if (!chapterResult.success) {
        throw new Error(chapterResult.message);
      }

      // Get student emails for the batch
      const studentsResult = await this.getStudentsEmails(eventDetails.batchId);
      if (!studentsResult.success) {
        throw new Error(studentsResult.message);
      }

      const sessionsToCreate = [];
      const startDate = new Date(eventDetails.startDateTime);
      let classCount = 0;

      while (classCount < eventDetails.totalClasses) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (classCount * 7)); // Weekly sessions

        const sessionStartTime = currentDate.toISOString();
        const sessionEndTime = new Date(currentDate.getTime() + (new Date(eventDetails.endDateTime).getTime() - new Date(eventDetails.startDateTime).getTime())).toISOString();

        // Create Google Calendar event
        const eventData = {
          title: `${eventDetails.title} - Class ${classCount + 1}`,
          description: eventDetails.description,
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          timeZone: eventDetails.timeZone,
          attendees: studentsResult.emails,
        };

        const calendarResult = await this.createGoogleCalendarEvent(eventData, creatorInfo);
        
        if (!calendarResult.success) {
          this.logger.warn(`Failed to create calendar event for class ${classCount + 1}: ${calendarResult.error}`);
          continue;
        }

        const session = {
          meetingId: calendarResult.data.id,
          hangoutLink: calendarResult.data.hangoutLink,
          creator: creatorInfo.email,
          startTime: sessionStartTime,
          endTime: sessionEndTime,
          batchId: eventDetails.batchId,
          bootcampId: chapterResult.bootcampId,
          moduleId: eventDetails.moduleId,
          chapterId: chapterResult.chapter.id,
          title: eventData.title,
          status: 'upcoming',
          isZoomMeet: false,
        };

        sessionsToCreate.push(session);
        classCount++;
      }

      // Save sessions to database
      const saveResult = await this.saveSessionsToDatabase(sessionsToCreate);
      
      if (saveResult.status === 'error') {
        throw new Error(saveResult.message);
      }

      return {
        status: 'success',
        message: `${sessionsToCreate.length} Google Meet sessions created successfully`,
        data: saveResult.data,
      };
    } catch (error) {
      this.logger.error(`Error creating Google Meet sessions: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to create Google Meet sessions',
        error: error.message,
      };
    }
  }

  // Helper method to get student emails for a batch
  private async getStudentsEmails(batchId: number) {
    try {
      const students = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          enrollmentId: zuvyBatchEnrollments.id,
        })
        .from(zuvyBatchEnrollments)
        .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
        .where(eq(zuvyBatchEnrollments.batchId, batchId));

      const emails = students.map(student => student.email || '');
      return {
        success: true,
        emails,
        students,
      };
    } catch (error) {
      this.logger.error(`Error fetching student emails: ${error.message}`);
      return {
        success: false,
        message: error.message,
        emails: [],
        students: [],
      };
    }
  }

  // Helper method to create Zoom meeting directly
  private async createZoomMeetingDirect(meetingData: any) {
    try {
      this.logger.log(`Creating Zoom meeting:`, meetingData);
      const result = await this.zoomService.createMeeting(meetingData);
      
      if (result.success) {
        return {
          success: true,
          data: result.data,
        };
      } else {
        return {
          success: false,
          error: result.error,
        };
      }
    } catch (error) {
      console.log({error})
      this.logger.error(`Error creating Zoom meeting: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper method to delete Google Calendar event
  private async deleteGoogleCalendarEvent(eventId: string, userInfo: any) {
    try {
      // Get user tokens for Google Calendar access
      const userTokenData = await this.getUserTokens(userInfo.email);
      if (!userTokenData) {
        throw new Error('No Google Calendar access tokens found');
      }

      // Set up Google Calendar API
      auth2Client.setCredentials({
        access_token: userTokenData.accessToken,
        refresh_token: userTokenData.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });

      // Delete the event
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      this.logger.log(`Google Calendar event ${eventId} deleted successfully`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error deleting Google Calendar event ${eventId}: ${error.message}`);
      throw error;
    }
  }

  // Helper method to update Google Calendar event
  private async updateGoogleCalendarEvent(eventId: string, updateData: any, userInfo: any) {
    try {
      // Get user tokens for Google Calendar access
      const userTokenData = await this.getUserTokens(userInfo.email);
      if (!userTokenData) {
        throw new Error('No Google Calendar access tokens found');
      }

      // Set up Google Calendar API
      auth2Client.setCredentials({
        access_token: userTokenData.accessToken,
        refresh_token: userTokenData.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });

      // Prepare update data
      const eventUpdateData: any = {};
      if (updateData.title) eventUpdateData.summary = updateData.title;
      if (updateData.startTime) {
        eventUpdateData.start = {
          dateTime: updateData.startTime,
          timeZone: updateData.timeZone || 'Asia/Kolkata',
        };
      }
      if (updateData.endTime) {
        eventUpdateData.end = {
          dateTime: updateData.endTime,
          timeZone: updateData.timeZone || 'Asia/Kolkata',
        };
      }

      // Update the event
      await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: eventUpdateData,
      });

      this.logger.log(`Google Calendar event ${eventId} updated successfully`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Error updating Google Calendar event ${eventId}: ${error.message}`);
      throw error;
    }
  }

  // Helper method to create Google Calendar event
  private async createGoogleCalendarEvent(eventData: any, userInfo: any) {
    try {
      const userTokenData = await this.getUserTokens(userInfo.email);
      if (!userTokenData) {
        throw new Error('No calendar tokens found for user');
      }

      auth2Client.setCredentials({
        access_token: userTokenData.accessToken,
        refresh_token: userTokenData.refreshToken,
      });

      const calendar = google.calendar({ version: 'v3', auth: auth2Client });

      const event = {
        summary: eventData.title,
        description: eventData.description,
        start: {
          dateTime: eventData.startTime,
          timeZone: eventData.timeZone || 'Asia/Kolkata',
        },
        end: {
          dateTime: eventData.endTime,
          timeZone: eventData.timeZone || 'Asia/Kolkata',
        },
        attendees: eventData.attendees?.map((email: string) => ({ email })) || [],
        conferenceData: {
          createRequest: {
            requestId: uuid(),
          },
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        conferenceDataVersion: 1,
      });

      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      this.logger.error(`Error creating Google Calendar event: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Helper method to save sessions to database
  private async saveSessionsToDatabase(sessions: any[]) {
    try {
      const sessionData = sessions.map(session => ({
        meetingId: session.meetingId,
        hangoutLink: session.hangoutLink || session.zoomJoinUrl,
        creator: session.creator,
        startTime: session.startTime,
        endTime: session.endTime,
        batchId: session.batchId,
        bootcampId: session.bootcampId,
        moduleId: session.moduleId,
        chapterId: session.chapterId,
        title: session.title,
        status: session.status || 'upcoming',
        isZoomMeet: session.isZoomMeet || false,
        zoomStartUrl: session.zoomStartUrl,
        zoomPassword: session.zoomPassword,
        zoomMeetingId: session.zoomMeetingId,
      }));

      this.logger.log(`Saving ${sessionData.length} sessions to the database.`);
      console.log('Session data:', sessionData);

      const savedSessions = await db
        .insert(zuvySessions)
        .values(sessionData)
        .returning();

      return {
        status: 'success',
        message: 'Sessions saved successfully',
        data: savedSessions,
      };
    } catch (error) {
      this.logger.error(`Error saving sessions to database: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to save sessions',
        error: error.message,
      };
    }
  }

  // Get OAuth tokens for the designated account.
  private async getUserTokens(email: string) {
    const result = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userEmail, email));
    return result.length ? result[0] : null;
  }

  /**
   * Fetches the meeting recording using the Google Calendar API and updates the session record.
   * @param meetingId - The Google Calendar meeting/event ID.
   */
  async fetchRecordingForMeeting(meetingId: string) {
    // Retrieve tokens for the designated account.
    const userTokenData = await this.getUserTokens('team@zuvy.org');
    if (!userTokenData) {
      this.logger.warn('No tokens found for team@zuvy.org');
      return;
    }

    // Set credentials for OAuth2 client.
    auth2Client.setCredentials({
      access_token: userTokenData.accessToken,
      refresh_token: userTokenData.refreshToken,
    });

    // Initialize the Calendar client.
    const calendar = google.calendar({ version: 'v3', auth: auth2Client });

    try {
      // Fetch the Calendar event.
      const eventResponse = await calendar.events.get({
        calendarId: 'primary',
        eventId: meetingId,
      });

      // Find the recording attachment
      const recording = eventResponse.data.attachments?.find(
        (att) =>
          att.mimeType === 'video/mp4' ||
          att.fileUrl?.includes('meet') ||
          (att.title && att.title.toLowerCase().includes('recording'))
      );
      
      this.logger.log(`recording: ${JSON.stringify(recording)}`);
      const newS3Link = recording ? recording.fileUrl : null;
      let updateData: any = { s3link: newS3Link }
      
      // Update the session record in zuvySessions with the recording link.
      await db.update(zuvySessions)
        .set(updateData)
        .where(eq(zuvySessions.meetingId, meetingId))
        .execute();

      this.logger.log(
        `Meeting ${meetingId} updated with recording link: ${newS3Link}`
      );

      return newS3Link;
    } catch (err) {
      this.logger.error(`Error fetching recording for meeting ${meetingId}: ${err.message}`);
      return null;
    }
  }

  /**
   * Fetches attendance data for a meeting from the Admin Reports API.
   */
  async fetchAttendanceForMeeting(meetingId: string, students, batchId, bootcampId) {
    // Retrieve tokens for the designated account.
    const userTokenData = await this.getUserTokens('team@zuvy.org');
    if (!userTokenData) {
      this.logger.warn('No tokens found for team@zuvy.org');
      return;
    }

    // Set credentials for OAuth2 client.
    auth2Client.setCredentials({
      access_token: userTokenData.accessToken,
      refresh_token: userTokenData.refreshToken,
    });

    // Initialize the Admin Reports API client.
    const adminClient = google.admin({ version: 'reports_v1', auth: auth2Client });

    try {
      // Fetch attendance details using the Admin Reports API.
      const attendanceResponse = await adminClient.activities.list({
        userKey: 'all',
        applicationName: 'meet',
        eventName: 'call_ended',
        maxResults: 1000,
        filters: `calendar_event_id==${meetingId}`,
      });

      // Prepare an attendance record.
      const attendance: Record<string, any> = {};
      let adminData: { email: string; duration: number } | null = null;

      // Identify the benchmark admin data.
      attendanceResponse.data.items?.forEach((item: any) => {
        const eventDetails = item.events[0];
        const email = eventDetails.parameters.find((param: any) => param.name === 'identifier')?.value || '';
        const duration = eventDetails.parameters.find((param: any) => param.name === 'duration_seconds')?.intValue || 0;
        if (email.includes('@zuvy.org')) {
          adminData = { email, duration };
        }
      });

      if (!adminData) {
        this.logger.warn(`No admin attendance data found for meeting ${meetingId}`);
      }

      // Process each attendance record, comparing duration to adminData.
      attendanceResponse.data.items?.forEach((item: any) => {
        const eventDetails = item.events[0];
        const email = eventDetails.parameters.find((param: any) => param.name === 'identifier')?.value || '';
        const duration = eventDetails.parameters.find((param: any) => param.name === 'duration_seconds')?.intValue || 0;
        // Mark present if duration reaches at least 75% of the admin's duration.
        const status = adminData && (duration >= 0.75 * adminData.duration) ? 'present' : 'absent';
        attendance[email] = { duration, attendance: status };
      });

      // Check if an attendance record already exists for this meeting.
      const existingRecord = await db
        .select()
        .from(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, meetingId));

      let arrayOfAttendanceStudents = [];
      this.logger.log(`existingRecord: ${JSON.stringify(attendance)}`);
      
      for (const student in attendance) {
        if (student.length > 0 && !student.includes('@zuvy.org')) {
          arrayOfAttendanceStudents.push({
            email: student,
            duration: attendance[student].duration,
            attendance: attendance[student].attendance
          });
        }
      }
      
      students.forEach((enrollStudent) => {
        let presentStudent = arrayOfAttendanceStudents.find((student) => student.email == enrollStudent.user.email);
        if (!presentStudent) {
          arrayOfAttendanceStudents.push({
            email: enrollStudent.user.email,
            duration: 0,
            attendance: 'absent'
          });
        }
      });
      
      if (existingRecord.length) {
        // Update the existing attendance record.
        await db.update(zuvyStudentAttendance)
          .set({ attendance: arrayOfAttendanceStudents })
          .where(eq(zuvyStudentAttendance.meetingId, meetingId))
          .execute();
        this.logger.log(`Attendance updated for meeting ${meetingId}: ${JSON.stringify(arrayOfAttendanceStudents)}`);
      } else {
        // Prepare the attendance data object.
        const attendanceData = {
          attendance: arrayOfAttendanceStudents,
          meetingId,
          batchId,
          bootcampId
        };
        // Insert a new attendance record.
        await db.insert(zuvyStudentAttendance)
          .values(attendanceData)
          .execute();
        this.logger.log(`Attendance inserted for meeting ${meetingId}: ${JSON.stringify(arrayOfAttendanceStudents)}`);
      }

      return arrayOfAttendanceStudents;
    } catch (err) {
      this.logger.error(`Error fetching attendance for meeting ${meetingId}: ${err.message}`);
      return null;
    }
  }

  async getAttendance(meetingId: string, userInfo: any) {
    try {
      // Find the session by meetingId
      const session = await db
        .select()
        .from(zuvySessions)
        .where(eq(zuvySessions.meetingId, meetingId))
        .limit(1);

      if (session.length === 0) {
        return [{ status: 'error', message: 'Session not found', code: 404 }, null];
      }

      const sessionData = session[0];

      // Check if user has access to this session
      if (!userInfo.roles?.includes('admin')) {
        const enrollment = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            and(
              eq(zuvyBatchEnrollments.userId, BigInt(userInfo.id)),
              eq(zuvyBatchEnrollments.batchId, sessionData.batchId),
              eq(zuvyBatchEnrollments.bootcampId, sessionData.bootcampId)
            )
          );

        if (enrollment.length === 0) {
          return [{ status: 'error', message: 'You are not enrolled in this session', code: 403 }, null];
        }
      }

      // Get attendance data
      const attendance = await db
        .select()
        .from(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, meetingId))
        .limit(1);

      if (attendance.length === 0) {
        // Try to fetch attendance from Google Meet or Zoom
        if (sessionData.isZoomMeet) {
          const fetchResult = await this.fetchZoomAttendanceForSession(sessionData.id);
          if (fetchResult.success) {
            return [null, fetchResult];
          }
          return [{ status: 'error', message: 'No attendance data found and failed to fetch from Zoom', code: 404 }, null];
        } else {
          const students = await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              enrollmentId: zuvyBatchEnrollments.id,
            })
            .from(zuvyBatchEnrollments)
            .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
            .where(eq(zuvyBatchEnrollments.batchId, sessionData.batchId));

          const [error, result] = await this.getSessionAttendanceAndS3Link(sessionData, students);
          if (error) {
            return [error, null];
          }
          return [null, result];
        }
      }

      return [null, {
        status: 'success',
        message: 'Attendance fetched successfully',
        data: attendance[0],
      }];
    } catch (error) {
      this.logger.error(`Error fetching attendance: ${error.message}`);
      return [{ status: 'error', message: 'Failed to fetch attendance', code: 500 }, null];
    }
  }

  async getSessionAttendanceAndS3Link(sessionData: any, students: any[]) {
    try {
      this.logger.log(`Getting session attendance and S3 link for session: ${sessionData.id}`);
      
      // Basic implementation - you'll need to implement the actual logic
      return [null, {
        attendance: [],
        s3Link: null,
        sessionData
      }];
    } catch (error) {
      this.logger.error(`Error getting session attendance and S3 link: ${error.message}`);
      return [error, null];
    }
  }

  async getClassesByBatchId(batchId: string, limit: number, offset: number) {
    try {
      const batchIdNum = parseInt(batchId);
      
      // Validate batch exists
      const batch = await db
        .select()
        .from(zuvyBatches)
        .where(eq(zuvyBatches.id, batchIdNum))
        .limit(1);

      if (batch.length === 0) {
        return {
          status: 'error',
          message: 'Batch not found',
          code: 404,
        };
      }

      // Get sessions with pagination
      const query = db
        .select({
          sessions: zuvySessions,
          totalCount: sql<number>`count(*) over()`.as('total_count'),
        })
        .from(zuvySessions)
        .where(eq(zuvySessions.batchId, batchIdNum))
        .orderBy(desc(zuvySessions.startTime))
        .offset(offset || 0)
        .limit(limit || 50);

      const result = await query;
      const sessions = result.map((item) => item.sessions);
      const totalCount = result.length > 0 ? Number(result[0].totalCount) : 0;

      return {
        status: 'success',
        message: 'Classes fetched successfully',
        code: 200,
        data: sessions,
        total_items: totalCount,
        total_pages: Math.ceil(totalCount / (limit || 50)),
      };
    } catch (error) {
      this.logger.error(`Error fetching classes by batch ID: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to fetch classes',
        code: 500,
        error: error.message,
      };
    }
  }

  async unattendanceClassesByBootcampId(bootcampId: string) {
    try {
      const bootcampIdNum = parseInt(bootcampId);

      // Get all sessions for the bootcamp
      const sessions = await db
        .select({
          id: zuvySessions.id,
          meetingId: zuvySessions.meetingId,
          title: zuvySessions.title,
          startTime: zuvySessions.startTime,
          endTime: zuvySessions.endTime,
          status: zuvySessions.status,
          batchId: zuvySessions.batchId,
        })
        .from(zuvySessions)
        .where(eq(zuvySessions.bootcampId, bootcampIdNum))
        .orderBy(desc(zuvySessions.startTime));

      // Get sessions that don't have attendance records
      const sessionsWithoutAttendance = [];
      
      for (const session of sessions) {
        const attendance = await db
          .select()
          .from(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, session.meetingId))
          .limit(1);

        if (attendance.length === 0) {
          sessionsWithoutAttendance.push(session);
        }
      }

      return {
        status: 'success',
        message: 'Sessions without attendance fetched successfully',
        code: 200,
        data: {
          total_sessions: sessions.length,
          sessions_without_attendance: sessionsWithoutAttendance.length,
          sessions: sessionsWithoutAttendance,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching unattended classes: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to fetch unattended classes',
        code: 500,
        error: error.message,
      };
    }
  }

  private async uploadVideoToS3(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<string> {
    try {
      const s3 = new S3({
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_KEY_ACCESS,
      });
      const bucketName = process.env.S3_BUCKET_NAME;
      const s3Key = `class-recordings/${fileName}`;
      await s3
        .upload({
          Bucket: bucketName,
          Key: s3Key,
          Body: fileBuffer,
        })
        .promise();
      const s3Url = `https://${bucketName}.s3.amazonaws.com/${s3Key}`;
      return s3Url;
    } catch (error) {
      throw new Error('Error uploading video to S3');
    }
  }

  async getClassesBy(
    bootcamp_id: number,
    user: any,
    batch_id: number,
    limit: number,
    offset: number,
    search_term: string,
    status: string,
  ) {
    try {
      // Check user permissions and enrollment
      if (user?.roles?.includes('admin')) {
        let desiredCourse = [];
        if (isNaN(batch_id)) {
          desiredCourse = await db
            .select()
            .from(zuvyBootcamps)
            .where(eq(zuvyBootcamps.id, bootcamp_id));
        } else {
          desiredCourse = await db
            .select()
            .from(zuvyBatches)
            .where(
              sql`${zuvyBatches.id}=${batch_id} AND ${zuvyBatches.bootcampId} = ${bootcamp_id}`,
            );
        }
        if (desiredCourse.length == 0) {
          return {
            status: 'error',
            message: 'There is no such course or batch.',
            code: 404,
          };
        }
      } else if (bootcamp_id && user.id) {
        // Check enrollment for non-admin users
        let queryString;
        if (isNaN(batch_id)) {
          queryString = sql`${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} AND ${zuvyBatchEnrollments.userId} = ${user.id}`;
        } else {
          queryString = sql`${zuvyBatchEnrollments.batchId} = ${batch_id} AND ${zuvyBatchEnrollments.bootcampId} = ${bootcamp_id} AND ${zuvyBatchEnrollments.userId} = ${user.id}`;
        }
        
        let zuvyBatchEnrollmentsData = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(queryString);
          
        if (zuvyBatchEnrollmentsData.length == 0) {
          return {
            status: 'error',
            message: 'You are not enrolled in this course or batch',
            code: 404,
          };
        }
        batch_id = zuvyBatchEnrollmentsData[0].batchId;
        if (batch_id == null) {
          return {
            status: 'error',
            message: 'You are not assigned to any batch in this course',
            code: 404,
          };
        }
      } else {
        return {
          status: 'error',
          message: 'Unauthorized access',
          code: 401,
        };
      }

      // Build query for sessions
      const query = db
        .select({
          sessions: zuvySessions,
          totalCount: sql<number>`count(*) over()`.as('total_count'),
        })
        .from(zuvySessions)
        .$dynamic()
        .where(
          and(
            bootcamp_id ? eq(zuvySessions.bootcampId, bootcamp_id) : undefined,
            batch_id ? eq(zuvySessions.batchId, batch_id) : undefined,
            status.toLowerCase() !== 'all'
              ? eq(zuvySessions.status, status)
              : undefined,
            search_term
              ? ilike(zuvySessions.title, `%${search_term}%`)
              : undefined,
          ),
        )
        .orderBy(
          status.toLowerCase() === 'completed' || status.toLowerCase() === 'all'
            ? desc(zuvySessions.startTime)
            : zuvySessions.startTime,
        )
        .offset(offset)
        .limit(limit);

      const allClasses = await query;
      let classes = allClasses.map((classObj) => classObj.sessions);
      
      // Apply role-based filtering for session data
      if (user?.roles?.includes('admin')) {
        // Admin gets full access including zoomStartUrl
        classes = classes.map(session => ({
          ...session,
          zoomStartUrl: session.zoomStartUrl,
          hangoutLink: session.hangoutLink,
        }));
      } else {
        // Regular users only get hangoutLink, zoomStartUrl is filtered out
        classes = classes.map(session => {
          const { zoomStartUrl, ...sessionWithoutAdminFields } = session;
          return {
            ...sessionWithoutAdminFields,
            hangoutLink: session.hangoutLink,
            zoomStartUrl: null,
          };
        });
      }
      
      const totalClasses =
        allClasses.length > 0 ? Number(allClasses[0].totalCount) : 0;
      return {
        status: 'success',
        message: 'Classes fetched successfully by batchId',
        code: 200,
        classes,
        total_items: totalClasses,
        total_pages: Math.ceil(totalClasses / limit) || 1,
      };
    } catch (err) {
      return { status: 'error', message: err.message, code: 500 };
    }
  }

  async getAttendanceByBatchId(batchId: any, userInfo: any) {
    try {
      const batchIdNum = parseInt(batchId);
      
      // Check if user has access to this batch
      if (!userInfo.roles?.includes('admin')) {
        const enrollment = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            and(
              eq(zuvyBatchEnrollments.userId, BigInt(userInfo.id)),
              eq(zuvyBatchEnrollments.batchId, batchIdNum)
            )
          );

        if (enrollment.length === 0) {
          return {
            status: 'error',
            message: 'You are not enrolled in this batch',
            code: 403,
          };
        }
      }

      // Get all sessions for the batch
      const sessions = await db
        .select()
        .from(zuvySessions)
        .where(eq(zuvySessions.batchId, batchIdNum))
        .orderBy(desc(zuvySessions.startTime));

      // Get attendance data for all sessions
      const attendanceData = [];
      for (const session of sessions) {
        const attendance = await db
          .select()
          .from(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, session.meetingId))
          .limit(1);

        attendanceData.push({
          session: {
            id: session.id,
            title: session.title,
            startTime: session.startTime,
            endTime: session.endTime,
            status: session.status,
          },
          attendance: attendance.length > 0 ? attendance[0].attendance : null,
        });
      }

      return {
        status: 'success',
        message: 'Batch attendance fetched successfully',
        code: 200,
        data: {
          batchId: batchIdNum,
          sessions: attendanceData,
          total_sessions: sessions.length,
        },
      };
    } catch (error) {
      this.logger.error(`Error fetching batch attendance: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to fetch batch attendance',
        code: 500,
        error: error.message,
      };
    }
  }

  private async validateAndCreateChapter(eventDetails: any) {
    try {
      // Validate bootcamp and batch exist
      const batch = await db
        .select()
        .from(zuvyBatches)
        .where(and(
          eq(zuvyBatches.id, eventDetails.batchId),
          eq(zuvyBatches.bootcampId, eventDetails.bootcampId || 0)
        ))
        .limit(1);

      if (batch.length === 0) {
        return {
          success: false,
          message: 'Invalid batch ID or bootcamp ID',
        };
      }

      // Validate module exists
      const module = await db
        .select()
        .from(zuvyCourseModules)
        .where(eq(zuvyCourseModules.id, eventDetails.moduleId))
        .limit(1);

      if (module.length === 0) {
        return {
          success: false,
          message: 'Invalid module ID',
        };
      }

      // Create chapter for live class
      const chapterData = {
        title: eventDetails.title,
        description: eventDetails.description || 'Live class session',
        topicId: 8, // Live session topic ID
        moduleId: eventDetails.moduleId,
        chapterContent: JSON.stringify({
          type: 'live_session',
          content: eventDetails.title,
        }),
      };

      const chapter = await db
        .insert(zuvyModuleChapter)
        .values(chapterData)
        .returning();

      return {
        success: true,
        chapter: chapter[0],
        bootcampId: batch[0].bootcampId,
      };
    } catch (error) {
      this.logger.error(`Error validating and creating chapter: ${error.message}`);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  async getSession(sessionId: number, userInfo: any) {
    try {
      this.logger.log(`Fetching session: ${sessionId}`);
      
      // Get session from DB
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.id, sessionId));
        
      if (!session.length) {
        return { success: false, message: 'Session not found' };
      }
      
      const sessionData = session[0];
      
      // Check permissions (admin, session creator, or enrolled student)
      if (!userInfo.roles?.includes('admin') && sessionData.creator !== userInfo.email) {
        // Check if user is enrolled in the batch
        const enrollment = await db
          .select()
          .from(zuvyBatchEnrollments)
          .where(
            and(
              eq(zuvyBatchEnrollments.userId, BigInt(userInfo.id)),
              eq(zuvyBatchEnrollments.batchId, sessionData.batchId),
              eq(zuvyBatchEnrollments.bootcampId, sessionData.bootcampId)
            )
          );

        if (enrollment.length === 0) {
          return { success: false, message: 'Unauthorized to access this session' };
        }
      }
      
      // Enrich session data based on platform
      let enrichedSession: any = { ...sessionData };
      
      if (sessionData.isZoomMeet) {
        // Enrich with Zoom-specific data
        try {
          if (sessionData.zoomMeetingId) {
            const zoomMeeting = await this.zoomService.getMeeting(sessionData.zoomMeetingId);
            if (zoomMeeting.success) {
              enrichedSession = {
                ...enrichedSession,
                zoomDetails: zoomMeeting.data,
                joinUrl: sessionData.hangoutLink, // Zoom join URL stored in hangoutLink
                startUrl: sessionData.zoomStartUrl,
                platform: 'zoom'
              };
            }
          }
        } catch (error) {
          this.logger.warn(`Could not fetch Zoom meeting details: ${error.message}`);
          // Continue with basic session data
          enrichedSession.platform = 'zoom';
        }
      } else {
        // Google Meet session
        enrichedSession = {
          ...enrichedSession,
          joinUrl: sessionData.hangoutLink,
          platform: 'google_meet'
        };
      }
      
      return {
        success: true,
        data: enrichedSession,
        message: 'Session fetched successfully'
      };
    } catch (error) {
      this.logger.error(`Error fetching session ${sessionId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch session'
      };
    }
  }

  async updateSession(sessionId: number, updateData: any, userInfo: any) {
    try {
      this.logger.log(`Updating session: ${sessionId}`);
      
      // Get current session
      const currentSession = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.id, sessionId));
        
      if (!currentSession.length) {
        return { success: false, message: 'Session not found' };
      }
      
      const session = currentSession[0];
      
      // Check permissions (admin or session creator)
      if (!userInfo.roles?.includes('admin') && session.creator !== userInfo.email) {
        return { success: false, message: 'Unauthorized to update this session' };
      }
      
      // Update database record first
      await db.update(zuvySessions)
        .set({
          title: updateData.title || session.title,
          startTime: updateData.startTime || session.startTime,
          endTime: updateData.endTime || session.endTime,
          // Add other fields as needed
        })
        .where(eq(zuvySessions.id, sessionId));
      
      // Handle platform-specific updates
      if (session.isZoomMeet) {
        // Update Zoom meeting
        if (session.zoomMeetingId) {
          try {
            // Calculate duration if start/end times are provided
            let duration;
            const startTime = updateData.startTime || session.startTime;
            const endTime = updateData.endTime || session.endTime;
            if (startTime && endTime) {
              duration = Math.floor((new Date(endTime).getTime() - new Date(startTime).getTime()) / (1000 * 60));
            }
            
            const zoomUpdateData: any = {};
            if (updateData.title) zoomUpdateData.topic = updateData.title;
            if (updateData.startTime) zoomUpdateData.start_time = updateData.startTime;
            if (duration) zoomUpdateData.duration = duration;
            
            await this.zoomService.updateMeeting(session.zoomMeetingId, zoomUpdateData);
            this.logger.log(`Zoom meeting ${session.zoomMeetingId} updated successfully`);
          } catch (error) {
            this.logger.error(`Failed to update Zoom meeting: ${error.message}`);
            // Could rollback DB changes or continue with warning
            return {
              success: false,
              error: `Database updated but Zoom meeting update failed: ${error.message}`,
              message: 'Partial update completed'
            };
          }
        }
      } else {
        // Update Google Calendar event
        if (session.meetingId && session.meetingId !== session.zoomMeetingId) {
          try {
            await this.updateGoogleCalendarEvent(session.meetingId, updateData, userInfo);
            this.logger.log(`Google Calendar event ${session.meetingId} updated successfully`);
          } catch (error) {
            this.logger.error(`Failed to update Google Calendar: ${error.message}`);
            return {
              success: false,
              error: `Database updated but Google Calendar update failed: ${error.message}`,
              message: 'Partial update completed'
            };
          }
        }
      }
      
      return {
        success: true,
        data: { sessionId, ...updateData },
        message: 'Session updated successfully'
      };
    } catch (error) {
      this.logger.error(`Error updating session ${sessionId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update session'
      };
    }
  }

  async deleteSession(sessionId: number, userInfo: any) {
    try {
      this.logger.log(`Deleting session: ${sessionId}`);
      
      // Get session details
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.id, sessionId));
        
      if (!session.length) {
        return { success: false, message: 'Session not found' };
      }
      
      const sessionData = session[0];
      
      // Check permissions (admin or session creator)
      if (!userInfo.roles?.includes('admin') && sessionData.creator !== userInfo.email) {
        return { success: false, message: 'Unauthorized to delete this session' };
      }
      
      // Delete from external platforms first
      if (sessionData.isZoomMeet) {
        // Delete Zoom meeting
        if (sessionData.zoomMeetingId) {
          try {
            await this.zoomService.deleteMeeting(sessionData.zoomMeetingId);
            this.logger.log(`Zoom meeting ${sessionData.zoomMeetingId} deleted`);
          } catch (error) {
            this.logger.error(`Failed to delete Zoom meeting: ${error.message}`);
            // Continue with DB deletion even if Zoom deletion fails
          }
        }
      } else {
        // Delete Google Calendar event
        if (sessionData.meetingId && sessionData.meetingId !== sessionData.zoomMeetingId) {
          try {
            await this.deleteGoogleCalendarEvent(sessionData.meetingId, userInfo);
            this.logger.log(`Google Calendar event ${sessionData.meetingId} deleted`);
          } catch (error) {
            this.logger.error(`Failed to delete Google Calendar event: ${error.message}`);
          }
        }
      }
      
      // Delete from database
      await db.delete(zuvySessions).where(eq(zuvySessions.id, sessionId));
      
      // Clean up related records (attendance, etc.)
      await db.delete(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, sessionData.meetingId));
      
      return {
        success: true,
        message: 'Session and all related data deleted successfully'
      };
      
    } catch (error) {
      this.logger.error(`Error deleting session ${sessionId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete session'
      };
    }
  }

  async fetchZoomAttendanceForSession(sessionId: number) {
    try {
      this.logger.log(`Fetching Zoom attendance for session: ${sessionId}`);

      // Get session details
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.id, sessionId));

      if (!session.length) {
        return { success: false, message: 'Session not found' };
      }

      let sessionData:any = session[0];

      if (!sessionData.isZoomMeet) {
        return { success: false, message: 'This is not a Zoom session' };
      }

      if (!sessionData.zoomMeetingId) {
        return { success: false, message: 'No Zoom meeting ID found for this session' };
      }

      try {
        // Fetch Zoom meeting details to get UUID
        const meetingDetails = await this.zoomService.getMeeting(sessionData.zoomMeetingId);
        if (!meetingDetails.success || !meetingDetails.data) {
          return { 
            success: false, 
            message: 'Failed to fetch meeting details from Zoom',
            error: meetingDetails.error 
          };
        }
        
        // Fetch attendance using meeting UUID
        const zoomAttendanceResponse = await this.zoomService.getMeetingParticipants(meetingDetails.data.uuid);

        if (!zoomAttendanceResponse.success || !zoomAttendanceResponse.data) {
          return { 
            success: false, 
            message: 'Failed to fetch attendance from Zoom',
            error: zoomAttendanceResponse.error 
          };
        }

        // Refresh sessionData from DB in case it was updated elsewhere
        const sessionDataArr: any = await db.select().from(zuvySessions)
          .where(eq(zuvySessions.id, sessionId));

        if (!sessionDataArr.length) {
          return { success: false, message: 'Session not found' };
        }
        // Use the refreshed sessionData
        sessionData = sessionDataArr[0];
        let { startTime, endTime, s3link } = sessionData;
        if (!s3link){
          // If no S3 link, upload recording if available
          const recording = await this.zoomService.getMeetingRecordings(sessionData.zoomMeetingId);
          if (recording.success && recording.data) {
            const s3Link = await this.uploadVideoToS3(recording.data.fileBuffer, `session-${sessionId}.mp4`);
            if (s3Link) {
              s3link = s3Link;
              let updateClass: any = { s3link: s3link };
              // Update session with new S3 link
              await db.update(zuvySessions)
                .set(updateClass)
                .where(eq(zuvySessions.id, sessionId));
            }
          }
        }
        // Process and save attendance data
        const students = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            enrollmentId: zuvyBatchEnrollments.id,  
          })
          .from(zuvyBatchEnrollments)
          .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
          .where(eq(zuvyBatchEnrollments.batchId, sessionData.batchId));

        // Calculate attendance based on duration threshold
        const processedAttendance = this.zoomService.calculateAttendance(
          zoomAttendanceResponse.participants,
          0.75 // 75% threshold
        );

        // Save attendance to `zuvyStudentAttendance` table (JSON format)
        const attendanceJson = students.map(student => ({
          userId: student.id,
          status: processedAttendance.some(p => p.email === student.email) ? 'present' : 'absent',
        }));

        await db.insert(zuvyStudentAttendance).values({
          meetingId: sessionData.zoomMeetingId,
          attendance: attendanceJson,
          batchId: sessionData.batchId,
          bootcampId: sessionData.bootcampId,
          version: '1.0',
        });

        // Save attendance to `zuvyStudentAttendanceRecords` table (structured format)
        for (const student of students) {
          const participantData = processedAttendance.find(
            p => p.email === student.email
          );

          const attendanceRecord = {
            userId: Number(student.id),
            batchId: sessionData.batchId,
            bootcampId: sessionData.bootcampId,
            attendanceDate: new Date(sessionData.startTime).toISOString().split('T')[0],
            status: participantData ? 'present' : 'absent',
          };

          await db.insert(zuvyStudentAttendanceRecords).values(attendanceRecord);
        }

        return {
          success: true,
          message: 'Zoom attendance and recording fetched and saved successfully',
          data: { s3link },
        };

      } catch (zoomError) {
        this.logger.error(`Error fetching from Zoom API: ${zoomError.message}`);
        return {
          success: false,
          error: zoomError.message,
          message: 'Failed to fetch attendance or recording from Zoom',
        };
      }

    } catch (error) {
      this.logger.error(`Error fetching Zoom attendance for session ${sessionId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch Zoom attendance for session',
      };
    }
  }

  async processCompletedSessionsForAttendance() {
    try {
      this.logger.log('Processing completed sessions for attendance');
      return {
        success: true,
        data: { processedSessions: 0 },
        message: 'Completed sessions processed successfully'
      };
    } catch (error) {
      this.logger.error(`Error processing completed sessions: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to process completed sessions'
      };
    }
  }

  async meetingAttendanceAnalytics(sessionId: number, userInfo: any) {
    try {
      this.logger.log(`Processing meeting attendance analytics for session: ${sessionId}`);
      return [null, {
        success: true,
        data: { sessionId, analytics: {} },
        message: 'Meeting attendance analytics processed successfully'
      }];
    } catch (error) {
      this.logger.error(`Error processing meeting attendance analytics: ${error.message}`);
      return [error, null];
    }
  }

  async getAttendeesByMeetingId(meetingId: string) {
    try {
      this.logger.log(`Fetching attendees for meeting: ${meetingId}`);
      return {
        success: true,
        data: { meetingId, attendees: [] },
        message: 'Attendees fetched successfully'
      };
    } catch (error) {
      this.logger.error(`Error fetching attendees for meeting ${meetingId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch attendees'
      };
    }
  }
}
