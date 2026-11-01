import { listCaseRows } from "@/lib/db/queries";
import { CasesGrid, CaseRow } from "@/components/cases-grid";
import { PageHeader } from "@/components/case-status";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const casesData = await listCaseRows();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispute queue"
        description="Nearest deadline first. Open a dispute to see the recommendation, the cited evidence draft, and your options."
      />
      <CasesGrid rowData={casesData as CaseRow[]} />
    </div>
  );
}
