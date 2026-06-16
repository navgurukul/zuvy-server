import * as dotenv from 'dotenv';
dotenv.config();

const { db } = require('../src/db');
const { sql } = require('drizzle-orm');
const fs = require('fs');

async function diagnose() {
  console.log('--- DB DIAGNOSTIC START ---');

  const jobs = await db.execute(sql`
    SELECT id, status, local_segment_paths
    FROM zuvy_session_recordings
    WHERE id = 1328
  `);

  for (const job of jobs.rows as any[]) {
    console.log(`Job ID: ${job.id}`);
    const paths =
      typeof job.local_segment_paths === 'string'
        ? JSON.parse(job.local_segment_paths)
        : job.local_segment_paths;

    if (paths && paths.length > 0) {
      const p = paths[0];
      console.log(`Path: "${p}"`);
      console.log(`Exists:`, fs.existsSync(p));
      console.log(`Resolved Absolute:`, fs.existsSync(p));
    } else {
      console.log('No paths found');
    }
  }

  console.log('--- DB DIAGNOSTIC END ---');
}

diagnose()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
