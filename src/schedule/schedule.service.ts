import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  userTokens,
  zuvySessions,
} from '../../drizzle/schema';
import { db } from '../db/index';
import { eq, sql, count, inArray, isNull } from 'drizzle-orm';
import { google } from 'googleapis';

const { OAuth2 } = google.auth;
let { GOOGLE_CLIENT_ID, GOOGLE_SECRET, GOOGLE_REDIRECT, ZUVY_REDIRECT_URL } = process.env

let auth2Client = new OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_SECRET,
  GOOGLE_REDIRECT
);

@Injectable()
export class ScheduleService {

  @Cron('*/59 * * * *') // Runs every 59 minutes
  async getEventDetails(): Promise<any> {
    try {
      // Retrieve all classes with null s3link
      const classesWithNullS3Link = await db.select().from(zuvySessions).where(isNull(zuvySessions.s3link));

      // Iterate through each class
      for (const classData of classesWithNullS3Link) {
        // Fetch user tokens
        const userTokenData = await db.select().from(userTokens).where(eq(userTokens.userEmail, classData.creator));

        // Check if tokens are fetched successfully
        if (!userTokenData || userTokenData.length === 0) {
          return { status: 'error', message: 'Unable to fetch tokens' };
        }

        // Set credentials
        try {
          const tokens = userTokenData[0];
          auth2Client.setCredentials({
            access_token: tokens.accessToken,
            refresh_token: tokens.refreshToken,
          });
          const calendar = google.calendar({ version: 'v3', auth: auth2Client });
          if (classData.meetingId) {
            // Retrieve event details
            const eventDetails = await calendar.events.get({
              calendarId: 'primary',
              eventId: classData.meetingId,
            });
            // Create calendar instance

            // Check if meetingid exists and s3link is null

            // Check if event has attachments
            if (eventDetails.data.attachments) {
              // Iterate through attachments
              for (const attachment of eventDetails.data.attachments) {
                // If attachment is a video, update s3link
                if (attachment.mimeType === 'video/mp4') {
                  // Update s3link
                  let data:any = { ...classData, s3link: attachment.fileUrl }
                  await db
                    .update(zuvySessions)
                    .set(data)
                    .where(eq(zuvySessions.id, classData.id))
                    .returning();
                }
              }
            }
            // The classData start_time for the class has 3 days after the update the s3link to not found string
            // if the s3link is still null
            if (new Date(classData.startTime) < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)) {
              let data:any = { ...classData, s3link: 'not found' }
              await db
                .update(zuvySessions)
                .set(data)
                .where(eq(zuvySessions.id, classData.id))
                .returning();
            }
          }
        } catch (error) {
          Logger.error(error.message);
        }
      }
      Logger.log(`Cron job executed successfully update meeting link, ${classesWithNullS3Link.length} classes updated`);
    } catch (error) {
      Logger.error(error.message);
    }
  }
}
