import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { actions, analyses, disputes, drafts, orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { verifyAdminAuth } from "@/lib/auth";
import { isDemoMode } from "@/lib/mode";
import { processDispute } from "@/lib/agent/pipeline";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SimulateDisputeSchema = z.object({
  scenario: z.enum(["S1", "S2", "S3", "S4"]).optional(),
  orderId: z.string().optional(),
  reason: z
    .enum(["MERCHANDISE_OR_SERVICE_NOT_RECEIVED", "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED"])
    .optional(),
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
    const parseResult = SimulateDisputeSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid simulation parameters" },
        { status: 400 }
      );
    }

    const { scenario, orderId, reason } = parseResult.data;
    const now = new Date();
    const hoursFromNow = (h: number) => new Date(now.getTime() + h * 3600000).toISOString();
    const nowIso = now.toISOString();

    let targetDisputeId = "";

    if (scenario) {
      const scenarioMap: Record<
        string,
        { id: string; orderId: string; reason: string; amountMinor: number; dueHours: number }
      > = {
        S1: {
          id: "PP-D-1001",
          orderId: "O-1001",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          amountMinor: 4800,
          dueHours: 36,
        },
        S2: {
          id: "PP-D-1002",
          orderId: "O-1002",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          amountMinor: 12000,
          dueHours: 120,
        },
        S3: {
          id: "PP-D-1003",
          orderId: "O-1003",
          reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
          amountMinor: 8900,
          dueHours: 72,
        },
        S4: {
          id: "PP-D-1004",
          orderId: "O-1004",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          amountMinor: 3500,
          dueHours: 24,
        },
      };

      const s = scenarioMap[scenario];
      targetDisputeId = s.id;

      // Reset or upsert this scenario dispute back to WAITING_FOR_SELLER_RESPONSE
      const existing = (await db.select().from(disputes).where(eq(disputes.paypalDisputeId, s.id)))[0];
      if (existing) {
        await db
          .update(disputes)
          .set({
            paypalStatus: "WAITING_FOR_SELLER_RESPONSE",
            caseState: "NEW",
            sellerResponseDueAt: hoursFromNow(s.dueHours),
            updatedAt: nowIso,
          })
          .where(eq(disputes.paypalDisputeId, s.id));
      } else {
        await db.insert(disputes).values({
          paypalDisputeId: s.id,
          orderId: s.orderId,
          captureId: `CAP-${s.orderId.replace("O-", "")}`,
          reason: s.reason,
          paypalStatus: "WAITING_FOR_SELLER_RESPONSE",
          lifeCycleStage: "CHARGEBACK",
          amountMinor: s.amountMinor,
          currency: "USD",
          sellerResponseDueAt: hoursFromNow(s.dueHours),
          caseState: "NEW",
          rawJson: JSON.stringify({ simulated: true, scenario }),
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    } else if (orderId) {
      // Find order
      const order = (await db.select().from(orders).where(eq(orders.id, orderId)))[0];
      if (!order) {
        return NextResponse.json({ error: `Order '${orderId}' not found.` }, { status: 404 });
      }

      targetDisputeId = `PP-D-${order.id}`;
      const disputeReason = reason || "MERCHANDISE_OR_SERVICE_NOT_RECEIVED";

      const existingDispute = (
        await db.select().from(disputes).where(eq(disputes.paypalDisputeId, targetDisputeId))
      )[0];

      if (existingDispute) {
        await db
          .update(disputes)
          .set({
            paypalStatus: "WAITING_FOR_SELLER_RESPONSE",
            caseState: "NEW",
            sellerResponseDueAt: hoursFromNow(48),
            updatedAt: nowIso,
          })
          .where(eq(disputes.paypalDisputeId, targetDisputeId));
      } else {
        await db.insert(disputes).values({
          paypalDisputeId: targetDisputeId,
          orderId: order.id,
          captureId: order.captureId,
          reason: disputeReason,
          paypalStatus: "WAITING_FOR_SELLER_RESPONSE",
          lifeCycleStage: "CHARGEBACK",
          amountMinor: order.amountMinor,
          currency: order.currency,
          sellerResponseDueAt: hoursFromNow(48),
          caseState: "NEW",
          rawJson: JSON.stringify({ simulated: true, orderId }),
          createdAt: nowIso,
          updatedAt: nowIso,
        });
      }
    } else {
      return NextResponse.json(
        { error: "Either 'scenario' (S1-S4) or 'orderId' must be provided." },
        { status: 400 }
      );
    }

    // A simulated dispute starts fresh: earlier analyses, drafts, and actions belong to the old run.
    db.transaction((tx) => {
      tx.delete(analyses).where(eq(analyses.disputeId, targetDisputeId)).run();
      tx.delete(drafts).where(eq(drafts.disputeId, targetDisputeId)).run();
      tx.delete(actions).where(eq(actions.disputeId, targetDisputeId)).run();
    });

    await logAudit({
      actor: "system",
      disputeId: targetDisputeId,
      action: "DISPUTE_SIMULATED",
      detail: {
        scenario: scenario || "CUSTOM",
        disputeId: targetDisputeId,
        mode: isDemoMode() ? "demo" : "sandbox",
      },
    });

    // Same path as a real webhook: facts, analysis, and a draft when the case is worth fighting.
    const result = await processDispute(targetDisputeId, { trigger: "simulator" });

    return NextResponse.json({
      success: true,
      disputeId: targetDisputeId,
      recommendation: result.analysis?.recommendation ?? null,
      draftStatus: result.draft?.groundingStatus ?? null,
      scenario: scenario || null,
      mode: isDemoMode() ? "demo" : "sandbox",
      simulated: true,
      message: `Dispute ${targetDisputeId} initialized and ready in sandbox queue.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during dispute simulation" },
      { status: 500 }
    );
  }
}
