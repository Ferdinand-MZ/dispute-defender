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
 * Enforces Rule 2: Never fabricate notes or claims. Notes must only come from cited facts.
 * If tracking information is absent, do not send empty PROOF_OF_FULFILLMENT.
 */
export function buildEvidencePayload({
  reason,
  carrier,
  trackingNumber,
  notesText,
  refundId,
}: BuildEvidenceParams): ProvideEvidenceInput {
  const cleanNotes = notesText && notesText.trim() ? notesText.trim() : undefined;

  if (reason === "MERCHANDISE_OR_SERVICE_NOT_RECEIVED") {
    if (refundId) {
      return {
        evidences: [
          {
            evidence_type: "PROOF_OF_REFUND",
            evidence_info: {
              refund_ids: [refundId],
            },
            ...(cleanNotes ? { notes: cleanNotes } : {}),
          },
        ],
      };
    }

    if (carrier && trackingNumber) {
      return {
        evidences: [
          {
            evidence_type: "PROOF_OF_FULFILLMENT",
            evidence_info: {
              tracking_info: [
                {
                  carrier_name: carrier,
                  tracking_number: trackingNumber,
                },
              ],
            },
            ...(cleanNotes ? { notes: cleanNotes } : {}),
          },
        ],
      };
    }

    return {
      evidences: [
        {
          evidence_type: "OTHER",
          ...(cleanNotes ? { notes: cleanNotes } : {}),
        },
      ],
    };
  }

  // Fallback for MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED or OTHER
  return {
    evidences: [
      {
        evidence_type: "OTHER",
        ...(cleanNotes ? { notes: cleanNotes } : {}),
      },
    ],
  };
}
