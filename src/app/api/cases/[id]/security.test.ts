import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { computeDraftApprovalHash } from "@/lib/agent/approval";

// In-memory mock stores
const mockDisputeStore = vi.hoisted(() => new Map<string, any>());
const mockDraftStore = vi.hoisted(() => new Map<string, any>());
const mockOrderStore = vi.hoisted(() => new Map<string, any>());
const mockActionsList = vi.hoisted(() => [] as any[]);
const mockAuditLogList = vi.hoisted(() => [] as any[]);

// Mock PayPal API functions
const mockProvideEvidence = vi.hoisted(() => vi.fn());
const mockAcceptClaim = vi.hoisted(() => vi.fn());
const mockRefundCapture = vi.hoisted(() => vi.fn());
const mockAdjudicate = vi.hoisted(() => vi.fn());

// Mutable env mock for testing configuration modes
const mockEnvState = vi.hoisted(() => ({
  PAYPAL_CLIENT_ID: "mock_client_id",
  PAYPAL_CLIENT_SECRET: "mock_client_secret",
  PAYPAL_ENV: "sandbox",
  DEMO_MODE: false,
  APP_PASSWORD: "secure-merchant-secret",
  NODE_ENV: "test",
}));

vi.mock("@/lib/env", () => ({
  env: mockEnvState,
}));

vi.mock("@/lib/paypal/disputes", () => ({
  provideDisputeEvidence: mockProvideEvidence,
  acceptSandboxDisputeClaim: mockAcceptClaim,
  adjudicateSandboxDispute: mockAdjudicate,
}));

vi.mock("@/lib/paypal/orders", () => ({
  refundCapture: mockRefundCapture,
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(async (entry) => {
    mockAuditLogList.push(entry);
  }),
}));

function getTableNameFromTable(table: any): string {
  return table?.[Symbol.for("drizzle:Name")] || table?.name || "";
}

vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: (table: any) => ({
        where: (_condition: any) => {
          const resolveData = () => {
            const tblName = getTableNameFromTable(table);
            const dispute = mockDisputeStore.get("PP-D-SEC-01");
            const order = mockOrderStore.get("O-SEC-01");
            const draft = mockDraftStore.get("PP-D-SEC-01");

            if (tblName === "drafts") {
              return draft ? [draft] : [];
            }
            if (tblName === "orders") {
              return order ? [order] : [];
            }
            if (tblName === "actions") {
              const condStr = JSON.stringify(_condition, (k, v) => (k === "table" ? "" : v)) || "";
              if (condStr.includes('"provide_evidence"')) {
                return mockActionsList.filter((a) => a.type === "provide_evidence");
              }
              if (condStr.includes('"approve"')) {
                return mockActionsList.filter((a) => a.type === "approve");
              }
              if (condStr.includes('"refund"')) {
                return mockActionsList.filter((a) => a.type === "refund");
              }
              if (condStr.includes('"accept_claim"')) {
                return mockActionsList.filter((a) => a.type === "accept_claim");
              }
              return [...mockActionsList];
            }
            if (tblName === "facts") {
              return [];
            }
            return dispute ? [dispute] : [];
          };

          return {
            orderBy: () => resolveData(),
            all: () => resolveData(),
            then: (resolve: any) => resolve(resolveData()),
          };
        },
      }),
    }),
    transaction: async (cb: any) => {
      const tx = {
        delete: () => ({
          where: async () => {},
        }),
        update: () => ({
          set: (updates: any) => ({
            where: async () => {
              const current = mockDisputeStore.get("PP-D-SEC-01") || {};
              mockDisputeStore.set("PP-D-SEC-01", { ...current, ...updates });
            },
          }),
        }),
        insert: () => ({
          values: async (row: any) => {
            mockActionsList.push(row);
          },
        }),
      };
      return await cb(tx);
    },
    update: () => ({
      set: (updates: any) => ({
        where: () => {
          const current = mockDisputeStore.get("PP-D-SEC-01") || {};
          mockDisputeStore.set("PP-D-SEC-01", { ...current, ...updates });
        },
      }),
    }),
    insert: () => ({
      values: (row: any) => {
        mockActionsList.push(row);
      },
    }),
  },
}));

