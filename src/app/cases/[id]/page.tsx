import { notFound } from "next/navigation";
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
import { CaseDetailView } from "@/components/case-detail-view";

export const dynamic = "force-dynamic";

interface CaseDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CaseDetailPage({ params }: CaseDetailPageProps) {
  const disputeRows = await db
    .select()
    .from(disputes)
    .where(eq(disputes.paypalDisputeId, params.id));

  if (!disputeRows.length) {
    notFound();
  }

  const dispute = disputeRows[0];

  const linkedOrder = dispute.orderId
    ? (await db.select().from(orders).where(eq(orders.id, dispute.orderId)))[0] || null
    : null;

  const caseFacts = await db
    .select()
    .from(facts)
    .where(eq(facts.disputeId, params.id));

  const analysisRows = await db
    .select()
    .from(analyses)
    .where(eq(analyses.disputeId, params.id))
    .orderBy(desc(analyses.createdAt));
  const analysis = analysisRows[0] || null;

  const draftRows = await db
    .select()
    .from(drafts)
    .where(eq(drafts.disputeId, params.id))
    .orderBy(desc(drafts.createdAt));
  const draft = draftRows[0] || null;

  const actionRows = await db
    .select()
    .from(actions)
    .where(eq(actions.disputeId, params.id))
    .orderBy(desc(actions.createdAt));

  const auditRows = await db
    .select()
    .from(auditLog)
    .where(eq(auditLog.disputeId, params.id))
    .orderBy(desc(auditLog.ts));

  return (
    <CaseDetailView
      // Remount after router.refresh() so local state (case state, edit mode) follows the new data.
      key={`${dispute.caseState}-${analysis?.id ?? "none"}-${draft?.id ?? "none"}`}
      dispute={dispute}
      order={linkedOrder}
      facts={caseFacts}
      analysis={analysis}
      draft={draft}
      actions={actionRows}
      auditLog={auditRows}
    />
  );
}
