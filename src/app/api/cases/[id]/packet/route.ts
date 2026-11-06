import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, drafts, orders, facts } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { generateEvidencePacketPdf } from "@/lib/evidence/packet-pdf";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
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

    const draftRows = await db
      .select()
      .from(drafts)
      .where(eq(drafts.disputeId, disputeId))
      .orderBy(desc(drafts.createdAt));

    if (!draftRows.length) {
      return NextResponse.json({ error: "No evidence draft available for this dispute" }, { status: 404 });
    }

    const draft = draftRows[0];

    const linkedOrder = dispute.orderId
      ? (await db.select().from(orders).where(eq(orders.id, dispute.orderId)))[0] || null
      : null;

    const caseFacts = await db
      .select()
      .from(facts)
      .where(eq(facts.disputeId, disputeId));

    const packet = await generateEvidencePacketPdf({
      dispute,
      order: linkedOrder,
      facts: caseFacts,
      draft,
      approvedBy: draft.author || "Merchant Preview",
    });

    return new NextResponse(Buffer.from(packet.buffer), {
      status: 200,
      headers: {
        "Content-Type": packet.mimeType,
        "Content-Disposition": `inline; filename="${packet.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Could not generate evidence packet PDF" },
      { status: 500 }
    );
  }
}
