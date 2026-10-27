import { execSync } from "child_process";
import fs from "fs";
import path from "path";

export const TEST_DB_PATH = "./data/test.db";

// Recreate a throwaway SQLite file so tests never touch the app database.
export default function setup() {
  const resolved = path.resolve(TEST_DB_PATH);
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    fs.rmSync(`${resolved}${suffix}`, { force: true });
  }
  execSync("pnpm exec drizzle-kit push --force", {
    stdio: "ignore",
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
  });
}
