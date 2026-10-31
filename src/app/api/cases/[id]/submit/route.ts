import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, drafts, orders, actions, facts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { buildEvidencePayload } from "@/lib/evidence/mapping";
import { provideDisputeEvidence } from "@/lib/paypal/disputes";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SubmitRequestSchema = z.object({
  approvedBy: z.string().min(1, "Merchant representative name ('approvedBy') is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = SubmitRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid submission request" },
        { status: 400 }
      );
    }

    const { approvedBy } = parseResult.data;

    // 1. Fetch Dispute Record
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];

    // 2. Strict Human Gate: Case must already have been approved
    if (dispute.caseState !== "APPROVED") {
      return NextResponse.json(
        {
          error: `Case must be in 'APPROVED' state before submitting to PayPal. Current state is '${dispute.caseState}'.`,
        },
        { status: 400 }
      );
    }

    // 3. Fetch Approved Draft
    const draftRows = await db
      .select()
      .from(drafts)
      .where(eq(drafts.disputeId, disputeId))
      .orderBy(desc(drafts.createdAt));

    if (!draftRows.length) {
      return NextResponse.json({ error: "No draft found to submit" }, { status: 400 });
    }

    const draft = draftRows[0];
    if (draft.groundingStatus !== "pass" && draft.groundingStatus !== "edited_pass") {
      return NextResponse.json(
        { error: `Cannot submit draft: Grounding validation failed ('${draft.groundingStatus}').` },
        { status: 400 }
      );
    }

    // 4. Fetch Linked Order and Facts
    let carrier: string | undefined;
    let trackingNumber: string | undefined;

    if (dispute.orderId) {
      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.id, dispute.orderId));
      const order = orderRows[0];
      if (order?.carrier && order?.trackingNumber) {
        carrier = order.carrier;
        trackingNumber = order.trackingNumber;
      }
    }

    if (!carrier || !trackingNumber) {
      // Check tracking facts if not directly on the order record
      const trackingFacts = await db
        .select()
        .from(facts)
        .where(eq(facts.disputeId, disputeId));
      for (const f of trackingFacts) {
        if (f.kind === "tracking" && f.value) {
          const match = f.value.match(/(?:FEDEX|UPS|USPS|DHL)/i);
          if (match && !carrier) carrier = match[0].toUpperCase();
          const trkMatch = f.value.match(/\b([A-Z0-9]{8,30})\b/);
          if (trkMatch && !trackingNumber) trackingNumber = trkMatch[1];
        }
      }
    }

    // 5. Construct Compliant Evidence Payload
    const evidencePayload = buildEvidencePayload({
      reason: dispute.reason,
      carrier,
      trackingNumber,
      notesText: draft.notesText || undefined,
    });

    // 6. Transmit to PayPal Sandbox Disputes API
    let paypalResponse: Record<string, unknown> = { status: "SUCCESS" };

    if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
      await provideDisputeEvidence({
        disputeId,
        evidencePayload,
        approvedBy,
      });
      paypalResponse = { status: "TRANSMITTED_TO_PAYPAL_SANDBOX", endpoint: `/v1/customer/disputes/${disputeId}/provide-evidence` };
    } else {
      // In local dev/test when no live sandbox credentials exist in env
      paypalResponse = {
        status: "SIMULATED_SANDBOX_SUCCESS",
        note: "Simulated PayPal API call (PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET not configured)",
      };
    }

    // 7. Verify and Execute State Transition
    if (!canTransition(dispute.caseState as CaseState, "SUBMITTED")) {
      return NextResponse.json(
        { error: `Cannot transition case state from '${dispute.caseState}' to 'SUBMITTED'` },
        { status: 400 }
      );
    }

    const nextState = transitionState(dispute.caseState as CaseState, "SUBMITTED");
    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_sub`;

    db.transaction((tx) => {
      tx.update(disputes)
        .set({
          caseState: nextState,
          paypalStatus: "UNDER_REVIEW",
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId))
        .run();

      tx.update(drafts)
        .set({
          status: "submitted",
        })
        .where(eq(drafts.id, draft.id))
        .run();

      tx.insert(actions)
        .values({
          id: actionId,
          disputeId,
          type: "provide_evidence",
          payloadJson: JSON.stringify(evidencePayload),
          paypalResponseJson: JSON.stringify(paypalResponse),
          status: "SUBMITTED",
          approvedBy,
          createdAt: now,
        })
        .run();
    });

    // 8. Log Immutable Audit Record
    await logAudit({
      actor: "human",
      disputeId,
      action: "EVIDENCE_SUBMITTED_TO_PAYPAL",
      detail: {
        approvedBy,
        evidenceType: evidencePayload.evidences[0]?.evidence_type,
        caseState: nextState,
      },
    });

    return NextResponse.json({
      success: true,
      caseState: nextState,
      actionId,
      approvedBy,
      paypalResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during evidence submission" },
      { status: 500 }
    );
  }
}
