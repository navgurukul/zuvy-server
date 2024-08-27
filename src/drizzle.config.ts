import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
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
