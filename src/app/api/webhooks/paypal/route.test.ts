import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockEnv = vi.hoisted(() => ({
  NODE_ENV: "test" as "development" | "test" | "production",
  PAYPAL_WEBHOOK_ID: "WH-TEST",
  PAYPAL_WEBHOOK_SKIP_VERIFY: false,
}));
const seenEventIds = vi.hoisted(() => new Set<string>());
const verifyWebhookSignature = vi.hoisted(() => vi.fn());

const updatedEvents = vi.hoisted(() => new Map<string, any>());
const syncPayPalDisputeToDb = vi.hoisted(() => vi.fn());
const getSandboxDispute = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ env: mockEnv }));
vi.mock("@/lib/paypal/webhook", () => ({ verifyWebhookSignature }));
vi.mock("@/lib/audit", () => ({ logAudit: vi.fn() }));
vi.mock("@/lib/paypal/disputes", () => ({ getSandboxDispute }));
vi.mock("@/lib/paypal/sync", () => ({ syncPayPalDisputeToDb }));
vi.mock("@/lib/db", () => ({
  db: {
    insert: () => ({
      values: async (row: { eventId: string }) => {
        if (seenEventIds.has(row.eventId)) {
          throw new Error("UNIQUE constraint failed: webhook_events.event_id");
        }
        seenEventIds.add(row.eventId);
      },
    }),
    update: () => ({
      set: (updates: any) => ({
        where: async () => {
          updatedEvents.set("last", updates);
        },
      }),
    }),
  },
}));

import { POST } from "./route";

const signatureHeaders = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/v1/notifications/certs/CERT",
  "paypal-transmission-id": "TX-1",
  "paypal-transmission-sig": "SIG",
  "paypal-transmission-time": "2026-10-27T00:00:00Z",
};

function webhookRequest(eventId: string, headers: Record<string, string> = signatureHeaders) {
  return new NextRequest("http://localhost/api/webhooks/paypal", {
    method: "POST",
    headers,
    body: JSON.stringify({ id: eventId, event_type: "CUSTOMER.DISPUTE.CREATED", resource: {} }),
  });
}

describe("POST /api/webhooks/paypal", () => {
  beforeEach(() => {
    seenEventIds.clear();
    verifyWebhookSignature.mockReset();
    mockEnv.NODE_ENV = "test";
    mockEnv.PAYPAL_WEBHOOK_ID = "WH-TEST";
    mockEnv.PAYPAL_WEBHOOK_SKIP_VERIFY = false;
  });

  it("rejects events without signature headers", async () => {
    const res = await POST(webhookRequest("WH-EVT-1", {}));
    expect(res.status).toBe(403);
    expect(verifyWebhookSignature).not.toHaveBeenCalled();
  });

  it("rejects events with an invalid signature", async () => {
    verifyWebhookSignature.mockResolvedValue(false);
    const res = await POST(webhookRequest("WH-EVT-2"));
    expect(res.status).toBe(403);
  });

  it("refuses to process when the webhook id is not configured", async () => {
    mockEnv.PAYPAL_WEBHOOK_ID = "";
    const res = await POST(webhookRequest("WH-EVT-3"));
    expect(res.status).toBe(503);
  });

  it("accepts a verified event once and acknowledges duplicates", async () => {
    verifyWebhookSignature.mockResolvedValue(true);
    const first = await POST(webhookRequest("WH-EVT-4"));
    const second = await POST(webhookRequest("WH-EVT-4"));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(await second.json()).toMatchObject({ message: "Duplicate event acknowledged" });
  });

  it("ignores the skip flag in production", async () => {
    mockEnv.NODE_ENV = "production";
    mockEnv.PAYPAL_WEBHOOK_SKIP_VERIFY = true;
    const res = await POST(webhookRequest("WH-EVT-5", {}));
    expect(res.status).toBe(403);
  });

  it("allows unsigned simulator events locally when the skip flag is set", async () => {
    mockEnv.PAYPAL_WEBHOOK_SKIP_VERIFY = true;
    const res = await POST(webhookRequest("WH-EVT-6", {}));
    expect(res.status).toBe(200);
    expect(verifyWebhookSignature).not.toHaveBeenCalled();
  });

  it("triggers dispute intake and updates processedAt on CUSTOMER.DISPUTE.* event", async () => {
    verifyWebhookSignature.mockResolvedValue(true);
    getSandboxDispute.mockResolvedValue({
      dispute_id: "PP-D-INTAKE-1",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      status: "WAITING_FOR_SELLER_RESPONSE",
      dispute_amount: { currency_code: "USD", value: "48.00" },
    });
    syncPayPalDisputeToDb.mockResolvedValue({});

    const req = new NextRequest("http://localhost/api/webhooks/paypal", {
      method: "POST",
      headers: signatureHeaders,
      body: JSON.stringify({
        id: "WH-EVT-7",
        event_type: "CUSTOMER.DISPUTE.CREATED",
        resource: { dispute_id: "PP-D-INTAKE-1" },
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(getSandboxDispute).toHaveBeenCalledWith("PP-D-INTAKE-1");
    expect(syncPayPalDisputeToDb).toHaveBeenCalled();
    expect(updatedEvents.get("last")).toHaveProperty("processedAt");
  });
});
