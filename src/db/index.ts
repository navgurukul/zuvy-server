import * as dotenv from 'dotenv';
dotenv.config();

import * as schema from '../../drizzle/schema';

import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { ConfigIndex } from '../config/index';

const pool = new Pool({
  ...ConfigIndex.database,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export const db = drizzle(pool, { schema: schema });
