import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosResponse } from 'axios';
import { db } from '../../db';
import { zuvySessions, AttendanceStatus,zuvyBatches,users } from '../../../drizzle/schema';
import { eq } from 'drizzle-orm';

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

export interface ZoomParticipantReportResponse {
  page_count?: number;
  page_size?: number;
  total_records?: number;
  next_page_token?: string;
  participants: ZoomParticipant[];
}

interface ZoomParticipant {
  id: string;
  name: string;
  user_email?: string;
  join_time: string;
  leave_time: string;
  duration: number; // Duration in seconds
  // Add other fields you might need
}

export interface ZoomRecordingFile {
  id: string;
  file_type: 'MP4' | 'M4A' | 'TIMELINE' | 'TRANSCRIPT' | 'CHAT';
  play_url: string;
  download_url: string;
  recording_type: 'shared_screen_with_speaker_view' | 'shared_screen_with_gallery_view' | 'speaker_view' | 'gallery_view' | 'shared_screen' | 'audio_only' | 'chat_file' | 'timeline';
}

export interface ZoomRecordingResponse {
  uuid: string;
  id: number;
  topic: string;
  duration: number;
  start_time: string;
  recording_files: ZoomRecordingFile[];
}

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private readonly baseUrl = 'https://api.zoom.us/v2';
  // Simple in-memory token cache (process lifetime). Avoids generating a new token for every request.
  private tokenCache: { accessToken: string; expiresAt: number } | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  private async generateAccessToken(): Promise<{ accessToken: string; expiresIn: number }> {
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
      const accessToken = response.data.access_token;
      const expiresIn: number = Number(response.data.expires_in) || 3500; // seconds
      const expiresAt = Date.now() + (expiresIn * 1000);
      this.tokenCache = { accessToken, expiresAt };
      this.logger.log(`Zoom access token generated successfully (expires in ${expiresIn}s).`);
      return { accessToken, expiresIn };
    } catch (error) {
      this.logger.error(`Error generating Zoom access token: ${error.response?.data || error.message}`);
      throw new Error('Failed to generate Zoom access token.');
    }
  }

  private async getHeaders() {
    try {
      // Reuse valid token if not near expiry (60s buffer)
      if (this.tokenCache && Date.now() < this.tokenCache.expiresAt - 60_000) {
        return {
          Authorization: `Bearer ${this.tokenCache.accessToken}`,
          'Content-Type': 'application/json',
        };
      }
      // Prevent thundering herd: reuse in-flight refresh promise
      if (!this.tokenRefreshPromise) {
        this.tokenRefreshPromise = this.generateAccessToken()
          .then(r => r.accessToken)
          .finally(() => { this.tokenRefreshPromise = null; });
      }
      const newToken = await this.tokenRefreshPromise;
      return {
        Authorization: `Bearer ${newToken}`,
        'Content-Type': 'application/json',
      };
    } catch (e) {
      this.logger.error(`Failed to obtain Zoom headers: ${e.message}`);
      throw e;
    }
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
        { headers: await this.getHeaders() }
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

  // Re-added helper: create meeting for specific user (email or userId)
  async createMeetingForUser(userEmailOrId: string, meetingData: ZoomMeetingRequest): Promise<{ success: boolean; data?: ZoomMeetingResponse; error?: string }> {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(userEmailOrId)}/meetings`;
      const response: AxiosResponse<ZoomMeetingResponse> = await axios.post(url, meetingData, { headers: await this.getHeaders() });
      this.logger.log(`Zoom meeting (host=${userEmailOrId}) created: ${response.data.id}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      this.logger.error(`Error creating Zoom meeting for ${userEmailOrId}: ${error.response?.data || error.message}`);
      return { success: false, error: error.response?.data?.message || error.message };
    }
  }

  // Public so controller can fetch directly
  async getUser(email: string) {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(email)}`;
      const res = await axios.get(url, { headers: await this.getHeaders() });
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  async createUser(email: string, firstName = '', lastName = '') {
    try {
      const url = `${this.baseUrl}/users`;
      const payload = { action: 'create', user_info: { email, type: 1, first_name: firstName, last_name: lastName } };
      const res = await axios.post(url, payload, { headers: await this.getHeaders() });
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  async setUserLicense(email: string, type: 1|2|3) {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(email)}`;
      await axios.patch(url, { type }, { headers: await this.getHeaders() });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  /**
   * Ensure a user exists and is licensed. Returns detailed status so caller can decide
   * whether to include as alternative host (Zoom requires Licensed + Active user).
   */
  async ensureLicensedUser(email: string, firstName = '', lastName = ''): Promise<{
    success: boolean;
    step?: string;
    error?: string;
    userType?: number;
    userStatus?: string;
    licensed?: boolean;
  }> {
    const user = await this.getUser(email);
    if (!user.success) {
      const created = await this.createUser(email, firstName, lastName);
      if (!created.success) return { success: false, step: 'create', error: created.error };
      // After creation, fetch again to inspect status
    }
    const afterCreate = await this.getUser(email);
    if (!afterCreate.success) return { success: false, step: 'fetch', error: afterCreate.error };

    // Attempt to license if not already licensed (type 2)
    if (afterCreate.data.type !== 2) {
      const licensed = await this.setUserLicense(email, 2);
      if (!licensed.success) return { success: false, step: 'license', error: licensed.error, userType: afterCreate.data.type };
    }

    // Final verification
    const finalUser = await this.getUser(email);
    if (!finalUser.success) return { success: false, step: 'verify', error: finalUser.error };
    const userType = finalUser.data.type;
    const userStatus = finalUser.data.status; // expect 'active'
    const licensed = userType === 2 && userStatus === 'active';
    return { success: true, userType, userStatus, licensed };
  }

  /** Downgrade a user to Basic (type=1) */
  async downgradeUser(email: string) {
    const res = await this.setUserLicense(email, 1);
    if (!res.success) return { success: false, error: res.error };
    return { success: true };
  }

  /** Update user profile / license */
  async updateUser(update: { email: string; firstName?: string; lastName?: string; displayName?: string; phoneNumber?: string; timezone?: string; type?: 1|2|3 }) {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(update.email)}`;
      const body: any = {};
      if (update.firstName) body.first_name = update.firstName;
      if (update.lastName) body.last_name = update.lastName;
      if (update.timezone) body.timezone = update.timezone;
      if (update.type) body.type = update.type;
      // displayName / phoneNumber not always supported; include if provided
      if (update.displayName) body.display_name = update.displayName;
      if (update.phoneNumber) body.phone_number = update.phoneNumber;
      await axios.patch(url, body, { headers: await this.getHeaders() });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  /** List meetings for the authenticated (team) user */
  async listUserMeetings(type: string = 'upcoming') {
    try {
      const url = `${this.baseUrl}/users/me/meetings?type=${encodeURIComponent(type)}`;
      const res = await axios.get(url, { headers: await this.getHeaders() });
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  /**
   * Update an existing Zoom meeting
   */
  async updateMeeting(meetingId: string, meetingData: Partial<ZoomMeetingRequest>): Promise<void> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;
      
      await axios.patch(url, meetingData, { headers: await this.getHeaders() });
      
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
      
      await axios.delete(url, { headers: await this.getHeaders() });
      
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
        { headers: await this.getHeaders() }
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
  async getMeetingParticipants(meetingUuid: string): Promise<ZoomParticipantReportResponse> {
  try {
    const encodedUuid = encodeURIComponent(encodeURIComponent(meetingUuid));
    let allParticipants: ZoomParticipant[] = [];
    let nextPageToken = ''; // Start with an empty token

    // Use a do...while loop to fetch all pages of participants
    do {
      // Append the next_page_token and set a max page_size to reduce API calls
      const url = `${this.baseUrl}/report/meetings/${encodedUuid}/participants?page_size=300&next_page_token=${encodeURIComponent(nextPageToken)}`;
      
      const response: AxiosResponse<ZoomParticipantReportResponse> = await axios.get(
        url,
        { headers: await this.getHeaders() }
      );
      // Add the participants from the current page to our master list
      if (response.data && response.data.participants) {
        allParticipants = allParticipants.concat(response.data.participants);
      }

      // Get the token for the next page. If it's empty or null, the loop will end.
      nextPageToken = response.data.next_page_token;

    } while (nextPageToken);

    // Return the complete list of participants from all pages
    return { participants: allParticipants };

  } catch (error) {
    this.logger.error(`Error fetching Zoom meeting participants for UUID ${meetingUuid}: ${error.response?.data?.message || error.message}`);
    // Return an empty list on error to prevent the main aggregation loop from crashing
    return { participants: [] }; 
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
        { headers: await this.getHeaders() }
      );
      return response.data.share_url;
    } catch (error) {
      this.logger.error(`Error fetching Zoom meeting recordings: ${error.response?.data || error.message}`);
      throw new Error(`Failed to fetch Zoom meeting recordings: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Compute attendance & recordings at a 75% threshold of host duration.
   * Backwards-compatible wrapper: uses computeAttendance75 and fetches recordings.
   */
  async computeAttendanceAndRecordings75(meetingId: string | string[]) {
    // Support array input
    if (Array.isArray(meetingId)) {
      const results = [] as any[];
      for (const id of meetingId) {
        const single = await this.computeAttendance75(id);
        if (!single.success) {
          results.push({ meetingId: id, success: false, error: single.error });
          continue;
        }
        let recordings = null;
        try {
          recordings = await this.getMeetingRecordings(id).catch(() => null);
        } catch (_e) {
          recordings = null;
        }
        results.push({ meetingId: id, ...single.data, recordings });
      }
      return { success: true, data: results };
    }

    // Single meeting: compute attendance then fetch recordings
    const singleMeetingId = meetingId;
    const attendanceRes = await this.computeAttendance75(singleMeetingId);
    if (!attendanceRes.success) return attendanceRes;
    try {
      const recordings = await this.getMeetingRecordings(singleMeetingId).catch(() => null);
      return { success: true, data: { meetingId: singleMeetingId, ...attendanceRes.data, recordings } };
    } catch (e:any) {
      this.logger.error(`computeAttendanceAndRecordings75 failed when fetching recordings: ${e.message}`);
      return { success: true, data: { meetingId: singleMeetingId, ...attendanceRes.data, recordings: null } };
    }
  }

  /**
   * Compute attendance at 75% threshold only (no recordings fetched).
   */
  async computeAttendance75(meetingId: string | string[]) {
    // Support batch
    if (Array.isArray(meetingId)) {
      const results: any[] = [];
      for (const id of meetingId) {
        const single = await this.computeAttendance75(id);
        results.push({ meetingId: id, ...single });
      }
      return { success: true, data: results };
    }
    const singleMeetingId = meetingId;
    const session = await db.select().from(zuvySessions).where(eq(zuvySessions.zoomMeetingId, singleMeetingId)).limit(1);
    if (!session.length) {
      return { success: false, error: `No session found for meeting ID ${meetingId}` };
    }
    const batchId = session[0].batchId;
    const batchInfo = await db.select().from(zuvyBatches).where(eq(zuvyBatches.id, batchId)).limit(1);
    if (!batchInfo.length) {
      return { success: false, error: `No batch found for ID ${batchId}` };
    }
    const hostInfo = await db.select().from(users).where(eq(users.id, BigInt(batchInfo[0].instructorId))).limit(1);
    if (!hostInfo.length) {
      return { success: false, error: `No host found for instructor ID ${batchInfo[0].instructorId}` };
    }
    const hostEmail = hostInfo[0].email;
    try {
      const participantsResp = await this.getAllParticipantsForMeetingId(singleMeetingId);
      const hostDuration = (participantsResp || [])
        .filter(p => p.user_email === hostEmail)
        .reduce((a, b) => a + (b.duration || 0), 0);
      const thresholdRatio = 0.75;
      const threshold = hostDuration * thresholdRatio;
      // Build a map of user -> total duration
      const durationMap: Record<string, number> = {};
      for (const p of participantsResp || []) {
        if (!p.user_email) continue;
        durationMap[p.user_email] = (durationMap[p.user_email] || 0) + (p.duration || 0);
      }
      // Base attendance from participants
      const attendanceMap: Record<string, { email: string; duration: number; attendance: AttendanceStatus }> = {};
      for (const [email, dur] of Object.entries(durationMap)) {
        attendanceMap[email] = {
          email,
          duration: dur,
          attendance: dur >= threshold ? AttendanceStatus.PRESENT : AttendanceStatus.ABSENT
        };
      }
      // Fetch invitedStudents snapshot for the session (if any) to mark absent ones
      try {
        const sessionRows = await db
          .select({ invitedStudents: zuvySessions.invitedStudents })
          .from(zuvySessions)
          .where(eq(zuvySessions.zoomMeetingId, singleMeetingId))
          .limit(1);
        if (sessionRows.length) {
          const invited = sessionRows[0].invitedStudents || [];
          for (const student of invited) {
            if (!student.email) continue;
            if (!attendanceMap[student.email]) {
              attendanceMap[student.email] = {
                email: student.email,
                duration: 0,
                attendance: AttendanceStatus.ABSENT
              };
            }
          }
        }
      } catch (subErr: any) {
        this.logger.warn(`Failed to enrich attendance with invitedStudents for meeting ${singleMeetingId}: ${subErr.message}`);
      }
      const attendance = Object.values(attendanceMap);
      return { success: true, data: { meetingId: singleMeetingId, thresholdRatio, hostDuration, threshold, attendance } };
    } catch (e:any) {
      this.logger.error(`computeAttendance75 failed: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  /**
   * Fetch recordings for one or multiple meeting IDs (returns share_url or null)
   */
  async getMeetingRecordingsBatch(meetingId: string | string[]) {
    if (Array.isArray(meetingId)) {
      const results: any[] = [];
      for (const id of meetingId) {
        try {
          const rec = await this.getMeetingRecordings(id).catch(() => null);
          results.push({ meetingId: id, recordings: rec });
        } catch (e:any) {
          results.push({ meetingId: id, recordings: null, error: e.message });
        }
      }
      return { success: true, data: results };
    }
    try {
      const rec = await this.getMeetingRecordings(meetingId).catch(() => null);
      return { success: true, data: { meetingId, recordings: rec } };
    } catch (e:any) {
      return { success: false, error: e.message };
    }
  }

  // Assume you have your existing 'getMeetingParticipants(uuid)' function ready.

async getAllParticipantsForMeetingId(meetingId: string | number): Promise<any[]> {
  try {
    // Step 1: Get all past session UUIDs
    const instancesUrl = `${this.baseUrl}/past_meetings/${encodeURIComponent(meetingId)}/instances`;
    const instancesResponse = await axios.get(instancesUrl, { headers: await this.getHeaders() });
    const pastSessions = instancesResponse.data.meetings;

    if (!pastSessions || pastSessions.length === 0) return [];

    // Step 2: Fetch all participant lists from all sessions
    const allSessionReports = [];
    for (const session of pastSessions) {
      const report = await this.getMeetingParticipants(session.uuid);
      if (report && report.participants && report.participants.length > 0) {
        allSessionReports.push(report.participants);
      }
    }

    if (allSessionReports.length === 0) return [];

    // ========================================================================
    // NEW STEP: Consolidate each report to handle users rejoining the SAME session
    // ========================================================================
    const consolidatedReports = allSessionReports.map(report => {
      const consolidatedMap = new Map<string, ZoomParticipant>();
      for (const participant of report) {
        const key = participant.user_email || participant.name;
        if (!key) continue;

        if (consolidatedMap.has(key)) {
          // If we've already seen this person in THIS report, just add their duration
          const existingRecord = consolidatedMap.get(key)!;
          existingRecord.duration += participant.duration;
        } else {
          // Otherwise, add them to the map for this report
          consolidatedMap.set(key, { ...participant });
        }
      }
      return Array.from(consolidatedMap.values());
    });

    // Step 3: Identify the main summary report from the CLEANED reports
    consolidatedReports.sort((a, b) => b.length - a.length);
    const mainReport = consolidatedReports[0];
    const otherReports = consolidatedReports.slice(1);

    // Step 4: Use the main report as the primary source of truth
    const finalParticipantsMap = new Map();
    for (const participant of mainReport) {
      const key = participant.user_email || participant.name;
      if (key) {
        finalParticipantsMap.set(key, participant);
      }
    }

    // Step 5: Loop through OTHER reports ONLY to find participants missed by the main report
    for (const report of otherReports) {
      for (const participant of report) {
        const key = participant.user_email || participant.name;
        if (key && !finalParticipantsMap.has(key)) {
          finalParticipantsMap.set(key, participant);
        }
      }
    }

    return Array.from(finalParticipantsMap.values());

  } catch (error) {
    this.logger.error(`Failed to get all participants for meeting ID ${meetingId}: ${error.message}`);
    throw error;
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

  async getMeetingRecordingLink(meetingId: string | number): Promise<{ success: boolean; data?: { playUrl: string, topic: string, duration: number }; error?: string }> {
  try {
    // We need the access token to authenticate the download URL
    const headers = await this.getHeaders();
    const accessToken = headers.Authorization.replace('Bearer ', ''); // Extract token

    const url = `${this.baseUrl}/meetings/${encodeURIComponent(meetingId)}/recordings`;
    const response: AxiosResponse<ZoomRecordingResponse> = await axios.get(url, { headers });
    const recordingData = response.data;

    if (!recordingData || !recordingData.recording_files || recordingData.recording_files.length === 0) {
      this.logger.warn(`No recording files found for Zoom meeting ${meetingId}`);
      return { success: false, error: 'No recording files exist for this meeting.' };
    }

    // Find the desired MP4 video file from the list.
    const videoFile = 
      recordingData.recording_files.find(file => file.file_type === 'MP4' && file.recording_type === 'shared_screen_with_speaker_view') ||
      recordingData.recording_files.find(file => file.file_type === 'MP4');

    if (!videoFile) {
      this.logger.warn(`No MP4 video file found for Zoom meeting ${meetingId}`);
      return { success: false, error: 'An MP4 video file could not be found for this recording.' };
    }

    // *** MODIFICATION HERE ***
    // Construct the playable URL using the download_url and the access token.
    const playableUrl = `${videoFile.download_url}?access_token=${accessToken}`;

    this.logger.log(`Successfully fetched React Player URL for Zoom meeting: ${meetingId}`);
    
    return {
      success: true,
      data: {
        playUrl: playableUrl, // Use the newly constructed URL
        topic: recordingData.topic,
        duration: recordingData.duration,
      }
    };

  } catch (error: any) {
    this.logger.error(`Error fetching recording for Zoom meeting ${meetingId}: ${error.response?.data?.message || error.message}`);
    
    if (error.response?.status === 404) {
        return { success: false, error: `Meeting with ID ${meetingId} not found or has no recordings.` };
    }
    
    return { success: false, error: error.response?.data?.message || 'Failed to fetch recording details.' };
  }
}
}
