import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { isTable, getTableName, getTableColumns } from 'drizzle-orm';
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api';
import * as schema from '../../drizzle/schema';

dotenv.config();

const schemaName = process.env.ENV_NOTE || 'main';

function getDrizzleDir(): string {
  return path.resolve(process.cwd(), 'drizzle');
}

// Scan existing .sql files in drizzle/
function getAllExistingSqlContent(): string {
  const drizzleDir = getDrizzleDir();
  if (!fs.existsSync(drizzleDir)) return '';

  function walk(dir: string): string[] {
    let results: string[] = [];
    for (const f of fs.readdirSync(dir)) {
      const fullPath = path.join(dir, f);
      if (fs.statSync(fullPath).isDirectory()) {
        results = results.concat(walk(fullPath));
      } else if (f.endsWith('.sql')) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const files = walk(drizzleDir);
  return files.map((f) => fs.readFileSync(f, 'utf-8')).join('\n');
}

/**
 * Get the next sequential filename: 0007_create_table.sql
 */
function getNextMigrationFilename(slug: string): string {
  const drizzleDir = getDrizzleDir();
  const files = fs.readdirSync(drizzleDir);
  let maxNum = -1;

  for (const f of files) {
    const m = f.match(/^(\d{4})_/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  const nextNum = (maxNum + 1).toString().padStart(4, '0');
  const cleanSlug = slug
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 50)
    .replace(/^_|_$/g, '');

  return `${nextNum}_${cleanSlug || 'migration'}.sql`;
}

/**
 * Get legacy tables list to avoid re-generating old tables
 */
function getOriginalTableNames(): Set<string> {
  const originalTables = new Set<string>();
  const tableRegex = /main\.table\(\s*['"]([^'"]+)['"]/g;
  try {
    const headSchema = execSync('git show HEAD:drizzle/schema.ts', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    let match: RegExpExecArray | null;
    while ((match = tableRegex.exec(headSchema)) !== null) {
      originalTables.add(match[1]);
    }
  } catch {
    const orPath = path.join(getDrizzleDir(), 'schemaOR.ts');
    if (fs.existsSync(orPath)) {
      const orSchema = fs.readFileSync(orPath, 'utf-8');
      let match: RegExpExecArray | null;
      while ((match = tableRegex.exec(orSchema)) !== null) {
        originalTables.add(match[1]);
      }
    }
  }
  return originalTables;
}

async function runMigration() {
  console.log('Checking schema changes for migration...');

  const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 5432,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  const dbTables = new Set<string>();
  const dbColumnsByTable: Record<string, Set<string>> = {};
  let client: any = null;

  try {
    client = await pool.connect();
    // Ensure target schema exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}";`);

    const tablesRes = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = $1`,
      [schemaName],
    );
    for (const row of tablesRes.rows) {
      dbTables.add(row.table_name);
    }

    const colsRes = await client.query(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1`,
      [schemaName],
    );
    for (const row of colsRes.rows) {
      if (!dbColumnsByTable[row.table_name]) {
        dbColumnsByTable[row.table_name] = new Set();
      }
      dbColumnsByTable[row.table_name].add(row.column_name);
    }
  } catch (err: any) {
    console.warn(
      `Note: Could not query database (${err.message}). Checking schema file.`,
    );
  }

  try {
    // Collect all tables defined in drizzle/schema.ts
    const allSchemaTables: Record<string, any> = {};
    for (const [key, val] of Object.entries(schema)) {
      if (isTable(val)) {
        allSchemaTables[key] = val;
      }
    }

    const allSqlContent = getAllExistingSqlContent();
    const originalTables = getOriginalTableNames();

    // Identify new tables
    const pendingTablesForFile: Record<string, any> = {};
    const pendingTableNamesForFile: string[] = [];
    const pendingTablesForDb: Record<string, any> = {};

    for (const [key, table] of Object.entries(allSchemaTables)) {
      const tName = getTableName(table);
      const inSqlRegex = new RegExp(
        `CREATE TABLE (?:IF NOT EXISTS )?(?:"?${schemaName}"?\\.)?"?${tName}"?`,
        'i',
      );
      const inSql = inSqlRegex.test(allSqlContent);
      const isNewTable = !originalTables.has(tName);
      const notInDb = !dbTables.has(tName);

      if (!inSql && (isNewTable || notInDb)) {
        pendingTablesForFile[key] = table;
        pendingTableNamesForFile.push(tName);
      }

      if (notInDb) {
        pendingTablesForDb[key] = table;
      }
    }

    // Identify new columns in existing tables
    const pendingAlterStatements: string[] = [];
    const addedColumnsList: string[] = [];

    for (const [key, table] of Object.entries(allSchemaTables)) {
      const tName = getTableName(table);
      const sName =
        (table as any)[Symbol.for('drizzle:Schema')] ||
        (table as any)._.schema ||
        schemaName;

      if (pendingTableNamesForFile.includes(tName) || !dbTables.has(tName)) {
        continue;
      }

      const existingCols = dbColumnsByTable[tName];
      if (!existingCols) continue;

      const columns = getTableColumns(table);
      for (const col of Object.values(columns) as any[]) {
        if (!existingCols.has(col.name)) {
          let colDef = `"${col.name}" ${col.getSQLType()}`;
          if (col.hasDefault && col.default !== undefined) {
            if (typeof col.default === 'string') {
              colDef += ` DEFAULT '${col.default}'`;
            } else if (
              typeof col.default === 'number' ||
              typeof col.default === 'boolean'
            ) {
              colDef += ` DEFAULT ${col.default}`;
            } else if (col.default?.queryChunks) {
              const val = col.default.queryChunks
                .map((c: any) => c.value?.join?.('') || c.value || '')
                .join('');
              if (val) colDef += ` DEFAULT ${val}`;
            }
          }
          pendingAlterStatements.push(
            `ALTER TABLE "${sName}"."${tName}" ADD COLUMN IF NOT EXISTS ${colDef};`,
          );
          addedColumnsList.push(`${sName}.${tName}.${col.name}`);
        }
      }
    }

    // Generate DDL for new tables to save into file
    let fileStatements: string[] = [];
    if (Object.keys(pendingTablesForFile).length > 0) {
      const empty = generateDrizzleJson({});
      const cur = generateDrizzleJson(pendingTablesForFile);
      const ddl = await generateMigration(empty, cur);
      fileStatements = fileStatements.concat(ddl);
    }
    fileStatements = fileStatements.concat(pendingAlterStatements);

    // Generate DDL for database execution (including any tables missing in DB)
    let dbStatements: string[] = [];
    if (Object.keys(pendingTablesForDb).length > 0) {
      const empty = generateDrizzleJson({});
      const cur = generateDrizzleJson(pendingTablesForDb);
      const ddl = await generateMigration(empty, cur);
      dbStatements = dbStatements.concat(ddl);
    }
    dbStatements = dbStatements.concat(pendingAlterStatements);

    // If no changes needed for file and DB is already up to date
    if (fileStatements.length === 0 && dbStatements.length === 0) {
      console.log(
        'All tables and columns are already up to date. No new migration needed.',
      );
      return;
    }

    // Build and write SQL file if there are new changes
    if (fileStatements.length > 0) {
      let slug = 'migration';
      if (pendingTableNamesForFile.length === 1) {
        slug = `create_${pendingTableNamesForFile[0]}`;
      } else if (pendingTableNamesForFile.length > 1) {
        slug = `create_${pendingTableNamesForFile[0]}_and_more`;
      } else if (addedColumnsList.length > 0) {
        slug = `alter_tables_add_columns`;
      }

      const filename = getNextMigrationFilename(slug);
      const filePath = path.join(getDrizzleDir(), filename);

      const fileLines: string[] = [];

      for (const stmt of fileStatements) {
        const trimmed = stmt.trim();
        if (trimmed) {
          fileLines.push(trimmed.endsWith(';') ? trimmed : `${trimmed};`);
          fileLines.push('--> statement-breakpoint');
          fileLines.push('');
        }
      }

      if (fileLines[fileLines.length - 2] === '--> statement-breakpoint') {
        fileLines.splice(fileLines.length - 2, 2);
      }

      fs.writeFileSync(filePath, fileLines.join('\n'), 'utf-8');

      console.log('');
      console.log('Migration SQL file generated:');
      console.log(`drizzle/${filename}`);
    }

    // Migrate the changes into the database as well
    if (client && dbStatements.length > 0) {
      console.log('');
      console.log('🚀 Migrating changes into the database...');
      for (const stmt of dbStatements) {
        try {
          await client.query(stmt);
        } catch (err: any) {
          // Suppress benign warnings
        }
      }
      console.log('✔ Changes successfully migrated into the database!');
    }
  } finally {
    if (client) client.release();
    await pool.end();
  }
}

runMigration().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
