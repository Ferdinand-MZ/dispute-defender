import { describe, it, expect } from "vitest";
import { buildEvidencePayload } from "./mapping";

describe("Evidence Payload Builder (Rule 2: No Fabricated Claims)", () => {
  it("does not fabricate notes when notesText is omitted", () => {
    const payload = buildEvidencePayload({
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      carrier: "FEDEX",
      trackingNumber: "TESTTRACK0001",
    });

    expect(payload.evidences[0].evidence_type).toBe("PROOF_OF_FULFILLMENT");
    expect(payload.evidences[0].notes).toBeUndefined();
    expect(payload.evidences[0].evidence_info?.tracking_info).toEqual([
      { carrier_name: "FEDEX", tracking_number: "TESTTRACK0001" },
    ]);
  });

  it("does not send PROOF_OF_FULFILLMENT with empty tracking_info when tracking is missing", () => {
    const payload = buildEvidencePayload({
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      carrier: null,
      trackingNumber: null,
      notesText: "Custom factual note from cited records.",
    });

    expect(payload.evidences[0].evidence_type).toBe("OTHER");
    expect(payload.evidences[0].notes).toBe("Custom factual note from cited records.");
    expect(payload.evidences[0].evidence_info?.tracking_info).toBeUndefined();
  });

  it("builds PROOF_OF_REFUND without fabricated notes", () => {
    const payload = buildEvidencePayload({
      reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
      refundId: "REFUND-12345",
    });

    expect(payload.evidences[0].evidence_type).toBe("PROOF_OF_REFUND");
    expect(payload.evidences[0].evidence_info?.refund_ids).toEqual(["REFUND-12345"]);
    expect(payload.evidences[0].notes).toBeUndefined();
  });

  it("builds OTHER evidence for SNAD disputes without fabricated policy text", () => {
    const payload = buildEvidencePayload({
      reason: "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
    });

    expect(payload.evidences[0].evidence_type).toBe("OTHER");
    expect(payload.evidences[0].notes).toBeUndefined();
  });
});
