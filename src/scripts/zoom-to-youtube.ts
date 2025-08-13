import 'dotenv/config';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { YoutubeService } from '../services/youtube.service';

/**
 * End-to-end test script: download a Zoom recording and upload to YouTube.
 *
 * Required env vars:
 * - ZOOM_ACCESS_TOKEN      OAuth access token for Zoom API
 * - ZOOM_MEETING_ID        Meeting ID to fetch recordings for
 * - TEST_USER_EMAIL        Email in user_tokens (owner of the target YouTube channel)
 * - YT_TITLE               Title for the YouTube video
 * - YT_DESCRIPTION         Description for the YouTube video
 * - YOUTUBE_CHANNEL_ID     (optional) assert upload goes to this channel
 * - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REDIRECT_URI (for auth client)
 * - DB env vars as used by src/db/index.ts (ConfigIndex.database)
 */
async function main() {
  console.log('--- Zoom ➜ YouTube Test Script ---');

  const zoomToken = process.env.ZOOM_ACCESS_TOKEN;
  const meetingId = process.env.ZOOM_MEETING_ID;    
  const localVideo = process.env.LOCAL_VIDEO_PATH; // optional: skip Zoom download
  const email = process.env.TEAM_EMAIL;
  const title = process.env.YT_TITLE || 'Zoom Recording Upload';
  const description = process.env.YT_DESCRIPTION || 'Uploaded from Zoom via test script';
  const expectedChannelId = process.env.YOUTUBE_CHANNEL_ID;

  console.log('Input params:', { meetingId, email, title, expectedChannelId, localVideo });

  if (!email) {
    console.error('Missing required env var TEST_USER_EMAIL.');
    process.exit(1);
  }

  let tmpFile = '';
  try {
    if (localVideo) {
      if (!fs.existsSync(localVideo)) {
        throw new Error(`LOCAL_VIDEO_PATH not found: ${localVideo}`);
      }
      tmpFile = localVideo;
      console.log('Using local video file for upload:', tmpFile);
    } else {
      if (!zoomToken || !meetingId) {
        throw new Error('Missing ZOOM_ACCESS_TOKEN or ZOOM_MEETING_ID and no LOCAL_VIDEO_PATH provided.');
      }
      // 1) Fetch Zoom recordings
      console.log('Fetching Zoom recordings...');
      const recRes = await axios.get(`https://api.zoom.us/v2/meetings/${encodeURIComponent(meetingId)}/recordings`, {
        headers: { Authorization: `Bearer ${zoomToken}` },
      });
      const files = recRes.data?.recording_files || [];
      const mp4 = files.find((f: any) => f.file_type === 'MP4' && f.download_url);
      if (!mp4) {
        throw new Error('No MP4 recording file found for this meeting');
      }
      const downloadUrl = mp4.download_url as string;
      console.log('Found MP4 recording:', { fileSize: mp4.file_size, recordingStart: mp4.recording_start });

      // 2) Download to temp file
      const tmpDir = os.tmpdir();
      tmpFile = path.join(tmpDir, `zoom-${meetingId}-${Date.now()}.mp4`);
      console.log(`Downloading recording to: ${tmpFile}`);
      const writer = fs.createWriteStream(tmpFile);
      const downloadResponse = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'stream',
        headers: { Authorization: `Bearer ${zoomToken}` },
      });
      await new Promise<void>((resolve, reject) => {
        downloadResponse.data.pipe(writer);
        writer.on('finish', () => resolve());
        writer.on('error', (e) => reject(e));
      });
      console.log('Download complete.');
    }

    // 4) Upload to YouTube
    console.log('Uploading to YouTube...');
    const yt = new YoutubeService();
    const link = await yt.uploadVideo(tmpFile, title, description, '', {
      expectedChannelId,
      userEmail: email,
    });

    console.log('Upload complete.');
    console.log(JSON.stringify({ success: true, link }, null, 2));
  } catch (err: any) {
    console.error('Error during Zoom ➜ YouTube process:');
    console.error(
      JSON.stringify(
        { success: false, error: err?.message || 'Unknown error', details: err?.response?.data },
        null,
        2
      )
    );
    process.exitCode = 1;
  } finally {
    if (!localVideo && tmpFile && fs.existsSync(tmpFile)) {
      try {
        console.log('Cleaning up temp file...');
        fs.unlinkSync(tmpFile);
        console.log('Temp file removed.');
      } catch (e) {
        console.warn('Failed to remove temp file:', e);
      }
    }
  }
}

main();
