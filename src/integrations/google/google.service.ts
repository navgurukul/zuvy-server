import { Injectable, UnauthorizedException } from '@nestjs/common';
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
  async generateConnectUrl(userId: number, redirectUrl?: string) {
    const statePayload = {
      userId,
      redirectUrl: redirectUrl || null,
    };

    const url = this.oauthClient.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: Buffer.from(JSON.stringify(statePayload)).toString('base64'),
    });

    return url;
  }

  /*
  Handle Google OAuth callback
  */
  async handleCallback(code: string, state: string) {
    if (!state) {
      throw new UnauthorizedException('Missing OAuth state');
    }

    const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));

    if (!decoded?.userId) {
      throw new UnauthorizedException('Invalid OAuth state');
    }

    const userId = Number(decoded.userId);
    const redirectUrl = decoded.redirectUrl;

    const { tokens } = await this.oauthClient.getToken(code);

    await db.execute(sql`
    UPDATE zuvy_mentor_slot_management
    SET google_refresh_token =
        COALESCE(${tokens.refresh_token}, google_refresh_token)
    WHERE mentor_user_id = ${BigInt(userId)}
  `);

    return {
      message: 'Google Calendar connected successfully',
      redirectUrl,
    };
  }
}
