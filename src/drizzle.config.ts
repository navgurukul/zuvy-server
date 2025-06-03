import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();
import { helperVariable } from "./constants/helper";
import { log } from "console";

let schemaName: string;
if (process.env.ENV_NOTE === helperVariable.schemaName) {
  schemaName = helperVariable.schemaName;
} else {
  schemaName = "main";
}
if (!process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_HOST || !process.env.DB_PORT || !process.env.DB_NAME) {
  throw new Error("Missing required database environment variables.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  schemaFilter: [schemaName],
  dbCredentials: {
    url: `postgres://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  },
  migrations: {
    table: "migrations",
    schema: schemaName
  },
  out: "./drizzle",
  verbose: true
});