import { POST as approveHandler } from "./approve/route";
import { POST as submitHandler } from "./submit/route";
import { POST as acceptHandler } from "./accept/route";
import { POST as refundHandler } from "./refund/route";
import { POST as adjudicateHandler } from "@/app/api/admin/simulate/adjudicate/route";
import { POST as disputeSimulateHandler } from "@/app/api/admin/simulate/dispute/route";

const VALID_AUTH_HEADERS = {
  "content-type": "application/json",
  "x-merchant-auth": "secure-merchant-secret",
};

describe("DisputeDefender Security & Financial Hardening Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDisputeStore.clear();
    mockDraftStore.clear();
    mockOrderStore.clear();
    mockActionsList.length = 0;
    mockAuditLogList.length = 0;

    // Reset default env state
    mockEnvState.PAYPAL_CLIENT_ID = "mock_client_id";
    mockEnvState.PAYPAL_CLIENT_SECRET = "mock_client_secret";
    mockEnvState.PAYPAL_ENV = "sandbox";
    mockEnvState.DEMO_MODE = false;
    mockEnvState.APP_PASSWORD = "secure-merchant-secret";
    mockEnvState.NODE_ENV = "test";

    // Setup standard mock responses
    mockProvideEvidence.mockResolvedValue({
      success: true,
      disputeId: "PP-D-SEC-01",
      action: "provide-evidence",
    });
    mockAcceptClaim.mockResolvedValue({
      success: true,
      disputeId: "PP-D-SEC-01",
      action: "accept-claim",
    });
    mockRefundCapture.mockResolvedValue({
      id: "REF-SEC-999",
      status: "COMPLETED",
    });
    mockAdjudicate.mockResolvedValue({
      success: true,
      disputeId: "PP-D-SEC-01",
      outcome: "SELLER_FAVOR",
    });

    // Seed valid dispute
    mockDisputeStore.set("PP-D-SEC-01", {
      paypalDisputeId: "PP-D-SEC-01",
      orderId: "O-SEC-01",
      captureId: "CAP-SEC-01",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      caseState: "DRAFTED",
      amountMinor: 5500,
      currency: "USD",
      paypalStatus: "WAITING_FOR_SELLER_RESPONSE",
    });

    mockOrderStore.set("O-SEC-01", {
      id: "O-SEC-01",
      captureId: "CAP-SEC-01",
      carrier: "FEDEX",
      trackingNumber: "FEDEX12345678",
      amountMinor: 5500,
      currency: "USD",
    });

    mockDraftStore.set("PP-D-SEC-01", {
      id: "DRF-SEC-01",
      disputeId: "PP-D-SEC-01",
      version: 1,
      evidenceType: "PROOF_OF_FULFILLMENT",
      bodyJson: JSON.stringify({ sections: [{ title: "Fulfillment", text: "Dispatched via FedEx" }] }),
      notesText: "Verified tracking FEDEX12345678.",
      groundingStatus: "pass",
      status: "draft",
    });
  });

  // 1. Unauthenticated approval requests
  it("Scenario 1: Rejects unauthenticated approval requests with 401", async () => {
    const unauthReq = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/approve", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ approvedBy: "Attacker" }),
    });

    const res = await approveHandler(unauthReq, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toMatch(/Authentication required/i);
  });

  // 2. Unauthorized cross-merchant access
  it("Scenario 2: Blocks unauthorized cross-merchant access with 403 Forbidden", async () => {
    const crossMerchantReq = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/approve", {
      method: "POST",
      headers: {
        ...VALID_AUTH_HEADERS,
        "x-merchant-id": "merch_foreign_attacker",
      },
      body: JSON.stringify({ approvedBy: "Cross Merchant Attacker" }),
    });

    const res = await approveHandler(crossMerchantReq, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Access denied.*Dispute does not belong to the authenticated merchant/i);
  });

  // 3. Direct evidence submission without approval
  it("Scenario 3: Blocks direct evidence submission without prior human approval", async () => {
    // 3a. Case state is DRAFTED (not APPROVED)
    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "DRAFTED",
    });

    const reqUnapprovedState = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/submit", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const resUnapprovedState = await submitHandler(reqUnapprovedState, { params: { id: "PP-D-SEC-01" } });
    expect(resUnapprovedState.status).toBe(400);
    const dataState = await resUnapprovedState.json();
    expect(dataState.error).toMatch(/Direct evidence submission rejected: Case must be in 'APPROVED' state/i);

    // 3b. Case state is APPROVED but no database approval record exists
    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "APPROVED",
    });
    mockActionsList.length = 0; // No approval record

    const reqNoRecord = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/submit", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const resNoRecord = await submitHandler(reqNoRecord, { params: { id: "PP-D-SEC-01" } });
    expect(resNoRecord.status).toBe(400);
    const dataRecord = await resNoRecord.json();
    expect(dataRecord.error).toMatch(/No valid human approval record exists/i);
  });

  // 4. Modified draft after approval
  it("Scenario 4: Rejects submission with 409 Conflict if draft was modified after approval", async () => {
    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "APPROVED",
    });

    const originalDraft = mockDraftStore.get("PP-D-SEC-01");
    const order = mockOrderStore.get("O-SEC-01");

    // Fingerprint created at time of approval
    const originalHash = computeDraftApprovalHash({
      draftId: originalDraft.id,
      disputeId: originalDraft.disputeId,
      evidenceType: originalDraft.evidenceType,
      bodyJson: originalDraft.bodyJson,
      notesText: originalDraft.notesText,
      carrier: order.carrier,
      trackingNumber: order.trackingNumber,
    });

    mockActionsList.push({
      id: "ACT-APPR-SEC",
      disputeId: "PP-D-SEC-01",
      type: "approve",
      status: "APPROVED",
      payloadJson: JSON.stringify({
        draftId: originalDraft.id,
        disputeId: "PP-D-SEC-01",
        approvalHash: originalHash,
        approvedBy: "Sarah Jenkins",
      }),
      approvedBy: "Sarah Jenkins",
      createdAt: new Date().toISOString(),
    });

    // Post-approval tampering: draft modified without re-approval!
    mockDraftStore.set("PP-D-SEC-01", {
      ...originalDraft,
      notesText: "Tampered content: customer accepted delivery verbally.",
    });

    const req = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/submit", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const res = await submitHandler(req, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/Draft content or evidence was modified after approval\. Re-approval required/i);
    expect(mockProvideEvidence).not.toHaveBeenCalled();
  });

  // 5. Reused approval for another dispute
  it("Scenario 5: Blocks submission with 403 Forbidden if approval record belongs to another dispute", async () => {
    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "APPROVED",
    });

    const draft = mockDraftStore.get("PP-D-SEC-01");

    // Approval record hijacked from a different dispute
    mockActionsList.push({
      id: "ACT-APPR-OTHER",
      disputeId: "PP-D-SEC-01",
      type: "approve",
      status: "APPROVED",
      payloadJson: JSON.stringify({
        draftId: draft.id,
        disputeId: "PP-D-FOREIGN-999", // Belongs to different dispute
        approvalHash: "some_hash",
        approvedBy: "Sarah Jenkins",
      }),
      approvedBy: "Sarah Jenkins",
      createdAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/submit", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const res = await submitHandler(req, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Approval record cannot be reused for another dispute/i);
  });

  // 6. Duplicate submission attempts
  it("Scenario 6: Prevents duplicate submissions with 409 Conflict", async () => {
    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "APPROVED",
    });

    // Existing SUBMITTED action in database
    mockActionsList.push({
      id: "ACT-SUBMIT-EXISTING",
      disputeId: "PP-D-SEC-01",
      type: "provide_evidence",
      status: "SUBMITTED",
      payloadJson: JSON.stringify({ action: "evidence_provided" }),
      approvedBy: "Sarah Jenkins",
      createdAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/submit", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const res = await submitHandler(req, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/Duplicate submission attempt: Evidence has already been submitted/i);
    expect(mockProvideEvidence).not.toHaveBeenCalled();
  });

  // 7. Missing PayPal credentials in sandbox mode
  it("Scenario 7: Returns 503 error when PayPal credentials are missing in sandbox mode (never silently falls back)", async () => {
    mockEnvState.DEMO_MODE = false; // Sandbox mode active
    mockEnvState.PAYPAL_CLIENT_ID = ""; // Missing credentials
    mockEnvState.PAYPAL_CLIENT_SECRET = "";

    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "DRAFTED",
    });

    const req = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/accept", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const res = await acceptHandler(req, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.error).toMatch(/Sandbox mode requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET/i);
    expect(mockAcceptClaim).not.toHaveBeenCalled();
  });

  // 8. Demo mode isolation from PayPal APIs
  it("Scenario 8: Demo mode performs simulated action without invoking PayPal APIs and labels simulation", async () => {
    mockEnvState.DEMO_MODE = true; // Explicit demo mode active

    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "DRAFTED",
    });

    const req = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/accept", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const res = await acceptHandler(req, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.simulated).toBe(true);
    expect(data.mode).toBe("demo");
    expect(data.paypalResponse.notice).toMatch(/No live PayPal financial endpoints were contacted/i);

    // CRITICAL: Ensure real PayPal API was NOT invoked
    expect(mockAcceptClaim).not.toHaveBeenCalled();
    expect(mockProvideEvidence).not.toHaveBeenCalled();
    expect(mockRefundCapture).not.toHaveBeenCalled();
  });

  // 9. Duplicate refund attempts
  it("Scenario 9: Prevents duplicate refund attempts with 409 Conflict", async () => {
    mockDisputeStore.set("PP-D-SEC-01", {
      ...mockDisputeStore.get("PP-D-SEC-01"),
      caseState: "REFUNDED",
    });

    // Existing refund action in database
    mockActionsList.push({
      id: "ACT-REFUND-EXISTING",
      disputeId: "PP-D-SEC-01",
      type: "refund",
      status: "REFUNDED",
      payloadJson: JSON.stringify({ refundId: "REF-PREV-01" }),
      approvedBy: "Sarah Jenkins",
      createdAt: new Date().toISOString(),
    });

    const req = new NextRequest("http://localhost:3000/api/cases/PP-D-SEC-01/refund", {
      method: "POST",
      headers: VALID_AUTH_HEADERS,
      body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
    });

    const res = await refundHandler(req, { params: { id: "PP-D-SEC-01" } });
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.error).toMatch(/Duplicate refund attempt: This dispute has already been refunded/i);
    expect(mockRefundCapture).not.toHaveBeenCalled();
  });

  // 10. Unauthorized admin requests
  it("Scenario 10: Blocks unauthorized admin simulation requests with 401 or 403", async () => {
    // 10a. Unauthenticated admin adjudication request
    const unauthReq = new NextRequest("http://localhost:3000/api/admin/simulate/adjudicate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        disputeId: "PP-D-SEC-01",
        outcome: "SELLER_FAVOR",
        approvedBy: "Admin",
      }),
    });

    const unauthRes = await adjudicateHandler(unauthReq);
    expect(unauthRes.status).toBe(401);
    const unauthData = await unauthRes.json();
    expect(unauthData.error).toMatch(/Authentication required/i);

    // 10b. Unauthenticated admin dispute simulation request
    const unauthSimReq = new NextRequest("http://localhost:3000/api/admin/simulate/dispute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ scenario: "S1" }),
    });

    const unauthSimRes = await disputeSimulateHandler(unauthSimReq);
    expect(unauthSimRes.status).toBe(401);

    // 10c. Cross-Site CSRF Attack attempt
    const csrfReq = new NextRequest("http://localhost:3000/api/admin/simulate/adjudicate", {
      method: "POST",
      headers: {
        ...VALID_AUTH_HEADERS,
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({
        disputeId: "PP-D-SEC-01",
        outcome: "SELLER_FAVOR",
      }),
    });

    const csrfRes = await adjudicateHandler(csrfReq);
    expect(csrfRes.status).toBe(403);
    const csrfData = await csrfRes.json();
    expect(csrfData.error).toMatch(/CSRF protection triggered/i);
  });
});
