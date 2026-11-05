import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { computeDraftApprovalHash } from "@/lib/agent/approval";

// In-memory mock store
const mockDisputeStore = vi.hoisted(() => new Map<string, any>());
const mockDraftStore = vi.hoisted(() => new Map<string, any>());
const mockOrderStore = vi.hoisted(() => new Map<string, any>());
const mockActionsList = vi.hoisted(() => [] as any[]);
const mockAuditLogList = vi.hoisted(() => [] as any[]);

const mockProvideEvidence = vi.hoisted(() => vi.fn());
const mockAcceptClaim = vi.hoisted(() => vi.fn());
const mockRefundCapture = vi.hoisted(() => vi.fn());
const mockAdjudicate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({
  env: {
    PAYPAL_CLIENT_ID: "mock_client_id",
    PAYPAL_CLIENT_SECRET: "mock_client_secret",
    PAYPAL_ENV: "sandbox",
    DEMO_MODE: false,
    APP_PASSWORD: "test-merchant-secret",
    NODE_ENV: "test",
  },
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

const mockProcessDispute = vi.hoisted(() =>
  vi.fn(async (disputeId: string) => ({
    disputeId,
    skipped: false,
    factCount: 6,
    analysis: { recommendation: "FIGHT" },
    draft: { groundingStatus: "pass" },
  }))
);

// The agent pipeline has its own tests against a real database; here it only has to be called.
vi.mock("@/lib/agent/pipeline", () => ({ processDispute: mockProcessDispute }));

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
            const dispute = mockDisputeStore.get("PP-D-1001");
            const order = mockOrderStore.get("O-1001");
            const draft = mockDraftStore.get("PP-D-1001");

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
    transaction: (cb: any) => {
      const tx = {
        delete: () => ({
          where: () => ({
            run: () => {},
          }),
        }),
        update: () => ({
          set: (updates: any) => ({
            where: () => ({
              run: () => {
                const current = mockDisputeStore.get("PP-D-1001") || {};
                mockDisputeStore.set("PP-D-1001", { ...current, ...updates });
              },
            }),
          }),
        }),
        insert: () => ({
          values: (row: any) => ({
            run: () => {
              mockActionsList.push(row);
            },
          }),
        }),
      };
      return cb(tx);
    },
    update: () => ({
      set: (updates: any) => ({
        where: () => {
          const current = mockDisputeStore.get("PP-D-1001") || {};
          mockDisputeStore.set("PP-D-1001", { ...current, ...updates });
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

const AUTH_HEADERS = {
  "content-type": "application/json",
  "x-merchant-auth": "test-merchant-secret",
};

describe("Dispute Lifecycle Action Endpoints (T11, T18, T19, T09)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDisputeStore.clear();
    mockDraftStore.clear();
    mockOrderStore.clear();
    mockActionsList.length = 0;
    mockAuditLogList.length = 0;

    // Default mock implementations
    mockProvideEvidence.mockResolvedValue({
      success: true,
      disputeId: "PP-D-1001",
      action: "provide-evidence",
    });
    mockAcceptClaim.mockResolvedValue({
      success: true,
      disputeId: "PP-D-1001",
      action: "accept-claim",
    });
    mockAdjudicate.mockResolvedValue({
      success: true,
      disputeId: "PP-D-1001",
      outcome: "SELLER_FAVOR",
    });

    // Seed test dispute
    mockDisputeStore.set("PP-D-1001", {
      paypalDisputeId: "PP-D-1001",
      orderId: "O-1001",
      captureId: "CAP-1001-A1",
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      caseState: "DRAFTED",
      amountMinor: 4800,
      currency: "USD",
      paypalStatus: "WAITING_FOR_SELLER_RESPONSE",
    });

    mockOrderStore.set("O-1001", {
      id: "O-1001",
      captureId: "CAP-1001-A1",
      carrier: "FEDEX",
      trackingNumber: "TESTTRACK0001",
      amountMinor: 4800,
      currency: "USD",
    });

    mockDraftStore.set("PP-D-1001", {
      id: "DRF-1001",
      disputeId: "PP-D-1001",
      version: 1,
      evidenceType: "PROOF_OF_FULFILLMENT",
      bodyJson: JSON.stringify({ sections: [] }),
      notesText: "Dispatched via FEDEX tracking TESTTRACK0001.",
      groundingStatus: "pass",
      status: "draft",
    });
  });

  describe("POST /api/cases/[id]/approve", () => {
    it("fails when approvedBy is empty", async () => {
      const req = new NextRequest("http://localhost:3000/api/cases/PP-D-1001/approve", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ approvedBy: "" }),
      });
      const res = await approveHandler(req, { params: { id: "PP-D-1001" } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/approvedBy.*is required/i);
    });

    it("fails when draft failed grounding", async () => {
      mockDraftStore.set("PP-D-1001", {
        id: "DRF-1001",
        disputeId: "PP-D-1001",
        groundingStatus: "fail",
      });

      const req = new NextRequest("http://localhost:3000/api/cases/PP-D-1001/approve", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
      });
      const res = await approveHandler(req, { params: { id: "PP-D-1001" } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Grounding validation has not passed/i);
    });

    it("successfully approves a valid draft and transitions to APPROVED", async () => {
      const req = new NextRequest("http://localhost:3000/api/cases/PP-D-1001/approve", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
      });
      const res = await approveHandler(req, { params: { id: "PP-D-1001" } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.caseState).toBe("APPROVED");
      expect(mockDisputeStore.get("PP-D-1001").caseState).toBe("APPROVED");
    });
  });

  describe("POST /api/cases/[id]/submit", () => {
    it("fails when case is not in APPROVED state", async () => {
      mockDisputeStore.set("PP-D-1001", {
        ...mockDisputeStore.get("PP-D-1001"),
        caseState: "DRAFTED", // Not yet approved
      });

      const req = new NextRequest("http://localhost:3000/api/cases/PP-D-1001/submit", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
      });
      const res = await submitHandler(req, { params: { id: "PP-D-1001" } });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toMatch(/Case must be in 'APPROVED' state/i);
    });

    it("submits evidence to PayPal Disputes API and transitions to SUBMITTED", async () => {
      mockDisputeStore.set("PP-D-1001", {
        ...mockDisputeStore.get("PP-D-1001"),
        caseState: "APPROVED",
      });

      const draft = mockDraftStore.get("PP-D-1001");
      const order = mockOrderStore.get("O-1001");
      const approvalHash = computeDraftApprovalHash({
        draftId: draft.id,
        disputeId: draft.disputeId,
        evidenceType: draft.evidenceType,
        bodyJson: draft.bodyJson,
        notesText: draft.notesText,
        carrier: order?.carrier,
        trackingNumber: order?.trackingNumber,
      });

      mockActionsList.push({
        id: "ACT-APPR-1001",
        disputeId: "PP-D-1001",
        type: "approve",
        status: "APPROVED",
        payloadJson: JSON.stringify({
          draftId: draft.id,
          disputeId: "PP-D-1001",
          approvalHash,
          approvedBy: "Sarah Jenkins",
        }),
        approvedBy: "Sarah Jenkins",
        createdAt: new Date().toISOString(),
      });

      const req = new NextRequest("http://localhost:3000/api/cases/PP-D-1001/submit", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
      });
      const res = await submitHandler(req, { params: { id: "PP-D-1001" } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.caseState).toBe("SUBMITTED");
      expect(mockProvideEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          disputeId: "PP-D-1001",
          approvedBy: "Sarah Jenkins",
        })
      );
    });
  });

  describe("POST /api/cases/[id]/accept", () => {
    it("accepts buyer claim and transitions to ACCEPTED", async () => {
      const req = new NextRequest("http://localhost:3000/api/cases/PP-D-1001/accept", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
      });
      const res = await acceptHandler(req, { params: { id: "PP-D-1001" } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.caseState).toBe("ACCEPTED");
      expect(mockAcceptClaim).toHaveBeenCalledWith(
        "PP-D-1001",
        "Sarah Jenkins",
        expect.any(String)
      );
    });
  });

  describe("POST /api/cases/[id]/refund", () => {
    it("executes capture refund via PayPal Payments API and transitions to REFUNDED", async () => {
      mockRefundCapture.mockResolvedValueOnce({
        id: "REF-999-XYZ",
        status: "COMPLETED",
      });

      const req = new NextRequest("http://localhost:3000/api/cases/PP-D-1001/refund", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({ approvedBy: "Sarah Jenkins" }),
      });
      const res = await refundHandler(req, { params: { id: "PP-D-1001" } });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.caseState).toBe("REFUNDED");
      expect(mockRefundCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          captureId: "CAP-1001-A1",
          approvedBy: "Sarah Jenkins",
          amountMinor: 4800,
        })
      );
    });
  });

  describe("POST /api/admin/simulate/adjudicate", () => {
    it("settles dispute via adjudicate endpoint and transitions to RESOLVED", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/simulate/adjudicate", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          disputeId: "PP-D-1001",
          outcome: "SELLER_FAVOR",
          approvedBy: "Admin",
        }),
      });
      const res = await adjudicateHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.caseState).toBe("RESOLVED");
      expect(mockAdjudicate).toHaveBeenCalledWith("PP-D-1001", "SELLER_FAVOR", "Admin");
    });
  });

  describe("POST /api/admin/simulate/dispute", () => {
    it("simulates scenario S1 dispute into queue", async () => {
      const req = new NextRequest("http://localhost:3000/api/admin/simulate/dispute", {
        method: "POST",
        headers: AUTH_HEADERS,
        body: JSON.stringify({
          scenario: "S1",
        }),
      });
      const res = await disputeSimulateHandler(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.disputeId).toBe("PP-D-1001");
      expect(data.scenario).toBe("S1");
      expect(mockProcessDispute).toHaveBeenCalledWith("PP-D-1001", { trigger: "simulator" });
      expect(data.recommendation).toBe("FIGHT");
    });
  });
});
