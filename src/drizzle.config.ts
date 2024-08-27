
// import type { Config } from 'drizzle-kit';
// import { ConfigIndex } from './config/index';
// // import { dot } from "node:test/reporters";
// export default {
//   schema: "./drizzle/schema.ts",
//   schemaFilter: ["main"],
//   out: "./drizzle",
//   driver: 'pg',
//   dbCredentials: {
//     host: process.env.DB_HOST,
//     user: process.env.DB_USER,
//     password: process.env.DB_PASS,
//     database: process.env.DB_NAME,
//   }
// } satisfies Config;

import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
// import * as schema from './schema'; // Assuming you have a database connection
dotenv.config();

export default defineConfig({
  dialect: "postgresql",
  schema: './drizzle/schema.ts', // Update this path to the correct location of your schema file
  schemaFilter: ["main"],
  dbCredentials: {
  url: `postgres://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  },
  migrations: {
    table: "migrations",
    schema: "main" // Change this to your actual schema name if different
  },
  out: "./drizzle", // Output directory for generated files
  verbose: true,
});
