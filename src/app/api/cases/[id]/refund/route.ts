import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, orders, actions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { refundCapture } from "@/lib/paypal/orders";
import { logAudit } from "@/lib/audit";
import { verifyMerchantAuth } from "@/lib/auth";
import {
  isDemoMode,
  isSandboxMode,
  assertSandboxCredentials,
  formatDemoSimulationResponse,
  isLocalSeedOrSimulatedDispute,
  PayPalConfigError,
} from "@/lib/mode";
import { PayPalApiError } from "@/lib/paypal/client";
import { z } from "zod";

export const dynamic = "force-dynamic";

const RefundRequestSchema = z.object({
  approvedBy: z
    .string()
    .min(1, "Merchant representative name ('approvedBy') is required")
    .optional(),
  noteToPayer: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    // 1. Strict Server-Side Authentication & Authorization Gate
    const auth = verifyMerchantAuth(req);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: auth.status || 401 }
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = RefundRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid refund request" },
        { status: 400 }
      );
    }

    const approvedBy = parseResult.data?.approvedBy?.trim() || auth.user.name;
    const { noteToPayer } = parseResult.data;

    // 2. Fetch Dispute Record
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];

    // 3. Duplicate Refund Guard: Prevent double-refunding
    if (dispute.caseState === "REFUNDED") {
      return NextResponse.json(
        { error: "Duplicate refund attempt: This dispute has already been refunded." },
        { status: 409 }
      );
    }

    const existingRefunds = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.disputeId, disputeId),
          eq(actions.type, "refund"),
          eq(actions.status, "REFUNDED")
        )
      );

    if (existingRefunds.length > 0) {
      return NextResponse.json(
        { error: "Duplicate refund attempt: Capture has already been refunded." },
        { status: 409 }
      );
    }

    // 4. Validate State Transition
    if (!canTransition(dispute.caseState as CaseState, "REFUNDED")) {
      return NextResponse.json(
        { error: `Cannot transition case state from '${dispute.caseState}' to 'REFUNDED'` },
        { status: 400 }
      );
    }

    // 5. Amount & Currency Validation
    if (!dispute.amountMinor || dispute.amountMinor <= 0) {
      return NextResponse.json(
        { error: "Invalid refund amount: Disputed amount must be greater than zero." },
        { status: 400 }
      );
    }

    // 6. Resolve Capture ID from Dispute or Linked Order
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

    // 7. Server-Controlled Mode Execution Gate
    let paypalResponse: Record<string, unknown>;

    if (isDemoMode()) {
      // DEMO MODE: Pure local simulation with visible labeling, NEVER contacts PayPal API
      paypalResponse = formatDemoSimulationResponse("refund", {
        disputeId,
        captureId,
        amountMinor: dispute.amountMinor,
        currency: dispute.currency,
      });
    } else {
      // SANDBOX MODE: Communicate with PayPal Payments API v2
      try {
        assertSandboxCredentials();
      } catch (configErr) {
        if (configErr instanceof PayPalConfigError) {
          return NextResponse.json(
            { error: configErr.message, mode: "sandbox" },
            { status: configErr.statusCode }
          );
        }
        throw configErr;
      }

      const stableRequestId = `ref_${captureId}_${disputeId}`;
      try {
        const refundResult = await refundCapture({
          captureId,
          approvedBy,
          amountMinor: dispute.amountMinor,
          currency: dispute.currency,
          noteToPayer: noteToPayer || "Dispute defender full refund",
          requestId: stableRequestId,
        });

        paypalResponse = {
          mode: "sandbox",
          simulated: false,
          ...refundResult,
        };
      } catch (ppErr) {
        if (
          ppErr instanceof PayPalApiError &&
          ppErr.status === 404 &&
          isLocalSeedOrSimulatedDispute(dispute.rawJson)
        ) {
          paypalResponse = formatDemoSimulationResponse("refund", {
            disputeId,
            captureId,
            amountMinor: dispute.amountMinor,
            currency: dispute.currency,
            paypalSandboxAuthVerified: true,
            paypalDebugId: ppErr.debugId,
          });
        } else {
          throw ppErr;
        }
      }
    }

    const nextState = transitionState(dispute.caseState as CaseState, "REFUNDED");
    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_ref`;

    // 8. Update Database State
    await db.transaction(async (tx) => {
      await tx
        .update(disputes)
        .set({
          caseState: nextState,
          paypalStatus: "RESOLVED",
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId));

      if (linkedOrderRecord) {
        await tx
          .update(orders)
          .set({
            status: "refunded",
            updatedAt: now,
          })
          .where(eq(orders.id, linkedOrderRecord.id));
      }

      await tx.insert(actions).values({
        id: actionId,
        disputeId,
        type: "refund",
        payloadJson: JSON.stringify({ captureId, approvedBy, noteToPayer }),
        paypalResponseJson: JSON.stringify(paypalResponse),
        status: "REFUNDED",
        approvedBy,
        createdAt: now,
      });
    });

    // 9. Log Immutable Audit Record
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
        mode: isDemoMode() ? "demo" : "sandbox",
        simulated: isDemoMode(),
      },
    });

    return NextResponse.json({
      success: true,
      caseState: nextState,
      actionId,
      captureId,
      approvedBy,
      mode: isDemoMode() ? "demo" : "sandbox",
      simulated: isDemoMode(),
      paypalResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during refund processing" },
      { status: 500 }
    );
  }
}
