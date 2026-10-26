import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  disputes,
  orders,
  facts,
  analyses,
  drafts,
  actions,
  auditLog,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];

    // Linked Order
    const linkedOrder = dispute.orderId
      ? (await db.select().from(orders).where(eq(orders.id, dispute.orderId)))[0] || null
      : null;

    // Associated Facts
    const caseFacts = await db
      .select()
      .from(facts)
      .where(eq(facts.disputeId, disputeId));

    // Analysis
    const analysisRows = await db
      .select()
      .from(analyses)
      .where(eq(analyses.disputeId, disputeId))
      .orderBy(desc(analyses.createdAt));
    const analysis = analysisRows[0] || null;

    // Draft
    const draftRows = await db
      .select()
      .from(drafts)
      .where(eq(drafts.disputeId, disputeId))
      .orderBy(desc(drafts.createdAt));
    const draft = draftRows[0] || null;

    // Actions
    const actionRows = await db
      .select()
      .from(actions)
      .where(eq(actions.disputeId, disputeId))
      .orderBy(desc(actions.createdAt));

    // Audit Log
    const auditRows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.disputeId, disputeId))
      .orderBy(desc(auditLog.ts));

    return NextResponse.json({
      dispute,
      order: linkedOrder,
      facts: caseFacts,
      analysis,
      draft,
      actions: actionRows,
      auditLog: auditRows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
