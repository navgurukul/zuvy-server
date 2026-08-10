import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { db } from '../../db';
import {
  zuvySessions,
  AttendanceStatus,
  zuvyBatches,
  users,
  zuvyUserLicenses,
} from '../../../drizzle/schema';
import { eq, sql } from 'drizzle-orm';
import {
  computeMergedDurationsByKey,
  ParticipantConnection,
} from 'src/services/attendance/attendance-duration-merge';

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
    waiting_room_options?: {
      mode?: string;
      who_goes_to_waiting_room?: string;
    };
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
  // Meeting-level fields (identical across every page of one occurrence) —
  // duration is in seconds, matching each participant row's own `duration`.
  duration?: number;
  start_time?: string;
  end_time?: string;
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
  recording_type:
    | 'shared_screen_with_speaker_view'
    | 'shared_screen_with_gallery_view'
    | 'speaker_view'
    | 'gallery_view'
    | 'shared_screen'
    | 'audio_only'
    | 'chat_file'
    | 'timeline';
  meeting_id: string;
  recording_start: string;
  file_size: number;
  recording_end: string;
}

interface ZoomRecordingDetails {
  uuid: string; // The critical Meeting UUID
  recording_files: ZoomRecordingFile[];
}

export interface ZoomRecordingResponse {
  uuid: string;
  id: number;
  topic: string;
  duration: number;
  start_time: string;
  recording_files: ZoomRecordingFile[];
}

interface ZoomUserListItem {
  id: string;
  first_name?: string;
  last_name?: string;
  display_name?: string;
  email: string;
  type: number;
  status: string;
  role_name?: string;
  timezone?: string;
  verified?: number;
  created_at?: string;
  last_login_time?: string;
}

interface ZoomUsersListResponse {
  page_count?: number;
  page_number?: number;
  page_size?: number;
  total_records?: number;
  next_page_token?: string;
  users?: ZoomUserListItem[];
}

type ZoomUserSettingsPayload = {
  security?: Record<string, unknown>;
  scheduled_meeting?: Record<string, unknown>;
  in_meeting?: Record<string, unknown>;
  email_notification?: Record<string, unknown>;
  recording?: Record<string, unknown>;
  feature?: Record<string, unknown>;
};

@Injectable()
export class ZoomService {
  private readonly logger = new Logger(ZoomService.name);
  private readonly baseUrl = 'https://api.zoom.us/v2';
  // Simple in-memory token cache (process lifetime). Avoids generating a new token for every request.
  private tokenCache: { accessToken: string; expiresAt: number } | null = null;
  private tokenRefreshPromise: Promise<string> | null = null;

  private buildLicensedUserSettingsPayload(): ZoomUserSettingsPayload {
    return {
      security: {
        waiting_room: true,
      },
      scheduled_meeting: {
        host_video: true,
        participants_video: true,
        audio_type: 'both',
        join_before_host: false,
        waiting_room: true,
        force_pmi_jbh_password: false,
        pstn_password_protected: false,
      },
      in_meeting: {
        waiting_room: true,
        waiting_room_settings: {
          participants_to_place_in_waiting_room: 2,
          users_who_can_admit_participants_from_waiting_room: 0,
        },

        e2e_encryption: true,

        chat: true,
        private_chat: true,
        auto_saving_chat: false,
        entry_exit_chime: 'none',
        record_play_voice: false,
        file_transfer: true,
        feedback: false,
        co_host: true,
        polling: true,
        attendee_on_hold: false,
        annotation: false,
        remote_control: false,
        non_verbal_feedback: true,
        breakout_room: true,
        remote_support: false,
        closed_caption: false,
        group_hd: false,
        virtual_background: true,
        far_end_camera_control: false,
      },
      email_notification: {
        jbh_reminder: false,
        cancel_meeting_reminder: true,
        alternative_host_reminder: true,
      },
      recording: {
        local_recording: true,
        cloud_recording: true,
        record_speaker_view: true,
        record_gallery_view: false,
        record_audio_file: true,
        save_chat_text: true,
        show_timestamp: false,
        recording_audio_transcript: true,
        auto_recording: 'cloud',
        host_pause_stop_recording: true,
      },
    };
  }

