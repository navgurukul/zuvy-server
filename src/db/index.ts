import * as dotenv from 'dotenv';
dotenv.config();

import * as schema from '../../drizzle/schema'; // Assuming you have a database connection

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ConfigIndex } from '../config/index';

// A non-negative number of milliseconds from the environment; 0 is allowed
// and means "no limit" in Postgres. Empty or invalid falls back to the default.
function msFromEnv(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

// Safety net: a statement waiting more than 30 s for a lock fails instead of
// waiting for ever. Postgres can't see a wait that goes through the app (a
// transaction waiting on a query that, on another pooled connection, waits on
// that transaction's own lock), so without this such a request would hang
// indefinitely. Override with DB_LOCK_TIMEOUT_MS.
const LOCK_TIMEOUT_MS = msFromEnv(process.env.DB_LOCK_TIMEOUT_MS, 30_000);

// Safety net: if a connection is cut in the middle of a transaction (network
// blip, failover), the server keeps that transaction and its row locks until
// it notices the dead link, which can take many minutes; meanwhile anything
// needing those rows waits. A transaction sitting idle longer than this is
// ended by the server instead. Transactions here don't wait on anything
// outside the database (the one that does, the Zoom licence-transfer lock,
// raises its own limit), so 2 minutes is generous. Override with
// DB_IDLE_IN_TX_TIMEOUT_MS.
const IDLE_IN_TX_TIMEOUT_MS = msFromEnv(
  process.env.DB_IDLE_IN_TX_TIMEOUT_MS,
  120_000,
);

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
  // Notice a dead network link sooner, so a broken connection isn't handed
  // out to a request.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  // Runs once per new connection, and the pool waits for it before handing
  // the connection out (pg-pool >= 3.10), so the timeouts are in place for
  // the first query. Older pg-pool ignores this option; the 'connect'
  // listener below covers that case.
  onConnect: (client) => prepareConnection(client),
});

// Set up each new connection once:
// - An 'error' listener, so a connection dropped by the server can't crash
//   the process. The pool only listens for errors on idle connections; one
//   that drops while a request holds it (e.g. between two statements of a
//   transaction) emits an 'error' with no listener, which Node turns into a
//   crash. The request using it still fails (its next query errors), and
//   the pool discards the dead connection when it's released.
// - The session timeouts, with a normal query (not startup options) so it
//   also works behind a connection pooler such as PgBouncer. If that fails,
//   it is logged and the connection is still used, without them.
const preparedConnections = new WeakSet<object>();
async function prepareConnection(client: any): Promise<void> {
  if (preparedConnections.has(client)) return;
  preparedConnections.add(client);
  client.on('error', (error: Error) => {
    console.error(`Postgres pool: connection error: ${error.message}`);
  });
  try {
    await client.query(
      `SET lock_timeout = ${LOCK_TIMEOUT_MS}; ` +
        `SET idle_in_transaction_session_timeout = ${IDLE_IN_TX_TIMEOUT_MS}`,
    );
  } catch (error: any) {
    console.error(
      `Postgres pool: could not set session timeouts: ${error.message}`,
    );
  }
}

pool.on('error', (error) => {
  console.error(`Postgres pool: idle connection error: ${error.message}`);
});
// Fallback for pg-pool versions without onConnect (they skip it): set the
// connection up here instead. With onConnect it is already done and this
// does nothing.
pool.on('connect', (client) => {
  void prepareConnection(client);
});

export const db = drizzle(pool, { schema: schema });
