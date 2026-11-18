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
  // Notice a dead network link sooner, so a broken connection isn't handed
  // out to a request.
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
});

// Safety net: a statement waiting more than 30 s for a lock fails instead of
// waiting for ever. Postgres can't see a wait that goes through the app (a
// transaction waiting on a query that, on another pooled connection, waits on
// that transaction's own lock), so without this such a request would hang
// indefinitely. Set per connection with a normal query (not a startup
// option) so it also works behind a connection pooler such as PgBouncer.
// Override with DB_LOCK_TIMEOUT_MS.
const LOCK_TIMEOUT_MS = Number(process.env.DB_LOCK_TIMEOUT_MS) || 30_000;

// Safety net: if a connection is cut in the middle of a transaction (network
// blip, failover), the server keeps that transaction and its row locks until
// it notices the dead link, which can take many minutes; meanwhile anything
// needing those rows waits. A transaction sitting idle longer than this is
// ended by the server instead. No transaction in this app waits on anything
// outside the database, so 2 minutes is generous. Override with
// DB_IDLE_IN_TX_TIMEOUT_MS.
const IDLE_IN_TX_TIMEOUT_MS =
  Number(process.env.DB_IDLE_IN_TX_TIMEOUT_MS) || 120_000;

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
  // pg runs a client's queries in order, so this runs before the first query
  // the pool hands this connection out for.
  client
    .query(
      `SET lock_timeout = ${Math.max(0, Math.floor(LOCK_TIMEOUT_MS))}; ` +
        `SET idle_in_transaction_session_timeout = ${Math.max(0, Math.floor(IDLE_IN_TX_TIMEOUT_MS))}`,
    )
    .catch((error) =>
      console.error(
        `Postgres pool: could not set session timeouts: ${error.message}`,
      ),
    );
});

export const db = drizzle(pool, { schema: schema });
