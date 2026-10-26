import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const disputeList = await db
      .select({
        paypalDisputeId: disputes.paypalDisputeId,
        orderId: disputes.orderId,
        reason: disputes.reason,
        amountMinor: disputes.amountMinor,
        currency: disputes.currency,
        paypalStatus: disputes.paypalStatus,
        caseState: disputes.caseState,
        sellerResponseDueAt: disputes.sellerResponseDueAt,
        createdAt: disputes.createdAt,
        recommendation: analyses.recommendation,
        strengthScore: analyses.strengthScore,
        pWinBand: analyses.pWinBand,
      })
      .from(disputes)
      .leftJoin(analyses, eq(disputes.paypalDisputeId, analyses.disputeId))
      .orderBy(desc(disputes.createdAt));

    return NextResponse.json({ cases: disputeList });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 }
    );
  }
}
