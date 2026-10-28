import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { orders } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

const CreateDemoOrderSchema = z.object({
  name: z.string().min(1),
  sku: z.string().min(1),
  priceMinor: z.number().int().positive(),
  description: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CreateDemoOrderSchema.parse(body);

    const now = new Date().toISOString();
    const idSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderId = `O-DEMO-${idSuffix}`;
    const paypalOrderId = `5EA${Date.now().toString().slice(-12)}${idSuffix}`;
    const captureId = `CAP-${idSuffix}-SIM`;

    await db.insert(orders).values({
      id: orderId,
      paypalOrderId,
      captureId,
      buyerEmail: "demo.buyer@example.com",
      buyerName: "Demo Customer",
      shipToJson: JSON.stringify({
        recipient_name: "Demo Customer",
        line1: "123 Innovation Way",
        city: "San Jose",
        state: "CA",
        postal_code: "95131",
        country_code: "US",
      }),
      itemsJson: JSON.stringify([
        {
          name: parsed.name,
          sku: parsed.sku,
          quantity: "1",
          unit_amount: { currency_code: "USD", value: (parsed.priceMinor / 100).toFixed(2) },
        },
      ]),
      amountMinor: parsed.priceMinor,
      currency: "USD",
      status: "paid",
      createdAt: now,
      updatedAt: now,
    });

    await logAudit({
      actor: "human",
      action: "DEMO_ORDER_CREATED",
      detail: { orderId, paypalOrderId, amountMinor: parsed.priceMinor },
    });

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error("[DEMO_ORDER_ERROR]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
