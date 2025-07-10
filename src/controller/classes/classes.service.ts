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
      moduleId: number;
      daysOfWeek: string[];
      totalClasses: number;
      isZoomMeet?: boolean;
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

      // Default to Zoom if not specified
      const useZoom = eventDetails.isZoomMeet !== false; // true by default, false only if explicitly set

      if (useZoom) {
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

  /**
   * Creates a Zoom session with Google Calendar integration
   * 
   * This method:
   * 1. Generates a Zoom access token using app credentials
   * 2. Creates a Zoom meeting with the specified settings
   * 3. Creates a Google Calendar event with Zoom meeting details in the description
   * 4. Adds batch students as attendees to the calendar event
   * 5. Saves the session to database with:
   *    - meetingId: Google Calendar event ID (preferred) or Zoom meeting ID (fallback)
   *    - zoomMeetingId: Zoom meeting ID for API operations
   *    - hangoutLink: Zoom join URL for easy access
   * 
   * @param eventDetails Session details including title, time, batch, etc.
   * @param creatorInfo Information about the session creator
   * @returns Success/error response with session data
   */
  async createZoomSession(
    eventDetails: {
      title: string;
      description?: string;
      startDateTime: string;
      endDateTime: string;
      timeZone: string;
      batchId: number;
      moduleId: number;
      daysOfWeek?: string[];
      totalClasses?: number;
    },
    creatorInfo: any,
  ) {
    try {
      // Generate Zoom access token before proceeding
      const [error, zoomAccessToken] = await this.generateZoomAccessToken();
      this.logger.log(`Zoom token generation result: ${JSON.stringify({error, success: zoomAccessToken?.success})}`);
      
      if (error) {
        const errorMessage = (error as any).error || 'Failed to generate Zoom access token';
        this.logger.error(`Zoom token generation failed: ${errorMessage}`);
        throw new Error(`Zoom configuration is invalid: ${errorMessage}`);
      }

      if (!zoomAccessToken || !(zoomAccessToken as any).success) {
        this.logger.error('Zoom token generation failed: Invalid response');
        throw new Error('Zoom configuration is invalid: Invalid token response');
      }

      // Log successful token generation
      this.logger.log('Zoom access token generated successfully for session creation');

      // Implementation for creating Zoom sessions
      this.logger.log('Creating Zoom session:'+ JSON.stringify(eventDetails));
      
      const sessionsToCreate = [];
      const startDate = new Date(eventDetails.startDateTime);
      const endDate = new Date(eventDetails.endDateTime);
      const duration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60)); // Duration in minutes

      // Handle timezone conversion properly
      const timeZone = eventDetails.timeZone || 'Asia/Kolkata';
      
      this.logger.log(`Input times - Start: ${eventDetails.startDateTime}, End: ${eventDetails.endDateTime}, TimeZone: ${timeZone}`);

      // For database storage, we'll keep the original UTC times as they are
      // The frontend should handle timezone display
      
      // Create Zoom meeting with generated access token
      const zoomMeetingData = {
        topic: eventDetails.title,
        type: 2, // Scheduled meeting
        start_time: eventDetails.startDateTime, // Keep original UTC time for Zoom API
        duration: duration,
        timezone: timeZone,
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          auto_recording: 'cloud',
        },
      };

      const zoomResponse = await this.createZoomMeetingDirect(zoomMeetingData, (zoomAccessToken as any).token);
      
      if (!zoomResponse.success) {
        throw new Error(`Failed to create Zoom meeting: ${zoomResponse.error}`);
      }

      // Type guard to ensure we have the data
      if (!('data' in zoomResponse) || !zoomResponse.data) {
        throw new Error('Invalid Zoom response: missing meeting data');
      }
      
      this.logger.log('Zoom meeting created successfully, now creating Google Calendar event...');
      
      let batchData = await db.select().from(zuvyBatches).where(eq(zuvyBatches.id, eventDetails.batchId));
      this.logger.log(`Batch data retrieved: ${JSON.stringify({batchId: eventDetails.batchId, found: batchData.length > 0})}`);
      let bootcampId = batchData[0].bootcampId
      let instructorId = batchData[0].instructorId;

      const instructorEmail = await db.select({ email: users.email }).from(users).where(eq(users.id, BigInt(instructorId)));
      // Get student emails for the batch to add as attendees
      const studentsResult = await this.getStudentsEmails(eventDetails.batchId);
      const attendeeEmails = studentsResult.success ? studentsResult.emails : [];

      // Create Google Calendar event for the Zoom session
      const calendarEventData = {
        title: eventDetails.title,
        description: `${eventDetails.description || ''}\n\nZoom Meeting Details:\nJoin URL: ${zoomResponse.data.join_url}\nMeeting ID: ${zoomResponse.data.id}\nPassword: ${zoomResponse.data.password || 'N/A'}`,
        startTime: eventDetails.startDateTime,
        endTime: eventDetails.endDateTime,
        timeZone: eventDetails.timeZone || 'Asia/Kolkata',
        attendees: [...attendeeEmails, instructorEmail[0].email, "team@zuvy.org"], // Add batch students as attendees
      };
      this.logger.log(`Calendar event attendees count: ${calendarEventData.attendees.length}`);
      const calendarResult = await this.createGoogleCalendarEvent(calendarEventData, creatorInfo);
      
      if (!calendarResult.success) {
        this.logger.warn(`Failed to create Google Calendar event for Zoom session: ${calendarResult.error}`);
        // Continue without calendar event - we still have the Zoom meeting
        // Note: This means meetingId will fallback to Zoom meeting ID
      }

      const session = {
        meetingId: calendarResult.success ? calendarResult.data.id : zoomResponse.data.id.toString(), // Use calendar event ID if available, fallback to Zoom ID
        zoomJoinUrl: zoomResponse.data.join_url,
        zoomStartUrl: zoomResponse.data.start_url,
        zoomPassword: zoomResponse.data.password,
        zoomMeetingId: zoomResponse.data.id.toString(),
        hangoutLink: zoomResponse.data.join_url, // Store Zoom join URL in hangoutLink for consistency
        creator: creatorInfo.email,
        startTime: eventDetails.startDateTime, // Store original UTC time
        endTime: eventDetails.endDateTime, // Store original UTC time
        batchId: eventDetails.batchId,
        moduleId: eventDetails.moduleId,
        title: eventDetails.title,
        isZoomMeet: true,
        status: 'upcoming',
      };
    
      

      // Validate and create chapter
      const chapterResult = await this.validateAndCreateChapter({
        ...eventDetails,
        bootcampId
      });

      this.logger.log(`Chapter creation result: ${JSON.stringify({success: chapterResult.success, chapterId: chapterResult.chapter?.id})}`);

      if (!chapterResult.success) {
        throw new Error(chapterResult.message);
      }

      session['chapterId'] = chapterResult.chapter.id;
      session['bootcampId'] = chapterResult.bootcampId;

      sessionsToCreate.push(session);

      // Save sessions to database
      const saveResult = await this.saveSessionsToDatabase(sessionsToCreate);
      
      if (saveResult.status === 'error') {
        throw new Error(saveResult.message);
      }

      this.logger.log(`Zoom session created successfully:`, {
        zoomMeetingId: zoomResponse.data.id,
        zoomJoinUrl: zoomResponse.data.join_url,
        calendarEventId: calendarResult.success ? calendarResult.data.id : 'Not created',
        sessionDatabaseId: saveResult.data[0]?.id
      });

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
        bootcampId: null, // Will be set from batch validation
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

  /**
   * Generate Zoom access token using account credentials
   */
  private async generateZoomAccessToken() {
    try {
      const accountId = process.env.ZOOM_ACCOUNT_ID;
      const clientId = process.env.ZOOM_CLIENT_ID;
      const clientSecret = process.env.ZOOM_CLIENT_SECRET;

      if (!accountId || !clientId || !clientSecret) {
        return [{
          success: false,
          error: 'Missing Zoom credentials: ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, or ZOOM_CLIENT_SECRET'
        }];
      }

      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      
      this.logger.log('Generating Zoom access token...');
      
      const response = await fetch(
        `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      if (!response.ok) {
        const errorData = await response.text();
        return [{
          success: false,
          error: `Zoom token generation failed: ${response.status} ${errorData}`
        }];
      }
      
      const data = await response.json();
      
      this.logger.log('Zoom access token generated successfully');
      
      return [null, {
        success: true,
        token: data.access_token
      }];
    } catch (error) {
      this.logger.error(`Error generating Zoom access token: ${error.message}`);
      return [{
        success: false,
        error: error.message
      }];
    }
  }



  // Helper method to create Zoom meeting directly
  private async createZoomMeetingDirect(meetingData: any, accessToken: string) {
    try {
      this.logger.log(`Creating Zoom meeting with access token:`, {
        topic: meetingData.topic,
        start_time: meetingData.start_time,
        duration: meetingData.duration
      });
      
      // Temporarily update the environment variable for this request
      const result = await this.zoomService.createMeeting(meetingData, accessToken);
      
      if (result.success) {
        this.logger.log('Zoom meeting created successfully:', {
          id: result.data.id,
          join_url: result.data.join_url
        });
        return {
          success: true,
          data: result.data,
        };
      } else {
        // Enhanced error handling for meeting creation
        let errorDetails = {
          success: false,
          error: result.error,
        };

        // Provide specific guidance based on error type
        if (result.error?.includes('403') || result.error?.includes('scope')) {
          errorDetails['code'] = 'ZOOM_SCOPE_ERROR';
          errorDetails['solution'] = 'Your Zoom app requires granular scopes. Follow ZOOM_SCOPE_MIGRATION.md';
        } else if (result.error?.includes('access token') || result.error?.includes('401')) {
          errorDetails['code'] = 'ZOOM_TOKEN_ERROR';
          errorDetails['solution'] = 'Please regenerate your Zoom access token';
        } else if (result.error?.includes('rate limit') || result.error?.includes('429')) {
          errorDetails['code'] = 'ZOOM_RATE_LIMIT';
          errorDetails['solution'] = 'API rate limit exceeded. Please wait before retrying';
        }

        return errorDetails;
      }
    } catch (error) {
      this.logger.error(`Error creating Zoom meeting: ${error.message}`);
      return {
        success: false,
        error: error.message,
        code: 'ZOOM_API_ERROR'
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
      
      this.logger.log(`Google Calendar event created: ${JSON.stringify({eventId: response.data.id, hangoutLink: response.data.hangoutLink})}`);
      
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
      const savedSessions = [];

      for (const session of sessions) {
        const sessionData = {
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
        };

        const saved = await db
          .insert(zuvySessions)
          .values(sessionData)
          .returning();

        savedSessions.push(saved[0]);
      }

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
            const [error, zoomAccessToken] = await this.generateZoomAccessToken();
            if (!error && zoomAccessToken?.success) {
              const zoomMeeting = await this.zoomService.getMeeting(sessionData.zoomMeetingId, (zoomAccessToken as any).token);
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
            
            try {
              // Generate Zoom access token
              const zoomAccessToken = await this.generateZoomAccessToken();
              const zoomResult = await this.zoomService.updateMeeting(session.zoomMeetingId, zoomUpdateData, (zoomAccessToken as any).token);
              this.logger.log(`Zoom meeting ${session.zoomMeetingId} updated successfully`);
            } catch (zoomUpdateError) {
              this.logger.error(`Failed to update Zoom meeting: ${zoomUpdateError.message}`);
              
              // Enhanced error handling for update failures  
              if (zoomUpdateError.message.includes('403') || zoomUpdateError.message.includes('scope')) {
                return {
                  success: false,
                  error: 'Zoom meeting update failed due to insufficient permissions',
                  message: 'Database updated but Zoom meeting update failed due to scope issues. Please check your Zoom app scopes.',
                  solution: 'Follow ZOOM_SCOPE_MIGRATION.md to update your Zoom app scopes'
                };
              }
              
              if (zoomUpdateError.message.includes('access token')) {
                return {
                  success: false,
                  error: 'Zoom access token is invalid',
                  message: 'Database updated but Zoom meeting update failed due to invalid token',
                  solution: 'Please regenerate your Zoom access token'
                };
              }
              
              return {
                success: false,
                error: `Database updated but Zoom meeting update failed: ${zoomUpdateError.message}`,
                message: 'Partial update completed'
              };
            }
          } catch (error) {
            this.logger.error(`Failed to update Zoom meeting: ${error.message}`);
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
            // Generate Zoom access token
            const zoomAccessToken = await this.generateZoomAccessToken();
            await this.zoomService.deleteMeeting(sessionData.zoomMeetingId, (zoomAccessToken as any).token);
            this.logger.log(`Zoom meeting ${sessionData.zoomMeetingId} deleted successfully`);
          } catch (deleteError) {
            this.logger.warn(`Zoom meeting deletion failed: ${deleteError.message}`);
            // Check if it's a scope issue
            if (deleteError.message.includes('403') || deleteError.message.includes('scope')) {
              this.logger.warn('Zoom deletion failed due to scope issues - continuing with database cleanup');
            }
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
      
      const sessionData = session[0];
      
      if (!sessionData.isZoomMeet) {
        return { success: false, message: 'This is not a Zoom session' };
      }
      
      if (!sessionData.zoomMeetingId) {
        return { success: false, message: 'No Zoom meeting ID found for this session' };
      }
      
      try {
        // Fetch Zoom meeting details to get UUID
        const [error, zoomAccessToken] = await this.generateZoomAccessToken();
        if (error || !zoomAccessToken?.success) {
          return {
            success: false,
            error: (error as any)?.error || 'Failed to generate Zoom access token',
            message: 'Cannot fetch Zoom meeting details due to invalid access token'
          };
        }
        
        const meetingDetails = await this.zoomService.getMeeting(sessionData.zoomMeetingId, (zoomAccessToken as any).token);
        if (!meetingDetails.success || !meetingDetails.data) {
          // Enhanced error handling for meeting details fetch
          if (meetingDetails.error?.includes('403') || meetingDetails.error?.includes('scope')) {
            return { 
              success: false, 
              message: 'Cannot fetch Zoom meeting details due to insufficient permissions',
              error: meetingDetails.error,
              solution: 'Please update your Zoom app scopes following ZOOM_SCOPE_MIGRATION.md'
            };
          }
          
          if (meetingDetails.error?.includes('access token')) {
            return {
              success: false,
              message: 'Cannot fetch Zoom meeting details due to invalid access token',
              error: meetingDetails.error,
              solution: 'Please regenerate your Zoom access token'
            };
          }
          
          return { 
            success: false, 
            message: 'Failed to fetch meeting details from Zoom',
            error: meetingDetails.error 
          };
        }
        
        // Fetch attendance using meeting UUID
        const zoomAttendanceResponse = await this.zoomService.getMeetingParticipants(meetingDetails.data.uuid, (zoomAccessToken as any).token);
        
        if (!zoomAttendanceResponse || !zoomAttendanceResponse.participants) {
          // Enhanced error handling for attendance fetch
          const errorMessage = 'Failed to fetch attendance from Zoom';
          return {
            success: false,
            message: errorMessage,
            error: errorMessage
          };
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
        const processedAttendance = [];
        if (zoomAttendanceResponse.participants && Array.isArray(zoomAttendanceResponse.participants)) {
          // Simple attendance processing - implement actual logic based on your Zoom response structure
          processedAttendance.push(...zoomAttendanceResponse.participants.map(p => ({
            email: p.user_email, // Use the correct property name from Zoom API
            duration: p.duration || 0,
            attendance: (p.duration || 0) > 0 ? 'present' : 'absent'
          })));
        }
        
        // Save attendance to database
        const attendanceRecords = [];
        for (const student of students) {
          const participantData = processedAttendance.find(
            p => p.email === student.email
          );
          
          const attendanceRecord = {
            userId: Number(student.id),
            email: student.email,
            name: student.name,
            isPresent: participantData ? participantData.attendance === 'present' : false,
            duration: participantData ? participantData.duration : 0,
            joinTime: null, // Could be extracted from Zoom data if needed
            leaveTime: null,
          };
          
          attendanceRecords.push(attendanceRecord);
        }
        
        // Delete existing attendance records for this session
        await db.delete(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, sessionData.meetingId));
        
        // Insert new attendance record with JSONB data
        if (attendanceRecords.length > 0) {
          await db.insert(zuvyStudentAttendance).values({
            meetingId: sessionData.meetingId,
            attendance: attendanceRecords,
            batchId: sessionData.batchId,
            bootcampId: sessionData.bootcampId,
          });
        }
        
        return {
          success: true,
          data: { 
            sessionId, 
            attendance: attendanceRecords,
            totalParticipants: zoomAttendanceResponse?.participants?.length || 0,
            meetingDuration: zoomAttendanceResponse?.duration || 0
          },
          message: 'Zoom attendance fetched and saved successfully'
        };
        
      } catch (zoomError) {
        this.logger.error(`Error fetching from Zoom API: ${zoomError.message}`);
        
        // Enhanced error handling for various Zoom API issues
        if (zoomError.message.includes('403') || zoomError.message.includes('scope')) {
          return {
            success: false,
            error: zoomError.message,
            message: 'Zoom API permissions insufficient for attendance fetching',
            solution: {
              description: 'Your Zoom app needs updated scopes for attendance reports',
              required_scopes: [
                'meeting:read:meeting:admin',
                'report:read:admin',
                'user:read:user:admin'
              ],
              action: 'Follow ZOOM_SCOPE_MIGRATION.md to add required scopes'
            }
          };
        }
        
        if (zoomError.message.includes('access token') || zoomError.message.includes('401')) {
          return {
            success: false,
            error: zoomError.message,
            message: 'Zoom access token is invalid or expired',
            solution: 'Please regenerate your Zoom access token and update environment variables'
          };
        }
        
        if (zoomError.message.includes('rate limit') || zoomError.message.includes('429')) {
          return {
            success: false,
            error: zoomError.message,
            message: 'Zoom API rate limit exceeded',
            solution: 'Please wait before retrying attendance fetch'
          };
        }
        
        return {
          success: false,
          error: zoomError.message,
          message: 'Failed to fetch attendance from Zoom API'
        };
      }
      
    } catch (error) {
      this.logger.error(`Error fetching Zoom attendance for session ${sessionId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch Zoom attendance for session'
      };
    }
  }

  async processCompletedSessionsForAttendance() {
    try {
      this.logger.log('Processing completed sessions for attendance');
      // TODO: Implement actual logic for processing completed sessions
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

  /**
   * Debug helper to check Zoom configuration and connectivity
   */
  async debugZoomConfiguration() {
    try {
      this.logger.log('Running Zoom configuration debug check...');
      
      const debugInfo = {
        environment: {
          hasAccessToken: !!process.env.ZOOM_ACCESS_TOKEN,
          hasClientId: !!process.env.ZOOM_CLIENT_ID,
          hasClientSecret: !!process.env.ZOOM_CLIENT_SECRET,
          hasAccountId: !!process.env.ZOOM_ACCOUNT_ID
        },
        recommendations: []
      };

      // Add recommendations based on missing environment variables
      if (!debugInfo.environment.hasAccessToken) {
        debugInfo.recommendations.push('Set ZOOM_ACCESS_TOKEN environment variable');
      }
      if (!debugInfo.environment.hasClientId) {
        debugInfo.recommendations.push('Set ZOOM_CLIENT_ID environment variable');
      }
      if (!debugInfo.environment.hasClientSecret) {
        debugInfo.recommendations.push('Set ZOOM_CLIENT_SECRET environment variable');
      }
      if (!debugInfo.environment.hasAccountId) {
        debugInfo.recommendations.push('Set ZOOM_ACCOUNT_ID environment variable');
      }

      return {
        success: true,
        data: debugInfo,
        message: 'Zoom configuration debug completed'
      };
    } catch (error) {
      this.logger.error(`Error running Zoom debug check: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to run Zoom configuration debug'
      };
    }
  }

  /**
   * Test method to verify Zoom configuration
   */
  async testZoomConfiguration() {
    try {
      this.logger.log('Testing Zoom configuration...');
      
      const [error, tokenResult] = await this.generateZoomAccessToken();
      
      if (error) {
        return {
          success: false,
          error: (error as any).error,
          message: 'Zoom configuration has issues',
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        success: true,
        message: 'Zoom configuration is valid and ready to use',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      this.logger.error(`Error testing Zoom configuration: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to test Zoom configuration'
      };
    }
  }



  async getSessionByMeetingId(meetingId: string, userInfo: any) {
    try {
      this.logger.log(`Fetching session by meeting ID: ${meetingId}`);
      
      // Get session from DB by meetingId
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.meetingId, meetingId));
        
      if (!session.length) {
        return { 
          success: false, 
          message: 'Session not found',
          status: 'error',
          code: 404
        };
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
          return { 
            success: false, 
            message: 'Unauthorized to access this session',
            status: 'error',
            code: 403
          };
        }
      }
      
      // Enrich session data based on platform
      let enrichedSession: any = { ...sessionData };
      
      if (sessionData.isZoomMeet) {
        // Enrich with Zoom-specific data
        try {

          if (sessionData.zoomMeetingId) {
            const [error, zoomAccessToken] = await this.generateZoomAccessToken();
            if (!error && zoomAccessToken?.success) {
              const zoomMeeting = await this.zoomService.getMeeting(sessionData.zoomMeetingId, (zoomAccessToken as any).token);
              if (zoomMeeting.success) {
                enrichedSession.zoomDetails = zoomMeeting.data;
                enrichedSession.platform = 'zoom';
              }
            }
          }
        } catch (error) {
          this.logger.warn(`Could not fetch Zoom meeting details: ${error.message}`);
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
        message: 'Session fetched successfully',
        status: 'success',
        code: 200
      };
    } catch (error) {
      this.logger.error(`Error fetching session by meeting ID ${meetingId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch session',
        status: 'error',
        code: 500
      };
    }
  }

  async updateSessionByMeetingId(meetingId: string, updateData: any, userInfo: any) {
    try {
      this.logger.log(`Updating session by meeting ID: ${meetingId}`);
      
      // Get current session by meetingId
      const currentSession = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.meetingId, meetingId));
        
      if (!currentSession.length) {
        return { 
          success: false, 
          message: 'Session not found',
          status: 'error',
          code: 404
        };
      }
      
      const session = currentSession[0];
      
      // Check permissions (admin or session creator)
      if (!userInfo.roles?.includes('admin') && session.creator !== userInfo.email) {
        return { 
          success: false, 
          message: 'Unauthorized to update this session',
          status: 'error',
          code: 403
        };
      }
      
      // Update database record first
      const updateFields: any = {};
      if (updateData.title) updateFields.title = updateData.title;
      if (updateData.startTime) updateFields.startTime = updateData.startTime;
      if (updateData.endTime) updateFields.endTime = updateData.endTime;
      
      if (Object.keys(updateFields).length > 0) {
        await db.update(zuvySessions)
          .set(updateFields)
          .where(eq(zuvySessions.meetingId, meetingId));
      }
      
      // Handle platform-specific updates
      if (session.isZoomMeet) {
        // Update Zoom meeting
        if (session.zoomMeetingId && (updateData.title || updateData.startTime || updateData.endTime)) {
          try {
            const [error, zoomAccessToken] = await this.generateZoomAccessToken();
            if (!error && zoomAccessToken?.success) {
              const zoomUpdateData: any = {};
              if (updateData.title) zoomUpdateData.topic = updateData.title;
              if (updateData.startTime) {
                zoomUpdateData.start_time = updateData.startTime;
                if (updateData.endTime) {
                  const startDate = new Date(updateData.startTime);
                  const endDate = new Date(updateData.endTime);
                  zoomUpdateData.duration = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60));
                }
              }
              
              const zoomResult = await this.zoomService.updateMeeting(session.zoomMeetingId, zoomUpdateData, (zoomAccessToken as any).token);
              if (!zoomResult.success) {
                this.logger.warn(`Failed to update Zoom meeting: ${zoomResult.error}`);
              } else {
                this.logger.log(`Zoom meeting ${session.zoomMeetingId} updated successfully`);
              }
            } else {
              this.logger.error(`Failed to generate Zoom access token for update: ${(error as any)?.error}`);
            }
          } catch (error) {
            this.logger.error(`Error updating Zoom meeting: ${error.message}`);
          }
        }
        
        // Update Google Calendar event if it exists (for Zoom sessions that also have calendar events)
        if (meetingId !== session.zoomMeetingId && (updateData.title || updateData.startTime || updateData.endTime)) {
          try {
            const calendarUpdateData: any = {};
            if (updateData.title) calendarUpdateData.title = updateData.title;
            if (updateData.startTime) calendarUpdateData.startTime = updateData.startTime;
            if (updateData.endTime) calendarUpdateData.endTime = updateData.endTime;
            
            await this.updateGoogleCalendarEvent(meetingId, calendarUpdateData, userInfo);
            this.logger.log(`Google Calendar event ${meetingId} updated successfully`);
          } catch (error) {
            this.logger.error(`Failed to update Google Calendar: ${error.message}`);
            return {
              success: false,
              error: `Database updated but Google Calendar update failed: ${error.message}`,
              message: 'Partial update completed'
            };
          }
        }
      } else {
        // Update Google Calendar event for Google Meet sessions
        if (updateData.title || updateData.startTime || updateData.endTime) {
          try {
            const calendarUpdateData: any = {};
            if (updateData.title) calendarUpdateData.title = updateData.title;
            if (updateData.startTime) calendarUpdateData.startTime = updateData.startTime;
            if (updateData.endTime) calendarUpdateData.endTime = updateData.endTime;
            
            await this.updateGoogleCalendarEvent(meetingId, calendarUpdateData, userInfo);
            this.logger.log(`Google Calendar event ${meetingId} updated successfully`);
          } catch (error) {
            this.logger.error(`Error updating Google Calendar event: ${error.message}`);
            return {
              success: false,
              error: error.message,
              message: 'Failed to update Google Calendar event',
              status: 'error',
              code: 500
            };
          }
        }
      }
      
      return {
        success: true,
        data: { meetingId, ...updateFields },
        message: 'Session updated successfully',
        status: 'success',
        code: 200
      };
    } catch (error) {
      this.logger.error(`Error updating session by meeting ID ${meetingId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to update session',
        status: 'error',
        code: 500
      };
    }
  }

  async deleteSessionByMeetingId(meetingId: string, userInfo: any) {
    try {
      this.logger.log(`Deleting session by meeting ID: ${meetingId}`);
      
      // Get session details
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.meetingId, meetingId));
        
      if (!session.length) {
        return { 
          success: false, 
          message: 'Session not found',
          status: 'error',
          code: 404
        };
      }
      
      const sessionData = session[0];
      
      // Check permissions (admin or session creator)
      if (!userInfo.roles?.includes('admin') && sessionData.creator !== userInfo.email) {
        return { 
          success: false, 
          message: 'Unauthorized to delete this session',
          status: 'error',
          code: 403
        };
      }
      
      // Delete from external platforms first
      if (sessionData.isZoomMeet) {
        // Delete Zoom meeting
        if (sessionData.zoomMeetingId) {
          try {
            const [error, zoomAccessToken] = await this.generateZoomAccessToken();
            if (!error && zoomAccessToken?.success) {
              const zoomResult = await this.zoomService.deleteMeeting(sessionData.zoomMeetingId, (zoomAccessToken as any).token);
              if (zoomResult.success) {
                this.logger.log(`Zoom meeting ${sessionData.zoomMeetingId} deleted successfully`);
              } else {
                this.logger.warn(`Failed to delete Zoom meeting: ${zoomResult.error}`);
              }
            } else {
              this.logger.error(`Failed to generate Zoom access token for deletion: ${(error as any)?.error}`);
            }
          } catch (error) {
            this.logger.error(`Error deleting Zoom meeting: ${error.message}`);
          }
        }
        
        // Delete Google Calendar event if it exists (for Zoom sessions that also have calendar events)
        if (meetingId !== sessionData.zoomMeetingId) {
          try {
            await this.deleteGoogleCalendarEvent(meetingId, userInfo);
            this.logger.log(`Google Calendar event ${meetingId} deleted successfully`);
          } catch (error) {
            this.logger.warn(`Failed to delete Google Calendar event: ${error.message}`);
          }
        }
      } else {
        // Delete Google Calendar event for Google Meet sessions
        try {
          await this.deleteGoogleCalendarEvent(meetingId, userInfo);
          this.logger.log(`Google Calendar event ${meetingId} deleted successfully`);
        } catch (error) {
          this.logger.error(`Error deleting Google Calendar event: ${error.message}`);
          // Don't fail the entire operation if calendar deletion fails
        }
      }
      
      // Delete from database
      await db.delete(zuvySessions).where(eq(zuvySessions.meetingId, meetingId));
      
      // Clean up related records (attendance, etc.)
      await db.delete(zuvyStudentAttendance)
        .where(eq(zuvyStudentAttendance.meetingId, meetingId));
      
      this.logger.log(`Session with meeting ID ${meetingId} and all related data deleted successfully`);
      
      return {
        success: true,
        message: 'Session and all related data deleted successfully',
        status: 'success',
        code: 200
      };
      
    } catch (error) {
      this.logger.error(`Error deleting session by meeting ID ${meetingId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to delete session',
        status: 'error',
        code: 500
      };
    }
  }
}
