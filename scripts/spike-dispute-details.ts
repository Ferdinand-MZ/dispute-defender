import { getSandboxDispute, listSandboxDisputes } from "../src/lib/paypal/disputes";
import { syncPayPalDisputeToDb } from "../src/lib/paypal/sync";
import { env } from "../src/lib/env";

async function main() {
  console.log("==========================================================");
  console.log("🔍 PayPal Customer Dispute Details Spike");
  console.log("==========================================================");

  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    console.warn("⚠️  PAYPAL CREDENTIALS NOT CONFIGURED:");
    console.warn("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env to run this spike.");
    process.exit(0);
  }

  let disputeId = process.argv[2];

  if (!disputeId) {
    console.log("No dispute ID provided as argument. Checking for available sandbox disputes...");
    try {
      const list = await listSandboxDisputes({ pageSize: 1 });
      if (list.items && list.items.length > 0) {
        disputeId = list.items[0].dispute_id;
        console.log(`Found sandbox dispute: ${disputeId}`);
      } else {
        console.log("No disputes found in sandbox account.");
        console.log("Usage: pnpm tsx scripts/spike-dispute-details.ts <PAYPAL_DISPUTE_ID>");
        process.exit(0);
      }
    } catch (err) {
      console.error("Failed to query disputes list:", (err as Error).message);
      process.exit(1);
    }
  }

  console.log(`Fetching dispute details for: ${disputeId}...`);
  try {
    const dispute = await getSandboxDispute(disputeId);
    console.log("✓ Retrieved Dispute Details Successfully!");
    console.log(`  Dispute ID:       ${dispute.dispute_id}`);
    console.log(`  Status:           ${dispute.status}`);
    console.log(`  Reason:           ${dispute.reason}`);
    console.log(`  Lifecycle Stage:  ${dispute.dispute_life_cycle_stage || "N/A"}`);
    console.log(`  Dispute Amount:   ${dispute.dispute_amount.value} ${dispute.dispute_amount.currency_code}`);
    console.log(`  Response Due At:  ${dispute.seller_response_due_date || "N/A"}`);
    console.log(`  Messages Count:   ${dispute.messages?.length || 0}`);
    console.log(`  Evidences Count:  ${dispute.evidences?.length || 0}`);

    if (dispute.disputed_transactions && dispute.disputed_transactions.length > 0) {
      const tx = dispute.disputed_transactions[0];
      console.log(`  Disputed Tx ID:   ${tx.seller_transaction_id || tx.buyer_transaction_id || "N/A"}`);
      console.log(`  Custom / Order:   ${tx.custom || "N/A"}`);
    }

    const synced = await syncPayPalDisputeToDb(dispute);
    console.log(`\n✓ Synchronized to local SQLite fact base (Case State: ${synced.caseState})`);
  } catch (err) {
    console.error("❌ Failed to get dispute details:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
