/**
 * Mints access/refresh JWTs for every student in students-<runId>.csv,
 * without going through Google OAuth or the real /auth/login endpoint.
 *
 * This works because a plain "student" role JWT is stateless in this app:
 * AuthService.validateToken()'s ensureTokenSessionIsCurrent() skips its
 * DB session check entirely when rolesList is ['student'] and orgId is
 * null (see src/auth/auth.service.ts ensureTokenSessionIsCurrent). The
 * payload shape below matches exactly what AuthService.login() signs.
 *
 * Usage:
 *   npx ts-node scripts/load-test/login-students.ts --runId=abc123 [--expiresIn=15d]
 *
 * --expiresIn accepts any jsonwebtoken duration string (e.g. 24h, 15d) and
 * applies to both the access and refresh token (a load test has no use for
 * a shorter refresh token than access token). Defaults to 24h, matching
 * real login(). When set, the output file is named
 * tokens-<runId>-<expiresIn>.csv instead of tokens-<runId>.csv, so re-runs
 * with a different expiry don't clobber a previous one.
 *
 * Writes scripts/load-test/output/tokens-<runId>[-<expiresIn>].csv — one
 * row per student with their full record (name/email/bootcampId/batchId/
 * etc.) plus the minted tokens, so it's the single file to hand to
 * whoever is running the load test. Contains LIVE bearer tokens signed
 * with the real JWT_SECRET_KEY. Treat as a secret: never commit it,
 * delete it once the load test is done.
 */
import 'dotenv/config';
import * as jwt from 'jsonwebtoken';
import * as path from 'path';
import {
  parseArgs,
  readCsv,
  writeCsv,
  ensureOutputDir,
  OUTPUT_DIR,
} from './lib';

async function main() {
  const args = parseArgs(process.argv);
  const runId = String(args.runId ?? '');
  if (!runId) {
    console.error('Usage: ts-node login-students.ts --runId=<id>');
    process.exit(1);
  }

  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) {
    console.error('JWT_SECRET_KEY is not set in the environment. Aborting.');
    process.exit(1);
  }

  const expiresIn = String(args.expiresIn ?? '24h');

  const inputPath = path.join(OUTPUT_DIR, `students-${runId}.csv`);
  const rows = readCsv(inputPath);
  if (rows.length === 0) {
    throw new Error(`No rows found in ${inputPath}`);
  }
  console.log(`Loaded ${rows.length} students from ${inputPath}`);
  console.log(`Token expiry: ${expiresIn}`);

  const results = rows.map((row) => {
    const payload = {
      sub: row.userId,
      email: row.email,
      googleUserId: row.googleUserId,
      role: 'student',
      rolesList: ['student'],
      permissions: {},
      orgId: null,
      orgName: null,
      isPoc: false,
    };
    const accessToken = jwt.sign(payload, secret, { expiresIn });
    const refreshToken = jwt.sign(payload, secret, { expiresIn });
    const decoded = jwt.decode(accessToken) as { exp: number };
    return {
      ...row,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: new Date(decoded.exp * 1000).toISOString(),
    };
  });

  ensureOutputDir();
  const outSuffix = args.expiresIn ? `-${expiresIn}` : '';
  const outPath = path.join(OUTPUT_DIR, `tokens-${runId}${outSuffix}.csv`);
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
      'accessToken',
      'refreshToken',
      'accessTokenExpiresAt',
    ],
    results,
  );

  console.log(`\nDone. Minted ${results.length} tokens.`);
  console.log(`CSV: ${outPath}`);
  console.log(
    '\n/!\\ This file contains live bearer tokens signed with your real JWT secret.\n' +
      '    Do not commit it. Delete it once the load test finishes.',
  );
  console.log(
    `\nAfter testing, clean up with: npx ts-node scripts/load-test/cleanup-students.ts --runId=${runId} --dryRun`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error('login-students failed:', err);
  process.exit(1);
});
