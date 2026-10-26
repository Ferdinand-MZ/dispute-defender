import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookEvents, auditLog } from "@/lib/db/schema";
import { verifyWebhookSignature } from "@/lib/paypal/webhook";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let bodyJson: Record<string, unknown>;

    try {
      bodyJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const eventId = String(bodyJson.id || "");
    const eventType = String(bodyJson.event_type || "");

    if (!eventId || !eventType) {
      return NextResponse.json({ error: "Missing required webhook fields" }, { status: 400 });
    }

    // Extract PayPal signature headers
    const authAlgo = req.headers.get("paypal-auth-algo") || "";
    const certUrl = req.headers.get("paypal-cert-url") || "";
    const transmissionId = req.headers.get("paypal-transmission-id") || "";
    const transmissionSig = req.headers.get("paypal-transmission-sig") || "";
    const transmissionTime = req.headers.get("paypal-transmission-time") || "";

    // Signature verification if credentials are configured
    if (env.PAYPAL_WEBHOOK_ID && authAlgo && certUrl && transmissionId && transmissionSig) {
      const isValid = await verifyWebhookSignature({
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
        webhookId: env.PAYPAL_WEBHOOK_ID,
        webhookEvent: bodyJson,
      });

      if (!isValid) {
        console.warn(`[WEBHOOK_REJECTED] Signature verification failed for event ${eventId}`);
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 403 });
      }
    } else {
      console.log(`[WEBHOOK_DEV] Processing webhook event ${eventId} in development/demo mode.`);
    }

    // Deduplicate on event_id via webhook_events
    try {
      await db.insert(webhookEvents).values({
        eventId,
        eventType,
        payloadJson: rawBody,
        receivedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      });
    } catch (dbErr: unknown) {
      // If error is unique constraint violation, duplicate event received -> return 200 fast
      const errMsg = String((dbErr as Error).message || "");
      if (errMsg.includes("UNIQUE") || errMsg.includes("constraint")) {
        console.log(`[WEBHOOK_DEDUPE] Event ${eventId} already received. Skipping duplicate.`);
        return NextResponse.json({ message: "Duplicate event acknowledged" }, { status: 200 });
      }
      throw dbErr;
    }

    // Log to audit trail
    await logAudit({
      actor: "paypal",
      action: `WEBHOOK_RECEIVED:${eventType}`,
      detail: { eventId, eventType },
    });

    return NextResponse.json(
      { status: "SUCCESS", message: `Event ${eventId} acknowledged` },
      { status: 200 }
    );
  } catch (err) {
    console.error("[WEBHOOK_ERROR] Unexpected error processing webhook:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
