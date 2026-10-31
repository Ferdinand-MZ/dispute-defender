import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, orders, facts, analyses, drafts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { formatMoney } from "@/lib/money";
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
      const scenarioMap: Record<string, { id: string; orderId: string; reason: string; amountMinor: number; dueHours: number; state: string }> = {
        S1: {
          id: "PP-D-1001",
          orderId: "O-1001",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          amountMinor: 4800,
          dueHours: 36,
          state: "DRAFTED",
        },
        S2: {
          id: "PP-D-1002",
          orderId: "O-1002",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          amountMinor: 12000,
          dueHours: 120,
          state: "ANALYZED",
        },
        S3: {
          id: "PP-D-1003",
          orderId: "O-1003",
          reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
          amountMinor: 8900,
          dueHours: 72,
          state: "NEW",
        },
        S4: {
          id: "PP-D-1004",
          orderId: "O-1004",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          amountMinor: 3500,
          dueHours: 24,
          state: "NEW",
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
            caseState: s.state,
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
          caseState: s.state,
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

        // Add basic dispute facts for this order
        await db.insert(facts).values([
          {
            id: `F-disp-${targetDisputeId}`,
            disputeId: targetDisputeId,
            kind: "dispute_msg",
            label: "Dispute Reason & Amount",
            value: `Customer filed dispute for ${disputeReason}. Amount: ${formatMoney(order.amountMinor, order.currency)}.`,
            source: `orders:${order.id}`,
            untrusted: 0,
          },
          {
            id: `F-ord-${targetDisputeId}-${order.id}`,
            disputeId: targetDisputeId,
            kind: "order",
            label: "Order Transaction",
            value: `Order ${order.id} placed for ${order.buyerName || "buyer"} totaling ${formatMoney(order.amountMinor, order.currency)}.`,
            source: `orders:${order.id}`,
            untrusted: 0,
          },
        ]);
      }
    } else {
      return NextResponse.json(
        { error: "Either 'scenario' (S1-S4) or 'orderId' must be provided." },
        { status: 400 }
      );
    }

    await logAudit({
      actor: "system",
      disputeId: targetDisputeId,
      action: "DISPUTE_SIMULATED",
      detail: { scenario: scenario || "CUSTOM", disputeId: targetDisputeId },
    });

    return NextResponse.json({
      success: true,
      disputeId: targetDisputeId,
      scenario: scenario || null,
      message: `Dispute ${targetDisputeId} initialized and ready in sandbox queue.`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during dispute simulation" },
      { status: 500 }
    );
  }
}
