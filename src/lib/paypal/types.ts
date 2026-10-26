import { z } from "zod";

// --- Common / Money ---
export const PayPalMoneySchema = z.object({
  currency_code: z.string(),
  value: z.string(),
});
export type PayPalMoney = z.infer<typeof PayPalMoneySchema>;

export const PayPalLinkDescriptionSchema = z.object({
  href: z.string(),
  rel: z.string(),
  method: z.string().optional(),
});
export type PayPalLinkDescription = z.infer<typeof PayPalLinkDescriptionSchema>;

// --- Orders v2 API ---
export const PayPalOrderStatusSchema = z.enum([
  "CREATED",
  "SAVED",
  "APPROVED",
  "VOIDED",
  "COMPLETED",
  "PAYER_ACTION_REQUIRED",
]);
export type PayPalOrderStatus = z.infer<typeof PayPalOrderStatusSchema>;

export const PayPalItemSchema = z.object({
  name: z.string(),
  unit_amount: PayPalMoneySchema,
  quantity: z.string(),
  description: z.string().optional(),
  sku: z.string().optional(),
  category: z.enum(["DIGITAL_GOODS", "PHYSICAL_GOODS", "DONATION"]).optional(),
});
export type PayPalItem = z.infer<typeof PayPalItemSchema>;

export const PayPalCaptureSchema = z.object({
  id: z.string(),
  status: z.enum(["COMPLETED", "DECLINED", "PARTIALLY_REFUNDED", "PENDING", "REFUNDED", "FAILED"]),
  amount: PayPalMoneySchema,
  final_capture: z.boolean().optional(),
  seller_protection: z
    .object({
      status: z.string(),
      dispute_categories: z.array(z.string()).optional(),
    })
    .optional(),
  create_time: z.string().optional(),
  update_time: z.string().optional(),
});
export type PayPalCapture = z.infer<typeof PayPalCaptureSchema>;

export const PayPalPurchaseUnitSchema = z.object({
  reference_id: z.string().optional(),
  amount: z.object({
    currency_code: z.string(),
    value: z.string(),
    breakdown: z
      .object({
        item_total: PayPalMoneySchema.optional(),
        shipping: PayPalMoneySchema.optional(),
        tax_total: PayPalMoneySchema.optional(),
        discount: PayPalMoneySchema.optional(),
      })
      .optional(),
  }),
  payee: z
    .object({
      email_address: z.string().optional(),
      merchant_id: z.string().optional(),
    })
    .optional(),
  description: z.string().optional(),
  custom_id: z.string().optional(),
  invoice_id: z.string().optional(),
  items: z.array(PayPalItemSchema).optional(),
  shipping: z
    .object({
      name: z.object({ full_name: z.string().optional() }).optional(),
      address: z
        .object({
          address_line_1: z.string().optional(),
          address_line_2: z.string().optional(),
          admin_area_2: z.string().optional(), // city
          admin_area_1: z.string().optional(), // state
          postal_code: z.string().optional(),
          country_code: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  payments: z
    .object({
      captures: z.array(PayPalCaptureSchema).optional(),
    })
    .optional(),
});
export type PayPalPurchaseUnit = z.infer<typeof PayPalPurchaseUnitSchema>;

export const PayPalOrderSchema = z.object({
  id: z.string(),
  status: PayPalOrderStatusSchema,
  intent: z.enum(["CAPTURE", "AUTHORIZE"]).optional(),
  create_time: z.string().optional(),
  update_time: z.string().optional(),
  purchase_units: z.array(PayPalPurchaseUnitSchema).optional(),
  payer: z
    .object({
      name: z.object({ given_name: z.string().optional(), surname: z.string().optional() }).optional(),
      email_address: z.string().optional(),
      payer_id: z.string().optional(),
    })
    .optional(),
  links: z.array(PayPalLinkDescriptionSchema).optional(),
});
export type PayPalOrder = z.infer<typeof PayPalOrderSchema>;

// --- Customer Disputes v1 API ---
export const PayPalDisputeStatusSchema = z.enum([
  "OPEN",
  "WAITING_FOR_SELLER_RESPONSE",
  "WAITING_FOR_BUYER_RESPONSE",
  "UNDER_REVIEW",
  "RESOLVED",
  "OTHER",
]);
export type PayPalDisputeStatus = z.infer<typeof PayPalDisputeStatusSchema>;

export const PayPalDisputeReasonSchema = z.enum([
  "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
  "MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED",
  "UNAUTHORISED",
  "CREDIT_NOT_PROCESSED",
  "DUPLICATE_TRANSACTION",
  "INCORRECT_AMOUNT",
  "PAYMENT_BY_OTHER_MEANS",
  "CANCELED_RECURRING_BILLING",
  "PROBLEM_WITH_REMITTANCE",
  "OTHER",
]);
export type PayPalDisputeReason = z.infer<typeof PayPalDisputeReasonSchema>;

export const PayPalDisputeSchema = z.object({
  dispute_id: z.string(),
  create_time: z.string().optional(),
  update_time: z.string().optional(),
  status: z.string(),
  dispute_state: z.string().optional(),
  dispute_amount: PayPalMoneySchema,
  reason: z.string(),
  dispute_life_cycle_stage: z.string().optional(),
  dispute_channel: z.string().optional(),
  seller_response_due_date: z.string().optional(),
  disputed_transactions: z
    .array(
      z.object({
        buyer_transaction_id: z.string().optional(),
        seller_transaction_id: z.string().optional(),
        gross_amount: PayPalMoneySchema.optional(),
        invoice_number: z.string().optional(),
        custom: z.string().optional(),
      })
    )
    .optional(),
  messages: z
    .array(
      z.object({
        posted_by: z.string(),
        time_posted: z.string(),
        content: z.string(),
      })
    )
    .optional(),
  evidences: z
    .array(
      z.object({
        evidence_type: z.string(),
        evidence_info: z.record(z.unknown()).optional(),
        notes: z.string().optional(),
        date: z.string().optional(),
      })
    )
    .optional(),
  links: z.array(PayPalLinkDescriptionSchema).optional(),
});
export type PayPalDispute = z.infer<typeof PayPalDisputeSchema>;

export const PayPalDisputesListResponseSchema = z.object({
  items: z.array(PayPalDisputeSchema).optional().default([]),
  links: z.array(PayPalLinkDescriptionSchema).optional().default([]),
  total_items: z.number().optional(),
  total_pages: z.number().optional(),
});
export type PayPalDisputesListResponse = z.infer<typeof PayPalDisputesListResponseSchema>;

// --- Webhooks & Notifications ---
export const PayPalWebhookVerifyRequestSchema = z.object({
  auth_algo: z.string(),
  cert_url: z.string(),
  transmission_id: z.string(),
  transmission_sig: z.string(),
  transmission_time: z.string(),
  webhook_id: z.string(),
  webhook_event: z.record(z.unknown()),
});
export type PayPalWebhookVerifyRequest = z.infer<typeof PayPalWebhookVerifyRequestSchema>;

export const PayPalWebhookVerifyResponseSchema = z.object({
  verification_status: z.enum(["SUCCESS", "FAILURE"]),
});
export type PayPalWebhookVerifyResponse = z.infer<typeof PayPalWebhookVerifyResponseSchema>;

// --- Errors ---
export interface PayPalErrorResponse {
  name?: string;
  message?: string;
  debug_id?: string;
  details?: Array<{
    field?: string;
    issue?: string;
    description?: string;
  }>;
}
