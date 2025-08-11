import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';

export interface ZoomMeetingRequest {
  topic: string;
  type: number; // 1 = instant, 2 = scheduled, 3 = recurring with no fixed time, 8 = recurring with fixed time
  start_time: string; // ISO 8601 format
  duration: number; // Duration in minutes
  timezone: string;
  password?: string;
  agenda?: string;
  recurrence?: {
    type: number; // 1 = Daily, 2 = Weekly, 3 = Monthly
    repeat_interval: number;
    weekly_days?: string; // 1,2,3,4,5,6,7 (Sunday = 1, Monday = 2, etc.)
    end_times?: number; // How many times to repeat
  };
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    cn_meeting?: boolean;
    in_meeting?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    watermark?: boolean;
    use_pmi?: boolean;
    approval_type?: number; // 0 = automatically approve, 1 = manually approve, 2 = no registration required
    audio?: string; // both, telephony, voip
    auto_recording?: string; // local, cloud, none
    enforce_login?: boolean;
    waiting_room?: boolean;
    // New attendance and meeting control settings
    attendance_reporting?: boolean; // Enable attendance tracking
    end_on_auto_off?: boolean; // End meeting when host leaves
    alternative_hosts_email_notification?: boolean;
    close_registration?: boolean;
    enforce_login_domains?: string;
    global_dial_in_countries?: string[];
    jbh_time?: number;
    meeting_authentication?: boolean;
    registrants_confirmation_email?: boolean;
    registrants_email_notification?: boolean;
    registration_type?: number;
    show_share_button?: boolean;
    allow_multiple_devices?: boolean;
    breakout_room?: {
      enable: boolean;
    };
    contact_email?: string;
    contact_name?: string;
    encryption_type?: string;
    focus_mode?: boolean;
    meeting_invitees?: any[];
    private_meeting?: boolean;
    pstn_password_protected?: boolean;
    request_permission_to_unmute_participants?: boolean;
    host_save_video_order?: boolean;
    // Google Calendar Integration Settings
    calendar_type?: number; // 1 for Google Calendar, 2 for Outlook
    auto_start_meeting_summary?: boolean;
    auto_start_ai_companion_questions?: boolean;
  };
  // YouTube Live Stream Configuration
  live_stream?: {
    active: boolean; // Enable/disable live streaming
    settings: {
      page_url: string; // YouTube channel URL
      stream_key: string; // YouTube stream key
      stream_url: string; // YouTube RTMP URL
    };
  };
}

export interface ZoomMeetingResponse {
  uuid: string;
  id: number;
  host_id: string;
  host_email: string;
  topic: string;
  type: number;
  status: string;
  start_time: string;
  duration: number;
  timezone: string;
  agenda: string;
  created_at: string;
  start_url: string;
  join_url: string;
  password: string;
  h323_password: string;
  pstn_password: string;
  encrypted_password: string;
  occurrences?: Array<{
    occurrence_id: string;
    start_time: string;
    duration: number;
    status: string;
  }>;
}

