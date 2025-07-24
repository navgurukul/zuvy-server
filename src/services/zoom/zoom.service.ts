import { Inject, Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { google } from 'googleapis';
import { zuvySessions, userTokens } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq } from 'drizzle-orm';

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private readonly baseUrl = 'https://api.zoom.us/v2';
  private accessToken: string;

  constructor() {
    this.accessToken = '';
    this.generateAccessToken();
  }

  private async generateAccessToken(): Promise<void> {
    const tokenUrl = 'https://zoom.us/oauth/token';
    const authHeader = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');

    try {
      const response = await axios.post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'account_credentials',
          account_id: process.env.ZOOM_ACCOUNT_ID || '',
        }),
        {
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );

      this.accessToken = response.data.access_token;
      this.logger.log('Zoom access token generated successfully.');
    } catch (error) {
      this.logger.error(`Error generating Zoom access token: ${error.response?.data || error.message}`);
      throw new Error('Failed to generate Zoom access token.');
    }
  }

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async createMeeting(meetingData: any): Promise<any> {
    const url = `${this.baseUrl}/users/me/meetings`;

    try {
      this.logger.log(`Sending request to Zoom API: ${url}`);
      this.logger.log(`Request payload: ${JSON.stringify(meetingData)}`);

      const response: AxiosResponse<any> = await axios.post(url, meetingData, {
        headers: this.getHeaders(),
      });

      this.logger.log(`Zoom meeting created: ${response.data.id}`);
      return response.data;
    } catch (error) {
      this.logger.error(`Create Zoom meeting failed: ${error.response?.data || error.message}`);
      throw new Error(`Zoom meeting creation failed`);
    }
  }

  async deleteMeeting(meetingId: string): Promise<void> {
    const url = `${this.baseUrl}/meetings/${meetingId}`;
    try {
      await axios.delete(url, { headers: this.getHeaders() });
      this.logger.log(`Zoom meeting deleted: ${meetingId}`);
    } catch (error) {
      this.logger.error(`Delete Zoom meeting failed: ${error.message}`);
      throw error;
    }
  }

  async getMeeting(meetingId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;
      const response: AxiosResponse<any> = await axios.get(url, { headers: this.getHeaders() });
      this.logger.log(`Zoom meeting fetched successfully: ${response.data.id}`);
      return { success: true, data: response.data };
    } catch (error) {
      this.logger.error(`Error fetching Zoom meeting: ${error.response?.data || error.message}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async updateMeeting(meetingId: string, meetingData: any): Promise<void> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;
      await axios.patch(url, meetingData, { headers: this.getHeaders() });
      this.logger.log(`Zoom meeting updated successfully: ${meetingId}`);
    } catch (error) {
      this.logger.error(`Error updating Zoom meeting: ${error.response?.data || error.message}`);
      throw new Error(`Failed to update Zoom meeting: ${error.response?.data?.message || error.message}`);
    }
  }

  async getMeetingParticipants(meetingUuid: string): Promise<{ success: boolean; data?: any; participants?: any; error?: string }> {
    try {
      const encodedUuid = encodeURIComponent(meetingUuid);
      const url = `${this.baseUrl}/report/meetings/${encodedUuid}/participants`;
      const response: AxiosResponse<any> = await axios.get(url, { headers: this.getHeaders() });
      this.logger.log(`Zoom meeting participants fetched successfully for UUID: ${meetingUuid}`);
      return { success: true, data: response.data, participants: response.data.participants };
    } catch (error) {
      this.logger.error(`Error fetching Zoom meeting participants: ${error.response?.data || error.message}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  async getMeetingRecordings(meetingId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}/recordings`;
      const response: AxiosResponse<any> = await axios.get(url, { headers: this.getHeaders() });
      this.logger.log(`Zoom meeting recordings fetched successfully for meeting: ${meetingId}`);
      return { success: true, data: response.data };
    } catch (error) {
      this.logger.error(`Error fetching Zoom meeting recordings: ${error.response?.data || error.message}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  calculateAttendance(participants: any[], durationThreshold: number = 0.75): Array<{ email: string; duration: number; attendance: 'present' | 'absent' }> {
    if (!participants || participants.length === 0) {
      return [];
    }

    const maxDuration = Math.max(...participants.map(p => p.duration));
    const attendanceThreshold = maxDuration * durationThreshold;

    return participants.map(participant => ({
      email: participant.user_email,
      duration: participant.duration,
      attendance: participant.duration >= attendanceThreshold ? 'present' : 'absent',
    }));
  }

  async createAndStoreZoomMeeting(meetingData: any, eventDetails: any, creatorInfo: any): Promise<any> {
    const zoomResponse = await this.createMeeting(meetingData);

    // Synchronize with Google Calendar using user's tokens
    try {
      await this.createGoogleCalendarEvent(zoomResponse, creatorInfo.id);
      this.logger.log(`Google Calendar event created for Zoom meeting: ${zoomResponse.id}`);
    } catch (error) {
      this.logger.error(`Failed to create Google Calendar event: ${error.message}`);
      throw new Error(`Failed to synchronize with Google Calendar: ${error.message}`);
    }

    // Store in zuvySessions table
    const session = {
      meetingId: zoomResponse.id.toString(),
      hangoutLink: zoomResponse.join_url, // Required field - using Zoom join URL
      creator: creatorInfo.email,
      startTime: eventDetails.startDateTime,
      endTime: eventDetails.endDateTime,
      batchId: eventDetails.batchId,
      bootcampId: eventDetails.bootcampId,
      moduleId: eventDetails.moduleId,
      chapterId: eventDetails.chapterId || 1, // Use provided chapterId or default to 1
      title: eventDetails.title,
      isZoomMeet: true,
      zoomStartUrl: zoomResponse.start_url,
      zoomPassword: zoomResponse.password,
      zoomMeetingId: zoomResponse.id.toString(),
      status: 'upcoming',
    };

    try {
      await db.insert(zuvySessions).values(session);
      this.logger.log(`Zoom meeting stored successfully in zuvySessions: ${session.meetingId}`);
      return { success: true, data: session };
    } catch (error) {
      this.logger.error(`Failed to store Zoom meeting in zuvySessions: ${error.message}`);
      throw new Error(`Failed to store Zoom meeting in zuvySessions: ${error.message}`);
    }
  }

  async createGoogleCalendarEvent(meeting: any, userId: number): Promise<void> {
    try {
      // Fetch user tokens from database
      const userTokensRecord = await db.select().from(userTokens).where(eq(userTokens.userId, userId)).limit(1);
      
      if (!userTokensRecord || userTokensRecord.length === 0) {
        throw new Error(`No Google tokens found for user ID: ${userId}`);
      }

      const { accessToken, refreshToken } = userTokensRecord[0];

      const { OAuth2 } = google.auth;
      const oauth2Client = new OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );

      oauth2Client.setCredentials({ 
        access_token: accessToken,
        refresh_token: refreshToken 
      });

      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

      const event = {
        summary: meeting.topic,
        description: `Zoom Join URL: ${meeting.join_url}`,
        start: {
          dateTime: meeting.start_time,
          timeZone: meeting.timezone,
        },
        end: {
          dateTime: new Date(new Date(meeting.start_time).getTime() + meeting.duration * 60000).toISOString(),
          timeZone: meeting.timezone,
        },
        attendees: [
          { email: meeting.host_email },
        ],
      };

      this.logger.log(`Sending request to Google Calendar API with payload: ${JSON.stringify(event)}`);

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      this.logger.log(`Google Calendar event created: ${response.data.htmlLink}`);
    } catch (error) {
      this.logger.error(`Failed to create Google Calendar event: ${error.response?.data || error.message}`);
      throw error;
    }
  }
}
