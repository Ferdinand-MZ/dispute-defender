import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, orders, actions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { refundCapture } from "@/lib/paypal/orders";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RefundRequestSchema = z.object({
  approvedBy: z.string().min(1, "Merchant representative name ('approvedBy') is required"),
  noteToPayer: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = RefundRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid refund request" },
        { status: 400 }
      );
    }

    const { approvedBy, noteToPayer } = parseResult.data;

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
    if (!canTransition(dispute.caseState as CaseState, "REFUNDED")) {
      return NextResponse.json(
        { error: `Cannot transition case state from '${dispute.caseState}' to 'REFUNDED'` },
        { status: 400 }
      );
    }

    // 3. Resolve Capture ID from Dispute or Linked Order
    let captureId = dispute.captureId;
    let linkedOrderRecord = null;

    if (dispute.orderId) {
      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.id, dispute.orderId));
      if (orderRows.length) {
        linkedOrderRecord = orderRows[0];
        if (!captureId && linkedOrderRecord.captureId) {
          captureId = linkedOrderRecord.captureId;
        }
      }
    }

    if (!captureId) {
      return NextResponse.json(
        { error: "No capture transaction ID available for this dispute to execute a refund." },
        { status: 400 }
      );
    }

    // 4. Execute Refund via PayPal Payments API v2
    let paypalResponse: Record<string, unknown> = { status: "REFUNDED" };

    if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
      const refundResult = await refundCapture({
        captureId,
        approvedBy,
        amountMinor: dispute.amountMinor,
        currency: dispute.currency,
        noteToPayer: noteToPayer || "Dispute defender full refund",
      });
      paypalResponse = refundResult as unknown as Record<string, unknown>;
    } else {
      paypalResponse = {
        status: "SIMULATED_SANDBOX_SUCCESS",
        id: `SIM_REF_${Date.now()}`,
        amount: { value: String(dispute.amountMinor / 100), currency_code: dispute.currency },
      };
    }

    const nextState = transitionState(dispute.caseState as CaseState, "REFUNDED");
    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_ref`;

    // 5. Update Database State
    db.transaction((tx) => {
      tx.update(disputes)
        .set({
          caseState: nextState,
          paypalStatus: "RESOLVED",
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId))
        .run();

      if (linkedOrderRecord) {
        tx.update(orders)
          .set({
            status: "refunded",
            updatedAt: now,
          })
          .where(eq(orders.id, linkedOrderRecord.id))
          .run();
      }

      tx.insert(actions)
        .values({
          id: actionId,
          disputeId,
          type: "refund",
          payloadJson: JSON.stringify({ captureId, approvedBy, noteToPayer }),
          paypalResponseJson: JSON.stringify(paypalResponse),
          status: "REFUNDED",
          approvedBy,
          createdAt: now,
        })
        .run();
    });

    // 6. Log Immutable Audit Record
    await logAudit({
      actor: "human",
      disputeId,
      action: "CAPTURE_REFUNDED",
      detail: {
        approvedBy,
        captureId,
        amountMinor: dispute.amountMinor,
        currency: dispute.currency,
        caseState: nextState,
      },
    });

    return NextResponse.json({
      success: true,
      caseState: nextState,
      actionId,
      captureId,
      approvedBy,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during refund processing" },
      { status: 500 }
    );
  }
}
