import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { ensureTables } from "./init";
import { DEFAULT_DATABASE_URL } from "../env";

export type AppDatabase = NodePgDatabase<typeof schema>;

let _db: AppDatabase | null = null;
let _pool: Pool | null = null;
let _initPromise: Promise<void> | null = null;

export function getPool(): Pool {
  if (_pool) return _pool;
  const connectionString = process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
  _pool = new Pool({
    connectionString,
    max: 10,
  });
  return _pool;
}

export function getDb(): AppDatabase {
  if (_db) return _db;

  const pool = getPool();
  _db = drizzle(pool, { schema });

  if (!_initPromise) {
    _initPromise = (async () => {
      try {
        await ensureTables(pool);

        // Reseed on boot if DEMO_MODE is active and database has no disputes
        const isDemo =
          process.env.DEMO_MODE === "true" ||
          process.env.DEMO_MODE === "1" ||
          process.env.DEMO_MODE === undefined;
        const isSeedScript = /(?:seed|demo-reset)\.ts$/.test(process.argv[1] ?? "");

        if (isDemo && process.env.NODE_ENV !== "test" && !isSeedScript) {
          const res = await pool.query<{ cnt: string }>("SELECT count(*) as cnt FROM disputes");
          const cnt = Number(res.rows[0]?.cnt ?? 0);
          if (cnt === 0) {
            const { seed } = await import("./seed");
            await seed(_db!);
          }
        }
      } catch (err) {
        console.warn("[DB_INIT_WARNING] Could not auto-initialize or seed database:", (err as Error).message);
      }
    })();
  }

  return _db;
}

export async function ensureDatabaseReady(): Promise<AppDatabase> {
  const database = getDb();
  if (_initPromise) {
    await _initPromise;
  }
  return database;
}

export const db = getDb();
