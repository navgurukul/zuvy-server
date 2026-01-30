import { db } from '../src/db';
import { zuvySessions } from '../drizzle/schema';
import { sql, eq, isNull } from 'drizzle-orm';
import { ZoomService } from '../src/services/zoom/zoom.service';

const zoomService = new ZoomService();

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

async function backfillZoomUUIDs() {
  console.log('🔍 Fetching sessions missing Zoom UUID...');

  const sessions = await db
    .select({
      id: zuvySessions.id,
      zoomMeetingId: zuvySessions.zoomMeetingId,
    })
    .from(zuvySessions)
    .where(isNull(zuvySessions.zoomMeetingUuid));

  console.log(`📊 Found ${sessions.length} sessions`);

  let success = 0;
  let failed = 0;

  for (const session of sessions) {
    try {
      if (!session.zoomMeetingId) {
        throw new Error('Missing zoomMeetingId');
      }

      console.log(`➡️ Fetching UUID for meeting ${session.zoomMeetingId}`);

      const res = await zoomService.getMeeting(session.zoomMeetingId);

      if (!res.success || !res.data?.uuid) {
        throw new Error('UUID not returned from Zoom');
      }

      await db.execute(sql`
        UPDATE zuvy_sessions
        SET zoom_meeting_uuid = ${res.data.uuid}
        WHERE id = ${session.id}
      `);

      success++;
      console.log(`✅ Updated session ${session.id}`);

      await sleep(500); // Zoom rate limit safety
    } catch (err: any) {
      failed++;
      console.error(`❌ Failed for session ${session.id}: ${err.message}`);
    }
  }

  console.log('🎉 Backfill complete');
  console.log({ success, failed });
}

backfillZoomUUIDs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
