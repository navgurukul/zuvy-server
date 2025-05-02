import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();
import { helperVariable } from "./constants/helper";

let schemaName ;
if (process.env.ENV_NOTE == helperVariable.schemaName) {
  schemaName = helperVariable.schemaName;
} else {
  schemaName = 'main';
}

if (!process.env.DB_USER || !process.env.DB_PASS || !process.env.DB_HOST || !process.env.DB_PORT || !process.env.DB_NAME) {
  throw new Error("Missing required database environment variables.");
}
// Uncomment this line to
export default defineConfig({
  dialect: "postgresql",
  schema: './drizzle/schema.ts', // Update this path to the correct location of your schema file
  schemaFilter: [schemaName],
  dbCredentials: {
    url: `postgres://${process.env.DB_USER}:${process.env.DB_PASS}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
  },
  migrations: {
    table: "migrations",
    schema: schemaName // Change this to your actual schema name if different
  },
  out: "./drizzle", // Output directory for generated files
  verbose: true,
});
