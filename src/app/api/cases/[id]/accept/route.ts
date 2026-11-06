import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, actions } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { acceptSandboxDisputeClaim } from "@/lib/paypal/disputes";
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

const AcceptRequestSchema = z.object({
  approvedBy: z
    .string()
    .min(1, "Merchant representative name ('approvedBy') is required")
    .optional(),
  note: z.string().optional(),
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
    const parseResult = AcceptRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid accept request" },
        { status: 400 }
      );
    }

    const approvedBy = parseResult.data?.approvedBy?.trim() || auth.user.name;
    const { note } = parseResult.data;

    // 2. Fetch Dispute Record
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];

    // 3. Duplicate Accept Guard
    if (dispute.caseState === "ACCEPTED") {
      return NextResponse.json(
        { error: "Duplicate claim acceptance: Claim has already been accepted." },
        { status: 409 }
      );
    }

    const existingAccepts = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.disputeId, disputeId),
          eq(actions.type, "accept_claim"),
          eq(actions.status, "ACCEPTED")
        )
      );

    if (existingAccepts.length > 0) {
      return NextResponse.json(
        { error: "Duplicate claim acceptance: Claim has already been accepted." },
        { status: 409 }
      );
    }

    // 4. Validate State Transition
    if (!canTransition(dispute.caseState as CaseState, "ACCEPTED")) {
      return NextResponse.json(
        { error: `Cannot transition case from '${dispute.caseState}' to 'ACCEPTED'` },
        { status: 400 }
      );
    }

    // 5. Server-Controlled Mode Execution Gate
    let paypalResponse: Record<string, unknown>;

    if (isDemoMode()) {
      // DEMO MODE: Pure local simulation with visible labeling, NEVER contacts PayPal API
      paypalResponse = formatDemoSimulationResponse("accept_claim", {
        disputeId,
        note: note || "Accepting claim in accordance with store policy.",
      });
    } else {
      // SANDBOX MODE: Communicate with PayPal Disputes API
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

      try {
        await acceptSandboxDisputeClaim(
          dispute.paypalDisputeId,
          approvedBy,
          note || "Accepting claim in accordance with store policy."
        );

        paypalResponse = {
          mode: "sandbox",
          simulated: false,
          status: "TRANSMITTED_TO_PAYPAL_SANDBOX",
          endpoint: `/v1/customer/disputes/${disputeId}/accept-claim`,
        };
      } catch (ppErr) {
        if (
          ppErr instanceof PayPalApiError &&
          ppErr.status === 404 &&
          isLocalSeedOrSimulatedDispute(dispute.rawJson)
        ) {
          paypalResponse = formatDemoSimulationResponse("accept_claim", {
            disputeId,
            note: note || "Accepting claim in accordance with store policy.",
            paypalSandboxAuthVerified: true,
            paypalDebugId: ppErr.debugId,
          });
        } else {
          throw ppErr;
        }
      }
    }

    const nextState = transitionState(dispute.caseState as CaseState, "ACCEPTED");
    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_acc`;

    // 6. Update Database
    await db.transaction(async (tx) => {
      await tx
        .update(disputes)
        .set({
          caseState: nextState,
          paypalStatus: "RESOLVED",
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId));

      await tx.insert(actions).values({
        id: actionId,
        disputeId,
        type: "accept_claim",
        payloadJson: JSON.stringify({ approvedBy, note }),
        paypalResponseJson: JSON.stringify(paypalResponse),
        status: "ACCEPTED",
        approvedBy,
        createdAt: now,
      });
    });

    // 7. Append Audit Record
    await logAudit({
      actor: "human",
      disputeId,
      action: "CLAIM_ACCEPTED",
      detail: {
        approvedBy,
        note,
        caseState: nextState,
        mode: isDemoMode() ? "demo" : "sandbox",
        simulated: isDemoMode(),
      },
    });

    return NextResponse.json({
      success: true,
      caseState: nextState,
      actionId,
      approvedBy,
      mode: isDemoMode() ? "demo" : "sandbox",
      simulated: isDemoMode(),
      paypalResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during claim acceptance" },
      { status: 500 }
    );
  }
}
