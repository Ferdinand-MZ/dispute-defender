import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  payPalRequest,
  PayPalApiError,
  clearPayPalTokenCache,
} from "./client";

describe("PayPal Client Foundation", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    clearPayPalTokenCache();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    clearPayPalTokenCache();
  });

  it("extracts paypal-debug-id and normalizes errors on API failure", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "paypal-debug-id": "dbg_oauth_123" }),
          json: async () => ({ access_token: "mock_token_abc", expires_in: 3600 }),
        };
      }

      if (url.includes("/v1/customer/disputes/NON_EXISTENT")) {
        return {
          ok: false,
          status: 404,
          headers: new Headers({ "paypal-debug-id": "dbg_disp_999" }),
          json: async () => ({
            name: "RESOURCE_NOT_FOUND",
            message: "The specified resource does not exist.",
            debug_id: "dbg_disp_999",
          }),
        };
      }

      throw new Error(`Unhandled mock endpoint: ${url}`);
    });

    await expect(payPalRequest("/v1/customer/disputes/NON_EXISTENT")).rejects.toSatisfy(
      (err: unknown) => {
        const apiErr = err as PayPalApiError;
        expect(apiErr).toBeInstanceOf(PayPalApiError);
        expect(apiErr.status).toBe(404);
        expect(apiErr.debugId).toBe("dbg_disp_999");
        expect(apiErr.message).toContain("RESOURCE_NOT_FOUND");
        return true;
      }
    );
  });

  it("retries on 429 Rate Limit error with exponential backoff", async () => {
    let callCount = 0;

    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
        };
      }

      if (callCount === 2) {
        // First request call -> return 429
        return {
          ok: false,
          status: 429,
          headers: new Headers({ "paypal-debug-id": "dbg_rate_limit" }),
          json: async () => ({ message: "Rate limit exceeded" }),
        };
      }

      // Second request call (retry) -> succeed
      return {
        ok: true,
        status: 200,
        headers: new Headers({ "paypal-debug-id": "dbg_success" }),
        json: async () => ({ status: "OK", items: [] }),
      };
    });

    const res = await payPalRequest<{ status: string }>("/v1/customer/disputes");
    expect(res.data.status).toBe("OK");
    expect(res.debugId).toBe("dbg_success");
    expect(callCount).toBe(3); // 1 token + 1 failed + 1 retry
  });

  it("injects PayPal-Request-Id header when supplied", async () => {
    let capturedHeaders: Record<string, string> = {};

    global.fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
        };
      }

      capturedHeaders = init?.headers as Record<string, string>;
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({ id: "ORDER-123" }),
      };
    });

    await payPalRequest("/v2/checkout/orders", {
      method: "POST",
      requestId: "IDEMPOTENT_REQ_777",
      body: JSON.stringify({}),
    });

    expect(capturedHeaders["PayPal-Request-Id"]).toBe("IDEMPOTENT_REQ_777");
  });
});
