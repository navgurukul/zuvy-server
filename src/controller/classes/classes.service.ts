import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { auth2Client } from '../../auth/google-auth';
import { db } from '../../db/index';
import {
  zuvySessions,
  zuvyStudentAttendance,
  zuvyStudentAttendanceRecords,
  zuvyBatches,
  zuvyBatchEnrollments,
  zuvyCourseModules,
  zuvyModuleChapter,
  zuvyBootcamps,
  userTokens,
  users,
  zuvySessionMerge,
} from '../../../drizzle/schema';
import { eq, desc, and, sql, ilike } from 'drizzle-orm';
import { Res, Req } from '@nestjs/common';
import { Response } from 'express';
import { S3 } from 'aws-sdk';
import { v4 as uuid } from 'uuid';
import { ZoomService } from '../../services/zoom/zoom.service';

@Injectable()
export class ClassesService {
  updatingStatusOfClass(bootcampId: number, batchId: number): any {
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
      console.log('Creating session with details:', eventDetails);
      
      if (eventDetails.isZoomMeet) {
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
    },
    creatorInfo: any,
  ) {
    try {
      
      const sessionsToCreate = [];
      const startDate = new Date(eventDetails.startDateTime);
      const endDate = new Date(eventDetails.endDateTime);
      
      // Create adjusted dates for Zoom meeting (subtract 30 minutes)
      const zoomStartDate = new Date(startDate);
      const zoomEndDate = new Date(endDate);
      zoomStartDate.setHours(zoomStartDate.getHours() - 5);
      zoomEndDate.setHours(zoomEndDate.getHours() - 5);
      zoomStartDate.setMinutes(zoomStartDate.getMinutes() - 30);
      zoomEndDate.setMinutes(zoomEndDate.getMinutes() - 30);
      
      const duration = Math.floor((zoomEndDate.getTime() - zoomStartDate.getTime()) / (1000 * 60)); // Duration in minutes

      // Get student emails for the batch to add as meeting invitees
      const studentsResult = await this.getStudentsEmails(eventDetails.batchId);
      
      if (!studentsResult.success) {
        throw new Error(`Failed to fetch students for batch: ${studentsResult.message}`);
      }

      // Prepare meeting invitees from batch students (including instructor)
      const meetingInvitees = studentsResult.students.map(student => ({
        email: student.email,
        name: student.name || student.email.split('@')[0], // Use name or email prefix as fallback
      }));

      // Prepare alternative hosts (instructor if available)
      let alternativeHosts = '';
      if (studentsResult.instructor && studentsResult.instructor.email) {
        alternativeHosts = studentsResult.instructor.email;
        this.logger.log(`Adding instructor as alternative host: ${studentsResult.instructor.email}`);
      }

      // Create Zoom meeting
      const zoomMeetingData = {
        topic: eventDetails.title,
        type: 2, // Scheduled meeting
        start_time: zoomStartDate.toISOString(), // Use adjusted start time for Zoom
        duration: duration,
        timezone: eventDetails.timeZone || 'Asia/Kolkata',
        agenda: eventDetails.description || 'Live class session',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          alternative_hosts_email_notification: true,
          audio: 'both', // Both telephony and voip
          close_registration: false,
          cn_meeting: false,
          enforce_login: false,
          in_meeting: false,
          jbh_time: 0,
          meeting_authentication: false,
          registrants_confirmation_email: true,
          registrants_email_notification: true,
          registration_type: 1,
          show_share_button: true,
          // Attendance and End Meeting Settings
          attendance_reporting: true, // Enable attendance tracking
          end_on_auto_off: true, // End meeting when host leaves
          // Additional required attributes
          allow_multiple_devices: true,
          breakout_room: {
            enable: false
          },
          focus_mode: false,
          meeting_invitees: meetingInvitees,
          watermark: false,
          calendar_type: 1, // Google Calendar
          // Add instructor as alternative host
          alternative_hosts: alternativeHosts
        },
        // YouTube Live Stream Configuration
        live_stream: {
          active: false, // Set to true to enable YouTube live streaming
          settings: {
            page_url: '', // YouTube channel URL - to be configured
            stream_key: '', // YouTube stream key - to be configured  
            stream_url: 'rtmp://a.rtmp.youtube.com/live2/' // YouTube RTMP URL
          }
        }
      };

      const zoomResponse = await this.createZoomMeetingDirect(zoomMeetingData);
      
      if (!zoomResponse.success) {
        throw new Error(`Failed to create Zoom meeting: ${zoomResponse.error}`);
      }

      // Create corresponding Google Calendar event for Zoom meeting
      let calendarEventId = null;
      try {
        // Create Google Calendar event with Zoom meeting link
        const eventData = {
          title: `${eventDetails.title} (Zoom Meeting)`,
          description: `${eventDetails.description || 'Live class session'}\n\nJoin Zoom Meeting: ${zoomResponse.data.join_url}\nMeeting ID: ${zoomResponse.data.id}\nPassword: ${zoomResponse.data.password}`,
          startTime: zoomStartDate.toISOString(), // Use adjusted start time for calendar
          endTime: zoomEndDate.toISOString(), // Use adjusted end time for calendar
          timeZone: eventDetails.timeZone,
          attendees: studentsResult.emails,
          location: `Zoom Meeting - ${zoomResponse.data.join_url}`,
        };

        const calendarResult = await this.createGoogleCalendarEvent(eventData, creatorInfo);
        
        if (calendarResult.success) {
          calendarEventId = calendarResult.data.id;
          this.logger.log(`Google Calendar event created: ${calendarEventId}`);
        } else {
          this.logger.warn(`Failed to create Google Calendar event: ${calendarResult.error}`);

        }
      } catch (calendarError) {
        this.logger.warn(`Google Calendar integration failed: ${calendarError.message}`);
        // Continue without failing the entire process
      }

      const session = {
        meetingId: calendarEventId,
        zoomJoinUrl: zoomResponse.data.join_url,
        zoomStartUrl: zoomResponse.data.start_url,
        zoomPassword: zoomResponse.data.password,
        zoomMeetingId: zoomResponse.data.id.toString(),
        googleCalendarEventId: calendarEventId, // Store Google Calendar event ID
        creator: creatorInfo.email,
        startTime: eventDetails.startDateTime, // Use original start time for database
        endTime: eventDetails.endDateTime, // Use original end time for database
        batchId: eventDetails.batchId,
        bootcampId: eventDetails.bootcampId,
        moduleId: eventDetails.moduleId,
        title: eventDetails.title,
        isZoomMeet: true,
        status: 'upcoming',
      };

      // Validate and create chapter
      const chapterResult = await this.validateAndCreateChapter({
        ...eventDetails,
        bootcampId: eventDetails.bootcampId, // Will be set from batch validation
      });

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

      // Create Google Calendar event
      const eventData = {
        title: eventDetails.title,
        description: eventDetails.description,
        startTime: eventDetails.startDateTime,
        endTime: eventDetails.endDateTime,
        timeZone: eventDetails.timeZone,
        attendees: studentsResult.emails,
      };

      const calendarResult = await this.createGoogleCalendarEvent(eventData, creatorInfo);
      
      if (!calendarResult.success) {
        throw new Error(`Failed to create calendar event: ${calendarResult.error}`);
      }

      const session = {
        meetingId: calendarResult.data.id,
        hangoutLink: calendarResult.data.hangoutLink,
        creator: creatorInfo.email,
        startTime: eventDetails.startDateTime,
        endTime: eventDetails.endDateTime,
        batchId: eventDetails.batchId,
        bootcampId: chapterResult.bootcampId,
        moduleId: eventDetails.moduleId,
        chapterId: chapterResult.chapter.id,
        title: eventDetails.title,
        status: 'upcoming',
        isZoomMeet: false,
      };

      // Save session to database
      const saveResult = await this.saveSessionsToDatabase([session]);
      
      if (saveResult.status === 'error') {
        throw new Error(saveResult.message);
      }

      return {
        status: 'success',
        message: 'Google Meet session created successfully',
        data: saveResult.data,
      };
    } catch (error) {
      this.logger.error(`Error creating Google Meet session: ${error.message}`);
      return {
        status: 'error',
        message: 'Failed to create Google Meet session',
        error: error.message,
      };
    }
  }

  // Helper method to get instructor details for a batch
  private async getInstructorDetails(batchId: number) {
    try {
      const batchWithInstructor = await db
        .select({
          instructorId: zuvyBatches.instructorId,
          instructorEmail: users.email,
          instructorName: users.name,
          batchName: zuvyBatches.name,
        })
        .from(zuvyBatches)
        .leftJoin(users, eq(zuvyBatches.instructorId, users.id))
        .where(eq(zuvyBatches.id, batchId))
        .limit(1);

      if (batchWithInstructor.length === 0) {
        return {
          success: false,
          message: 'Batch not found',
          instructor: null,
        };
      }

      const batchInfo = batchWithInstructor[0];

      if (!batchInfo.instructorId) {
        return {
          success: true,
          message: 'No instructor assigned to this batch',
          instructor: null,
        };
      }

      const instructorDetails = {
        id: batchInfo.instructorId,
        email: batchInfo.instructorEmail,
        name: batchInfo.instructorName,
        isInstructor: true,
        batchName: batchInfo.batchName,
      };

      return {
        success: true,
        message: 'Instructor details fetched successfully',
        instructor: instructorDetails,
      };
    } catch (error) {
      this.logger.error(`Error fetching instructor details for batch ${batchId}: ${error.message}`);
      return {
        success: false,
        message: error.message,
        instructor: null,
      };
    }
  }

  // Helper method to get student emails for a batch
  private async getStudentsEmails(batchId: number) {
    try {
      // Fetch students enrolled in the batch
      const students = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
        })
        .from(zuvyBatchEnrollments)
        .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
        .where(eq(zuvyBatchEnrollments.batchId, batchId));

      // Fetch instructor details using the separate function
      const instructorResult = await this.getInstructorDetails(batchId);
      
      let allParticipants = [...students];
      let instructorDetails = null;

      // Add instructor to the participants list if instructor exists
      if (instructorResult.success && instructorResult.instructor) {
        instructorDetails = instructorResult.instructor;

        // Add instructor to participants if not already present (in case instructor is also enrolled)
        const instructorAlreadyInList = students.find(student => 
          student.id === instructorDetails.id
        );
        
        if (!instructorAlreadyInList && instructorDetails.email) {
          allParticipants.push({
            id: instructorDetails.id,
            email: instructorDetails.email,
            name: instructorDetails.name,
          });
        }
      }
      
      const emails = allParticipants.map(participant => participant.email || '');
      return {
        success: true,
        emails,
        students: allParticipants,
        instructor: instructorDetails,
      };
    } catch (error) {
      this.logger.error(`Error fetching student emails: ${error.message}`);
      return {
        success: false,
        message: error.message,
        emails: [],
        students: [],
        instructor: null,
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
        googleCalendarEventId: session.googleCalendarEventId, // Add Google Calendar event ID
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

  async getAttendance(meetingId: string, userInfo: any, resetAttendanceData: boolean = false) {
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

      if (attendance.length === 0 || resetAttendanceData) {
        // Try to fetch attendance from Google Meet or Zoom
        if (sessionData.isZoomMeet) {
          const fetchResult = await this.fetchZoomAttendanceForSession(sessionData.id, resetAttendanceData);
          if (fetchResult.success) {
            return [null, fetchResult];
          }
          return [{ status: 'error', message: 'No attendance data found and failed to fetch from Zoom', code: 404 }, null];
        } else {
          // Handle Google Meet attendance with same reset logic
          const fetchResult = await this.fetchGoogleMeetAttendanceForSession(sessionData.id, resetAttendanceData);
          if (fetchResult.success) {
            return [null, fetchResult];
          }
          return [{ status: 'error', message: 'No attendance data found and failed to fetch from Google Meet', code: 404 }, null];
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
      
      // Process merged sessions and apply role-based filtering
      const processedClasses = await Promise.all(classes.map(async (session) => {
        let processedSession = { ...session };
        
        // Handle merged sessions
        if (session.hasBeenMerged) {
          // Check if this is a child session (merged into parent)
          const childMergeRecord = await db
            .select({
              parentSessionId: zuvySessionMerge.parentSessionId,
              redirectMeetingUrl: zuvySessionMerge.redirectMeetingUrl,
              isActive: zuvySessionMerge.isActive,
              parentSession: {
                id: zuvySessions.id,
                title: zuvySessions.title,
                hangoutLink: zuvySessions.hangoutLink,
                zoomStartUrl: zuvySessions.zoomStartUrl,
                isZoomMeet: zuvySessions.isZoomMeet,
              }
            })
            .from(zuvySessionMerge)
            .innerJoin(zuvySessions, eq(zuvySessionMerge.parentSessionId, zuvySessions.id))
            .where(
              and(
                eq(zuvySessionMerge.childSessionId, session.id),
                eq(zuvySessionMerge.isActive, true)
              )
            )
            .limit(1);

          if (childMergeRecord.length > 0) {
            // This is a child session - redirect to parent
            const merge = childMergeRecord[0];
            processedSession = {
              ...processedSession,
              // Keep original session info for reference
              originalTitle: session.title,
              originalStatus: session.status,
              // Override with parent session info
              title: `${session.title} (Merged with: ${merge.parentSession.title})`,
              hangoutLink: merge.redirectMeetingUrl || merge.parentSession.hangoutLink,
              zoomStartUrl: merge.parentSession.zoomStartUrl, // Will be filtered for non-admins
              isZoomMeet: merge.parentSession.isZoomMeet,
              status: 'merged',
              mergeInfo: {
                isMerged: true,
                isChildSession: true,
                parentSessionId: merge.parentSessionId,
                parentTitle: merge.parentSession.title,
                redirectUrl: merge.redirectMeetingUrl || merge.parentSession.hangoutLink,
              }
            } as any;
          } else {
            // Check if this is a parent session (has children merged into it)
            const parentMergeRecords = await db
              .select({
                childSessionId: zuvySessionMerge.childSessionId,
                childSession: {
                  id: zuvySessions.id,
                  title: zuvySessions.title,
                  batchId: zuvySessions.batchId,
                }
              })
              .from(zuvySessionMerge)
              .innerJoin(zuvySessions, eq(zuvySessionMerge.childSessionId, zuvySessions.id))
              .where(
                and(
                  eq(zuvySessionMerge.parentSessionId, session.id),
                  eq(zuvySessionMerge.isActive, true)
                )
              );

            if (parentMergeRecords.length > 0) {
              // This is a parent session with merged children
              (processedSession as any).mergeInfo = {
                isMerged: true,
                isParentSession: true,
                childSessions: parentMergeRecords.map(record => record.childSession),
                mergedChildrenCount: parentMergeRecords.length,
              };
            }
          }
        }

        // Apply role-based filtering and clean up response
        if (user?.roles?.includes('admin')) {
          // Admin gets full access including zoomStartUrl for Zoom meetings
          const sessionWithAny = processedSession as any;
          return {
            id: sessionWithAny.id,
            meetingId: sessionWithAny.meetingId,
            hangoutLink: sessionWithAny.isZoomMeet ? sessionWithAny.zoomStartUrl : sessionWithAny.hangoutLink, // Join URL for both Google Meet and Zoom
            creator: sessionWithAny.creator,
            startTime: sessionWithAny.startTime,
            endTime: sessionWithAny.endTime,
            batchId: sessionWithAny.batchId,
            bootcampId: sessionWithAny.bootcampId,
            moduleId: sessionWithAny.moduleId,
            chapterId: sessionWithAny.chapterId,
            title: sessionWithAny.title,
            s3link: sessionWithAny.s3link,
            recurringId: sessionWithAny.recurringId,
            status: sessionWithAny.status,
            isZoomMeet: sessionWithAny.isZoomMeet,
            // Admin-only fields
            zoomStartUrl: sessionWithAny.isZoomMeet ? sessionWithAny.zoomStartUrl : null,
            zoomPassword: sessionWithAny.isZoomMeet ? sessionWithAny.zoomPassword : null,
            zoomMeetingId: sessionWithAny.isZoomMeet ? sessionWithAny.zoomMeetingId : null,
            hasBeenMerged: sessionWithAny.hasBeenMerged,
            // Merge information if available
            ...(sessionWithAny.mergeInfo && { mergeInfo: sessionWithAny.mergeInfo }),
            ...(sessionWithAny.originalTitle && { originalTitle: sessionWithAny.originalTitle }),
            ...(sessionWithAny.originalStatus && { originalStatus: sessionWithAny.originalStatus }),
          };
        } else {
          // Regular users get simplified response
          const sessionWithAny = processedSession as any;
          return {
            id: sessionWithAny.id,
            meetingId: sessionWithAny.meetingId,
            hangoutLink: sessionWithAny.hangoutLink, // Join URL for both Google Meet and Zoom
            creator: sessionWithAny.creator,
            startTime: sessionWithAny.startTime,
            endTime: sessionWithAny.endTime,
            batchId: sessionWithAny.batchId,
            bootcampId: sessionWithAny.bootcampId,
            moduleId: sessionWithAny.moduleId,
            chapterId: sessionWithAny.chapterId,
            title: sessionWithAny.title,
            s3link: sessionWithAny.s3link,
            recurringId: sessionWithAny.recurringId,
            status: sessionWithAny.status,
            isZoomMeet: sessionWithAny.isZoomMeet,
            hasBeenMerged: sessionWithAny.hasBeenMerged,
            // Merge information if available
            ...(sessionWithAny.mergeInfo && { mergeInfo: sessionWithAny.mergeInfo }),
            ...(sessionWithAny.originalTitle && { originalTitle: sessionWithAny.originalTitle }),
            ...(sessionWithAny.originalStatus && { originalStatus: sessionWithAny.originalStatus }),
          };
        }
      }));
      
      const totalClasses =
        allClasses.length > 0 ? Number(allClasses[0].totalCount) : 0;
      return {
        status: 'success',
        message: 'Classes fetched successfully by batchId',
        code: 200,
        classes: processedClasses,
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

  async getSessionForStudent(sessionId: number, userInfo: any) {
    try {
      this.logger.log(`Fetching session for student: ${sessionId}, userId: ${userInfo.id}`);
      
      // Get the original session
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.id, sessionId));
        
      if (!session.length) {
        return { success: false, message: 'Session not found' };
      }
      
      const sessionData = session[0];
      
      // Check if this is a merged child session
      if (sessionData.hasBeenMerged) {
        // Check if this session is a child session in a merge
        const mergeRecord = await db
          .select({
            parentSessionId: zuvySessionMerge.parentSessionId,
            redirectMeetingUrl: zuvySessionMerge.redirectMeetingUrl,
            isActive: zuvySessionMerge.isActive,
            parentSession: {
              id: zuvySessions.id,
              title: zuvySessions.title,
              hangoutLink: zuvySessions.hangoutLink,
              startTime: zuvySessions.startTime,
              endTime: zuvySessions.endTime,
              isZoomMeet: zuvySessions.isZoomMeet,
              status: zuvySessions.status,
            }
          })
          .from(zuvySessionMerge)
          .innerJoin(zuvySessions, eq(zuvySessionMerge.parentSessionId, zuvySessions.id))
          .where(
            and(
              eq(zuvySessionMerge.childSessionId, sessionId),
              eq(zuvySessionMerge.isActive, true)
            )
          )
          .limit(1);

        if (mergeRecord.length > 0) {
          // This is a child session, return parent session details
          const merge = mergeRecord[0];
          
          return {
            success: true,
            data: {
              originalSession: {
                id: sessionData.id,
                title: sessionData.title,
                status: 'merged'
              },
              activeSession: merge.parentSession,
              mergeInfo: {
                isMerged: true,
                isChildSession: true,
                redirectUrl: merge.redirectMeetingUrl || merge.parentSession.hangoutLink,
                message: `This class has been merged with "${merge.parentSession.title}". Please join using the link below.`
              },
              // For students, always show the parent session meeting link
              joinUrl: merge.redirectMeetingUrl || merge.parentSession.hangoutLink,
              platform: merge.parentSession.isZoomMeet ? 'zoom' : 'google_meet'
            },
            message: 'Child session merged with parent - redirecting to parent session'
          };
        }
      }
      
      // Check if user is enrolled in this session's batch
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
        return { success: false, message: 'You are not enrolled in this session' };
      }
      
      // Regular session or parent session - return normally
      return {
        success: true,
        data: {
          id: sessionData.id,
          meetingId: sessionData.meetingId,
          hangoutLink: sessionData.hangoutLink, // Join URL for both Google Meet and Zoom
          creator: sessionData.creator,
          startTime: sessionData.startTime,
          endTime: sessionData.endTime,
          batchId: sessionData.batchId,
          bootcampId: sessionData.bootcampId,
          moduleId: sessionData.moduleId,
          chapterId: sessionData.chapterId,
          title: sessionData.title,
          s3link: sessionData.s3link,
          status: sessionData.status,
          isZoomMeet: sessionData.isZoomMeet,
          hasBeenMerged: sessionData.hasBeenMerged,
          mergeInfo: {
            isMerged: sessionData.hasBeenMerged,
            isChildSession: false,
            isParentSession: sessionData.hasBeenMerged // If merged, this could be a parent
          },
          joinUrl: sessionData.hangoutLink, // Alias for hangoutLink
          platform: sessionData.isZoomMeet ? 'zoom' : 'google_meet'
        },
        message: 'Session fetched successfully'
      };
      
    } catch (error) {
      this.logger.error(`Error fetching session for student ${sessionId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch session'
      };
    }
  }

  async getSessionForAdmin(sessionId: number, userInfo: any) {
    try {
      this.logger.log(`Fetching session for admin: ${sessionId}`);
      
      // Get the session
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.id, sessionId));
        
      if (!session.length) {
        return { success: false, message: 'Session not found' };
      }
      
      const sessionData = session[0];
      
      // Get merge information if exists
      const mergeInfo = await db
        .select({
          id: zuvySessionMerge.id,
          childSessionId: zuvySessionMerge.childSessionId,
          parentSessionId: zuvySessionMerge.parentSessionId,
          isActive: zuvySessionMerge.isActive,
          childSession: {
            id: zuvySessions.id,
            title: zuvySessions.title,
            batchId: zuvySessions.batchId,
            status: zuvySessions.status,
          }
        })
        .from(zuvySessionMerge)
        .leftJoin(zuvySessions, eq(zuvySessionMerge.childSessionId, zuvySessions.id))
        .where(
          and(
            eq(zuvySessionMerge.parentSessionId, sessionId),
            eq(zuvySessionMerge.isActive, true)
          )
        );
      
      // Admin response - include session details and merge info
      const response = {
        id: sessionData.id,
        meetingId: sessionData.meetingId,
        hangoutLink: sessionData.hangoutLink, // Join URL for both Google Meet and Zoom
        creator: sessionData.creator,
        startTime: sessionData.startTime,
        endTime: sessionData.endTime,
        batchId: sessionData.batchId,
        bootcampId: sessionData.bootcampId,
        moduleId: sessionData.moduleId,
        chapterId: sessionData.chapterId,
        title: sessionData.title,
        s3link: sessionData.s3link,
        status: sessionData.status,
        isZoomMeet: sessionData.isZoomMeet,
        hasBeenMerged: sessionData.hasBeenMerged,
        mergeInfo: {
          isMerged: sessionData.hasBeenMerged,
          isParentSession: mergeInfo.length > 0,
          childSessions: mergeInfo.map(merge => merge.childSession).filter(Boolean),
          mergedStudentsCount: mergeInfo.length // Could be enhanced to show actual student count
        },
        joinUrl: sessionData.hangoutLink,
        platform: sessionData.isZoomMeet ? 'zoom' : 'google_meet'
      };

      // Add zoomStartUrl for admin if it's a Zoom meeting
      if (sessionData.isZoomMeet && sessionData.zoomStartUrl) {
        response['zoomStartUrl'] = sessionData.zoomStartUrl;
      }

      return {
        success: true,
        data: response,
        message: 'Session fetched successfully for admin'
      };
      
    } catch (error) {
      this.logger.error(`Error fetching session for admin ${sessionId}: ${error.message}`);
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
            
            // Also update corresponding Google Calendar event if it exists
            if (session.meetingId) {
              try {
                const calendarUpdateData = {
                  title: updateData.title ? `${updateData.title} (Zoom Meeting)` : undefined,
                  startTime: updateData.startTime,
                  endTime: updateData.endTime,
                  timeZone: updateData.timeZone,
                  description: updateData.description ? 
                    `${updateData.description}\n\nJoin Zoom Meeting: ${session.hangoutLink}\nMeeting ID: ${session.zoomMeetingId}\nPassword: ${session.zoomPassword}` : 
                    undefined
                };

                await this.updateGoogleCalendarEvent(session.meetingId, calendarUpdateData, userInfo);
                this.logger.log(`Google Calendar event ${session.meetingId} updated successfully`);
              } catch (calendarError) {
                this.logger.warn(`Failed to update Google Calendar event: ${calendarError.message}`);
                // Continue without failing the entire update
              }
            }
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
        
        // Also delete corresponding Google Calendar event if it exists
        if (sessionData.meetingId) {
          try {
            await this.deleteGoogleCalendarEvent(sessionData.meetingId, userInfo);
            this.logger.log(`Google Calendar event ${sessionData.meetingId} deleted`);
          } catch (error) {
            this.logger.error(`Failed to delete Google Calendar event: ${error.message}`);
            // Continue with deletion process
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

  async fetchZoomAttendanceForSession(sessionId: number, resetAttendanceData: boolean = false) {
    try {
      this.logger.log(`Fetching Zoom attendance for session: ${sessionId}, resetAttendanceData: ${resetAttendanceData}`);
      
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
      
      // Check if attendance data already exists (if not resetting)
      if (!resetAttendanceData) {
        // Check in zuvyStudentAttendance first
        const existingAttendance = await db
          .select()
          .from(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, sessionData.meetingId))
          .limit(1);
          
        if (existingAttendance.length > 0) {
          this.logger.log(`Found existing attendance data in zuvyStudentAttendance for session ${sessionId}`);
          return {
            success: true,
            data: {
              sessionId,
              attendance: existingAttendance[0].attendance,
              message: 'Existing attendance data found in zuvyStudentAttendance',
              source: 'existing_aggregate'
            },
            message: 'Attendance data retrieved from existing records'
          };
        }
        
        // Check in zuvyStudentAttendanceRecords
        const existingIndividualRecords = await db
          .select({
            userId: zuvyStudentAttendanceRecords.userId,
            status: zuvyStudentAttendanceRecords.status,
            attendanceDate: zuvyStudentAttendanceRecords.attendanceDate,
            email: users.email,
          })
          .from(zuvyStudentAttendanceRecords)
          .innerJoin(users, eq(zuvyStudentAttendanceRecords.userId, users.id))
          .where(eq(zuvyStudentAttendanceRecords.sessionId, sessionData.id));
          
        if (existingIndividualRecords.length > 0) {
          this.logger.log(`Found existing attendance data in zuvyStudentAttendanceRecords for session ${sessionId}`);
          
          // Convert individual records to the expected format
          const formattedAttendance = existingIndividualRecords.map(record => ({
            email: record.email,
            duration: 0, // Duration not stored in individual records, set to 0
            attendance: record.status.toLowerCase()
          }));
          
          return {
            success: true,
            data: {
              sessionId,
              attendance: formattedAttendance,
              totalParticipants: formattedAttendance.length,
              meetingDuration: 0, // Not available from individual records
              meetingDurationInMinutes: 0,
              hostTotalDuration: 0,
              attendanceThreshold: 0,
              message: 'Existing attendance data found in zuvyStudentAttendanceRecords',
              source: 'existing_individual'
            },
            message: 'Attendance data retrieved from existing individual records'
          };
        }
        
        this.logger.log(`No existing attendance data found for session ${sessionId}, fetching from Zoom`);
      } else {
        this.logger.log(`resetAttendanceData is true, will delete existing data and fetch fresh from Zoom`);
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
        
        // Fetch attendance using meeting UUID4
        console.log(`Fetching participants for Zoom meeting ID: ${sessionData.zoomMeetingId}`);
        const zoomAttendanceResponse = await this.zoomService.getMeetingParticipants(sessionData.zoomMeetingId);
        console.log(`Zoom attendance response: ${JSON.stringify(zoomAttendanceResponse)}`);
        
        // Calculate total meeting duration based on host's presence
        let totalMeetingDuration = 0;
        const hostEmail = 'team@zuvy.org';
        
        if (zoomAttendanceResponse.participants && zoomAttendanceResponse.participants.length > 0) {
          // Filter host entries and sum their durations
          const hostEntries = zoomAttendanceResponse.participants.filter(
            participant => participant.user_email === hostEmail
          );
          
          totalMeetingDuration = hostEntries.reduce((total, entry) => {
            return total + (entry.duration || 0);
          }, 0);
          
          console.log(`Host entries: ${JSON.stringify(hostEntries)}`);
          console.log(`Total meeting duration based on host presence: ${totalMeetingDuration} seconds`);
        }
        
        // Process and save attendance data
        const students = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
          })
          .from(zuvyBatchEnrollments)
          .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
          .where(eq(zuvyBatchEnrollments.batchId, sessionData.batchId));
        
        // Calculate attendance based on duration threshold (75% of host's total time)
        const attendanceThreshold = totalMeetingDuration * 0.75;
        console.log(`Attendance threshold (75% of ${totalMeetingDuration}s): ${attendanceThreshold}s`);
        
        // Save attendance to database
        const attendanceRecords = [];
        for (const student of students) {
          // Sum up all durations for this student across multiple join/leave cycles
          const studentEntries = zoomAttendanceResponse.participants?.filter(
            participant => participant.user_email === student.email
          ) || [];
          
          const totalStudentDuration = studentEntries.reduce((total, entry) => {
            return total + (entry.duration || 0);
          }, 0);
          
          const isPresent = totalStudentDuration >= attendanceThreshold;
          
          // Format to match requested structure: [{"email": "", "duration": 1700, "attendance": "present"}]
          const attendanceRecord = {
            email: student.email,
            duration: totalStudentDuration,
            attendance: isPresent ? 'present' : 'absent',
          };
          
          attendanceRecords.push(attendanceRecord);
          console.log(`Student: ${student.email}, Total Duration: ${totalStudentDuration}s, Status: ${isPresent ? 'present' : 'absent'}`);
        }
        
        // Delete existing attendance records only if resetAttendanceData is true
        if (resetAttendanceData) {
          await db.delete(zuvyStudentAttendance)
            .where(eq(zuvyStudentAttendance.meetingId, sessionData.meetingId));
          
          await db.delete(zuvyStudentAttendanceRecords)
            .where(eq(zuvyStudentAttendanceRecords.sessionId, sessionData.id));
            
          this.logger.log(`Deleted existing attendance records for session ${sessionId}`);
        }
        
        // Insert new attendance record with JSONB data
        if (attendanceRecords.length > 0) {
          await db.insert(zuvyStudentAttendance).values({
            meetingId: sessionData.meetingId,
            attendance: attendanceRecords,
            batchId: sessionData.batchId,
            bootcampId: sessionData.bootcampId,
          });
          
          // Insert individual attendance records for each student
          const individualRecords = [];
          const attendanceDate = new Date(sessionData.startTime).toISOString().split('T')[0]; // Format as YYYY-MM-DD
          
          for (const student of students) {
            const attendanceRecord = attendanceRecords.find(record => record.email === student.email);
            const status = attendanceRecord ? attendanceRecord.attendance : 'absent';
            
            individualRecords.push({
              userId: Number(student.id),
              batchId: sessionData.batchId,
              bootcampId: sessionData.bootcampId,
              sessionId: sessionData.id,
              attendanceDate: attendanceDate,
              status: status.toUpperCase(), // Convert to uppercase to match enum (PRESENT/ABSENT)
              version: 'v1', // You can modify this version as needed
            });
          }
          
          if (individualRecords.length > 0) {
            await db.insert(zuvyStudentAttendanceRecords).values(individualRecords);
            console.log(`Inserted ${individualRecords.length} individual attendance records`);
          }
        }
        
        return {
          success: true,
          data: { 
            sessionId, 
            attendance: attendanceRecords,
            totalParticipants: zoomAttendanceResponse?.participants?.length || 0,
            meetingDuration: totalMeetingDuration, // Use calculated host duration
            meetingDurationInMinutes: Math.round(totalMeetingDuration / 60),
            hostTotalDuration: totalMeetingDuration,
            attendanceThreshold: attendanceThreshold
          },
          message: 'Zoom attendance fetched and saved successfully'
        };
        
      } catch (zoomError) {
        this.logger.error(`Error fetching from Zoom API: ${zoomError.message}`);
        return {
          success: false,
          error: zoomError.message,
          message: 'Failed to fetch attendance from Zoom'
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

  async fetchGoogleMeetAttendanceForSession(sessionId: number, resetAttendanceData: boolean = false) {
    try {
      this.logger.log(`Fetching Google Meet attendance for session: ${sessionId}, resetAttendanceData: ${resetAttendanceData}`);
      
      // Get session details
      const session = await db.select().from(zuvySessions)
        .where(eq(zuvySessions.id, sessionId));
        
      if (!session.length) {
        return { success: false, message: 'Session not found' };
      }
      
      const sessionData = session[0];
      
      if (sessionData.isZoomMeet) {
        return { success: false, message: 'This is not a Google Meet session' };
      }
      
      if (!sessionData.meetingId) {
        return { success: false, message: 'No Google Meet meeting ID found for this session' };
      }
      
      // Check if attendance data already exists (if not resetting)
      if (!resetAttendanceData) {
        // Check in zuvyStudentAttendance first
        const existingAttendance = await db
          .select()
          .from(zuvyStudentAttendance)
          .where(eq(zuvyStudentAttendance.meetingId, sessionData.meetingId))
          .limit(1);
          
        if (existingAttendance.length > 0) {
          this.logger.log(`Found existing attendance data in zuvyStudentAttendance for session ${sessionId}`);
          return {
            success: true,
            data: {
              sessionId,
              attendance: existingAttendance[0].attendance,
              message: 'Existing attendance data found in zuvyStudentAttendance',
              source: 'existing_aggregate'
            },
            message: 'Attendance data retrieved from existing records'
          };
        }
        
        // Check in zuvyStudentAttendanceRecords
        const existingIndividualRecords = await db
          .select({
            userId: zuvyStudentAttendanceRecords.userId,
            status: zuvyStudentAttendanceRecords.status,
            attendanceDate: zuvyStudentAttendanceRecords.attendanceDate,
            email: users.email,
          })
          .from(zuvyStudentAttendanceRecords)
          .innerJoin(users, eq(zuvyStudentAttendanceRecords.userId, users.id))
          .where(eq(zuvyStudentAttendanceRecords.sessionId, sessionData.id));
          
        if (existingIndividualRecords.length > 0) {
          this.logger.log(`Found existing attendance data in zuvyStudentAttendanceRecords for session ${sessionId}`);
          
          // Convert individual records to the expected format
          const formattedAttendance = existingIndividualRecords.map(record => ({
            email: record.email,
            duration: 0, // Duration not stored in individual records, set to 0
            attendance: record.status.toLowerCase()
          }));
          
          return {
            success: true,
            data: {
              sessionId,
              attendance: formattedAttendance,
              totalParticipants: formattedAttendance.length,
              meetingDuration: 0, // Not available from individual records
              meetingDurationInMinutes: 0,
              hostTotalDuration: 0,
              attendanceThreshold: 0,
              message: 'Existing attendance data found in zuvyStudentAttendanceRecords',
              source: 'existing_individual'
            },
            message: 'Attendance data retrieved from existing individual records'
          };
        }
        
        this.logger.log(`No existing attendance data found for session ${sessionId}, fetching from Google Meet`);
      } else {
        this.logger.log(`resetAttendanceData is true, will delete existing data and fetch fresh from Google Meet`);
      }
      
      try {
        // Get student emails for the batch first
        const students = await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
          })
          .from(zuvyBatchEnrollments)
          .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
          .where(eq(zuvyBatchEnrollments.batchId, sessionData.batchId));
        
        // Use the existing Google Meet attendance fetching logic
        const googleMeetAttendance = await this.fetchAttendanceForMeeting(
          sessionData.meetingId, 
          students, 
          sessionData.batchId, 
          sessionData.bootcampId
        );
        
        if (!googleMeetAttendance) {
          return {
            success: false,
            message: 'Failed to fetch attendance from Google Meet API'
          };
        }
        
        // Delete existing attendance records only if resetAttendanceData is true
        if (resetAttendanceData) {
          await db.delete(zuvyStudentAttendance)
            .where(eq(zuvyStudentAttendance.meetingId, sessionData.meetingId));
          
          await db.delete(zuvyStudentAttendanceRecords)
            .where(eq(zuvyStudentAttendanceRecords.sessionId, sessionData.id));
            
          this.logger.log(`Deleted existing attendance records for session ${sessionId}`);
        }
        
        // Insert individual attendance records for each student
        if (googleMeetAttendance.length > 0) {
          const individualRecords = [];
          const attendanceDate = new Date(sessionData.startTime).toISOString().split('T')[0]; // Format as YYYY-MM-DD
          
          for (const student of students) {
            const attendanceRecord = googleMeetAttendance.find(record => record.email === student.email);
            const status = attendanceRecord ? attendanceRecord.attendance : 'absent';
            
            individualRecords.push({
              userId: Number(student.id),
              batchId: sessionData.batchId,
              bootcampId: sessionData.bootcampId,
              sessionId: sessionData.id,
              attendanceDate: attendanceDate,
              status: status.toUpperCase(), // Convert to uppercase to match enum (PRESENT/ABSENT)
              version: 'v1', // You can modify this version as needed
            });
          }
          
          if (individualRecords.length > 0) {
            await db.insert(zuvyStudentAttendanceRecords).values(individualRecords);
            console.log(`Inserted ${individualRecords.length} individual Google Meet attendance records`);
          }
        }
        
        return {
          success: true,
          data: { 
            sessionId, 
            attendance: googleMeetAttendance,
            totalParticipants: googleMeetAttendance?.length || 0,
            meetingDuration: 0, // Not available from Google Meet API in this format
            meetingDurationInMinutes: 0,
            hostTotalDuration: 0,
            attendanceThreshold: 0,
            message: 'Google Meet attendance fetched and saved successfully',
            source: 'google_meet_api'
          },
          message: 'Google Meet attendance fetched and saved successfully'
        };
        
      } catch (googleMeetError) {
        this.logger.error(`Error fetching from Google Meet API: ${googleMeetError.message}`);
        return {
          success: false,
          error: googleMeetError.message,
          message: 'Failed to fetch attendance from Google Meet'
        };
      }
      
    } catch (error) {
      this.logger.error(`Error fetching Google Meet attendance for session ${sessionId}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        message: 'Failed to fetch Google Meet attendance for session'
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

  async mergeClasses(childSessionId: number, parentSessionId: number, userInfo: any) {
    try {
      this.logger.log(`Merging classes: childSessionId=${childSessionId}, parentSessionId=${parentSessionId}`);
      // Get both sessions
      const [childSession, parentSession] = await Promise.all([
        db.select().from(zuvySessions).where(eq(zuvySessions.id, childSessionId)),
        db.select().from(zuvySessions).where(eq(zuvySessions.id, parentSessionId))
      ]);

      if (!childSession.length) {
        return {
          success: false,
          message: 'Child session not found',
          code: 404,
        };
      }

      if (!parentSession.length) {
        return {
          success: false,
          message: 'Parent session not found',
          code: 404,
        };
      }

      const childSessionData = childSession[0];
      const parentSessionData = parentSession[0];

      // Get students from CHILD session's batch only
      const childBatchStudents = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name
        })
        .from(zuvyBatchEnrollments)
        .innerJoin(users, eq(zuvyBatchEnrollments.userId, users.id))
        .where(eq(zuvyBatchEnrollments.batchId, childSessionData.batchId));

      if (childBatchStudents.length === 0) {
        return {
          success: false,
          message: 'No students found in child session batch',
          code: 404,
        };
      }

      this.logger.log(`Found ${childBatchStudents.length} students in child batch to add to parent session`);

      // Prepare student details for invites
      const studentEmails = childBatchStudents.map(student => student.email);
      const studentDetails = childBatchStudents.map(student => ({
        email: student.email,
        name: student.name || student.email.split('@')[0],
      }));

      // Update PARENT session with child session students
      // Update Google Calendar if parent session has Google Calendar event
      if (parentSessionData.meetingId && !parentSessionData.isZoomMeet) {
        try {
          await this.addAttendeesToGoogleCalendar(
            parentSessionData.meetingId,
            studentEmails,
            userInfo
          );
          this.logger.log('Successfully added child session students to parent session Google Calendar event');
        } catch (calendarError) {
          this.logger.error(`Failed to update Google Calendar: ${calendarError.message}`);
          // Continue with the process even if calendar update fails
        }
      }

      // Update Zoom meeting if parent session is a Zoom meeting
      if (parentSessionData.isZoomMeet && parentSessionData.zoomMeetingId) {
        try {
          await this.updateZoomMeetingInvitees(
            parentSessionData.zoomMeetingId,
            studentDetails
          );
          this.logger.log('Successfully updated parent session Zoom meeting with child session students');
        } catch (zoomError) {
          this.logger.error(`Failed to update Zoom meeting: ${zoomError.message}`);
          // Continue with the process even if Zoom update fails
        }
      }

      // Create redirect meeting URL (use parent session's meeting link)
      const redirectMeetingUrl = parentSessionData.isZoomMeet 
        ? parentSessionData.hangoutLink  // Zoom join URL stored in hangoutLink
        : parentSessionData.hangoutLink; // Google Meet link

      // Insert record in zuvySessionMerge table
      const mergeRecord = await db
        .insert(zuvySessionMerge)
        .values({
          childSessionId: childSessionId,
          parentSessionId: parentSessionId,
          redirectMeetingUrl: redirectMeetingUrl,
          mergedJustification: `Merged ${childBatchStudents.length} students from child session batch into parent session`,
          mergedBy: userInfo.id,
          isActive: true,
        } as any)
        .returning();

      // Mark BOTH sessions as merged and set parent/child flags
      await Promise.all([
        db.update(zuvySessions)
          .set({ 
            hasBeenMerged: true,
            isChildSession: true,
            isParentSession: false,
            status: 'merged'
          } as any)
          .where(eq(zuvySessions.id, childSessionId)),
        
        db.update(zuvySessions)
          .set({ 
            hasBeenMerged: true,
            isParentSession: true,
            isChildSession: false
          } as any)
          .where(eq(zuvySessions.id, parentSessionId))
      ]);

      return {
        success: true,
        message: 'Classes merged successfully',
        code: 200,
        data: {
          mergeRecord: mergeRecord[0],
          studentsAdded: childBatchStudents.length,
          parentSession: {
            id: parentSessionData.id,
            title: parentSessionData.title,
            platform: parentSessionData.isZoomMeet ? 'zoom' : 'google_meet',
            status: 'active', // Parent session becomes/remains the main session
          },
          childSession: {
            id: childSessionData.id,
            title: childSessionData.title,
            batchId: childSessionData.batchId,
            status: 'merged', // Child session is marked as merged
          },
          redirectUrl: redirectMeetingUrl,
        },
      };

    } catch (error) {
      this.logger.error(`Error merging classes: ${error.message}`);
      return {
        success: false,
        message: 'Failed to merge classes',
        code: 500,
        error: error.message,
      };
    }
  }

  private async addAttendeesToGoogleCalendar(eventId: string, emails: string[], userInfo: any) {
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

      // Get current event
      const currentEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: eventId,
      });

      // Get existing attendees
      const existingAttendees = currentEvent.data.attendees || [];
      const existingEmails = new Set(existingAttendees.map(attendee => attendee.email));

      // Add new attendees (avoid duplicates)
      const newAttendees = emails
        .filter(email => !existingEmails.has(email))
        .map(email => ({ email }));

      if (newAttendees.length === 0) {
        this.logger.log('No new attendees to add to Google Calendar event');
        return;
      }

      // Update event with new attendees
      await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: {
          ...currentEvent.data,
          attendees: [...existingAttendees, ...newAttendees],
        },
      });

      this.logger.log(`Added ${newAttendees.length} new attendees to Google Calendar event ${eventId}`);
    } catch (error) {
      this.logger.error(`Error adding attendees to Google Calendar: ${error.message}`);
      throw error;
    }
  }

  private async updateZoomMeetingInvitees(zoomMeetingId: string, studentDetails: { email: string; name: string }[]) {
    try {
      // Get current meeting details
      const currentMeeting = await this.zoomService.getMeeting(zoomMeetingId);
      if (!currentMeeting.success) {
        throw new Error(`Failed to get current Zoom meeting: ${currentMeeting.error}`);
      }

      // Prepare invitees data
      const newInvitees = studentDetails.map(student => ({
        email: student.email,
        name: student.name,
      }));

      // Prepare update data with new invitees
      const updateData = {
        settings: {
          meeting_invitees: newInvitees,
          // Add other settings that should be preserved
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          attendance_reporting: true,
        },
      };

      // Update Zoom meeting
      try {
        await this.zoomService.updateMeeting(zoomMeetingId, updateData);
        this.logger.log(`Added ${newInvitees.length} invitees to Zoom meeting ${zoomMeetingId}`);
      } catch (updateError) {
        this.logger.error(`Failed to update Zoom meeting invitees: ${updateError.message}`);
        throw updateError;
      }

    } catch (error) {
      this.logger.error(`Error updating Zoom meeting invitees: ${error.message}`);
      throw error;
    }
  }
}
