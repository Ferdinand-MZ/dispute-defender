import { env } from "../env";
import { payPalRequest } from "./client";
import {
  PayPalWebhookVerifyRequest,
  PayPalWebhookVerifyResponse,
  PayPalWebhookVerifyResponseSchema,
} from "./types";

export interface VerifyWebhookSignatureParams {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookId?: string;
  webhookEvent: Record<string, unknown>;
}

/**
 * Verify incoming PayPal webhook authenticity against the PayPal Notifications API.
 */
export async function verifyWebhookSignature({
  authAlgo,
  certUrl,
  transmissionId,
  transmissionSig,
  transmissionTime,
  webhookId = env.PAYPAL_WEBHOOK_ID,
  webhookEvent,
}: VerifyWebhookSignatureParams): Promise<boolean> {
  if (!webhookId) {
    console.warn("[WEBHOOK_WARN] PAYPAL_WEBHOOK_ID is not configured in env.");
  }

  const payload: PayPalWebhookVerifyRequest = {
    auth_algo: authAlgo,
    cert_url: certUrl,
    transmission_id: transmissionId,
    transmission_sig: transmissionSig,
    transmission_time: transmissionTime,
    webhook_id: webhookId || "",
    webhook_event: webhookEvent,
  };

  try {
    const { data } = await payPalRequest<PayPalWebhookVerifyResponse>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );

    const parsed = PayPalWebhookVerifyResponseSchema.safeParse(data);
    if (!parsed.success) {
      return false;
    }

    return parsed.data.verification_status === "SUCCESS";
  } catch (err) {
    console.error("[WEBHOOK_VERIFY_ERROR] Failed to verify webhook signature:", err);
    return false;
  }
}
