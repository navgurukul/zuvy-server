/**
 * Deletes dummy load-test students created by generate-students.ts,
 * plus every row anywhere in the DB that references their user IDs.
 *
 * Safety model:
 *   1. Every email in the input CSV must match the zt-<runId>-<idx>@zuvy-loadtest.invalid
 *      pattern. Any row that doesn't aborts the whole run before anything is deleted.
 *   2. Each userId is re-fetched from the DB and its email re-checked against
 *      both the CSV and the pattern. Any mismatch aborts before anything is deleted.
 *   3. The set of tables to clean is not hardcoded — it's discovered at
 *      runtime from information_schema (every FK column pointing at
 *      users.id, in the same schema users lives in). This DB has ~70
 *      tables referencing users.id across several legacy platforms that
 *      share the same users table (C4CA, Sansaar, mentor tools, resume
 *      builder, etc.) — deletes against those will just find 0 matching
 *      rows for load-test users, but they ARE included in the sweep.
 *   4. Everything runs in a single transaction. If a deeper (transitive,
 *      not-directly-to-users) FK blocks a delete, the whole transaction
 *      rolls back and the error is printed as-is — nothing is left
 *      partially deleted.
 *
 * Usage:
 *   npx ts-node scripts/load-test/cleanup-students.ts --runId=abc123 --dryRun   # preview only, deletes nothing
 *   npx ts-node scripts/load-test/cleanup-students.ts --runId=abc123           # actually deletes
 *
 * Always run with --dryRun first and review the report before the real run.
 */
import 'dotenv/config';
import * as path from 'path';
import { sql, inArray } from 'drizzle-orm';
import { db } from '../../src/db';
import { users, main as mainSchema } from '../../drizzle/schema';
import {
  parseArgs,
  readCsv,
  writeCsv,
  ensureOutputDir,
  OUTPUT_DIR,
  EMAIL_PATTERN,
} from './lib';

interface FkRef {
  table_name: string;
  column_name: string;
}

async function main() {
  const args = parseArgs(process.argv);
  const runId = String(args.runId ?? '');
  const dryRun = Boolean(args.dryRun);
  if (!runId) {
    console.error('Usage: ts-node cleanup-students.ts --runId=<id> [--dryRun]');
    process.exit(1);
  }

  const inputPath = path.join(OUTPUT_DIR, `students-${runId}.csv`);
  const rows = readCsv(inputPath);
  if (rows.length === 0) {
    throw new Error(`No rows found in ${inputPath}`);
  }
  console.log(`Loaded ${rows.length} row(s) from ${inputPath}`);

  // Safety check 1: every email in the CSV must match the synthetic pattern.
  const badCsvRows = rows.filter((r) => !EMAIL_PATTERN.test(r.email));
  if (badCsvRows.length > 0) {
    console.error(
      `Refusing to continue: ${badCsvRows.length} row(s) in the CSV have an email that ` +
        `doesn't match the load-test pattern. First bad row: ${JSON.stringify(badCsvRows[0])}`,
    );
    process.exit(1);
  }

  const userIds = rows.map((r) => BigInt(r.userId));

  // Safety check 2: re-fetch from the DB right now and cross-check the email again.
  const dbUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(inArray(users.id, userIds));
  const dbEmailById = new Map(
    dbUsers.map((u) => [u.id.toString(), u.email as string]),
  );

  for (const r of rows) {
    const dbEmail = dbEmailById.get(r.userId);
    if (dbEmail === undefined) {
      console.error(
        `Refusing to continue: userId ${r.userId} (${r.email}) from the CSV no longer exists ` +
          `in the DB. Aborting — nothing has been deleted.`,
      );
      process.exit(1);
    }
    if (dbEmail !== r.email || !EMAIL_PATTERN.test(dbEmail)) {
      console.error(
        `Refusing to continue: DB email for userId ${r.userId} is "${dbEmail}", which does not ` +
          `match the CSV ("${r.email}") or the load-test pattern. Aborting — nothing has been deleted.`,
      );
      process.exit(1);
    }
  }
  console.log(
    `Verified all ${rows.length} userId(s) against the DB — all match the load-test pattern.`,
  );

  const schemaName =
    (mainSchema as unknown as { schemaName: string }).schemaName || 'main';

  const fkResult: any = await db.execute(sql`
    SELECT tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = ${schemaName}
      AND ccu.table_schema = ${schemaName}
      AND ccu.table_name = 'users'
      AND ccu.column_name = 'id'
    ORDER BY tc.table_name, kcu.column_name
  `);
  const refs: FkRef[] = fkResult.rows ?? fkResult;
  console.log(
    `\nDiscovered ${refs.length} FK column(s) referencing users.id in schema "${schemaName}".`,
  );

  const idParams = userIds.map(String);
  const report: { table: string; rowsAffected: number }[] = [];

  if (dryRun) {
    console.log(
      '\n--dryRun: counting rows that WOULD be deleted. Nothing will be removed.\n',
    );
    for (const ref of refs) {
      const countResult: any = await db.execute(sql`
        SELECT count(*)::int AS count
        FROM ${sql.identifier(schemaName)}.${sql.identifier(ref.table_name)}
        WHERE ${sql.identifier(ref.column_name)} = ANY(${sql.param(idParams)}::bigint[])
      `);
      const count = (countResult.rows ?? countResult)[0]?.count ?? 0;
      if (count > 0) {
        console.log(
          `  would delete ${count} row(s) from ${ref.table_name}.${ref.column_name}`,
        );
      }
      report.push({
        table: `${ref.table_name}.${ref.column_name}`,
        rowsAffected: count,
      });
    }
    report.push({ table: 'users', rowsAffected: rows.length });
    console.log(`  would delete ${rows.length} row(s) from users`);
  } else {
    await db.transaction(async (tx) => {
      for (const ref of refs) {
        const result: any = await tx.execute(sql`
          DELETE FROM ${sql.identifier(schemaName)}.${sql.identifier(ref.table_name)}
          WHERE ${sql.identifier(ref.column_name)} = ANY(${sql.param(idParams)}::bigint[])
        `);
        const count = result.rowCount ?? 0;
        if (count > 0) {
          console.log(
            `  deleted ${count} row(s) from ${ref.table_name}.${ref.column_name}`,
          );
        }
        report.push({
          table: `${ref.table_name}.${ref.column_name}`,
          rowsAffected: count,
        });
      }

      const deletedUsers = await tx
        .delete(users)
        .where(inArray(users.id, userIds))
        .returning({ id: users.id });
      console.log(`  deleted ${deletedUsers.length} row(s) from users`);
      report.push({ table: 'users', rowsAffected: deletedUsers.length });
    });
  }

  ensureOutputDir();
  const outPath = path.join(
    OUTPUT_DIR,
    `cleanup-report-${runId}${dryRun ? '-dryrun' : ''}.csv`,
  );
  writeCsv(outPath, ['table', 'rowsAffected'], report);

  console.log(
    `\n${dryRun ? 'Dry run' : 'Cleanup'} complete. Report: ${outPath}`,
  );
  if (dryRun) {
    console.log(`\nTo actually delete, re-run without --dryRun:`);
    console.log(
      `  npx ts-node scripts/load-test/cleanup-students.ts --runId=${runId}`,
    );
  } else {
    console.log(
      '\nRemember to also delete scripts/load-test/output/tokens-<runId>.csv — it still contains ' +
        'signed bearer tokens (they will fail auth now that the underlying users are gone, but ' +
        'delete the file anyway).',
    );
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('cleanup-students failed. Nothing further will run.');
  console.error(err);
  process.exit(1);
});
