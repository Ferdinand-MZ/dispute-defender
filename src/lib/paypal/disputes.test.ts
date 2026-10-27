import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  listSandboxDisputes,
  getSandboxDispute,
  provideDisputeEvidence,
  adjudicateSandboxDispute,
} from "./disputes";

describe("PayPal Customer Disputes v1 API Integration", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("lists disputes and parses items correctly", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
        };
      }

      if (url.includes("/v1/customer/disputes")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            items: [
              {
                dispute_id: "PP-D-1001",
                reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
                status: "WAITING_FOR_SELLER_RESPONSE",
                dispute_amount: { currency_code: "USD", value: "48.00" },
              },
            ],
            links: [],
          }),
        };
      }

      throw new Error(`Unhandled mock endpoint: ${url}`);
    });

    const result = await listSandboxDisputes({ pageSize: 5 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].dispute_id).toBe("PP-D-1001");
    expect(result.items[0].status).toBe("WAITING_FOR_SELLER_RESPONSE");
  });

  it("throws error if provideDisputeEvidence is called without approvedBy (human approval gatekeeper)", async () => {
    await expect(
      provideDisputeEvidence({
        disputeId: "PP-D-1001",
        evidencePayload: {
          evidences: [{ evidence_type: "PROOF_OF_FULFILLMENT" }],
        },
        approvedBy: "", // Missing approval
      })
    ).rejects.toThrow("SECURITY_VIOLATION");
  });

  it("blocks evidence submission if dispute is not in WAITING_FOR_SELLER_RESPONSE status", async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes("/oauth2/token")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({ access_token: "mock_token", expires_in: 3600 }),
        };
      }

      if (url.includes("/v1/customer/disputes/PP-D-RESOLVED")) {
        return {
          ok: true,
          status: 200,
          headers: new Headers(),
          json: async () => ({
            dispute_id: "PP-D-RESOLVED",
            reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
            status: "RESOLVED", // Already resolved!
            dispute_amount: { currency_code: "USD", value: "48.00" },
          }),
        };
      }

      throw new Error(`Unhandled endpoint: ${url}`);
    });

    await expect(
      provideDisputeEvidence({
        disputeId: "PP-D-RESOLVED",
        evidencePayload: {
          evidences: [{ evidence_type: "PROOF_OF_FULFILLMENT" }],
        },
        approvedBy: "Merchant Admin",
      })
    ).rejects.toThrow("Cannot provide evidence");
  });
  it("sends adjudication_outcome when settling a sandbox dispute", async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes("/oauth2/token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "T", expires_in: 3600 }) };
      }
      calls.push({ url, init });
      return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
    });

    await adjudicateSandboxDispute("PP-D-ADJ", "SELLER_FAVOR", "Merchant Admin");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toContain("/v1/customer/disputes/PP-D-ADJ/adjudicate");
    expect(JSON.parse(String(calls[0].init.body))).toEqual({ adjudication_outcome: "SELLER_FAVOR" });
  });

  it("refuses to adjudicate without explicit authorization", async () => {
    await expect(adjudicateSandboxDispute("PP-D-ADJ", "BUYER_FAVOR")).rejects.toThrow("SECURITY_VIOLATION");
  });
  it("submits evidence as multipart with a JSON input part", async () => {
    const posts: RequestInit[] = [];
    global.fetch = vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
      if (url.includes("/oauth2/token")) {
        return { ok: true, status: 200, json: async () => ({ access_token: "T", expires_in: 3600 }) };
      }
      if (init?.method === "POST") {
        posts.push(init);
        return { ok: true, status: 200, headers: new Headers(), json: async () => ({}) };
      }
      return {
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => ({
          dispute_id: "PP-D-EV",
          reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
          status: "WAITING_FOR_SELLER_RESPONSE",
          dispute_amount: { currency_code: "USD", value: "48.00" },
        }),
      };
    });

    const evidencePayload = {
      evidences: [
        {
          evidence_type: "PROOF_OF_FULFILLMENT" as const,
          evidence_info: { tracking_info: [{ carrier_name: "FEDEX", tracking_number: "122533485" }] },
        },
      ],
    };
    await provideDisputeEvidence({ disputeId: "PP-D-EV", evidencePayload, approvedBy: "Merchant Admin" });

    expect(posts).toHaveLength(1);
    const body = posts[0].body;
    expect(body).toBeInstanceOf(FormData);
    const input = (body as FormData).get("input");
    expect(input).toBeInstanceOf(Blob);
    expect(JSON.parse(await (input as Blob).text())).toEqual(evidencePayload);
    expect((body as FormData).get("evidence-file")).toBeNull();
  });
});
