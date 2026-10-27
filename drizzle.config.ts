import { defineConfig } from "drizzle-kit";
import fs from "fs";
import path from "path";

const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "./data/app.db";

// drizzle-kit does not create parent folders; do it here so db:push works on every OS.
fs.mkdirSync(path.dirname(path.resolve(dbPath)), { recursive: true });

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: dbPath,
  },
});
