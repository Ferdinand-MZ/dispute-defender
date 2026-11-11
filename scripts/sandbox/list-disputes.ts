import { listSandboxDisputes } from "../../src/lib/paypal/disputes";
import { syncPayPalDisputeToDb } from "../../src/lib/paypal/sync";
import { env } from "../../src/lib/env";

async function main() {
  console.log("==========================================================");
  console.log("📋 PayPal Customer Disputes v1 Sandbox Spike (List)");
  console.log("==========================================================");

  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    console.warn("⚠️  PAYPAL CREDENTIALS NOT CONFIGURED:");
    console.warn("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env to run this script.");
    process.exit(0);
  }

  const shouldSync = process.argv.includes("--sync");

  console.log("Querying GET /v1/customer/disputes?page_size=10...");
  try {
    const response = await listSandboxDisputes({ pageSize: 10 });
    const items = response.items || [];

    console.log(`✓ Retrieved ${items.length} disputes from sandbox account.`);

    if (items.length === 0) {
      console.log("\nNote: No open or historical disputes found in this sandbox merchant account.");
      console.log("To create one, either:");
      console.log("1. Log in to your Sandbox Buyer account at sandbox.paypal.com, go to Resolution Center, and file a dispute against a test transaction.");
      console.log("2. Or use the DisputeDefender demo storefront & simulation helpers.");
    } else {
      console.log("\nDisputes on file:");
      for (const d of items) {
        console.log(
          `  • ID: ${d.dispute_id} | Reason: ${d.reason} | Status: ${d.status} | Amount: ${d.dispute_amount.value} ${d.dispute_amount.currency_code}`
        );

        if (shouldSync) {
          const synced = await syncPayPalDisputeToDb(d);
          console.log(`    -> Synchronized into local DB (Case State: ${synced.caseState})`);
        }
      }

      if (!shouldSync) {
        console.log("\nTip: Pass '--sync' to normalize and persist these disputes to your local database.");
      }
    }
  } catch (err) {
    console.error("❌ Failed to list sandbox disputes:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