  async applyLicensedUserSettings(email: string) {
    const url = `${this.baseUrl}/users/${encodeURIComponent(email)}/settings`;
    const payload = this.buildLicensedUserSettingsPayload();

    try {
      await axios.patch(url, payload, {
        headers: await this.getHeaders(),
      });
      this.logger.log(
        `Applied Zoom licensed-user settings for ${email} successfully.`,
      );
      return { success: true };
    } catch (e: any) {
      const errorMessage = e.response?.data?.message || e.message;
      this.logger.warn(
        `Failed to apply Zoom licensed-user settings for ${email}: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  async syncZoomLicenseUser(input: {
    email: string;
    zoomUserId?: string | null;
    userName?: string | null;
    licenseType: number;
    status?: string | null;
    isProtected?: boolean;
  }) {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingRows = await db
      .select({
        isProtected: zuvyUserLicenses.isProtected,
      })
      .from(zuvyUserLicenses)
      .where(eq(zuvyUserLicenses.zoomEmail, normalizedEmail))
      .limit(1);

    const resolvedIsProtected =
      input.isProtected ?? existingRows[0]?.isProtected ?? false;

    await db
      .insert(zuvyUserLicenses)
      .values({
        zoomEmail: normalizedEmail,
        zoomUserId: input.zoomUserId || null,
        userName: input.userName || normalizedEmail,
        licenseType: input.licenseType,
        status: input.status || 'active',
        isProtected: resolvedIsProtected,
        updatedAt: sql`NOW()`,
      } as any)
      .onConflictDoUpdate({
        target: zuvyUserLicenses.zoomEmail,
        set: {
          zoomUserId: input.zoomUserId || null,
          userName: input.userName || normalizedEmail,
          licenseType: input.licenseType,
          status: input.status || 'active',
          isProtected: resolvedIsProtected,
          updatedAt: sql`NOW()`,
        } as any,
      });
  }

  async getProtectedZoomEmails() {
    const rows = await db
      .select({ email: zuvyUserLicenses.zoomEmail })
      .from(zuvyUserLicenses)
      .where(eq(zuvyUserLicenses.isProtected, true));

    return new Set(
      rows
        .map((row) => row.email?.trim().toLowerCase())
        .filter((email): email is string => Boolean(email)),
    );
  }

  private async generateAccessToken(): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    const tokenUrl = 'https://zoom.us/oauth/token';
    const authHeader = Buffer.from(
      `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`,
    ).toString('base64');

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
        },
      );
      const accessToken = response.data.access_token;
      const expiresIn: number = Number(response.data.expires_in) || 3500; // seconds
      const expiresAt = Date.now() + expiresIn * 1000;
      this.tokenCache = { accessToken, expiresAt };
      this.logger.log(
        `Zoom access token generated successfully (expires in ${expiresIn}s).`,
      );
      return { accessToken, expiresIn };
    } catch (error: any) {
      this.logger.error(
        `Error generating Zoom access token: ${error.response?.data || error.message}`,
      );
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
          .then((r) => r.accessToken)
          .finally(() => {
            this.tokenRefreshPromise = null;
          });
      }
      const newToken = await this.tokenRefreshPromise;
      return {
        Authorization: `Bearer ${newToken}`,
        'Content-Type': 'application/json',
      };
    } catch (e: any) {
      this.logger.error(`Failed to obtain Zoom headers: ${e.message}`);
      throw e;
    }
  }

  public async getAccessToken(): Promise<string> {
    const headers = await this.getHeaders();
    return headers.Authorization.replace('Bearer ', '');
  }

  /**
   * Create a new Zoom meeting
   */
  async createMeeting(
    meetingData: ZoomMeetingRequest,
  ): Promise<{ success: boolean; data?: ZoomMeetingResponse; error?: string }> {
    try {
      const url = `${this.baseUrl}/users/me/meetings`;

      const response: AxiosResponse<ZoomMeetingResponse> = await axios.post(
        url,
        meetingData,
        { headers: await this.getHeaders() },
      );

      this.logger.log(`Zoom meeting created successfully: ${response.data.id}`);
      return { success: true, data: response.data };
    } catch (error: any) {
      this.logger.error(
        `Error creating Zoom meeting: ${error.response?.data || error.message}`,
      );
      return {
        success: false,
        error: `Failed to create Zoom meeting: ${error.response?.data?.message || error.message}`,
      };
    }
  }

  // Re-added helper: create meeting for specific user (email or userId)
  async createMeetingForUser(
    userEmailOrId: string,
    meetingData: ZoomMeetingRequest,
  ): Promise<{ success: boolean; data?: ZoomMeetingResponse; error?: string }> {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(userEmailOrId)}/meetings`;

      const headers = await this.getHeaders();

      // Log request intent (helps debug wrong-host issues)
      this.logger.log(`Creating Zoom meeting for user: ${userEmailOrId}`);

      // Ensure user level waiting room settings are applied to host's Zoom account
      await this.applyLicensedUserSettings(userEmailOrId);

      const finalMeetingData: ZoomMeetingRequest = {
        ...meetingData,
        settings: {
          ...meetingData.settings,
          waiting_room: true,
          waiting_room_options: {
            mode: 'custom',
            who_goes_to_waiting_room: 'users_not_on_invite',
            ...(meetingData.settings?.waiting_room_options || {}),
          },
        },
      };

      const response: AxiosResponse<ZoomMeetingResponse> = await axios.post(
        url,
        finalMeetingData,
        { headers },
      );

      const meeting = response.data;

      // Explicitly patch meeting-level settings on the newly created meeting ID
      if (meeting?.id) {
        try {
          await axios.patch(
            `${this.baseUrl}/meetings/${meeting.id}`,
            {
              settings: {
                waiting_room: true,
                waiting_room_options: {
                  mode: 'custom',
                  who_goes_to_waiting_room: 'users_not_on_invite',
                },
              },
            },
            { headers },
          );
          this.logger.log(
            `Explicitly enabled meeting-level waiting_room: true with users_not_on_invite for meeting ID ${meeting.id}`,
          );
        } catch (patchErr: any) {
          this.logger.warn(
            `Failed to patch meeting-level waiting_room for meeting ID ${meeting.id}: ${patchErr.message}`,
          );
        }
      }

      // Strong logging for debugging
      this.logger.log(`Zoom meeting created successfully: ${meeting.id}`);

      this.logger.log(`Expected host: ${userEmailOrId}`);
      this.logger.log(`Actual host: ${meeting.host_email}`);
      this.logger.log(`Account ID: ${meeting.host_id}`);

      // CRITICAL VALIDATION — prevent wrong host assignment
      if (
        meeting.host_email &&
        meeting.host_email.toLowerCase() !== userEmailOrId.toLowerCase()
      ) {
        this.logger.error(
          `HOST MISMATCH: Expected ${userEmailOrId}, got ${meeting.host_email}`,
        );

        // Fail fast — don't allow incorrect meeting to propagate
        return {
          success: false,
          error: `Zoom host mismatch. Expected ${userEmailOrId}, got ${meeting.host_email}`,
        };
      }

      // Additional safeguard: ensure join URL exists
      if (!meeting.join_url || !meeting.start_url) {
        this.logger.error(
          ` Invalid Zoom response: missing join_url or start_url`,
        );

        return {
          success: false,
          error: 'Invalid Zoom meeting response: missing URLs',
        };
      }

      return { success: true, data: meeting };
    } catch (error: any) {
      const zoomError = error?.response?.data;

      this.logger.error(
        `Error creating Zoom meeting for ${userEmailOrId}: ${
          zoomError?.message || error.message
        }`,
      );

      // More granular error handling
      if (zoomError?.message?.includes('User does not exist')) {
        return {
          success: false,
          error: 'Zoom user does not exist or is not activated',
        };
      }

      if (zoomError?.message?.includes('not licensed')) {
        return {
          success: false,
          error: 'Zoom user is not a licensed (paid) account',
        };
      }

      if (zoomError?.code === 429) {
        return {
          success: false,
          error: 'Zoom rate limit exceeded. Please retry.',
        };
      }

      return {
        success: false,
        error: zoomError?.message || error.message,
      };
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

  /**
   * Get user settings from Zoom (GET /v2/users/{userId}/settings)
   */
  async getUserSettings(userEmailOrId: string) {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(userEmailOrId)}/settings`;
      const res = await axios.get(url, { headers: await this.getHeaders() });
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  /**
   * Update Zoom user waiting room settings via User Level API (PATCH /v2/users/{userId}/settings)
   */
  async updateUserWaitingRoomSettings(
    userEmailOrId: string,
    settings: {
      waiting_room: boolean;
      waiting_room_settings?: {
        participants_to_place_in_waiting_room?: number;
        users_who_can_admit_participants_from_waiting_room?: number;
      };
    },
  ) {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(userEmailOrId)}/settings`;
      const payload = {
        in_meeting: {
          waiting_room: settings.waiting_room,
          participants_to_place_in_waiting_room:
            settings.waiting_room_settings
              ?.participants_to_place_in_waiting_room ?? 2,
          ...(settings.waiting_room_settings && {
            waiting_room_settings: settings.waiting_room_settings,
          }),
        },
      };

      await axios.patch(url, payload, {
        headers: await this.getHeaders(),
      });

      this.logger.log(
        `Updated Zoom waiting room settings for user ${userEmailOrId} successfully.`,
      );

      // Verify the settings update via GET /users/{userId}/settings
      const verification = await this.getUserSettings(userEmailOrId);

      return {
        success: true,
        data: verification.success ? verification.data : null,
      };
    } catch (e: any) {
      const errorMessage = e.response?.data?.message || e.message;
      this.logger.error(
        `Failed to update Zoom waiting room settings for user ${userEmailOrId}: ${errorMessage}`,
      );
      return { success: false, error: errorMessage };
    }
  }

  async createUser(email: string, firstName = '', lastName = '') {
    try {
      const url = `${this.baseUrl}/users`;
      const payload = {
        action: 'create',
        user_info: {
          email,
          type: 1,
          first_name: firstName,
          last_name: lastName,
        },
      };
      const res = await axios.post(url, payload, {
        headers: await this.getHeaders(),
      });
      await this.syncZoomLicenseUser({
        email,
        zoomUserId: res.data?.id || null,
        userName:
          `${firstName || ''} ${lastName || ''}`.trim() ||
          res.data?.display_name ||
          email,
        licenseType: 1,
        status: res.data?.status || 'pending',
      });
      return { success: true, data: res.data };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  async setUserLicense(email: string, type: 1 | 2 | 3) {
    try {
      const url = `${this.baseUrl}/users/${encodeURIComponent(email)}`;
      await axios.patch(url, { type }, { headers: await this.getHeaders() });
      const user = await this.getUser(email);
      if (user.success) {
        await this.syncZoomLicenseUser({
          email,
          zoomUserId: user.data?.id || null,
          userName:
            `${user.data?.first_name || ''} ${user.data?.last_name || ''}`.trim() ||
            user.data?.display_name ||
            email,
          licenseType: user.data?.type ?? type,
          status: user.data?.status || 'active',
        });
      } else {
        await this.syncZoomLicenseUser({
          email,
          licenseType: type,
          status: type === 2 ? 'active' : 'downgraded',
        });
      }

      if (type === 2) {
        await this.applyLicensedUserSettings(email);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  /**
   * Ensure a user exists and is licensed. Returns detailed status so caller can decide
   * whether to include as alternative host (Zoom requires Licensed + Active user).
   */
  async ensureLicensedUser(
    email: string,
    firstName = '',
    lastName = '',
  ): Promise<{
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
      if (!created.success)
        return { success: false, step: 'create', error: created.error };
      // After creation, fetch again to inspect status
    }
    const afterCreate = await this.getUser(email);
    if (!afterCreate.success)
      return { success: false, step: 'fetch', error: afterCreate.error };

    // Attempt to license if not already licensed (type 2)
    if (afterCreate.data.type !== 2) {
      const licensed = await this.setUserLicense(email, 2);
      if (!licensed.success)
        return {
          success: false,
          step: 'license',
          error: licensed.error,
          userType: afterCreate.data.type,
        };
    }

    // Final verification
    const finalUser = await this.getUser(email);
    if (!finalUser.success)
      return { success: false, step: 'verify', error: finalUser.error };
    const userType = finalUser.data.type;
    const userStatus = finalUser.data.status; // expect 'active'
    await this.syncZoomLicenseUser({
      email,
      zoomUserId: finalUser.data?.id || null,
      userName:
        `${finalUser.data?.first_name || ''} ${finalUser.data?.last_name || ''}`.trim() ||
        finalUser.data?.display_name ||
        email,
      licenseType: userType,
      status: userStatus,
    });
    const licensed = userType === 2 && userStatus === 'active';
    if (!licensed) {
      const typeLabel =
        userType === 2
          ? 'licensed'
          : userType === 1
            ? 'basic'
            : `type ${userType}`;
      return {
        success: false,
        step: 'verify',
        error: `Zoom user ${email} is currently ${typeLabel} with status '${userStatus}'. The user must be licensed and active before a session can be created.`,
        userType,
        userStatus,
        licensed,
      };
    }

    await this.applyLicensedUserSettings(email);

    return { success: true, userType, userStatus, licensed };
  }

  /** Downgrade a user to Basic (type=1) */
  async downgradeUser(email: string) {
    const res = await this.setUserLicense(email, 1);
    if (!res.success) return { success: false, error: res.error };
    return { success: true };
  }

  /** Update user profile / license */
  async updateUser(update: {
    email: string;
    firstName?: string;
    lastName?: string;
    displayName?: string;
    phoneNumber?: string;
    timezone?: string;
    type?: 1 | 2 | 3;
    isProtected?: boolean;
  }) {
    try {
      const normalizedEmail = update.email.trim().toLowerCase();
      const url = `${this.baseUrl}/users/${encodeURIComponent(normalizedEmail)}`;
      const body: any = {};
      if (update.firstName) body.first_name = update.firstName;
      if (update.lastName) body.last_name = update.lastName;
      if (update.timezone) body.timezone = update.timezone;
      if (update.type) body.type = update.type;
      // displayName / phoneNumber not always supported; include if provided
      if (update.displayName) body.display_name = update.displayName;
      if (update.phoneNumber) body.phone_number = update.phoneNumber;
      if (Object.keys(body).length > 0) {
        await axios.patch(url, body, { headers: await this.getHeaders() });
      }

      const user = await this.getUser(normalizedEmail);
      if (!user.success) {
        return { success: false, error: user.error };
      }

      await this.syncZoomLicenseUser({
        email: normalizedEmail,
        zoomUserId: user.data?.id || null,
        userName:
          `${user.data?.first_name || ''} ${user.data?.last_name || ''}`.trim() ||
          user.data?.display_name ||
          normalizedEmail,
        licenseType: user.data?.type ?? update.type ?? 1,
        status: user.data?.status || 'active',
        isProtected: update.isProtected,
      });

      if ((user.data?.type ?? update.type) === 2) {
        await this.applyLicensedUserSettings(normalizedEmail);
      }

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.response?.data?.message || e.message };
    }
  }

  async listAuthorizedUsers(query?: {
    page_size?: number;
    status?: string;
    hostType?: 'licensed' | 'basic' | 'all';
    search?: string;
  }) {
    try {
      const headers = await this.getHeaders();
      const pageSize = Math.min(query?.page_size || 100, 300);
      const status = query?.status?.trim() || 'active';
      const hostType = query?.hostType || 'all';
      const normalizedSearch = query?.search?.trim().toLowerCase() || '';
      const localUsers = await db
        .select({
          zoomEmail: zuvyUserLicenses.zoomEmail,
          isProtected: zuvyUserLicenses.isProtected,
          licenseType: zuvyUserLicenses.licenseType,
          localStatus: zuvyUserLicenses.status,
        })
        .from(zuvyUserLicenses);
      const localUserMap = new Map(
        localUsers.map((row) => [row.zoomEmail.trim().toLowerCase(), row]),
      );

      let nextPageToken = '';
      const users: ZoomUserListItem[] = [];

      do {
        const response: AxiosResponse<ZoomUsersListResponse> = await axios.get(
          `${this.baseUrl}/users`,
          {
            headers,
            params: {
              page_size: pageSize,
              status,
              next_page_token: nextPageToken || undefined,
            },
          },
        );

        users.push(...(response.data.users || []));
        nextPageToken = response.data.next_page_token || '';
      } while (nextPageToken);

      let filteredUsers = users.map((user) => {
        const fullName =
          `${user.first_name || ''} ${user.last_name || ''}`.trim() ||
          user.display_name ||
          user.email;

        return {
          id: user.id,
          email: user.email,
          name: fullName,
          firstName: user.first_name || '',
          lastName: user.last_name || '',
          displayName: user.display_name || fullName,
          status: user.status,
          roleName: user.role_name || null,
          timezone: user.timezone || null,
          userType: user.type,
          isLicensed: user.type === 2,
          canHostSessions: user.status === 'active',
          verified: user.verified,
          createdAt: user.created_at || null,
          lastLoginTime: user.last_login_time || null,
          isProtected:
            localUserMap.get(user.email.trim().toLowerCase())?.isProtected ||
            false,
          localLicenseType:
            localUserMap.get(user.email.trim().toLowerCase())?.licenseType ??
            null,
          localStatus:
            localUserMap.get(user.email.trim().toLowerCase())?.localStatus ??
            null,
        };
      });

      if (hostType === 'licensed') {
        filteredUsers = filteredUsers.filter((user) => user.isLicensed);
      } else if (hostType === 'basic') {
        filteredUsers = filteredUsers.filter((user) => !user.isLicensed);
      }

      if (normalizedSearch) {
        filteredUsers = filteredUsers.filter((user) =>
          [user.email, user.name, user.displayName]
            .filter(Boolean)
            .some((value) => value.toLowerCase().includes(normalizedSearch)),
        );
      }

      return {
        success: true,
        data: {
          total: filteredUsers.length,
          filters: {
            status,
            hostType,
            search: query?.search || null,
          },
          users: filteredUsers,
        },
      };
    } catch (e: any) {
      this.logger.error(
        `Error listing Zoom authorized users: ${e.response?.data?.message || e.message}`,
      );
      return {
        success: false,
        error:
          e.response?.data?.message || e.message || 'Failed to list Zoom users',
      };
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
  async updateMeeting(
    meetingId: string,
    meetingData: Partial<ZoomMeetingRequest>,
  ): Promise<void> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;

      await axios.patch(url, meetingData, { headers: await this.getHeaders() });

      this.logger.log(`Zoom meeting updated successfully: ${meetingId}`);
    } catch (error: any) {
      this.logger.error(
        `Error updating Zoom meeting: ${error.response?.data || error.message}`,
      );
      throw new Error(
        `Failed to update Zoom meeting: ${error.response?.data?.message || error.message}`,
      );
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
    } catch (error: any) {
      this.logger.error(
        `Error deleting Zoom meeting: ${error.response?.data || error.message}`,
      );
      throw new Error(
        `Failed to delete Zoom meeting: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  /**
   * Get meeting details
   */
  async getMeeting(
    meetingId: string,
  ): Promise<{ success: boolean; data?: ZoomMeetingResponse; error?: string }> {
    try {
      const url = `${this.baseUrl}/meetings/${meetingId}`;

      const response: AxiosResponse<ZoomMeetingResponse> = await axios.get(
        url,
        { headers: await this.getHeaders() },
      );

      return { success: true, data: response.data };
    } catch (error: any) {
      this.logger.error(
        `Error fetching Zoom meeting: ${error.response?.data || error.message}`,
      );
      return {
        success: false,
        error: `Failed to fetch Zoom meeting: ${error.response?.data?.message || error.message}`,
      };
    }
  }

  async isMeetingLiveViaDashboard(meetingIdOrUuid: string): Promise<boolean> {
    const encoded = encodeURIComponent(encodeURIComponent(meetingIdOrUuid));
    const url = `${this.baseUrl}/metrics/meetings/${encoded}`;

    try {
      // type=live asks Zoom to return only if it's currently running
      await axios.get(url, {
        headers: await this.getHeaders(),
        params: { type: 'live' },
      });
      return true; // 200 OK -> live right now
    } catch (e: any) {
      const err = e as AxiosError<any>;
      const status = err.response?.status;
      const code = err.response?.data?.code;
      const headers = err.response?.headers || {};
      const rlType = String(headers['x-ratelimit-type'] || '').toLowerCase();
      const retryAfter = Number(headers['retry-after'] || 0);

      if (status === 404 || code === 3001) return false; // not live
      if (status === 429) {
        this.logger.warn(
          `Rate limited by Zoom (${rlType || 'unknown'}); treating as not live.`,
        );
        return false;
      }
      if (status === 503) {
        this.logger.warn('Zoom 503; treating as not live.');
        return false;
      }
      // If code === 200 with a message about Dashboard/plan, it's a plan/scope issue.
      throw e;
    }
  }

  /**
   * Get meeting participants/attendance
   */
  async getMeetingParticipants(
    meetingUuid: string,
  ): Promise<ZoomParticipantReportResponse> {
    try {
      const encodedUuid = encodeURIComponent(encodeURIComponent(meetingUuid));
      let allParticipants: ZoomParticipant[] = [];
      let nextPageToken = ''; // Start with an empty token
      // Meeting-level fields are identical on every page — capture once,
      // from the first page, for the interval-merge duration cap below.
      let meetingDuration: number | undefined;
      let meetingStartTime: string | undefined;
      let meetingEndTime: string | undefined;

      // Use a do...while loop to fetch all pages of participants
      do {
        // Append the next_page_token and set a max page_size to reduce API calls
        const url = `${this.baseUrl}/report/meetings/${encodedUuid}/participants?page_size=300&next_page_token=${encodeURIComponent(nextPageToken)}`;

        const response: AxiosResponse<ZoomParticipantReportResponse> =
          await axios.get(url, { headers: await this.getHeaders() });
        // Add the participants from the current page to our master list
        if (response.data && response.data.participants) {
          allParticipants = allParticipants.concat(response.data.participants);
        }
        if (meetingDuration === undefined) {
          meetingDuration = response.data.duration;
          meetingStartTime = response.data.start_time;
          meetingEndTime = response.data.end_time;
        }

        // Get the token for the next page. If it's empty or null, the loop will end.
        nextPageToken = response.data.next_page_token;
      } while (nextPageToken);

      // Return the complete list of participants from all pages
      return {
        participants: allParticipants,
        duration: meetingDuration,
        start_time: meetingStartTime,
        end_time: meetingEndTime,
      };
    } catch (error: any) {
      this.logger.error(
        `Error fetching Zoom meeting participants for UUID ${meetingUuid}: ${error.response?.data?.message || error.message}`,
      );
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

      const response: AxiosResponse<any> = await axios.get(url, {
        headers: await this.getHeaders(),
      });
      return response.data.share_url;
    } catch (error: any) {
      this.logger.error(
        `Error fetching Zoom meeting recordings: ${error.response?.data || error.message}`,
      );
      throw new Error(
        `Failed to fetch Zoom meeting recordings: ${error.response?.data?.message || error.message}`,
      );
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
      const recordings = await this.getMeetingRecordings(singleMeetingId).catch(
        () => null,
      );
      return {
        success: true,
        data: { meetingId: singleMeetingId, ...attendanceRes.data, recordings },
      };
    } catch (e: any) {
      this.logger.error(
        `computeAttendanceAndRecordings75 failed when fetching recordings: ${e.message}`,
      );
      return {
        success: true,
        data: {
          meetingId: singleMeetingId,
          ...attendanceRes.data,
          recordings: null,
        },
      };
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
        try {
          const live = await this.isMeetingLiveViaDashboard(id);
          if (live) {
            continue; // go to next meeting
          }
        } catch (liveErr: any) {
          // If the dashboard call itself errors (non-404/3001), surface it so you can see why
          this.logger.warn(
            `Live check failed for ${id}: ${liveErr?.message || liveErr}`,
          );
          // fall through to try attendance anyway
        }
        const single = await this.computeAttendance75(id);
        results.push({ meetingId: id, ...single });
      }
      return { success: true, data: results };
    }
    const singleMeetingId = meetingId;
    try {
      const live = await this.isMeetingLiveViaDashboard(singleMeetingId);
      if (live) {
        return {
          success: true,
          data: {
            meetingId: singleMeetingId,
            live: true,
            skipped: true,
            message:
              'Meeting is currently live; attendance will be computed after it ends.',
          },
        };
      }
    } catch (liveErr: any) {
      // If the dashboard call itself errors (non-404/3001), log and continue to attempt attendance calc
      this.logger.warn(
        `Live check failed for ${singleMeetingId}: ${liveErr?.message || liveErr}`,
      );
    }
    const session = await db
      .select()
      .from(zuvySessions)
      .where(eq(zuvySessions.zoomMeetingId, singleMeetingId))
      .limit(1);
    if (!session.length) {
      return {
        success: false,
        error: `No session found for meeting ID ${meetingId}`,
      };
    }
    const batchId = session[0].batchId;
    const batchInfo = await db
      .select()
      .from(zuvyBatches)
      .where(eq(zuvyBatches.id, batchId))
      .limit(1);
    if (!batchInfo.length) {
      return { success: false, error: `No batch found for ID ${batchId}` };
    }
    const hostInfo = await db
      .select()
      .from(users)
      .where(eq(users.id, BigInt(batchInfo[0].instructorId)))
      .limit(1);
    if (!hostInfo.length) {
      return {
        success: false,
        error: `No host found for instructor ID ${batchInfo[0].instructorId}`,
      };
    }
    const hostEmail = hostInfo[0].email;
    try {
      const participantsResp =
        await this.getAllParticipantsForMeetingId(singleMeetingId);
      const hostDuration = (participantsResp || [])
        .filter((p) => p.user_email === hostEmail)
        .reduce((a, b) => a + (b.duration || 0), 0);
      const thresholdRatio = 0.75;
      const threshold = hostDuration * thresholdRatio;
      // Build a map of user -> total duration
      const durationMap: Record<string, number> = {};
      for (const p of participantsResp || []) {
        if (!p.user_email) continue;
        durationMap[p.user_email] =
          (durationMap[p.user_email] || 0) + (p.duration || 0);
      }
      // Base attendance from participants
      const attendanceMap: Record<
        string,
        { email: string; duration: number; attendance: AttendanceStatus }
      > = {};
      for (const [email, dur] of Object.entries(durationMap)) {
        attendanceMap[email] = {
          email,
          duration: dur,
          attendance:
            dur >= threshold
              ? AttendanceStatus.PRESENT
              : AttendanceStatus.ABSENT,
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
                attendance: AttendanceStatus.ABSENT,
              };
            }
          }
        }
      } catch (subErr: any) {
        this.logger.warn(
          `Failed to enrich attendance with invitedStudents for meeting ${singleMeetingId}: ${subErr.message}`,
        );
      }
      const attendance = Object.values(attendanceMap);
      return {
        success: true,
        data: {
          meetingId: singleMeetingId,
          thresholdRatio,
          hostDuration,
          threshold,
          attendance,
        },
      };
    } catch (e: any) {
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
        } catch (e: any) {
          results.push({ meetingId: id, recordings: null, error: e.message });
        }
      }
      return { success: true, data: results };
    }
    try {
      const rec = await this.getMeetingRecordings(meetingId).catch(() => null);
      return { success: true, data: { meetingId, recordings: rec } };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Assume you have your existing 'getMeetingParticipants(uuid)' function ready.

  async getAllParticipantsForMeetingId(
    meetingId: string | number,
  ): Promise<any[]> {
    try {
      // Step 1: Get all past session UUIDs
      const instancesUrl = `${this.baseUrl}/past_meetings/${encodeURIComponent(meetingId)}/instances`;
      const instancesResponse = await axios.get(instancesUrl, {
        headers: await this.getHeaders(),
      });
      const pastSessions = instancesResponse.data.meetings;

      if (!pastSessions || pastSessions.length === 0) return [];

      // Step 2: Fetch all participant lists from all sessions, keeping each
      // occurrence's own reported meeting duration alongside its
      // participants — needed below to cap that occurrence's merged
      // durations. Must not be mixed across occurrences: each has its own
      // actual length.
      const allSessionReports: Array<{
        participants: ZoomParticipant[];
        meetingDurationSeconds: number | null;
      }> = [];
      for (const session of pastSessions) {
        const report = await this.getMeetingParticipants(session.uuid);
        if (report && report.participants && report.participants.length > 0) {
          allSessionReports.push({
            participants: report.participants,
            meetingDurationSeconds: report.duration ?? null,
          });
        }
      }

      if (allSessionReports.length === 0) return [];

      // ========================================================================
      // Consolidate each report to handle users connecting more than once in
      // the SAME occurrence (dropped/rejoined, or — just as commonly — joined
      // from a second device concurrently). Duration is derived by merging
      // each person's join/leave intervals rather than summing each row's
      // own duration, so a genuine overlap isn't double-counted the way
      // naive addition would (this previously let a single participant's
      // reported duration exceed the meeting's own length). See
      // attendance-duration-merge.ts.
      // ========================================================================
      const consolidatedReports = allSessionReports.map(
        ({ participants, meetingDurationSeconds }) => {
          const connections: ParticipantConnection[] = participants
            .map((p) => ({
              key: p.user_email || p.name,
              joinTime: p.join_time,
              leaveTime: p.leave_time,
            }))
            .filter((c): c is ParticipantConnection => Boolean(c.key));

          const mergedDurations = computeMergedDurationsByKey(
            connections,
            meetingDurationSeconds,
          );

          const consolidatedMap = new Map<string, ZoomParticipant>();
          for (const participant of participants) {
            const key = participant.user_email || participant.name;
            if (!key || consolidatedMap.has(key)) continue;
            consolidatedMap.set(key, {
              ...participant,
              duration: mergedDurations.get(key) ?? participant.duration,
            });
          }
          return Array.from(consolidatedMap.values());
        },
      );

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
    } catch (error: any) {
      this.logger.error(
        `Failed to get all participants for meeting ID ${meetingId}: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Create recurring meetings based on days of week and total classes
   */
  async createRecurringMeetings(
    meetingData: ZoomMeetingRequest,
    daysOfWeek: string[],
    totalClasses: number,
  ): Promise<ZoomMeetingResponse[]> {
    try {
      const meetings: ZoomMeetingResponse[] = [];

      // Convert day names to Zoom's day numbers (Sunday = 1, Monday = 2, etc.)
      const dayToZoomDay: { [key: string]: number } = {
        Sunday: 1,
        Monday: 2,
        Tuesday: 3,
        Wednesday: 4,
        Thursday: 5,
        Friday: 6,
        Saturday: 7,
      };

      const zoomDays = daysOfWeek.map((day) => dayToZoomDay[day]).join(',');

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
    } catch (error: any) {
      this.logger.error(
        `Error creating recurring Zoom meetings: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Calculate attendance based on duration threshold
   */
  calculateAttendance(
    participants: ZoomAttendanceResponse['participants'],
    durationThreshold: number = 0.75,
  ): Array<{
    email: string;
    duration: number;
    attendance: 'present' | 'absent';
  }> {
    if (!participants || participants.length === 0) {
      return [];
    }

    // Find the longest duration (likely the host/instructor)
    const maxDuration = Math.max(...participants.map((p) => p.duration));
    const attendanceThreshold = maxDuration * durationThreshold;

    return participants.map((participant) => ({
      email: participant.user_email,
      duration: participant.duration,
      attendance:
        participant.duration >= attendanceThreshold ? 'present' : 'absent',
    }));
  }

  async getMeetingRecordingLink(meetingId: string | number): Promise<{
    success: boolean;
    data?: { playUrl: string; topic: string; duration: number };
    error?: string;
  }> {
    try {
      // We need the access token to authenticate the download URL
      const headers = await this.getHeaders();
      const accessToken = headers.Authorization.replace('Bearer ', ''); // Extract token

      const url = `${this.baseUrl}/meetings/${encodeURIComponent(meetingId)}/recordings`;
      const response: AxiosResponse<ZoomRecordingResponse> = await axios.get(
        url,
        { headers },
      );
      const recordingData = response.data;

      if (
        !recordingData ||
        !recordingData.recording_files ||
        recordingData.recording_files.length === 0
      ) {
        this.logger.warn(
          `No recording files found for Zoom meeting ${meetingId}`,
        );
        return {
          success: false,
          error: 'No recording files exist for this meeting.',
        };
      }

      // Find the desired MP4 video file from the list.
      const videoFile =
        recordingData.recording_files.find(
          (file) =>
            file.file_type === 'MP4' &&
            file.recording_type.includes('shared_screen_with_speaker_view'),
        ) ||
        recordingData.recording_files.find((file) => file.file_type === 'MP4');

      if (!videoFile) {
        this.logger.warn(
          `No MP4 video file found for Zoom meeting ${meetingId}`,
        );
        return {
          success: false,
          error: 'An MP4 video file could not be found for this recording.',
        };
      }

      // *** MODIFICATION HERE ***
      // Construct the playable URL using the download_url and the access token.
      const playableUrl = `${videoFile.download_url}?access_token=${accessToken}`;

      this.logger.log(
        `Successfully fetched React Player URL for Zoom meeting: ${meetingId}`,
      );

      return {
        success: true,
        data: {
          playUrl: playableUrl, // Use the newly constructed URL
          topic: recordingData.topic,
          duration: recordingData.duration,
        },
      };
    } catch (error: any) {
      this.logger.error(
        `Error fetching recording for Zoom meeting ${meetingId}: ${error.response?.data?.message || error.message}`,
      );

      if (error.response?.status === 404) {
        return {
          success: false,
          error: `Meeting with ID ${meetingId} not found or has no recordings.`,
        };
      }

      return {
        success: false,
        error:
          error.response?.data?.message || 'Failed to fetch recording details.',
      };
    }
  }

  async getZoomRecordingFiles(
    meetingId: string | number,
  ): Promise<ZoomRecordingDetails> {
    // This assumes you have a zoomService or a way to make authenticated requests to Zoom
    const url = `${this.baseUrl}/meetings/${meetingId}/recordings`;
    const response = await axios.get(url, { headers: await this.getHeaders() });
    return response.data;
  }

  async deleteFromZoomCloud(meetingId: string | number, recordingId: string) {
    // Note: Zoom API uses the meeting UUID for deletion, which might be different from the ID.
    // For simplicity, this example assumes meetingId can be used, but you may need to fetch the UUID.
    const encodedUuid = encodeURIComponent(encodeURIComponent(meetingId));
    this.logger.log(
      `Deleting Zoom recording for meeting UUID: ${encodedUuid}, recording ID: ${recordingId}`,
    );
    const url = `${this.baseUrl}/meetings/${encodedUuid}/recordings`;
    await axios.delete(url, { headers: await this.getHeaders() });
    this.logger.log(`Deleted Zoom recording for meeting ${meetingId}`);
  }

  async getZoomRecordingFilesByUuid(
    uuid: string,
  ): Promise<ZoomRecordingDetails> {
    // Zoom UUIDs can contain / + = so MUST be encoded
    const encodedUuid = encodeURIComponent(uuid);
    const url = `${this.baseUrl}/meetings/${encodedUuid}/recordings`;

    const response = await axios.get(url, {
      headers: await this.getHeaders(),
    });
    return response.data;
  }

  /**
   * Fetch Zoom recordings using UUID (preferred) with safe encoding.
   * Falls back to meetingId if UUID fails.
   */
  async getZoomRecordingFilesSafe(params: {
    meetingId: string | number;
    meetingUuid?: string | null;
  }): Promise<any> {
    const headers = await this.getHeaders();

    // Try UUID first (Zoom best practice)
    if (params.meetingUuid) {
      try {
        // Zoom requires UUID to be URL-encoded (base64 safe)
        const encodedUuid = encodeURIComponent(params.meetingUuid);

        const uuidUrl = `${this.baseUrl}/meetings/${encodedUuid}/recordings`;
        const uuidResp = await axios.get(uuidUrl, { headers });

        return {
          source: 'uuid',
          ...uuidResp.data,
        };
      } catch (err: any) {
        this.logger.warn(
          `UUID fetch failed for ${params.meetingUuid}, falling back to meetingId`,
        );
      }
    }

    // Fallback to meetingId
    const idUrl = `${this.baseUrl}/meetings/${params.meetingId}/recordings`;
    const idResp = await axios.get(idUrl, { headers });

    return {
      source: 'meetingId',
      ...idResp.data,
    };
  }

  /**
   * Fetch ALL recording files across ALL past instances of a meeting ID from Zoom.
   * When an instructor leaves and re-enters a meeting multiple times, Zoom creates
   * separate meeting instances (each with a unique UUID) under the same meeting ID.
   * This method queries all past instance UUIDs via GET /past_meetings/{meetingId}/instances
   * and aggregates all MP4 recording files into one complete list.
   */
  async getAllMeetingRecordings(meetingId: string | number): Promise<{
    recording_files: any[];
    instances_found: number;
  }> {
    const headers = await this.getHeaders();
    const allFiles: any[] = [];
    const seenFileIds = new Set<string>();
    const uuidsProcessed = new Set<string>();

    // Step 1: Query Zoom for all past instance UUIDs of this meeting ID
    try {
      const instancesUrl = `${this.baseUrl}/past_meetings/${encodeURIComponent(meetingId)}/instances`;
      const instancesRes = await axios.get(instancesUrl, { headers });
      const meetings = instancesRes.data?.meetings || [];

      for (const meetingInstance of meetings) {
        const uuid = meetingInstance.uuid;
        if (uuid && !uuidsProcessed.has(uuid)) {
          uuidsProcessed.add(uuid);
          try {
            const encodedUuid = encodeURIComponent(encodeURIComponent(uuid));
            const recUrl = `${this.baseUrl}/meetings/${encodedUuid}/recordings`;
            const recRes = await axios.get(recUrl, { headers });
            const files = recRes.data?.recording_files || [];
            for (const f of files) {
              if (f.id && !seenFileIds.has(f.id)) {
                seenFileIds.add(f.id);
                allFiles.push({ ...f, meeting_uuid: uuid });
              }
            }
          } catch (instanceErr: any) {
            this.logger.warn(
              `Failed to fetch recording files for past instance UUID ${uuid}: ${instanceErr.message}`,
            );
          }
        }
      }
    } catch (instancesErr: any) {
      this.logger.warn(
        `Failed to fetch past instances for meeting ${meetingId}: ${instancesErr.message}`,
      );
    }

    // Step 2: Fallback / additional check directly by meetingId
    try {
      const directUrl = `${this.baseUrl}/meetings/${encodeURIComponent(meetingId)}/recordings`;
      const directRes = await axios.get(directUrl, { headers });
      const files = directRes.data?.recording_files || [];
      for (const f of files) {
        if (f.id && !seenFileIds.has(f.id)) {
          seenFileIds.add(f.id);
          allFiles.push(f);
        }
      }
    } catch (directErr: any) {
      // Direct fetch may return 404 if meeting has ended and only accessible via UUIDs
    }

    return {
      recording_files: allFiles,
      instances_found: uuidsProcessed.size,
    };
  }

  /**
   * Check if any cloud recording for this Zoom meeting ID is currently processing on Zoom Cloud.
   */
  async isRecordingProcessingOnZoom(
    meetingId: string | number,
  ): Promise<boolean> {
    try {
      const headers = await this.getHeaders();
      const instancesUrl = `${this.baseUrl}/past_meetings/${encodeURIComponent(meetingId)}/instances`;
      const instancesRes = await axios.get(instancesUrl, { headers });
      const meetings = instancesRes.data?.meetings || [];

      for (const instance of meetings) {
        if (!instance.uuid) continue;
        const encodedUuid = encodeURIComponent(
          encodeURIComponent(instance.uuid),
        );
        try {
          const recUrl = `${this.baseUrl}/meetings/${encodedUuid}/recordings`;
          const recRes = await axios.get(recUrl, { headers });

          if (recRes.data?.status === 'processing') {
            return true;
          }

          const files = recRes.data?.recording_files || [];
          for (const f of files) {
            if (
              f.file_type === 'MP4' &&
              (f.status === 'processing' || !f.download_url)
            ) {
              return true;
            }
          }
        } catch (err: any) {
          if (err.response?.status === 404) {
            // Recording object created but files not yet available on Zoom
            return true;
          }
        }
      }

      try {
        const directUrl = `${this.baseUrl}/meetings/${encodeURIComponent(meetingId)}/recordings`;
        const directRes = await axios.get(directUrl, { headers });
        if (directRes.data?.status === 'processing') return true;
        const files = directRes.data?.recording_files || [];
        for (const f of files) {
          if (
            f.file_type === 'MP4' &&
            (f.status === 'processing' || !f.download_url)
          ) {
            return true;
          }
        }
      } catch (directErr: any) {}
    } catch (err: any) {
      // Ignore API errors and return false
    }

    return false;
  }
}
