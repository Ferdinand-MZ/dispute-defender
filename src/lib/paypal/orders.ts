import { payPalRequest } from "./client";
import {
  PayPalOrder,
  PayPalOrderSchema,
  PayPalItem,
  PayPalRefund,
  PayPalRefundSchema,
} from "./types";
import { fromMinorUnits } from "../money";

export interface CreateOrderInput {
  referenceId?: string;
  items: Array<{
    name: string;
    sku?: string;
    quantity: number;
    amountMinor: number;
    currency?: string;
  }>;
  currency?: string;
  customId?: string;
  invoiceId?: string;
  requestId?: string;
}

/**
 * Create a PayPal checkout order in the Sandbox environment.
 * Generates an approval link for the customer.
 */
export async function createSandboxOrder(
  input: CreateOrderInput
): Promise<PayPalOrder> {
  const currency = input.currency || "USD";

  const totalMinor = input.items.reduce(
    (sum, item) => sum + item.amountMinor * item.quantity,
    0
  );
  const totalValueStr = fromMinorUnits(totalMinor, currency);

  const formattedItems: PayPalItem[] = input.items.map((item) => ({
    name: item.name,
    sku: item.sku,
    quantity: String(item.quantity),
    unit_amount: {
      currency_code: currency,
      value: fromMinorUnits(item.amountMinor, currency),
    },
    category: "PHYSICAL_GOODS",
  }));

  const payload = {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: input.referenceId || "default",
        custom_id: input.customId,
        invoice_id: input.invoiceId,
        amount: {
          currency_code: currency,
          value: totalValueStr,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: totalValueStr,
            },
          },
        },
        items: formattedItems,
      },
    ],
  };

  const { data } = await payPalRequest<unknown>("/v2/checkout/orders", {
    method: "POST",
    requestId: input.requestId || `ord_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    body: JSON.stringify(payload),
  });

  return PayPalOrderSchema.parse(data);
}

/**
 * Retrieve order details from PayPal Sandbox Orders v2 API.
 */
export async function getSandboxOrder(orderId: string): Promise<PayPalOrder> {
  if (!orderId) {
    throw new Error("orderId is required to retrieve a PayPal order");
  }

  const { data } = await payPalRequest<unknown>(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });

  return PayPalOrderSchema.parse(data);
}

/**
 * Capture an approved PayPal checkout order in the Sandbox environment.
 * Requires the buyer to have approved the order via the approval link.
 */
export async function captureSandboxOrder(
  orderId: string,
  requestId?: string
): Promise<PayPalOrder> {
  if (!orderId) {
    throw new Error("orderId is required to capture a PayPal order");
  }

  const { data } = await payPalRequest<unknown>(
    `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`,
    {
      method: "POST",
      requestId: requestId || `cap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body: JSON.stringify({}),
    }
  );

  return PayPalOrderSchema.parse(data);
}

export interface RefundCaptureInput {
  captureId: string;
  approvedBy: string; // Required by Non-negotiable rule 3
  amountMinor?: number;
  currency?: string;
  noteToPayer?: string;
  requestId?: string;
}

/**
 * Refund a captured payment in the PayPal Sandbox environment.
 * NON-NEGOTIABLE RULE 3: Requires explicit human authorization (`approvedBy`).
 */
export async function refundCapture(input: RefundCaptureInput): Promise<PayPalRefund> {
  if (!input.captureId) {
    throw new Error("captureId is required to refund a capture");
  }

  if (!input.approvedBy || !input.approvedBy.trim()) {
    throw new Error("SECURITY_VIOLATION: Refunding a payment requires explicit human approval ('approvedBy').");
  }

  const currency = input.currency || "USD";
  const bodyPayload: Record<string, unknown> = {};

  if (input.amountMinor !== undefined) {
    bodyPayload.amount = {
      value: fromMinorUnits(input.amountMinor, currency),
      currency_code: currency,
    };
  }

  if (input.noteToPayer) {
    bodyPayload.note_to_payer = input.noteToPayer;
  }

  const { data } = await payPalRequest<unknown>(
    `/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`,
    {
      method: "POST",
      requestId: input.requestId || `ref_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      body: JSON.stringify(bodyPayload),
    }
  );

  return PayPalRefundSchema.parse(data);
}
