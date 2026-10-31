import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, actions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { adjudicateSandboxDispute, AdjudicationOutcome } from "@/lib/paypal/disputes";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AdjudicateRequestSchema = z.object({
  disputeId: z.string().min(1, "disputeId is required"),
  outcome: z.enum(["SELLER_FAVOR", "BUYER_FAVOR"]),
  approvedBy: z.string().min(1).default("Merchant Admin Simulator"),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = AdjudicateRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid adjudication parameters" },
        { status: 400 }
      );
    }

    const { disputeId, outcome, approvedBy } = parseResult.data;

    // 1. Fetch Dispute Record
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: `Dispute '${disputeId}' not found in database.` }, { status: 404 });
    }

    // 2. Call PayPal Sandbox Adjudication Endpoint
    let paypalResponse: Record<string, unknown> = { outcome };

    if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
      await adjudicateSandboxDispute(disputeId, outcome as AdjudicationOutcome, approvedBy);
      paypalResponse = {
        status: "TRANSMITTED_TO_PAYPAL_SANDBOX",
        endpoint: `/v1/customer/disputes/${disputeId}/adjudicate`,
        outcome,
      };
    } else {
      paypalResponse = {
        status: "SIMULATED_SANDBOX_SUCCESS",
        note: "Simulated PayPal dispute adjudication",
        outcome,
      };
    }

    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_adj`;

    // 3. Update Database State
    db.transaction((tx) => {
      tx.update(disputes)
        .set({
          caseState: "RESOLVED",
          paypalStatus: "RESOLVED",
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId))
        .run();

      tx.insert(actions)
        .values({
          id: actionId,
          disputeId,
          type: "adjudicate",
          payloadJson: JSON.stringify({ outcome, approvedBy }),
          paypalResponseJson: JSON.stringify(paypalResponse),
          status: "RESOLVED",
          approvedBy,
          createdAt: now,
        })
        .run();
    });

    // 4. Log Immutable Audit Record
    await logAudit({
      actor: "system",
      disputeId,
      action: `DISPUTE_ADJUDICATED_${outcome}`,
      detail: { outcome, approvedBy, caseState: "RESOLVED" },
    });

    return NextResponse.json({
      success: true,
      disputeId,
      outcome,
      caseState: "RESOLVED",
      actionId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during dispute adjudication" },
      { status: 500 }
    );
  }
}
