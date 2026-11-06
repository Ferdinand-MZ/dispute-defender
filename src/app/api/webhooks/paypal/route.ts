import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { verifyWebhookSignature } from "@/lib/paypal/webhook";
import { logAudit } from "@/lib/audit";
import { env } from "@/lib/env";
import { getSandboxDispute } from "@/lib/paypal/disputes";
import { syncPayPalDisputeToDb } from "@/lib/paypal/sync";
import { processDisputeInBackground } from "@/lib/agent/pipeline";
import { PayPalDispute } from "@/lib/paypal/types";
import { eq } from "drizzle-orm";
import { z } from "zod";

const WebhookEventSchema = z.object({
  id: z.string().min(1),
  event_type: z.string().min(1),
});

/** Skipping verification is a local-only escape hatch for PayPal's simulator, never honored in production. */
function canSkipVerification(): boolean {
  return env.PAYPAL_WEBHOOK_SKIP_VERIFY && env.NODE_ENV !== "production";
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    let bodyJson: Record<string, unknown>;

    try {
      bodyJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    const parsedEvent = WebhookEventSchema.safeParse(bodyJson);
    if (!parsedEvent.success) {
      return NextResponse.json({ error: "Missing required webhook fields" }, { status: 400 });
    }
    const { id: eventId, event_type: eventType } = parsedEvent.data;

    if (!canSkipVerification()) {
      const authAlgo = req.headers.get("paypal-auth-algo") || "";
      const certUrl = req.headers.get("paypal-cert-url") || "";
      const transmissionId = req.headers.get("paypal-transmission-id") || "";
      const transmissionSig = req.headers.get("paypal-transmission-sig") || "";
      const transmissionTime = req.headers.get("paypal-transmission-time") || "";

      if (!env.PAYPAL_WEBHOOK_ID) {
        console.error("[WEBHOOK_REJECTED] PAYPAL_WEBHOOK_ID is not configured.");
        return NextResponse.json({ error: "Webhook receiver is not configured" }, { status: 503 });
      }

      if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
        return NextResponse.json({ error: "Missing PayPal signature headers" }, { status: 403 });
      }

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
    }

    // Deduplicate on event_id via webhook_events (initially processedAt: null)
    try {
      await db.insert(webhookEvents).values({
        eventId,
        eventType,
        payloadJson: rawBody,
        receivedAt: new Date().toISOString(),
        processedAt: null,
      });
    } catch (dbErr: unknown) {
      // If error is unique constraint violation, duplicate event received -> return 200 fast
      const errCode = (dbErr as { code?: string }).code;
      const errMsg = String((dbErr as Error).message || "");
      if (
        errCode === "23505" ||
        errMsg.includes("UNIQUE constraint failed") ||
        errMsg.includes("duplicate key value violates unique constraint")
      ) {
        return NextResponse.json({ message: "Duplicate event acknowledged" }, { status: 200 });
      }
      throw dbErr;
    }

    // Process intake for dispute events
    if (eventType.startsWith("CUSTOMER.DISPUTE.")) {
      const resource = (bodyJson.resource || {}) as Record<string, unknown>;
      const disputeId = (resource.dispute_id || resource.id) as string | undefined;

      if (disputeId) {
        let disputeDetails: PayPalDispute;
        try {
          disputeDetails = await getSandboxDispute(disputeId);
        } catch (fetchErr) {
          if (
            resource.dispute_id &&
            resource.dispute_amount &&
            resource.reason &&
            resource.status
          ) {
            disputeDetails = resource as unknown as PayPalDispute;
          } else {
            throw fetchErr;
          }
        }
        const synced = await syncPayPalDisputeToDb(disputeDetails);
        // New cases go straight to the agent: facts, analysis, and a draft when worth fighting.
        if (synced.caseState === "NEW") {
          processDisputeInBackground(synced.paypalDisputeId, `webhook:${eventType}`);
        }
      }
    }

    // Mark event as processed after intake completes successfully
    await db
      .update(webhookEvents)
      .set({ processedAt: new Date().toISOString() })
      .where(eq(webhookEvents.eventId, eventId));

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
    return NextResponse.json({ error: "Internal error while processing webhook" }, { status: 500 });
  }
}
