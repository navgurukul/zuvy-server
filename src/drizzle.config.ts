
import type { Config } from 'drizzle-kit';
import { ConfigIndex } from './config/index';
// import { dot } from "node:test/reporters";
export default {
  schema: "./drizzle/schema.ts",
  schemaFilter: ["main"],
  out: "./drizzle",
  driver: 'pg',
  dbCredentials: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  }
} satisfies Config;