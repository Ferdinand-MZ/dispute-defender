import { db } from "@/lib/db";
import { disputes, analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { CasesGrid, CaseRow } from "@/components/cases-grid";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const casesData = await db
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            Merchant Dispute Queue
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Most urgent deadlines first. Open a case to review its facts, recommendation, and evidence draft.
          </p>
        </div>
      </div>

      {/* Grid Container */}
      <CasesGrid rowData={casesData as CaseRow[]} />

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>Displaying {casesData.length} disputes from SQLite fact base</span>
        <span className="flex items-center gap-1.5 font-mono text-[11px]">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          Realtime Webhook Intake Ready
        </span>
      </div>
    </div>
  );
}
