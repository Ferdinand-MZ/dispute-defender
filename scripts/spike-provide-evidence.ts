import { getSandboxDispute, provideDisputeEvidence } from "../src/lib/paypal/disputes";
import { buildEvidencePayload } from "../src/lib/evidence/mapping";
import { db } from "../src/lib/db";
import { actions, disputes } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "../src/lib/audit";
import { env } from "../src/lib/env";

async function main() {
  console.log("==========================================================");
  console.log("🛡️  PayPal Evidence Submission Spike (Human-Gated)");
  console.log("==========================================================");

  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
    console.warn("⚠️  PAYPAL CREDENTIALS NOT CONFIGURED in .env.");
    process.exit(0);
  }

  const disputeId = process.argv[2];
  if (!disputeId) {
    console.log("Usage: pnpm tsx scripts/spike-provide-evidence.ts <DISPUTE_ID> [--approve=\"<YOUR_NAME>\"]");
    process.exit(0);
  }

  const approveArg = process.argv.find((arg) => arg.startsWith("--approve="));
  const approvedBy = approveArg ? approveArg.split("=")[1].replace(/"/g, "") : null;

  console.log(`Checking dispute status for: ${disputeId}...`);
  const dispute = await getSandboxDispute(disputeId);
  console.log(`  Current Status: ${dispute.status}`);
  console.log(`  Reason:         ${dispute.reason}`);

  // Build the compliant evidence payload based on dispute reason
  const evidencePayload = buildEvidencePayload({
    reason: dispute.reason,
    carrier: "FEDEX",
    trackingNumber: "TESTTRACK0001",
    notesText: "Package dispatched via FedEx with verified tracking. Proof of delivery on record.",
  });

  console.log("\nPrepared Evidence Payload:");
  console.log(JSON.stringify(evidencePayload, null, 2));

  // ENFORCE NON-NEGOTIABLE RULE 3: Strict Human Authorization Gatekeeper
  if (!approvedBy) {
    console.log("\n==========================================================");
    console.log("🛑 SUBMISSION BLOCKED — HUMAN AUTHORIZATION REQUIRED");
    console.log("==========================================================");
    console.log("DisputeDefender strictly forbids autonomous submission of evidence");
    console.log("to the PayPal Disputes API without human sign-off.");
    console.log("\nTo authorize and submit this evidence packet, re-run with:");
    console.log(`  pnpm tsx scripts/spike-provide-evidence.ts ${disputeId} --approve="Your Name"`);
    console.log("==========================================================\n");
    process.exit(0);
  }

  console.log(`\n✓ Human approval verified from: "${approvedBy}"`);
  console.log("Submitting evidence to POST /v1/customer/disputes/{id}/provide-evidence...");

  try {
    await provideDisputeEvidence({
      disputeId,
      evidencePayload,
      approvedBy,
    });

    console.log("✓ Evidence successfully submitted to PayPal Sandbox API!");

    // Record action and audit log in database
    const actionId = `act_${Date.now()}`;
    await db.insert(actions).values({
      id: actionId,
      disputeId,
      type: "provide_evidence",
      payloadJson: JSON.stringify(evidencePayload),
      paypalResponseJson: JSON.stringify({ status: "SUCCESS" }),
      status: "success",
      approvedBy,
      createdAt: new Date().toISOString(),
    });

    await db
      .update(disputes)
      .set({ caseState: "SUBMITTED", updatedAt: new Date().toISOString() })
      .where(eq(disputes.paypalDisputeId, disputeId));

    await logAudit({
      actor: "human",
      disputeId,
      action: "EVIDENCE_SUBMITTED_TO_PAYPAL",
      detail: { approvedBy, actionId },
    });

    console.log("✓ Action and audit log recorded in database. Case state -> SUBMITTED.");
  } catch (err) {
    console.error("❌ Submission failed:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
