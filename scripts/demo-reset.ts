import { execSync } from "child_process";
import fs from "fs";
import path from "path";

async function main() {
  console.log("🔄 Resetting DisputeDefender database for demo...");

  const dbPath = path.resolve(
    process.cwd(),
    process.env.DATABASE_URL?.replace("file:", "") || "./data/app.db"
  );
  const dbDir = path.dirname(dbPath);

  // If database files exist, remove them
  const filesToRemove = [
    dbPath,
    `${dbPath}-journal`,
    `${dbPath}-shm`,
    `${dbPath}-wal`,
  ];

  for (const f of filesToRemove) {
    if (fs.existsSync(f)) {
      fs.unlinkSync(f);
      console.log(`Deleted ${f}`);
    }
  }

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Run schema push / initialization
  console.log("Applying database schema via drizzle-kit push...");
  execSync("pnpm exec drizzle-kit push --force", { stdio: "inherit" });

  // Import the seed only now: importing it opens the DB, which must happen after the reset.
  const { seed } = await import("../src/lib/db/seed");
  await seed();

  console.log("\n==========================================================");
  console.log("🎉 DEMO RESET COMPLETE");
  console.log("==========================================================");
  console.log("Checklist before recording or demonstrating:");
  console.log("1. Scenario S1 (PP-D-1001): Earbuds - High score (FIGHT) - Ready to approve & submit.");
  console.log("2. Scenario S2 (PP-D-1002): Lamp - Weak proof (REFUND recommendation).");
  console.log("3. Scenario S3 (PP-D-1003): Jacket - Not as described (SNAD).");
  console.log("4. Scenario S4 (PP-D-1004): Wallet - Prompt injection attempt quarantined.");
  console.log("==========================================================\n");
}

main().catch((err) => {
  console.error("Failed demo:reset:", err);
  process.exit(1);
});