export interface ZoomAttendanceResponse {
  uuid: string;
  id: number;
  topic: string;
  host: string;
  email: string;
  user_type: string;
  start_time: string;
  end_time: string;
  duration: number;
  participants: Array<{
    id: string;
    user_id: string;
    name: string;
    user_email: string;
    join_time: string;
    leave_time: string;
    duration: number;
    attentiveness_score: string;
  }>;
}

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
      console.log('Zoom access token generated successfully:', this.accessToken);
      this.logger.log('Zoom access token generated successfully.');
    } catch (error) {
      this.logger.error(`Error generating Zoom access token: ${error.response?.data || error.message}`);
      throw new Error('Failed to generate Zoom access token.');
    }
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Create a new Zoom meeting
   */
  async createMeeting(meetingData: ZoomMeetingRequest): Promise<{ success: boolean; data?: ZoomMeetingResponse; error?: string }> {
    try {
      const url = `${this.baseUrl}/users/me/meetings`;
      
      const response: AxiosResponse<ZoomMeetingResponse> = await axios.post(
        url,
        meetingData,
        { headers: this.getHeaders() }
      );

      this.logger.log(`Zoom meeting created successfully: ${response.data.id}`);
      return { success: true, data: response.data };
    } catch (error) {
      this.logger.error(`Error creating Zoom meeting: ${error.response?.data || error.message}`);
      return { 
        success: false, 
        error: `Failed to create Zoom meeting: ${error.response?.data?.message || error.message}` 
      };
    }
  }

  /**
   * Update an existing Zoom meeting
   */
  async updateMeeting(meetingId: string, meetingData: Partial<ZoomMeetingRequest>): Promise<void> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;
      
      await axios.patch(url, meetingData, { headers: this.getHeaders() });
      
      this.logger.log(`Zoom meeting updated successfully: ${meetingId}`);
    } catch (error) {
      this.logger.error(`Error updating Zoom meeting: ${error.response?.data || error.message}`);
      throw new Error(`Failed to update Zoom meeting: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Delete a Zoom meeting
   */
  async deleteMeeting(meetingId: string): Promise<void> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;
      
      await axios.delete(url, { headers: this.getHeaders() });
      
      this.logger.log(`Zoom meeting deleted successfully: ${meetingId}`);
    } catch (error) {
      this.logger.error(`Error deleting Zoom meeting: ${error.response?.data || error.message}`);
      throw new Error(`Failed to delete Zoom meeting: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(meetingId: string): Promise<{ success: boolean; data?: ZoomMeetingResponse; error?: string }> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;
      
      const response: AxiosResponse<ZoomMeetingResponse> = await axios.get(
        url,
        { headers: this.getHeaders() }
      );

      return { success: true, data: response.data };
    } catch (error) {
      this.logger.error(`Error fetching Zoom meeting: ${error.response?.data || error.message}`);
      return {
        success: false,
        error: `Failed to fetch Zoom meeting: ${error.response?.data?.message || error.message}`
      };
    }
  }

  /**
   * Get meeting participants/attendance
   */
  async getMeetingParticipants(meetingUuid: string): Promise<ZoomAttendanceResponse> {
    try {
      // URL encode the UUID as it might contain special characters
      const encodedUuid = encodeURIComponent(meetingUuid);
      const url = `${this.baseUrl}/report/meetings/${encodedUuid}/participants`;
      
      const response: AxiosResponse<ZoomAttendanceResponse> = await axios.get(
        url,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching Zoom meeting participants: ${error.response?.data || error.message}`);
      throw new Error(`Failed to fetch Zoom meeting participants: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Get meeting recordings
   */
  async getMeetingRecordings(meetingId: string): Promise<any> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}/recordings`;
      
      const response: AxiosResponse<any> = await axios.get(
        url,
        { headers: this.getHeaders() }
      );

      return response.data;
    } catch (error) {
      this.logger.error(`Error fetching Zoom meeting recordings: ${error.response?.data || error.message}`);
      throw new Error(`Failed to fetch Zoom meeting recordings: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Create recurring meetings based on days of week and total classes
   */
  async createRecurringMeetings(
    meetingData: ZoomMeetingRequest,
    daysOfWeek: string[],
    totalClasses: number
  ): Promise<ZoomMeetingResponse[]> {
    try {
      const meetings: ZoomMeetingResponse[] = [];
      
      // Convert day names to Zoom's day numbers (Sunday = 1, Monday = 2, etc.)
      const dayToZoomDay: { [key: string]: number } = {
        'Sunday': 1,
        'Monday': 2,
        'Tuesday': 3,
        'Wednesday': 4,
        'Thursday': 5,
        'Friday': 6,
        'Saturday': 7,
      };

      const zoomDays = daysOfWeek.map(day => dayToZoomDay[day]).join(',');
      
      // Create recurring meeting
      const recurringMeetingData: ZoomMeetingRequest = {
        ...meetingData,
        type: 8, // Recurring with fixed time
        recurrence: {
          type: 2, // Weekly
          repeat_interval: 1,
          weekly_days: zoomDays,
          end_times: totalClasses,
        },
      };

      const response = await this.createMeeting(recurringMeetingData);
      if (response.success && response.data) {
        meetings.push(response.data);
      } else {
        throw new Error(response.error || 'Failed to create recurring meeting');
      }

      return meetings;
    } catch (error) {
      this.logger.error(`Error creating recurring Zoom meetings: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate attendance based on duration threshold
   */
  calculateAttendance(
    participants: ZoomAttendanceResponse['participants'],
    durationThreshold: number = 0.75
  ): Array<{ email: string; duration: number; attendance: 'present' | 'absent' }> {
    if (!participants || participants.length === 0) {
      return [];
    }

    // Find the longest duration (likely the host/instructor)
    const maxDuration = Math.max(...participants.map(p => p.duration));
    const attendanceThreshold = maxDuration * durationThreshold;

    return participants.map(participant => ({
      email: participant.user_email,
      duration: participant.duration,
      attendance: participant.duration >= attendanceThreshold ? 'present' : 'absent'
    }));
  }
}
