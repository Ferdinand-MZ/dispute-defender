import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createSandboxOrder,
  getSandboxOrder,
  captureSandboxOrder,
  refundCapture,
} from "./orders";

describe("PayPal Orders v2 API Integration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("creates a checkout order with integer minor-unit amount formatting", async () => {
    let capturedBody: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
        };
      }

      if (url.includes("/v2/checkout/orders") && init?.method === "POST") {
        capturedBody = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            id: "5EA1234567890123A",
            status: "CREATED",
            intent: "CAPTURE",
            purchase_units: [
              {
                reference_id: "default",
                amount: { currency_code: "USD", value: "48.00" },
              },
            ],
            links: [
              {
                href: "https://www.sandbox.paypal.com/checkoutnow?token=5EA1234567890123A",
                rel: "approve",
                method: "GET",
              },
            ],
          }),
        };
      }

      throw new Error(`Unhandled mock endpoint: ${url}`);
    });

    const order = await createSandboxOrder({
      items: [
        {
          name: "Wireless Earbuds",
          sku: "WNC-EAR-01",
          quantity: 1,
          amountMinor: 4800, // $48.00 in minor units
          currency: "USD",
        },
      ],
      customId: "O-1001",
    });

    expect(order.id).toBe("5EA1234567890123A");
    expect(order.status).toBe("CREATED");
    expect(capturedBody.purchase_units[0].amount.value).toBe("48.00");
    expect(capturedBody.purchase_units[0].items[0].unit_amount.value).toBe("48.00");
    expect(capturedBody.intent).toBe("CAPTURE");
  });

  it("retrieves order details via GET /v2/checkout/orders/{id}", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
        };
      }

      if (url.includes("/v2/checkout/orders/5EA1234567890123A")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            id: "5EA1234567890123A",
            status: "COMPLETED",
            intent: "CAPTURE",
            purchase_units: [
              {
                amount: { currency_code: "USD", value: "48.00" },
                payments: {
                  captures: [
                    {
                      id: "CAP-1001-A1",
                      status: "COMPLETED",
                      amount: { currency_code: "USD", value: "48.00" },
                    },
                  ],
                },
              },
            ],
          }),
        };
      }

      throw new Error(`Unhandled mock endpoint: ${url}`);
    });

    const order = await getSandboxOrder("5EA1234567890123A");
    expect(order.id).toBe("5EA1234567890123A");
    expect(order.status).toBe("COMPLETED");
    expect(order.purchase_units?.[0].payments?.captures?.[0].id).toBe("CAP-1001-A1");
  });

  it("throws error when refundCapture is called without approvedBy (human-in-the-loop)", async () => {
    await expect(
      refundCapture({
        captureId: "CAP-1001-A1",
        approvedBy: "",
      })
    ).rejects.toThrow("SECURITY_VIOLATION");
  });

  it("successfully refunds capture with minor-unit conversion", async () => {
    let capturedBody: any = null;
    let capturedHeaders: any = null;

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
        };
      }

      if (url.includes("/v2/payments/captures/CAP-1001-A1/refund") && init?.method === "POST") {
        capturedBody = JSON.parse(init.body as string);
        capturedHeaders = new Headers(init.headers);
        return {
          ok: true,
          status: 201,
          headers: new Headers(),
          json: async () => ({
            id: "REF-999-XYZ",
            status: "COMPLETED",
            amount: { value: "48.00", currency_code: "USD" },
            note_to_payer: "Dispute resolution refund",
          }),
        };
      }

      throw new Error(`Unhandled mock endpoint: ${url}`);
    });

    const refund = await refundCapture({
      captureId: "CAP-1001-A1",
      approvedBy: "Merchant Admin",
      amountMinor: 4800,
      currency: "USD",
      noteToPayer: "Dispute resolution refund",
      requestId: "req-ref-1",
    });

    expect(refund.id).toBe("REF-999-XYZ");
    expect(refund.status).toBe("COMPLETED");
    expect(capturedBody.amount.value).toBe("48.00");
    expect(capturedBody.amount.currency_code).toBe("USD");
    expect(capturedBody.note_to_payer).toBe("Dispute resolution refund");
    expect(capturedHeaders?.get("PayPal-Request-Id")).toBe("req-ref-1");
  });
});
