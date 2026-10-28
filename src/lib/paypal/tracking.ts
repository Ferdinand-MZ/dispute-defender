import { payPalRequest } from "./client";

export interface PayPalTrackerItem {
  transaction_id: string;
  tracking_number: string;
  status: "SHIPPED" | "DELIVERED" | "ON_HOLD" | "CANCELLED";
  carrier: string;
  carrier_name_other?: string;
  notify_buyer?: boolean;
}

export interface AddTrackingBatchInput {
  trackers: PayPalTrackerItem[];
}

export interface TrackerBatchResponse {
  errors?: Array<{
    name?: string;
    message?: string;
    debug_id?: string;
  }>;
  tracker_identifiers?: Array<{
    transaction_id: string;
    tracking_number: string;
    status: string;
    links?: Array<{ href: string; rel: string }>;
  }>;
}

/**
 * Send shipping tracking information to PayPal via POST /v1/shipping/trackers-batch.
 * Crucial for seller protection and automated dispute prevention on Item Not Received claims.
 */
export async function addTrackingBatch(
  input: AddTrackingBatchInput,
  requestId?: string
): Promise<TrackerBatchResponse> {
  if (!input.trackers || input.trackers.length === 0) {
    throw new Error("At least one tracker item is required to add tracking information.");
  }

  const endpoint = "/v1/shipping/trackers-batch";

  const { data } = await payPalRequest<TrackerBatchResponse>(endpoint, {
    method: "POST",
    requestId: requestId || `trk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    body: JSON.stringify(input),
  });

  return (data || {}) as TrackerBatchResponse;
}
