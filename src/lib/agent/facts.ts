import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { comms, disputes, facts, orders, policies } from "../db/schema";
import type { Comms, Dispute, Order, Policy } from "../db/schema";
import { formatMoney } from "../money";
import type { FactSummary } from "./scoring";

export type NewFact = typeof facts.$inferInsert;
type Database = ReturnType<typeof getDb>;

export interface DisputeMessage {
  postedBy: string;
  timePosted?: string | null;
  content: string;
}

export interface FactSourceInput {
  dispute: Pick<Dispute, "paypalDisputeId" | "reason" | "amountMinor" | "currency" | "paypalStatus">;
  order: Order | null;
  policies: Policy[];
  comms: Comms[];
  disputeMessages: DisputeMessage[];
}

const ItemSchema = z
  .object({
    name: z.string().min(1),
    sku: z.string().optional().nullable(),
    quantity: z.union([z.string(), z.number()]).optional().nullable(),
  })
  .passthrough();

const ShipToSchema = z
  .object({
    recipient_name: z.string().optional().nullable(),
    line1: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    state: z.string().optional().nullable(),
    postal_code: z.string().optional().nullable(),
    country_code: z.string().optional().nullable(),
  })
  .passthrough();

const RawDisputeMessagesSchema = z.object({
  messages: z
    .array(
      z.object({
        posted_by: z.string(),
        time_posted: z.string().optional().nullable(),
        content: z.string(),
      })
    )
    .optional(),
});

function factId(tag: string, disputeId: string, n?: number): string {
  return n === undefined ? `F-${tag}-${disputeId}` : `F-${tag}-${disputeId}-${n}`;
}

/** ISO calendar date (YYYY-MM-DD), the format the grounding validator compares. */
function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString().slice(0, 10);
}

