import { desc, eq, sql } from "drizzle-orm";
import { db } from "./index";
import { analyses, disputes } from "./schema";

/** Queue rows: one per dispute, joined to its most recent analysis only. */
export async function listCaseRows() {
  const latestAnalysisId = sql`(
    select la.id from analyses la
    where la.dispute_id = ${disputes.paypalDisputeId}
    order by la.created_at desc, la.id desc
    limit 1
  )`;

  return db
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
    .leftJoin(analyses, eq(analyses.id, latestAnalysisId))
    .orderBy(desc(disputes.createdAt));
}
