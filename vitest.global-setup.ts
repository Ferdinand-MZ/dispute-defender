import { Pool } from "pg";
import { CREATE_TABLES_SQL } from "./src/lib/db/init";

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  "postgresql://dispute:dispute_password@localhost:5433/dispute_defender_test";

// Ensure the dedicated PostgreSQL test database exists and has a clean schema before tests run.
export default async function setup() {
  const adminPool = new Pool({
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://dispute:dispute_password@localhost:5433/dispute_defender",
  });

  try {
    const dbCheck = await adminPool.query(
      "SELECT 1 FROM pg_database WHERE datname = 'dispute_defender_test'"
    );
    if (dbCheck.rowCount === 0) {
      await adminPool.query("CREATE DATABASE dispute_defender_test OWNER dispute");
    }
  } finally {
    await adminPool.end();
  }

  const testPool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await testPool.query(CREATE_TABLES_SQL);
    await testPool.query(`
      TRUNCATE TABLE
        webhook_events,
        audit_log,
        actions,
        drafts,
        analyses,
        facts,
        disputes,
        comms,
        orders,
        policies
      RESTART IDENTITY CASCADE;
    `);
  } finally {
    await testPool.end();
  }
}
