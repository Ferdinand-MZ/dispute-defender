import { z } from "zod";

export const PayPalMoneySchema = z.object({
  currency_code: z.string(),
  value: z.string(),
});
export type PayPalMoney = z.infer<typeof PayPalMoneySchema>;

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
});
export type PayPalDispute = z.infer<typeof PayPalDisputeSchema>;

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
