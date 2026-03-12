import { Injectable } from '@nestjs/common';
import { google } from 'googleapis';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

@Injectable()
export class GoogleService {
  private oauthClient = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );

  /*
  Generate Google OAuth URL
  */
  async generateConnectUrl(userId: number) {
    const url = this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: userId.toString(),
    });

    return url;
  }

  /*
  Handle Google OAuth callback
  */
  async handleCallback(code: string, state: string) {
    const userId = Number(state);

    const { tokens } = await this.oauthClient.getToken(code);

    await db.execute(sql`
      UPDATE zuvy_mentor_slot_management
      SET google_refresh_token = ${tokens.refresh_token}
      WHERE mentor_user_id = ${BigInt(userId)}
    `);

    return {
      message: 'Google Calendar connected successfully',
    };
  }
}
