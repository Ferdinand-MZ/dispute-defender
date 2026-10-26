export type EvidenceType = "PROOF_OF_FULFILLMENT" | "PROOF_OF_REFUND" | "OTHER";

export interface TrackingInfoPayload {
  carrier_name: string;
  tracking_number: string;
}

export interface ProvideEvidenceInput {
  evidences: Array<{
    evidence_type: EvidenceType;
    evidence_info?: {
      tracking_info?: TrackingInfoPayload[];
      refund_ids?: string[];
    };
    notes?: string;
  }>;
}

export interface BuildEvidenceParams {
  reason: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  notesText?: string | null;
  refundId?: string | null;
}

/**
 * Maps dispute reason to the compliant PayPal evidence payload structure.
 */
export function buildEvidencePayload({
  reason,
  carrier,
  trackingNumber,
  notesText,
  refundId,
}: BuildEvidenceParams): ProvideEvidenceInput {
  if (reason === "MERCHANDISE_OR_SERVICE_NOT_RECEIVED") {
    if (refundId) {
      return {
        evidences: [
          {
            evidence_type: "PROOF_OF_REFUND",
            evidence_info: {
              refund_ids: [refundId],
            },
            notes: notesText || "Full refund was issued directly to customer.",
          },
        ],
      };
    }

    const trackingList: TrackingInfoPayload[] = [];
    if (carrier && trackingNumber) {
      trackingList.push({
        carrier_name: carrier,
        tracking_number: trackingNumber,
      });
    }

    return {
      evidences: [
        {
          evidence_type: "PROOF_OF_FULFILLMENT",
          evidence_info: {
            tracking_info: trackingList,
          },
          notes: notesText || "Proof of shipment and delivery attached.",
        },
      ],
    };
  }

  // Fallback for MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED or OTHER
  return {
    evidences: [
      {
        evidence_type: "OTHER",
        notes: notesText || "Product description and return policy excerpts attached.",
      },
    ],
  };
}
