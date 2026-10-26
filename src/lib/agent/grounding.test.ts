import { describe, it, expect } from "vitest";
import { validateGrounding, DraftPayload } from "./grounding";
import { Fact } from "../db/schema";

describe("Grounding Validator", () => {
  const mockFacts: Fact[] = [
    {
      id: "F-ord-001",
      disputeId: "PP-D-1001",
      kind: "order",
      label: "Order Total",
      value: "48.00 USD",
      source: "orders:O-1001",
      untrusted: 0,
    },
    {
      id: "F-track-001",
      disputeId: "PP-D-1001",
      kind: "tracking",
      label: "Tracking Number",
      value: "TESTTRACK0001 via FEDEX",
      source: "orders:O-1001",
      untrusted: 0,
    },
    {
      id: "F-del-001",
      disputeId: "PP-D-1001",
      kind: "delivery",
      label: "Delivery Confirmation",
      value: "Delivered on 2026-10-20 to Austin, TX",
      source: "orders:O-1001",
      untrusted: 0,
    },
  ];

  it("passes when all claims are cited and all entities match cited facts", () => {
    const validDraft: DraftPayload = {
      summary: "Proof of fulfillment response",
      sections: [
        {
          heading: "Fulfillment Details",
          paragraphs: [
            {
              text: "The customer ordered merchandise totaling $48.00 USD.",
              claimRefs: ["F-ord-001"],
            },
            {
              text: "The item was shipped with carrier FEDEX under tracking number TESTTRACK0001.",
              claimRefs: ["F-track-001"],
            },
            {
              text: "Carrier records confirm the parcel was delivered on 2026-10-20 to Austin, TX.",
              claimRefs: ["F-del-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(validDraft, mockFacts);
    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("fails when a paragraph has no claimRefs", () => {
    const draftWithoutRefs: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Section",
          paragraphs: [
            {
              text: "The item was delivered as scheduled.",
              claimRefs: [],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithoutRefs, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors[0].code).toBe("MISSING_REFS");
  });

  it("fails when an invalid or cross-dispute claimRef is cited", () => {
    const draftWithBadRef: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Section",
          paragraphs: [
            {
              text: "Delivery occurred on 2026-10-20.",
              claimRefs: ["F-FOREIGN-999"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithBadRef, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors[0].code).toBe("INVALID_REF");
  });

  it("catches hallucinated tracking numbers (adversarial test)", () => {
    const draftWithFakeTracking: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Section",
          paragraphs: [
            {
              text: "The tracking number is FAKETRACK9999999.",
              claimRefs: ["F-track-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithFakeTracking, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "HALLUCINATED_TRACKING")).toBe(true);
  });

  it("catches banned promotional phrases (adversarial test)", () => {
    const draftWithBannedPhrase: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Section",
          paragraphs: [
            {
              text: "We guarantee 100% customer satisfaction.",
              claimRefs: ["F-ord-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithBannedPhrase, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "BANNED_PHRASE")).toBe(true);
  });
});
