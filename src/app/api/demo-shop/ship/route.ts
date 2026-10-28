import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { addTrackingBatch } from "@/lib/paypal/tracking";
import { z } from "zod";

const ShipOrderSchema = z.object({
  orderId: z.string().min(1),
  carrier: z.string().default("FEDEX"),
  trackingNumber: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { orderId, carrier, trackingNumber: customTracking } = ShipOrderSchema.parse(body);

    const existing = (await db.select().from(orders).where(eq(orders.id, orderId)))[0];
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const trackingNumber =
      customTracking ||
      existing.trackingNumber ||
      `94001000${Math.floor(10000000 + Math.random() * 90000000)}`;

    const now = new Date().toISOString();

    await db
      .update(orders)
      .set({
        carrier,
        trackingNumber,
        status: "shipped",
        shippedAt: now,
        updatedAt: now,
      })
      .where(eq(orders.id, orderId));

    let trackingSubmitted = false;
    let paypalError: string | null = null;

    // Send tracking to PayPal POST /v1/shipping/trackers-batch if credentials and captureId exist
    if (existing.captureId && env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
      try {
        await addTrackingBatch({
          trackers: [
            {
              transaction_id: existing.captureId,
              tracking_number: trackingNumber,
              status: "SHIPPED",
              carrier,
            },
          ],
        });
        trackingSubmitted = true;
      } catch (apiErr) {
        paypalError = (apiErr as Error).message;
        console.warn("[PAYPAL_TRACKING_SYNC_WARNING]", paypalError);
      }
    }

    await logAudit({
      actor: "human",
      action: "ORDER_MARKED_SHIPPED",
      detail: {
        orderId,
        carrier,
        trackingNumber,
        trackingSubmitted,
        paypalError,
      },
    });

    return NextResponse.json({
      success: true,
      orderId,
      carrier,
      trackingNumber,
      trackingSubmitted,
    });
  } catch (err) {
    console.error("[SHIP_ORDER_ERROR]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
