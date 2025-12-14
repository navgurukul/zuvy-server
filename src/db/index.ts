import * as dotenv from 'dotenv';
dotenv.config();

import * as schema from '../../drizzle/schema';

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ConfigIndex } from '../config/index';

// Singleton verification - this should only log ONCE per process
console.log('[DB] ========================================');
console.log('[DB] Database module loading...');
console.log('[DB] This should appear ONLY ONCE at startup');
console.log('[DB] ========================================');

const pool = new Pool({
  ...ConfigIndex.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

console.log('[DB] Pool instance created at:', new Date().toISOString());
console.log('[DB] Pool configuration:', {
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Pool event listeners for monitoring
pool.on('connect', () => {
  console.log('[DB] New connection created');
});

pool.on('acquire', () => {
  console.log('[DB] Connection acquired');
});

pool.on('error', (err) => {
  console.error('[DB] Unexpected pool error:', err);
});

pool.on('remove', () => {
  console.log('[DB] Connection removed from pool');
});

export const db = drizzle(pool, { schema: schema });
