import { getPool, ensureDatabaseReady } from "../src/lib/db";
import { seed } from "../src/lib/db/seed";

async function main() {
  console.log("🔄 Resetting DisputeDefender PostgreSQL database for demo...");

  const db = await ensureDatabaseReady();
  const pool = getPool();

  console.log("Truncating existing tables...");
  await pool.query(`
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

  await seed(db);

  await pool.end();

  console.log("\n==========================================================");
  console.log("🎉 DEMO RESET COMPLETE (PostgreSQL)");
  console.log("==========================================================");
  console.log("Checklist before recording or demonstrating:");
  console.log("1. Scenario S1 (PP-D-1001): Earbuds - delivered, strong proof - FIGHT, grounded draft ready to approve.");
  console.log("2. Scenario S2 (PP-D-1002): Lamp - no delivery scan, weak proof - REFUND.");
  console.log("3. Scenario S3 (PP-D-1003): Jacket - not as described, medium proof - FIGHT with draft.");
  console.log("4. Scenario S4 (PP-D-1004): Cardholder - never shipped - ACCEPT; buyer injection stored as untrusted.");
  console.log("==========================================================\n");
}

main().catch((err) => {
  console.error("Failed demo:reset:", err);
  process.exit(1);
});
