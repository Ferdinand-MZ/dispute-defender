import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, actions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { adjudicateSandboxDispute, AdjudicationOutcome } from "@/lib/paypal/disputes";
import { logAudit } from "@/lib/audit";
import { verifyAdminAuth } from "@/lib/auth";
import {
  isDemoMode,
  isSandboxMode,
  assertSandboxCredentials,
  formatDemoSimulationResponse,
  PayPalConfigError,
} from "@/lib/mode";
import { z } from "zod";

export const dynamic = "force-dynamic";

const AdjudicateRequestSchema = z.object({
  disputeId: z.string().min(1, "disputeId is required"),
  outcome: z.enum(["SELLER_FAVOR", "BUYER_FAVOR"]),
  approvedBy: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Strict Server-Side Admin Authentication Gate
    const auth = verifyAdminAuth(req);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error || "Administrative authentication required" },
        { status: auth.status || 401 }
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = AdjudicateRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid adjudication parameters" },
        { status: 400 }
      );
    }

    const { disputeId, outcome } = parseResult.data;
    const approvedBy = parseResult.data.approvedBy?.trim() || auth.user.name;

    // 2. Fetch Dispute Record & Verify Existence
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json(
        { error: `Dispute '${disputeId}' not found in database.` },
        { status: 404 }
      );
    }

    // 3. Server-Controlled Mode Execution Gate
    let paypalResponse: Record<string, unknown>;

    if (isDemoMode()) {
      // DEMO MODE: Pure simulation, never contacts PayPal API
      paypalResponse = formatDemoSimulationResponse("adjudicate", {
        disputeId,
        outcome,
      });
    } else {
      // SANDBOX MODE: Communicate with PayPal Sandbox API
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

      await adjudicateSandboxDispute(disputeId, outcome as AdjudicationOutcome, approvedBy);

      paypalResponse = {
        mode: "sandbox",
        simulated: false,
        status: "TRANSMITTED_TO_PAYPAL_SANDBOX",
        endpoint: `/v1/customer/disputes/${disputeId}/adjudicate`,
        outcome,
      };
    }

    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_adj`;

    // 4. Update Database State
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

    // 5. Log Immutable Audit Record
    await logAudit({
      actor: "system",
      disputeId,
      action: `DISPUTE_ADJUDICATED_${outcome}`,
      detail: {
        outcome,
        approvedBy,
        caseState: "RESOLVED",
        mode: isDemoMode() ? "demo" : "sandbox",
        simulated: isDemoMode(),
      },
    });

    return NextResponse.json({
      success: true,
      disputeId,
      outcome,
      caseState: "RESOLVED",
      actionId,
      mode: isDemoMode() ? "demo" : "sandbox",
      simulated: isDemoMode(),
      paypalResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during dispute adjudication" },
      { status: 500 }
    );
  }
}
