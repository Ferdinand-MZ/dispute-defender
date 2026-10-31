import { createHash } from "crypto";

export interface DraftApprovalSnapshot {
  draftId: string;
  disputeId: string;
  evidenceType: string;
  bodyJson: string;
  notesText: string | null;
  carrier?: string | null;
  trackingNumber?: string | null;
}

/**
 * Computes a deterministic SHA-256 fingerprint of the exact draft content and supporting evidence.
 * Used to ensure that any modification to the draft or evidence after approval invalidates the approval.
 */
export function computeDraftApprovalHash(snapshot: DraftApprovalSnapshot): string {
  const normalized = [
    snapshot.draftId,
    snapshot.disputeId,
    snapshot.evidenceType,
    snapshot.bodyJson,
    snapshot.notesText || "",
    snapshot.carrier || "",
    snapshot.trackingNumber || "",
  ].join("|");

  return createHash("sha256").update(normalized).digest("hex");
}
