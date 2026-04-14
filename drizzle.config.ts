import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  // schema:"./db/index.ts",
  schema: "./db/*.schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: "192.168.1.44",
    port: 5432,
    database: "project_X",
    user: "tarchunk",
    password: process.env.DB_PASSWORD,
  },
});
