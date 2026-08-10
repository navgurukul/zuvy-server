/**
 * Creates N dummy "student" users and enrolls them into a specific
 * bootcamp + batch, for load-testing the assessment feature.
 *
 * Usage:
 *   npx ts-node scripts/load-test/generate-students.ts --bootcampId=123 --batchId=456 [--count=500] [--runId=abc123]
 *
 * Writes scripts/load-test/output/students-<runId>.csv — the source of
 * truth for scripts/load-test/login-students.ts and
 * scripts/load-test/cleanup-students.ts. Do not lose this file; cleanup
 * depends on it.
 */
import 'dotenv/config';
import * as path from 'path';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db';
import {
  users,
  zuvyBootcamps,
  zuvyBatches,
  zuvyBatchEnrollments,
} from '../../drizzle/schema';
import {
  parseArgs,
  writeCsv,
  ensureOutputDir,
  OUTPUT_DIR,
  EMAIL_DOMAIN,
} from './lib';

async function main() {
  const args = parseArgs(process.argv);
  const bootcampId = Number(args.bootcampId);
  const batchId = Number(args.batchId);
  const count = Number(args.count ?? 500);
  const runId = String(args.runId ?? Date.now().toString(36));

  if (!bootcampId || !batchId || !Number.isFinite(count) || count <= 0) {
    console.error(
      'Usage: ts-node generate-students.ts --bootcampId=<id> --batchId=<id> [--count=500] [--runId=<id>]',
    );
    process.exit(1);
  }

  const [bootcamp] = await db
    .select()
    .from(zuvyBootcamps)
    .where(eq(zuvyBootcamps.id, bootcampId));
  if (!bootcamp) {
    throw new Error(`Bootcamp ${bootcampId} not found. Aborting.`);
  }

  const [batch] = await db
    .select()
    .from(zuvyBatches)
    .where(eq(zuvyBatches.id, batchId));
  if (!batch) {
    throw new Error(`Batch ${batchId} not found. Aborting.`);
  }
  if (batch.bootcampId !== bootcampId) {
    throw new Error(
      `Batch ${batchId} belongs to bootcamp ${batch.bootcampId}, not ${bootcampId}. Refusing to continue.`,
    );
  }

  console.log(
    `Generating ${count} dummy students for bootcamp "${bootcamp.name}" (${bootcampId}) / batch "${batch.name}" (${batchId}). runId=${runId}`,
  );

  const idxPad = Math.max(3, String(count).length);
  const specs = Array.from({ length: count }, (_, i) => {
    const idx = String(i + 1).padStart(idxPad, '0');
    return {
      idx,
      email: `zt-${runId}-${idx}@${EMAIL_DOMAIN}`,
      name: `Load Test Student ${idx} (${runId})`,
      googleUserId: `zt-${runId}-${idx}`,
    };
  });

  const CHUNK = 50;
  const now = new Date().toISOString();
  const created: Record<string, unknown>[] = [];

  for (let start = 0; start < specs.length; start += CHUNK) {
    const chunk = specs.slice(start, start + CHUNK);

    const insertedUsers = await db
      .insert(users)
      .values(
        chunk.map((s) => ({
          email: s.email,
          name: s.name,
          googleUserId: s.googleUserId,
          mode: 'student',
          createdAt: now,
          lastLoginAt: now,
        })),
      )
      .returning({ id: users.id, email: users.email });

    const userIdByEmail = new Map(
      insertedUsers.map((u) => [u.email as string, u.id]),
    );

    const insertedEnrollments = await db
      .insert(zuvyBatchEnrollments)
      .values(
        chunk.map((s) => ({
          userId: userIdByEmail.get(s.email)!,
          bootcampId,
          batchId,
          status: 'active',
          enrolledDate: now,
        })),
      )
      .returning({
        id: zuvyBatchEnrollments.id,
        userId: zuvyBatchEnrollments.userId,
      });

    const enrollmentIdByUserId = new Map(
      insertedEnrollments.map((e) => [e.userId.toString(), e.id]),
    );

    for (const s of chunk) {
      const userId = userIdByEmail.get(s.email)!;
      created.push({
        index: s.idx,
        userId: userId.toString(),
        email: s.email,
        name: s.name,
        googleUserId: s.googleUserId,
        bootcampId,
        batchId,
        enrollmentId: enrollmentIdByUserId.get(userId.toString()),
        createdAt: now,
      });
    }
    console.log(
      `  inserted ${Math.min(start + CHUNK, specs.length)}/${specs.length}`,
    );
  }

  ensureOutputDir();
  const outPath = path.join(OUTPUT_DIR, `students-${runId}.csv`);
  writeCsv(
    outPath,
    [
      'index',
      'userId',
      'email',
      'name',
      'googleUserId',
      'bootcampId',
      'batchId',
      'enrollmentId',
      'createdAt',
    ],
    created,
  );

  console.log(`\nDone. Created ${created.length} students.`);
  console.log(`runId: ${runId}`);
  console.log(`CSV: ${outPath}`);
  console.log(
    `\nNext: npx ts-node scripts/load-test/login-students.ts --runId=${runId}`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('generate-students failed:', err);
  process.exit(1);
});
