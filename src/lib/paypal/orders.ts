import { payPalRequest } from "./client";
import {
  PayPalOrder,
  PayPalOrderSchema,
  PayPalItem,
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
