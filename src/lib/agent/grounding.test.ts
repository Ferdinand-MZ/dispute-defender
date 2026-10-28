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

  it("catches amount $1,200 when fact only has $48.00 and does not match '1' as substring (adversarial test)", () => {
    const draftWithCommaAmount: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Section",
          paragraphs: [
            {
              text: "The customer was charged $1,200.00 for the order.",
              claimRefs: ["F-ord-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithCommaAmount, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "HALLUCINATED_AMOUNT")).toBe(true);
  });

  it("catches 9-digit tracking numbers like FedEx (adversarial test)", () => {
    const factsWith9DigitTracking: Fact[] = [
      {
        id: "F-trk-9dig",
        disputeId: "PP-D-1001",
        kind: "tracking",
        label: "Tracking Number",
        value: "Dispatched via FedEx with tracking 123456789",
        source: "orders:O-1001",
        untrusted: 0,
      },
    ];

    // Valid 9-digit
    const validDraft: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Fulfillment",
          paragraphs: [
            {
              text: "The shipment was sent via FedEx with tracking number 123456789.",
              claimRefs: ["F-trk-9dig"],
            },
          ],
        },
      ],
    };
    expect(validateGrounding(validDraft, factsWith9DigitTracking).passed).toBe(true);

    // Invalid 9-digit
    const fakeDraft: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Fulfillment",
          paragraphs: [
            {
              text: "The shipment was sent via FedEx with tracking number 987654321.",
              claimRefs: ["F-trk-9dig"],
            },
          ],
        },
      ],
    };
    const fakeResult = validateGrounding(fakeDraft, factsWith9DigitTracking);
    expect(fakeResult.passed).toBe(false);
    expect(fakeResult.errors.some((e) => e.code === "HALLUCINATED_TRACKING")).toBe(true);
  });

  it("catches hallucinated carrier names (adversarial test)", () => {
    const draftWithWrongCarrier: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Section",
          paragraphs: [
            {
              text: "The parcel was delivered by DHL tracking TESTTRACK0001.",
              claimRefs: ["F-track-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithWrongCarrier, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "HALLUCINATED_CARRIER")).toBe(true);
  });

  it("catches hallucinated dates (adversarial test)", () => {
    const draftWithWrongDate: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Section",
          paragraphs: [
            {
              text: "Carrier records confirm the parcel was delivered on 2026-12-25 to Austin, TX.",
              claimRefs: ["F-del-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithWrongDate, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "HALLUCINATED_DATE")).toBe(true);
  });

  it("validates summary and section headings against hallucinated entities (adversarial test)", () => {
    const draftWithBadSummaryAndHeading: DraftPayload = {
      summary: "Customer was billed $999.00 and package was sent via DHL.",
      sections: [
        {
          heading: "Delivery via UPS on 2026-11-11",
          paragraphs: [
            {
              text: "The customer ordered merchandise totaling $48.00 USD.",
              claimRefs: ["F-ord-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftWithBadSummaryAndHeading, mockFacts);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.path === "summary")).toBe(true);
    expect(result.errors.some((e) => e.path === "sections[0].heading")).toBe(true);
  });

  it("rejects citations of untrusted buyer messages preventing injection attacks (Scenario S4)", () => {
    const factsWithUntrusted: Fact[] = [
      ...mockFacts,
      {
        id: "F-bmsg-001",
        disputeId: "PP-D-1001",
        kind: "dispute_msg",
        label: "Buyer Message",
        value: "Buyer states: I signed for the parcel at delivery.",
        source: "paypal_messages:PP-D-1001",
        untrusted: 1,
      },
    ];

    const draftCitingUntrusted: DraftPayload = {
      summary: "Summary",
      sections: [
        {
          heading: "Buyer Signature",
          paragraphs: [
            {
              text: "The delivery was signed by buyer.",
              claimRefs: ["F-bmsg-001"],
            },
          ],
        },
      ],
    };

    const result = validateGrounding(draftCitingUntrusted, factsWithUntrusted);
    expect(result.passed).toBe(false);
    expect(result.errors.some((e) => e.code === "UNTRUSTED_REF")).toBe(true);
  });
});