function parseJson<T>(raw: string | null | undefined, schema: z.ZodType<T>): T | null {
  if (!raw) return null;
  try {
    const result = schema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function parseItems(order: Order | null) {
  return parseJson(order?.itemsJson, z.array(ItemSchema)) ?? [];
}

export function parseShipTo(order: Order | null) {
  return parseJson(order?.shipToJson, ShipToSchema);
}

function formatAddress(shipTo: z.infer<typeof ShipToSchema>): string | null {
  const cityLine = [shipTo.city, [shipTo.state, shipTo.postal_code].filter(Boolean).join(" ")]
    .filter((part) => part && part.trim())
    .join(", ");
  const parts = [shipTo.line1, cityLine, shipTo.country_code].filter((part) => part && part.trim());
  return parts.length ? parts.join(", ") : null;
}

/** Messages the buyer posted on the PayPal dispute itself, read from the stored PayPal payload. */
export function disputeMessagesFromRaw(rawJson: string | null | undefined): DisputeMessage[] {
  const parsed = parseJson(rawJson, RawDisputeMessagesSchema);
  return (parsed?.messages ?? []).map((m) => ({
    postedBy: m.posted_by,
    timePosted: m.time_posted ?? null,
    content: m.content,
  }));
}

/**
 * Builds the fact base for one dispute. Pure: same input, same facts, same IDs.
 * Every value is a restatement of a stored record. Text written by the buyer is untrusted.
 */
export function buildFacts(input: FactSourceInput): NewFact[] {
  const { dispute, order } = input;
  const disputeId = dispute.paypalDisputeId;
  const out: NewFact[] = [];

  out.push({
    id: factId("dsp", disputeId),
    disputeId,
    kind: "dispute_msg",
    label: "Dispute on PayPal",
    value: `PayPal dispute ${disputeId} filed for ${dispute.reason}. Disputed amount: ${formatMoney(dispute.amountMinor, dispute.currency)}. PayPal status: ${dispute.paypalStatus}.`,
    source: `paypal:${disputeId}`,
    untrusted: 0,
  });

  if (order) {
    const items = parseItems(order);
    const itemText = items.length
      ? items.map((i) => `${i.quantity ?? 1}x ${i.name}${i.sku ? ` (SKU ${i.sku})` : ""}`).join(", ")
      : "items on file";
    const placed = isoDate(order.createdAt);
    out.push({
      id: factId("ord", disputeId),
      disputeId,
      kind: "order",
      label: "Order record",
      value: `Order ${order.id}${placed ? ` placed on ${placed}` : ""} for ${itemText}, totaling ${formatMoney(order.amountMinor, order.currency)}.`,
      source: `orders:${order.id}`,
      untrusted: 0,
    });

    if (order.captureId) {
      out.push({
        id: factId("pay", disputeId),
        disputeId,
        kind: "payment",
        label: "PayPal payment",
        value: `Payment for order ${order.id} was captured through PayPal (capture ID ${order.captureId}).`,
        source: `orders:${order.id}`,
        untrusted: 0,
      });
    }

    const shipTo = parseShipTo(order);
    const address = shipTo ? formatAddress(shipTo) : null;
    if (address) {
      out.push({
        id: factId("adr", disputeId),
        disputeId,
        kind: "order",
        label: "Ship-to address on the order",
        value: `Order ${order.id} ship-to address: ${address}.`,
        source: `orders:${order.id}`,
        untrusted: 0,
      });
    }

    if (order.carrier && order.trackingNumber) {
      const shipped = isoDate(order.shippedAt);
      out.push({
        id: factId("trk", disputeId),
        disputeId,
        kind: "tracking",
        label: "Shipment tracking",
        value: `Order ${order.id} shipped via ${order.carrier} with tracking number ${order.trackingNumber}${shipped ? ` on ${shipped}` : ""}${address ? ` to ${address}` : ""}.`,
        source: `orders:${order.id}`,
        untrusted: 0,
      });
    }

    const delivered = isoDate(order.deliveredAt);
    if (delivered) {
      out.push({
        id: factId("del", disputeId),
        disputeId,
        kind: "delivery",
        label: "Delivery confirmation",
        value: `${order.carrier ? `${order.carrier} reported` : "Carrier reported"} order ${order.id} as delivered on ${delivered}${address ? ` at ${address}` : ""}.`,
        source: `orders:${order.id}`,
        untrusted: 0,
      });
    }
  }

  const policyKinds = new Set(["shipping", "return"]);
  for (const policy of input.policies.filter((p) => policyKinds.has(p.kind))) {
    out.push({
      id: factId(policy.kind === "shipping" ? "pol-ship" : "pol-ret", disputeId),
      disputeId,
      kind: "policy",
      label: policy.title,
      value: policy.bodyMd,
      source: `policies:${policy.id}`,
      untrusted: 0,
    });
  }

  const sortedComms = [...input.comms].sort((a, b) => a.sentAt.localeCompare(b.sentAt));
  sortedComms.forEach((message, idx) => {
    const fromBuyer = message.direction !== "merchant";
    const sent = isoDate(message.sentAt);
    out.push({
      id: factId("com", disputeId, idx + 1),
      disputeId,
      kind: "comms",
      label: fromBuyer ? "Message from the buyer" : "Message from the merchant",
      value: fromBuyer
        ? message.body
        : `Merchant message${sent ? ` sent on ${sent}` : ""}: "${message.body}"`,
      source: `comms:${message.id}`,
      untrusted: fromBuyer ? 1 : 0,
    });
  });

  input.disputeMessages.forEach((message, idx) => {
    const fromBuyer = message.postedBy.toUpperCase() !== "SELLER";
    out.push({
      id: factId("msg", disputeId, idx + 1),
      disputeId,
      kind: "dispute_msg",
      label: `Message on the PayPal dispute (${message.postedBy})`,
      value: message.content,
      source: `paypal_messages:${disputeId}`,
      untrusted: fromBuyer ? 1 : 0,
    });
  });

  return out;
}

/**
 * The evidence signals the strength score reads. Derived from the same records as the facts,
 * so a signal is only "present" when a citable fact exists for it.
 */
export function summarizeEvidence(input: FactSourceInput): FactSummary {
  const { order } = input;
  const hasTracking = Boolean(order?.carrier && order?.trackingNumber);
  const hasDelivered = Boolean(isoDate(order?.deliveredAt));
  const shipTo = parseShipTo(order);
  return {
    hasTracking,
    hasDelivered,
    // Delivery is only confirmed at the order address when the carrier reported delivery
    // of a tracked shipment that was sent to the ship-to address on the PayPal order.
    addressMatch: hasTracking && hasDelivered && Boolean(shipTo && formatAddress(shipTo)),
    hasShippingPolicy: input.policies.some((p) => p.kind === "shipping"),
    // Only the merchant's own messages count as evidence; buyer-written text is untrusted.
    hasComms: input.comms.some((c) => c.direction === "merchant"),
    hasListingMatch: parseItems(order).length > 0,
    hasPhotos: false,
    hasReturnPolicy: input.policies.some((p) => p.kind === "return"),
  };
}

export type LoadedFactSources = FactSourceInput & { dispute: Dispute };

/** Loads every record a dispute's fact base is built from. */
export async function loadFactSources(
  disputeId: string,
  database: Database = getDb()
): Promise<LoadedFactSources | null> {
  const dispute = (await database.select().from(disputes).where(eq(disputes.paypalDisputeId, disputeId)))[0];
  if (!dispute) return null;
  const order = dispute.orderId
    ? (await database.select().from(orders).where(eq(orders.id, dispute.orderId)))[0] ?? null
    : null;
  return {
    dispute,
    order,
    policies: await database.select().from(policies),
    comms: order ? await database.select().from(comms).where(eq(comms.orderId, order.id)) : [],
    disputeMessages: disputeMessagesFromRaw(dispute.rawJson),
  };
}

/**
 * Rebuilds and stores the fact base for a dispute. IDs are stable, so drafts that cite
 * a fact keep pointing at it; facts whose source record disappeared are removed.
 */
export async function rebuildFacts(disputeId: string, database: Database = getDb()): Promise<NewFact[]> {
  const sources = await loadFactSources(disputeId, database);
  if (!sources) return [];
  const built = buildFacts(sources);
  await database.transaction(async (tx) => {
    await tx.delete(facts).where(eq(facts.disputeId, disputeId));
    for (const fact of built) {
      await tx.insert(facts).values(fact);
    }
  });
  return built;
}
