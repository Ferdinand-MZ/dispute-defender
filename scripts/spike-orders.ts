import { createSandboxOrder, getSandboxOrder, captureSandboxOrder } from "../src/lib/paypal/orders";
import { syncPayPalOrderToDb } from "../src/lib/paypal/sync";
import { env } from "../src/lib/env";

async function main() {
  console.log("==========================================================");
  console.log("📦 PayPal Orders v2 Sandbox Spike");
  console.log("==========================================================");

  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    console.warn("⚠️  PAYPAL CREDENTIALS NOT CONFIGURED:");
    console.warn("Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env to run this spike.");
    process.exit(0);
  }

  const captureArg = process.argv.find((arg) => arg.startsWith("--capture="));
  const orderIdToCapture = captureArg ? captureArg.split("=")[1] : null;

  if (orderIdToCapture) {
    console.log(`Attempting to capture approved order: ${orderIdToCapture}`);
    try {
      const captured = await captureSandboxOrder(orderIdToCapture);
      console.log("✓ Order Captured Successfully!");
      console.log(`  Order ID: ${captured.id}`);
      console.log(`  Status:   ${captured.status}`);

      const savedDb = await syncPayPalOrderToDb(captured);
      console.log(`✓ Synchronized into database with ID: ${savedDb.id} (status: ${savedDb.status})`);
      process.exit(0);
    } catch (err) {
      console.error("❌ Capture failed:", (err as Error).message);
      process.exit(1);
    }
  }

  console.log("1. Creating test order for 1x Wireless Noise-Canceling Earbuds ($48.00 USD)...");
  try {
    const order = await createSandboxOrder({
      items: [
        {
          name: "Wireless Noise-Canceling Earbuds",
          sku: "WNC-EAR-01",
          quantity: 1,
          amountMinor: 4800,
          currency: "USD",
        },
      ],
      customId: "O-1001-TEST",
      invoiceId: `INV-${Date.now()}`,
    });

    console.log("✓ Order Created Successfully!");
    console.log(`  PayPal Order ID: ${order.id}`);
    console.log(`  Status:          ${order.status}`);

    const approveLink = order.links?.find((l) => l.rel === "approve")?.href;
    console.log(`  Approve Link:    ${approveLink || "N/A"}`);

    console.log("\n2. Retrieving order details via GET /v2/checkout/orders/{id}...");
    const retrieved = await getSandboxOrder(order.id);
    console.log(`✓ Order Verified: ${retrieved.id} (Status: ${retrieved.status})`);

    console.log("\n3. Normalizing and persisting to local database...");
    const dbRecord = await syncPayPalOrderToDb(retrieved);
    console.log(`✓ Saved to database table 'orders' with id '${dbRecord.id}'`);

    console.log("\n----------------------------------------------------------");
    console.log("Next step to complete purchase capture:");
    console.log("1. Open the Approve Link above in your browser and log in with your sandbox buyer.");
    console.log("2. Click 'Complete Purchase'.");
    console.log(`3. Run: pnpm tsx scripts/spike-orders.ts --capture=${order.id}`);
    console.log("----------------------------------------------------------");
  } catch (err) {
    console.error("❌ Order spike failed:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
