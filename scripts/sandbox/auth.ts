import { checkPayPalConnectivity, getPayPalAccessToken } from "../../src/lib/paypal/client";
import { env } from "../../src/lib/env";

async function main() {
  console.log("==========================================================");
  console.log("🔒 PayPal Sandbox Authentication Verification");
  console.log("==========================================================");
  console.log(`Environment Target: ${env.PAYPAL_ENV}`);
  console.log(`Base URL:           https://api-m.sandbox.paypal.com`);
  console.log(`Client ID Config:   ${env.PAYPAL_CLIENT_ID ? "✓ Configured (redacted)" : "❌ Missing"}`);
  console.log(`Client Secret:      ${env.PAYPAL_CLIENT_SECRET ? "✓ Configured (redacted)" : "❌ Missing"}`);
  console.log("----------------------------------------------------------");

  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    console.warn("\n⚠️  PAYPAL CREDENTIALS NOT CONFIGURED:");
    console.warn("To connect to the live PayPal Sandbox API, please add your sandbox");
    console.warn("credentials from developer.paypal.com to your .env file:");
    console.warn("  PAYPAL_CLIENT_ID=your_sandbox_client_id");
    console.warn("  PAYPAL_CLIENT_SECRET=your_sandbox_client_secret\n");
    console.log("Status: ⏸️  BLOCKED (Awaiting sandbox credentials in .env)");
    process.exit(0);
  }

  console.log("Attempting OAuth2 client_credentials token request...");
  try {
    const token = await getPayPalAccessToken();
    console.log("✓ OAuth Token Acquired Successfully!");
    console.log(`  Token Length: ${token.length} chars (Token contents securely redacted)`);
    console.log("  Token Type:   Bearer");
    console.log("  Cache Status: In-memory cached with 60s expiration skew");

    const conn = await checkPayPalConnectivity();
    console.log(`✓ Connectivity Check: ${conn.message}`);
    console.log("\nStatus: ✅ PASS (PayPal Sandbox OAuth2 verified)");
  } catch (err: unknown) {
    console.error("❌ Authentication Failed:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
