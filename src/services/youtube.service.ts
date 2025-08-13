import { Injectable, Logger } from '@nestjs/common';
import { google, youtube_v3 } from 'googleapis';
import * as fs from 'fs';
import { auth2Client } from '../auth/google-auth';

@Injectable()
export class YoutubeService {
  private readonly logger = new Logger(YoutubeService.name);
  private youtube: youtube_v3.Youtube;


  constructor() {
    // YouTube client will be initialized per upload with user credentials
    this.youtube = google.youtube({ version: 'v3', auth: auth2Client });
  }

  /**
   * Uploads a video to YouTube using the provided user refresh token.
   * @param filePath Path to the video file
   * @param title Video title
   * @param description Video description
   * @param refreshToken User's Google refresh token
   */
  async uploadVideo(
    filePath: string,
    title: string,
    description: string,
    refreshToken: string,
    opts?: {
      expectedChannelId?: string;
      onBehalfOfContentOwner?: string;
      onBehalfOfContentOwnerChannel?: string;
      privacyStatus?: 'private' | 'public' | 'unlisted';
    }
  ): Promise<string> {
    try {
        console.log({refreshToken});
      // Set user credentials for this upload
      auth2Client.setCredentials({ refresh_token: refreshToken });
      const youtube = google.youtube({ version: 'v3', auth: auth2Client });

      // Optional: verify that the credentials map to the expected channel
      if (opts?.expectedChannelId) {
        const ch = await youtube.channels.list({ part: ['id'], mine: true });
        const actualChannelId = ch.data.items?.[0]?.id;
        if (!actualChannelId) {
          throw new Error('Unable to resolve authenticated channel ID');
        }
        if (actualChannelId !== opts.expectedChannelId) {
          throw new Error(`Authenticated channel (${actualChannelId}) does not match expected channel (${opts.expectedChannelId})`);
        }
      }
      const res = await youtube.videos.insert({
        part: ['snippet', 'status'],
        requestBody: {
          snippet: { title, description },
          status: { privacyStatus: opts?.privacyStatus ?? 'unlisted' },
        },
        media: {
          body: fs.createReadStream(filePath),
        },
        // These only work for Content Owner CMS accounts
        onBehalfOfContentOwner: opts?.onBehalfOfContentOwner,
        onBehalfOfContentOwnerChannel: opts?.onBehalfOfContentOwnerChannel,
      });
      this.logger.log(`YouTube video uploaded: ${res.data.id}`);
      return `https://www.youtube.com/watch?v=${res.data.id}`;
    } catch (error) {
      this.logger.error('YouTube upload failed', error);
      throw error;
    }
  }
}
