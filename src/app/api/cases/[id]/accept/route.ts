import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, actions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { acceptSandboxDisputeClaim } from "@/lib/paypal/disputes";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AcceptRequestSchema = z.object({
  approvedBy: z.string().min(1, "Merchant representative name ('approvedBy') is required"),
  note: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = AcceptRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid accept request" },
        { status: 400 }
      );
    }

    const { approvedBy, note } = parseResult.data;

    // 1. Fetch Dispute Record
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];

    // 2. Validate State Transition
    if (!canTransition(dispute.caseState as CaseState, "ACCEPTED")) {
      return NextResponse.json(
        { error: `Cannot transition case from '${dispute.caseState}' to 'ACCEPTED'` },
        { status: 400 }
      );
    }

    // 3. PayPal Disputes API Call
    let paypalResponse: Record<string, unknown> = { status: "ACCEPTED" };
    if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
      await acceptSandboxDisputeClaim(
        dispute.paypalDisputeId,
        approvedBy,
        note || "Accepting claim in accordance with store policy."
      );
      paypalResponse = { status: "TRANSMITTED_TO_PAYPAL_SANDBOX", endpoint: `/v1/customer/disputes/${disputeId}/accept-claim` };
    } else {
      paypalResponse = {
        status: "SIMULATED_SANDBOX_SUCCESS",
        note: "Simulated PayPal API accept-claim call",
      };
    }

    const nextState = transitionState(dispute.caseState as CaseState, "ACCEPTED");
    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_acc`;

    // 4. Update Database
    db.transaction((tx) => {
      tx.update(disputes)
        .set({
          caseState: nextState,
          paypalStatus: "RESOLVED",
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId))
        .run();

      tx.insert(actions)
        .values({
          id: actionId,
          disputeId,
          type: "accept_claim",
          payloadJson: JSON.stringify({ approvedBy, note }),
          paypalResponseJson: JSON.stringify(paypalResponse),
          status: "ACCEPTED",
          approvedBy,
          createdAt: now,
        })
        .run();
    });

    // 5. Append Audit Record
    await logAudit({
      actor: "human",
      disputeId,
      action: "CLAIM_ACCEPTED",
      detail: { approvedBy, note, caseState: nextState },
    });

    return NextResponse.json({
      success: true,
      caseState: nextState,
      actionId,
      approvedBy,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during claim acceptance" },
      { status: 500 }
    );
  }
}
