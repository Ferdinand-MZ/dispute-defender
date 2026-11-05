import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  paypalOrderId: text("paypal_order_id"),
  captureId: text("capture_id"),
  buyerEmail: text("buyer_email"),
  buyerName: text("buyer_name"),
  shipToJson: text("ship_to_json"),
  itemsJson: text("items_json"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("USD"),
  status: text("status").notNull(), // created, paid, shipped, delivered
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  shippedAt: text("shipped_at"),
  deliveredAt: text("delivered_at"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const policies = sqliteTable("policies", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(), // shipping, return, tos
  title: text("title").notNull(),
  bodyMd: text("body_md").notNull(),
  version: text("version").notNull().default("1.0"),
});

export const comms = sqliteTable("comms", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  direction: text("direction").notNull(), // buyer, merchant
  body: text("body").notNull(),
  sentAt: text("sent_at").notNull(),
});

export const disputes = sqliteTable("disputes", {
  paypalDisputeId: text("paypal_dispute_id").primaryKey(),
  captureId: text("capture_id"),
  orderId: text("order_id"),
  reason: text("reason").notNull(), // MERCHANDISE_OR_SERVICE_NOT_RECEIVED, MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED
  paypalStatus: text("paypal_status").notNull(),
  lifeCycleStage: text("life_cycle_stage"),
  amountMinor: integer("amount_minor").notNull(),
  currency: text("currency").notNull().default("USD"),
  sellerResponseDueAt: text("seller_response_due_at"),
  caseState: text("case_state").notNull().default("NEW"),
  rawJson: text("raw_json"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const facts = sqliteTable("facts", {
  id: text("id").primaryKey(), // F-ord-001
  disputeId: text("dispute_id").notNull(),
  kind: text("kind").notNull(), // order, payment, tracking, delivery, policy, comms, dispute_msg
  label: text("label").notNull(),
  value: text("value").notNull(),
  source: text("source").notNull(), // e.g. orders:O-1001
  untrusted: integer("untrusted").notNull().default(0), // 0 or 1
});

export const analyses = sqliteTable("analyses", {
  id: text("id").primaryKey(),
  disputeId: text("dispute_id").notNull(),
  strengthScore: integer("strength_score").notNull(), // stored as 0-100 or minor unit
  strengthBreakdownJson: text("strength_breakdown_json").notNull(),
  pWinBand: text("p_win_band").notNull(), // high, medium, low, very_low
  fightLossMinor: integer("fight_loss_minor").notNull(),
  refundLossMinor: integer("refund_loss_minor").notNull(),
  recommendation: text("recommendation").notNull(), // FIGHT, REFUND, ACCEPT
  rationale: text("rationale").notNull(),
  model: text("model").notNull(),
  createdAt: text("created_at").notNull(),
});

export const drafts = sqliteTable("drafts", {
  id: text("id").primaryKey(),
  disputeId: text("dispute_id").notNull(),
  version: integer("version").notNull().default(1),
  evidenceType: text("evidence_type").notNull(),
  bodyJson: text("body_json").notNull(), // Structured sections & paragraphs with claimRefs
  notesText: text("notes_text"),
  pdfPath: text("pdf_path"),
  groundingStatus: text("grounding_status").notNull(), // pass, fail, edited_pass
  groundingErrorsJson: text("grounding_errors_json"),
  status: text("status").notNull().default("draft"), // draft, approved, submitted
  author: text("author"), // LLM model id, "template", or "merchant_edit"
  createdAt: text("created_at").notNull(),
});

export const actions = sqliteTable("actions", {
  id: text("id").primaryKey(),
  disputeId: text("dispute_id").notNull(),
  type: text("type").notNull(), // provide_evidence, accept_claim, refund
  payloadJson: text("payload_json").notNull(),
  paypalResponseJson: text("paypal_response_json"),
  status: text("status").notNull(), // pending, success, failed
  approvedBy: text("approved_by").notNull(), // human identifier or "AUTOPILOT"
  createdAt: text("created_at").notNull(),
});

export const auditLog = sqliteTable("audit_log", {
  id: text("id").primaryKey(),
  ts: text("ts").notNull(),
  actor: text("actor").notNull(), // agent, human, system, paypal
  disputeId: text("dispute_id"),
  action: text("action").notNull(),
  detailJson: text("detail_json"),
});

export const webhookEvents = sqliteTable("webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  payloadJson: text("payload_json").notNull(),
  receivedAt: text("received_at").notNull(),
  processedAt: text("processed_at"),
});

export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type Policy = typeof policies.$inferSelect;
export type Comms = typeof comms.$inferSelect;
export type Dispute = typeof disputes.$inferSelect;
export type Fact = typeof facts.$inferSelect;
export type Analysis = typeof analyses.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type Action = typeof actions.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type WebhookEvent = typeof webhookEvents.$inferSelect;
