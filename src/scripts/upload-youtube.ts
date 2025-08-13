import 'dotenv/config';
import * as fs from 'fs';
import { db } from '../db/index';
import { userTokens } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { YoutubeService } from '../services/youtube.service';

/**
 * Manual test script: Upload a local video file to YouTube using a user's refresh token.
 *
 * Required env vars:
 * - GOOGLE_CLIENT_ID
 * - GOOGLE_CLIENT_SECRET
 * - GOOGLE_REDIRECT_URI
 * - DATABASE connection vars used by src/db/index.ts (ConfigIndex.database)
 * - TEST_USER_EMAIL  (email stored in user_tokens.user_email)
 * - VIDEO_PATH       (absolute or relative path to .mp4 file)
 * - YT_TITLE         (title for the YouTube video)
 * - YT_DESCRIPTION   (description for the YouTube video)
 * - YOUTUBE_CHANNEL_ID (optional: assert uploads go to this channel)
 */
async function main() {

  console.log('--- YouTube Upload Test Script ---');
  const email = process.env.TEAM_EMAIL;
  const filePath = process.env.VIDEO_PATH;
  const title = process.env.YT_TITLE || 'Test Upload';
  const description = process.env.YT_DESCRIPTION || 'Uploaded via test script';
  const expectedChannelId = process.env.YOUTUBE_CHANNEL_ID;
  console.log('Input params:', { email, filePath, title, description, expectedChannelId });


  if (!email || !filePath) {
    console.error('Missing required env vars. Please set TEST_USER_EMAIL and VIDEO_PATH. Optional: YT_TITLE, YT_DESCRIPTION.');
    process.exit(1);
  }

  console.log('Checking if file exists...');
  if (!fs.existsSync(filePath)) {
    console.error(`File not found at path: ${filePath}`);
    process.exit(1);
  }
  console.log('File exists.');

  try {
    console.log('Fetching refresh token for user from DB...');
    const records = await db
      .select()
      .from(userTokens)
      .where(eq(userTokens.userEmail, email));

    if (!records.length || !records[0].refreshToken) {
      console.error(`No refresh token found for user: ${email}`);
      process.exit(1);
    }
    console.log('Refresh token found.');

    const refreshToken = records[0].refreshToken as string;

    console.log('Instantiating YoutubeService...');
    const yt = new YoutubeService();
    console.log('Uploading video to YouTube...');
    const link = await yt.uploadVideo(filePath, title, description, refreshToken, {
      expectedChannelId,
    });

    console.log('Upload complete!');
    console.log(JSON.stringify({ success: true, link }, null, 2));
    process.exit(0);
  } catch (err: any) {
    console.error('Error during upload process:');
    console.error(
      JSON.stringify(
        { success: false, error: err?.message || 'Unknown error', details: err?.response?.data },
        null,
        2
      )
    );
    process.exit(1);
  }
}


main();
