import { listCaseRows } from "@/lib/db/queries";
import { CasesGrid, CaseRow } from "@/components/cases-grid";
import { Inbox } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function CasesPage() {
  const casesData = await listCaseRows();

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
      <div className="text-xs text-muted-foreground px-1">
        {casesData.length} {casesData.length === 1 ? "dispute" : "disputes"}
      </div>
    </div>
  );
}
