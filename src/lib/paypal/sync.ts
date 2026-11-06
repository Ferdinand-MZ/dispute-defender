import { db } from "../db";
import { orders, disputes, Order, Dispute } from "../db/schema";
import { eq, or } from "drizzle-orm";
import { PayPalOrder, PayPalDispute } from "./types";
import { toMinorUnits } from "../money";
import { logAudit } from "../audit";
import { canTransition, transitionState, CaseState } from "../agent/state";
import { rebuildFacts } from "../agent/facts";

/**
 * Safely upsert a PayPal Sandbox Order into the local PostgreSQL database.
 * Deduplicates by paypalOrderId or existing order record.
 */
export async function syncPayPalOrderToDb(paypalOrder: PayPalOrder): Promise<Order> {
  const now = new Date().toISOString();
  const firstUnit = paypalOrder.purchase_units?.[0];
  const firstCapture = firstUnit?.payments?.captures?.[0];

  const captureId = firstCapture?.id || null;
  const currency = firstUnit?.amount?.currency_code || "USD";
  const amountMinor = toMinorUnits(firstUnit?.amount?.value || "0", currency);

  let mappedStatus = "created";
  if (paypalOrder.status === "COMPLETED" || firstCapture?.status === "COMPLETED") {
    mappedStatus = "paid";
  } else if (paypalOrder.status === "APPROVED") {
    mappedStatus = "approved";
  }

  const buyerName = paypalOrder.payer?.name
    ? `${paypalOrder.payer.name.given_name || ""} ${paypalOrder.payer.name.surname || ""}`.trim()
    : null;
  const buyerEmail = paypalOrder.payer?.email_address || null;

  const shipToJson = firstUnit?.shipping?.address
    ? JSON.stringify({
        recipient_name: firstUnit.shipping.name?.full_name || buyerName,
        line1: firstUnit.shipping.address.address_line_1,
        line2: firstUnit.shipping.address.address_line_2,
        city: firstUnit.shipping.address.admin_area_2,
        state: firstUnit.shipping.address.admin_area_1,
        postal_code: firstUnit.shipping.address.postal_code,
        country_code: firstUnit.shipping.address.country_code,
      })
    : null;

  const itemsJson = firstUnit?.items ? JSON.stringify(firstUnit.items) : null;

  // Check if order already exists in DB
  const existingOrders = await db
    .select()
    .from(orders)
    .where(
      firstUnit?.custom_id
        ? or(eq(orders.paypalOrderId, paypalOrder.id), eq(orders.id, firstUnit.custom_id))
        : eq(orders.paypalOrderId, paypalOrder.id)
    );

  const existing = existingOrders[0];
  const orderId = existing ? existing.id : (firstUnit?.custom_id || `O-${paypalOrder.id.slice(-6)}`);

  if (existing) {
    // Update existing order without overwriting custom fulfillment tracking if already set
    await db
      .update(orders)
      .set({
        paypalOrderId: paypalOrder.id,
        captureId: captureId || existing.captureId,
        buyerEmail: buyerEmail || existing.buyerEmail,
        buyerName: buyerName || existing.buyerName,
        shipToJson: shipToJson || existing.shipToJson,
        itemsJson: itemsJson || existing.itemsJson,
        amountMinor,
        currency,
        status: existing.status === "delivered" || existing.status === "shipped" ? existing.status : mappedStatus,
        updatedAt: now,
      })
      .where(eq(orders.id, existing.id));

    await logAudit({
      actor: "paypal",
      action: "ORDER_UPDATED_FROM_PAYPAL",
      detail: { orderId: existing.id, paypalOrderId: paypalOrder.id, status: mappedStatus },
    });
  } else {
    // Insert new order
    await db.insert(orders).values({
      id: orderId,
      paypalOrderId: paypalOrder.id,
      captureId,
      buyerEmail,
      buyerName,
      shipToJson,
      itemsJson,
      amountMinor,
      currency,
      status: mappedStatus,
      carrier: null,
      trackingNumber: null,
      shippedAt: null,
      deliveredAt: null,
      createdAt: paypalOrder.create_time || now,
      updatedAt: now,
    });

    await logAudit({
      actor: "paypal",
      action: "ORDER_INSERTED_FROM_PAYPAL",
      detail: { orderId, paypalOrderId: paypalOrder.id, amountMinor, status: mappedStatus },
    });
  }

  const result = (await db.select().from(orders).where(eq(orders.id, orderId)))[0];
  return result;
}

