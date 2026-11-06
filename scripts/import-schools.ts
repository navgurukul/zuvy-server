/**
 * Loads the UDISE school list into zuvy_schools, for the Student ID sign-up
 * dropdowns (state -> city -> school). Use the "Basic Details of Schools"
 * CSV from the India Data Portal (UDISE dataset) exactly as downloaded.
 *
 * Check the file only (nothing is written):
 *   npx ts-node --transpile-only scripts/import-schools.ts <file.csv>
 *
 * Load it into the database configured in .env:
 *   npx ts-node --transpile-only scripts/import-schools.ts <file.csv> --yes
 *
 * Only some states:
 *   ... --states "Telangana,Bihar"
 *
 * Safe to run again (for example with next year's file): schools are
 * matched by UDISE code and updated, never duplicated. Run migration 0045
 * first.
 */
import 'dotenv/config'; // first: drizzle/schema reads ENV_NOTE when loaded
import { existsSync } from 'fs';
import { FileImportStats, importSchoolFile } from '../src/schools/udise-file';

function parseArgs(argv: string[]) {
  const args = { file: '', yes: false, states: [] as string[] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--yes') args.yes = true;
    else if (arg === '--states') {
      args.states = (argv[++i] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (!arg.startsWith('--') && !args.file) args.file = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

const target = () => {
  const schema =
    process.env.ENV_NOTE === 'stage_template' ? 'stage_template' : 'main';
  return `database "${process.env.DB_NAME}" on ${process.env.DB_HOST}, schema "${schema}"`;
};

const formatNumber = (n: number) => n.toLocaleString('en-IN');

function printReport(stats: FileImportStats, saved: boolean) {
  console.log('');
  console.log(`Schools in the file:     ${formatNumber(stats.totalRows)}`);
  console.log(`Good schools:            ${formatNumber(stats.valid)}`);
  if (stats.otherStates) {
    console.log(`Left out (other states): ${formatNumber(stats.otherStates)}`);
  }
  console.log(`Skipped (bad rows):      ${formatNumber(stats.skipped)}`);
  console.log(
    `Leading zero added back: ${formatNumber(stats.leadingZeroAdded)} codes`,
  );
  if (saved) {
    console.log(`Added to the list:       ${formatNumber(stats.inserted)}`);
    console.log(`Updated in the list:     ${formatNumber(stats.updated)}`);
  }
  for (const [reason, count] of Object.entries(stats.skipReasons)) {
    console.log(`  skipped, ${reason}: ${formatNumber(count)}`);
  }
  stats.examples.slice(0, 10).forEach((e) => {
    console.log(`  row ${e.row}: ${e.reason}`);
  });
  console.log('');
  console.log('Schools per state:');
  Object.entries(stats.states)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([state, count]) => {
      console.log(`  ${state.padEnd(30)} ${formatNumber(count)}`);
    });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.file || !existsSync(args.file)) {
    console.error(
      'Usage: npx ts-node --transpile-only scripts/import-schools.ts <basic-details-of-schools.csv> [--states "A,B"] [--yes]',
    );
    process.exit(1);
  }
  const started = Date.now();
  const seconds = () => Math.round((Date.now() - started) / 1000);

  if (!args.yes) {
    console.log(`Checking ${args.file} (nothing is written)...`);
    const stats = await importSchoolFile({
      filePath: args.file,
      states: args.states,
      onProgress: (s) => {
        if (s.totalRows % 100000 < 1000) {
          process.stdout.write(`  ${formatNumber(s.totalRows)} rows read\r`);
        }
      },
    });
    printReport(stats, false);
    console.log('');
    console.log(
      `Checked in ${seconds()} s. To load it into ${target()}, run again with --yes`,
    );
    return;
  }

  console.log(`Loading ${args.file} into ${target()}`);
  // Loaded only now: importing src/db opens the database connection.
  const { db } = await import('../src/db');
  const { loadPlaceNames, upsertSchools } =
    await import('../src/schools/school-store');
  const { sql } = await import('drizzle-orm');
  const { zuvySchools } = await import('../drizzle/schema');

  try {
    await db.execute(
      sql`select ${zuvySchools.udiseCode}, ${zuvySchools.village}, ${zuvySchools.classTo} from ${zuvySchools} limit 1`,
    );
  } catch (error) {
    console.error(
      `The table zuvy_schools is missing or old (${error.message}). Run drizzle/migrations/0045_schools_and_sessions.sql first.`,
    );
    process.exit(1);
  }

  const places = await loadPlaceNames(db);
  let lastReport = 0;
  const stats = await importSchoolFile({
    filePath: args.file,
    states: args.states,
    places,
    saveBatch: (rows) => upsertSchools(db, rows),
    onProgress: (s) => {
      if (s.valid - lastReport >= 50000) {
        lastReport = s.valid;
        console.log(
          `  ${formatNumber(s.valid)} schools saved (${seconds()} s)`,
        );
      }
    },
  });
  printReport(stats, true);
  console.log('');
  console.log(
    `Done in ${seconds()} s. The sign-up dropdowns show the new list within 10 minutes.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error?.message ?? error);
    process.exit(1);
  });
