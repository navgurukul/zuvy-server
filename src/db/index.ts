import * as dotenv from 'dotenv';
dotenv.config();

import * as schema from '../../drizzle/schema'; // Assuming you have a database connection

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ConfigIndex } from '../config/index';

// A pool, not one shared Client. With a single Client, drizzle runs every
// db.transaction() on that same connection, so two requests at once
// interleave inside one transaction: one request's COMMIT/ROLLBACK applies to
// the other's writes, and row locks / advisory locks never block (Postgres
// doesn't block a session on its own locks). With a pool, each transaction
// gets its own connection.
//
// Inside a transaction, always use the `trx`/`tx` handle. A query on the
// global `db` there now runs on another connection: it can't see the
// transaction's uncommitted rows and commits on its own.
const pool = new Pool({
  ...ConfigIndex.database,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  // Fail a query after 15 s without a free connection, instead of hanging.
  connectionTimeoutMillis: 15_000,
});

// A connection dropped by the server must not crash the process. The pool
// only listens for errors on idle connections; a connection that drops while
// a request holds it (e.g. between two statements of a transaction) emits an
// 'error' with no listener, which Node turns into a crash. So every
// connection gets its own listener. The request using it still fails (its
// next query errors), and the pool discards the dead connection when it's
// released.
pool.on('error', (error) => {
  console.error(`Postgres pool: idle connection error: ${error.message}`);
});
pool.on('connect', (client) => {
  client.on('error', (error) => {
    console.error(`Postgres pool: connection error: ${error.message}`);
  });
});

export const db = drizzle(pool, { schema: schema });