/**
 * Safely upsert a PayPal Dispute into the local PostgreSQL database.
 * Deduplicates by paypalDisputeId, links order by captureId, and registers facts.
 */
export async function syncPayPalDisputeToDb(dispute: PayPalDispute): Promise<Dispute> {
  const now = new Date().toISOString();
  const currency = dispute.dispute_amount?.currency_code || "USD";
  const amountMinor = toMinorUnits(dispute.dispute_amount?.value || "0", currency);

  // Identify capture ID from disputed transactions (strictly seller_transaction_id, no buyer_transaction_id)
  const firstTxn = dispute.disputed_transactions?.[0];
  const captureId = firstTxn?.seller_transaction_id || null;
  const customId = firstTxn?.custom || null;

  let auditAction = "";
  let auditDetail: Record<string, unknown> = {};

  const result = await db.transaction(async (tx) => {
    // Attempt to link to an existing order in database
    let linkedOrderId: string | null = null;
    if (customId) {
      const matchByCustom = (await tx.select().from(orders).where(eq(orders.id, customId)))[0];
      if (matchByCustom) linkedOrderId = matchByCustom.id;
    }
    if (!linkedOrderId && captureId) {
      const matchByCapture = (await tx.select().from(orders).where(eq(orders.captureId, captureId)))[0];
      if (matchByCapture) linkedOrderId = matchByCapture.id;
    }

    const existingDisputes = await tx
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, dispute.dispute_id));

    const existing = existingDisputes[0];

    if (existing) {
      // Update existing dispute without destroying case state if already drafted/approved
      let updatedCaseState = existing.caseState as CaseState;
      if (dispute.status === "RESOLVED" && existing.caseState !== "RESOLVED") {
        if (canTransition(existing.caseState as CaseState, "RESOLVED")) {
          updatedCaseState = transitionState(existing.caseState as CaseState, "RESOLVED");
        }
      }

      await tx
        .update(disputes)
        .set({
          captureId: captureId || existing.captureId,
          orderId: linkedOrderId || existing.orderId,
          reason: dispute.reason,
          paypalStatus: dispute.status,
          lifeCycleStage: dispute.dispute_life_cycle_stage || existing.lifeCycleStage,
          amountMinor,
          currency,
          sellerResponseDueAt: dispute.seller_response_due_date || existing.sellerResponseDueAt,
          caseState: updatedCaseState,
          rawJson: JSON.stringify(dispute),
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, dispute.dispute_id));

      auditAction = "DISPUTE_UPDATED_FROM_PAYPAL";
      auditDetail = { paypalStatus: dispute.status, caseState: updatedCaseState };
    } else {
      // Insert new dispute
      await tx.insert(disputes).values({
        paypalDisputeId: dispute.dispute_id,
        captureId,
        orderId: linkedOrderId,
        reason: dispute.reason,
        paypalStatus: dispute.status,
        lifeCycleStage: dispute.dispute_life_cycle_stage || "INQUIRY",
        amountMinor,
        currency,
        sellerResponseDueAt: dispute.seller_response_due_date || null,
        caseState: "NEW",
        rawJson: JSON.stringify(dispute),
        createdAt: dispute.create_time || now,
        updatedAt: now,
      });

      auditAction = "DISPUTE_INSERTED_FROM_PAYPAL";
      auditDetail = { reason: dispute.reason, amountMinor, status: dispute.status };
    }

    return (await tx.select().from(disputes).where(eq(disputes.paypalDisputeId, dispute.dispute_id)))[0];
  });

  // Rebuild the fact base from the stored dispute (including buyer messages) and linked order.
  await rebuildFacts(dispute.dispute_id);

  if (auditAction) {
    await logAudit({
      actor: "paypal",
      disputeId: dispute.dispute_id,
      action: auditAction,
      detail: auditDetail,
    });
  }

  return result;
}
