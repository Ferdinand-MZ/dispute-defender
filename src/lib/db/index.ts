import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { ensureTables } from "./init";
import path from "path";
import fs from "fs";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _sqlite: Database.Database | null = null;

export function getDb() {
  if (_db) return _db;

  const dbUrl = process.env.DATABASE_URL?.replace("file:", "") || "./data/app.db";
  const resolvedPath = path.resolve(process.cwd(), dbUrl);

  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  _sqlite = new Database(resolvedPath);
  _sqlite.pragma("journal_mode = WAL");
  _sqlite.pragma("foreign_keys = ON");

  ensureTables(_sqlite);

  _db = drizzle(_sqlite, { schema });

  // Reseed on boot if DEMO_MODE is active and database has no disputes (e.g. Render ephemeral filesystem)
  const isDemo =
    process.env.DEMO_MODE === "true" ||
    process.env.DEMO_MODE === "1" ||
    process.env.DEMO_MODE === undefined;
  // The seed and demo-reset scripts seed explicitly; auto-seeding there would run the pipeline twice.
  const isSeedScript = /(?:seed|demo-reset)\.ts$/.test(process.argv[1] ?? "");
  if (isDemo && process.env.NODE_ENV !== "test" && !isSeedScript) {
    try {
      const row = _sqlite.prepare("SELECT count(*) as cnt FROM disputes").get() as { cnt: number } | undefined;
      if (!row || row.cnt === 0) {
        const { seed } = require("./seed");
        seed(_db).catch((seedErr: unknown) => {
          console.warn("[DEMO_MODE_RESEED_WARNING] Could not auto-seed demo data:", seedErr);
        });
      }
    } catch (seedErr) {
      console.warn("[DEMO_MODE_RESEED_WARNING] Could not auto-seed demo data:", seedErr);
    }
  }

  return _db;
}

export const db = getDb();
