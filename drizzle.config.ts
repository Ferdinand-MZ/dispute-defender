import { defineConfig } from "drizzle-kit";

const dbUrl =
  process.env.DATABASE_URL ||
  "postgresql://dispute:dispute_password@localhost:5433/dispute_defender";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
