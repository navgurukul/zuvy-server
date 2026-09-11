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

//  Scan existing .sql files in drizzle/
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

async function generateMigrationFile() {
  console.log('Checking schema changes for migration generation...');

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

  try {
    const client = await pool.connect();
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
    client.release();
  } catch (err: any) {
    console.warn(
      `Note: Could not query database (${err.message}). Checking schema file.`,
    );
  } finally {
    await pool.end();
  }

  // 1. Collect all tables defined in drizzle/schema.ts
  const allSchemaTables: Record<string, any> = {};
  for (const [key, val] of Object.entries(schema)) {
    if (isTable(val)) {
      allSchemaTables[key] = val;
    }
  }

  const allSqlContent = getAllExistingSqlContent();
  const originalTables = getOriginalTableNames();

  // 2. Identify new tables
  const pendingTables: Record<string, any> = {};
  const pendingTableNames: string[] = [];

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
      pendingTables[key] = table;
      pendingTableNames.push(tName);
    }
  }

  // 3. Identify new columns in existing tables
  const pendingAlterStatements: string[] = [];
  const addedColumnsList: string[] = [];

  for (const [key, table] of Object.entries(allSchemaTables)) {
    const tName = getTableName(table);
    const sName =
      (table as any)[Symbol.for('drizzle:Schema')] ||
      (table as any)._.schema ||
      schemaName;

    if (pendingTableNames.includes(tName)) continue;

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

  // 4. Generate DDL for new tables
  let statements: string[] = [];
  if (Object.keys(pendingTables).length > 0) {
    const empty = generateDrizzleJson({});
    const cur = generateDrizzleJson(pendingTables);
    const ddl = await generateMigration(empty, cur);
    statements = statements.concat(ddl);
  }

  statements = statements.concat(pendingAlterStatements);

  if (statements.length === 0) {
    console.log(
      'All tables and columns are already up to date. No new SQL file needed.',
    );
    return;
  }

  // 5. Build and write SQL file
  let slug = 'migration';
  if (pendingTableNames.length === 1) {
    slug = `create_${pendingTableNames[0]}`;
  } else if (pendingTableNames.length > 1) {
    slug = `create_${pendingTableNames[0]}_and_more`;
  } else if (addedColumnsList.length > 0) {
    slug = `alter_tables_add_columns`;
  }

  const filename = getNextMigrationFilename(slug);
  const filePath = path.join(getDrizzleDir(), filename);

  const fileLines: string[] = [];

  for (const stmt of statements) {
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
  console.log('');
}

generateMigrationFile().catch((err) => {
  console.error('Migration generation failed:', err);
  process.exit(1);
});
