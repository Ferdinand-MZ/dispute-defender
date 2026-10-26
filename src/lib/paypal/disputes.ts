import { payPalRequest } from "./client";
import {
  PayPalDispute,
  PayPalDisputeSchema,
  PayPalDisputesListResponse,
  PayPalDisputesListResponseSchema,
} from "./types";
import { ProvideEvidenceInput } from "../evidence/mapping";

export interface ListDisputesParams {
  disputeState?: "REQUIRED_ACTION" | "REQUIRED_OTHER_PARTY_ACTION" | "UNDER_PAYPAL_REVIEW" | "RESOLVED" | "OPEN_INQUIRIES";
  pageSize?: number;
  updateTimeAfter?: string;
  updateTimeBefore?: string;
}

/**
 * List disputes from the PayPal Sandbox Disputes API.
 */
export async function listSandboxDisputes(
  params: ListDisputesParams = {}
): Promise<PayPalDisputesListResponse> {
  const query = new URLSearchParams();
  if (params.disputeState) query.set("dispute_state", params.disputeState);
  if (params.pageSize) query.set("page_size", String(params.pageSize));
  if (params.updateTimeAfter) query.set("update_time_after", params.updateTimeAfter);
  if (params.updateTimeBefore) query.set("update_time_before", params.updateTimeBefore);

  const qs = query.toString();
  const endpoint = `/v1/customer/disputes${qs ? `?${qs}` : ""}`;

  const { data } = await payPalRequest<unknown>(endpoint, {
    method: "GET",
  });

  return PayPalDisputesListResponseSchema.parse(data);
}

/**
 * Show dispute details from PayPal Sandbox Disputes API.
 */
export async function getSandboxDispute(disputeId: string): Promise<PayPalDispute> {
  if (!disputeId) {
    throw new Error("disputeId is required to retrieve dispute details");
  }

  const { data } = await payPalRequest<unknown>(
    `/v1/customer/disputes/${encodeURIComponent(disputeId)}`,
    {
      method: "GET",
    }
  );

  return PayPalDisputeSchema.parse(data);
}

export interface ProvideEvidenceParams {
  disputeId: string;
  evidencePayload: ProvideEvidenceInput;
  approvedBy: string; // Required by Non-negotiable rule 3
  evidenceFile?: {
    buffer: Buffer | Uint8Array;
    filename: string;
    mimeType: string;
  };
  requestId?: string;
}

/**
 * Submit evidence for a dispute to PayPal Disputes API.
 * NON-NEGOTIABLE RULE 3: Requires explicit human authorization (`approvedBy`).
 * NON-NEGOTIABLE RULE: Can only be submitted when status is WAITING_FOR_SELLER_RESPONSE.
 */
export async function provideDisputeEvidence({
  disputeId,
  evidencePayload,
  approvedBy,
  evidenceFile,
  requestId,
}: ProvideEvidenceParams): Promise<void> {
  if (!disputeId) {
    throw new Error("disputeId is required to submit evidence");
  }

  if (!approvedBy || !approvedBy.trim()) {
    throw new Error(
      "SECURITY_VIOLATION: Submitting dispute evidence to PayPal requires explicit human approval ('approvedBy')."
    );
  }

  // Pre-flight check: Verify dispute exists and is in WAITING_FOR_SELLER_RESPONSE status
  const dispute = await getSandboxDispute(disputeId);
  if (dispute.status !== "WAITING_FOR_SELLER_RESPONSE") {
    throw new Error(
      `Cannot provide evidence: Dispute ${disputeId} is in status '${dispute.status}'. Evidence can only be submitted while 'WAITING_FOR_SELLER_RESPONSE'.`
    );
  }

  const endpoint = `/v1/customer/disputes/${encodeURIComponent(disputeId)}/provide-evidence`;

  if (evidenceFile) {
    // Multipart form submission
    const formData = new FormData();
    formData.append("input", JSON.stringify(evidencePayload));

    const blob = new Blob([new Uint8Array(evidenceFile.buffer)], { type: evidenceFile.mimeType });
    formData.append("evidence-file", blob, evidenceFile.filename);

    await payPalRequest<void>(endpoint, {
      method: "POST",
      requestId: requestId || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body: formData,
    });
  } else {
    // JSON submission
    await payPalRequest<void>(endpoint, {
      method: "POST",
      requestId: requestId || `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body: JSON.stringify(evidencePayload),
    });
  }
}

/**
 * Settle and close a dispute in Sandbox environment (simulation helper).
 * Calls POST /v1/customer/disputes/{id}/adjudicate
 */
export async function adjudicateSandboxDispute(
  disputeId: string,
  adjudicationType: "REVERT_PAYMENT" = "REVERT_PAYMENT",
  approvedBy?: string
): Promise<void> {
  if (!disputeId) {
    throw new Error("disputeId is required for adjudication");
  }

  if (!approvedBy) {
    throw new Error("SECURITY_VIOLATION: Adjudicating dispute requires explicit authorization.");
  }

  const endpoint = `/v1/customer/disputes/${encodeURIComponent(disputeId)}/adjudicate`;
  await payPalRequest<void>(endpoint, {
    method: "POST",
    body: JSON.stringify({ adjudication_type: adjudicationType }),
  });
}

/**
 * Accept a buyer's claim in PayPal Disputes API.
 * NON-NEGOTIABLE RULE 3: Requires explicit human authorization.
 */
export async function acceptSandboxDisputeClaim(
  disputeId: string,
  approvedBy: string,
  note = "Accepting customer claim in accordance with store policy."
): Promise<void> {
  if (!disputeId) {
    throw new Error("disputeId is required to accept a claim");
  }

  if (!approvedBy) {
    throw new Error("SECURITY_VIOLATION: Accepting dispute claim requires explicit human approval.");
  }

  const endpoint = `/v1/customer/disputes/${encodeURIComponent(disputeId)}/accept-claim`;
  await payPalRequest<void>(endpoint, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
}
