import { describe, it, expect, beforeEach } from "vitest";
import { syncPayPalOrderToDb, syncPayPalDisputeToDb } from "./sync";
import { db } from "../db";
import { orders, disputes, facts } from "../db/schema";
import { eq } from "drizzle-orm";
import { PayPalOrder, PayPalDispute } from "./types";

describe("PayPal SQLite Normalization & Persistence Sync", () => {
  const mockOrderPayload: PayPalOrder = {
    id: "5EA-TEST-SYNC-01",
    status: "COMPLETED",
    intent: "CAPTURE",
    create_time: "2026-10-25T12:00:00Z",
    purchase_units: [
      {
        custom_id: "O-SYNC-101",
        amount: {
          currency_code: "USD",
          value: "48.00",
        },
        shipping: {
          name: { full_name: "Sarah Jenkins" },
          address: {
            address_line_1: "742 Evergreen Terrace",
            admin_area_2: "Austin",
            admin_area_1: "TX",
            postal_code: "78701",
            country_code: "US",
          },
        },
        payments: {
          captures: [
            {
              id: "CAP-SYNC-999",
              status: "COMPLETED",
              amount: { currency_code: "USD", value: "48.00" },
            },
          ],
        },
      },
    ],
    payer: {
      name: { given_name: "Sarah", surname: "Jenkins" },
      email_address: "sarah.buyer@example.com",
    },
  };

  const mockDisputePayload: PayPalDispute = {
    dispute_id: "PP-D-SYNC-001",
    reason: "MERCHANDISE_OR_SERVICE_NOT_RECEIVED",
    status: "WAITING_FOR_SELLER_RESPONSE",
    dispute_amount: { currency_code: "USD", value: "48.00" },
    dispute_life_cycle_stage: "CHARGEBACK",
    seller_response_due_date: "2026-10-29T12:00:00Z",
    disputed_transactions: [
      {
        seller_transaction_id: "CAP-SYNC-999",
        custom: "O-SYNC-101",
      },
    ],
    messages: [
      {
        posted_by: "BUYER",
        time_posted: "2026-10-25T14:00:00Z",
        content: "Where is my parcel? I have not received it.",
      },
    ],
    evidences: [],
  };

  beforeEach(async () => {
    // Clean test records before each run
    await db.delete(facts).where(eq(facts.disputeId, "PP-D-SYNC-001"));
    await db.delete(disputes).where(eq(disputes.paypalDisputeId, "PP-D-SYNC-001"));
    await db.delete(orders).where(eq(orders.id, "O-SYNC-101"));
  });

  it("normalizes PayPal Order into orders table in integer minor units", async () => {
    const synced = await syncPayPalOrderToDb(mockOrderPayload);
    expect(synced.id).toBe("O-SYNC-101");
    expect(synced.paypalOrderId).toBe("5EA-TEST-SYNC-01");
    expect(synced.amountMinor).toBe(4800);
    expect(synced.captureId).toBe("CAP-SYNC-999");
    expect(synced.buyerName).toBe("Sarah Jenkins");
    expect(synced.status).toBe("paid");

    // Repeated sync must update existing record without duplicating
    await syncPayPalOrderToDb(mockOrderPayload);
    const orderRows = await db
      .select()
      .from(orders)
      .where(eq(orders.id, "O-SYNC-101"));
    expect(orderRows).toHaveLength(1);
  });

  it("normalizes PayPal Dispute into disputes table, links order, and quarantines buyer message", async () => {
    // 1. Sync order first
    await syncPayPalOrderToDb(mockOrderPayload);

    // 2. Sync dispute
    const syncedDispute = await syncPayPalDisputeToDb(mockDisputePayload);
    expect(syncedDispute.paypalDisputeId).toBe("PP-D-SYNC-001");
    expect(syncedDispute.orderId).toBe("O-SYNC-101");
    expect(syncedDispute.amountMinor).toBe(4800);
    expect(syncedDispute.caseState).toBe("NEW");

    // Check facts table
    const disputeFacts = await db
      .select()
      .from(facts)
      .where(eq(facts.disputeId, "PP-D-SYNC-001"));

    expect(disputeFacts.length).toBeGreaterThanOrEqual(2);

    // Buyer message fact must be untrusted=1
    const buyerMsgFact = disputeFacts.find((f) => f.kind === "dispute_msg" && f.label.includes("BUYER"));
    expect(buyerMsgFact).toBeDefined();
    expect(buyerMsgFact?.untrusted).toBe(1);

    // Repeated sync must not duplicate dispute or facts
    await syncPayPalDisputeToDb(mockDisputePayload);
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, "PP-D-SYNC-001"));
    expect(disputeRows).toHaveLength(1);
  });
});
