"use client";

import { useMemo, useCallback } from "react";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams, RowClickedEvent } from "ag-grid-community";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";

export interface CaseRow {
  paypalDisputeId: string;
  orderId: string | null;
  reason: string;
  amountMinor: number;
  currency: string;
  paypalStatus: string;
  caseState: string;
  sellerResponseDueAt: string | null;
  createdAt: string;
  recommendation: string | null;
  strengthScore: number | null;
  pWinBand: string | null;
}

interface CasesGridProps {
  rowData: CaseRow[];
}

export function CasesGrid({ rowData }: CasesGridProps) {
  const router = useRouter();

  const onRowClicked = useCallback(
    (event: RowClickedEvent<CaseRow>) => {
      if (event.data?.paypalDisputeId) {
        router.push(`/cases/${event.data.paypalDisputeId}`);
      }
    },
    [router]
  );

  const columnDefs = useMemo<ColDef<CaseRow>[]>(() => {
    return [
      {
        headerName: "Dispute ID",
        field: "paypalDisputeId",
        filter: "agTextColumnFilter",
        sortable: true,
        width: 170,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => {
          return (
            <span className="font-mono text-primary font-medium cursor-pointer hover:underline">
              {params.value}
            </span>
          );
        },
      },
      {
        headerName: "Dispute Reason",
        field: "reason",
        filter: "agTextColumnFilter",
        sortable: true,
        flex: 1,
        minWidth: 220,
        valueFormatter: (params) => {
          return String(params.value || "").replace(/MERCHANDISE_OR_SERVICE_/g, "");
        },
      },
      {
        headerName: "Amount",
        field: "amountMinor",
        filter: "agNumberColumnFilter",
        sortable: true,
        width: 120,
        valueFormatter: (params) => {
          return formatMoney(params.value || 0, params.data?.currency || "USD");
        },
      },
      {
        headerName: "Case State",
        field: "caseState",
        filter: "agTextColumnFilter",
        sortable: true,
        width: 140,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => {
          const state = params.value;
          let variant: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" = "outline";

          if (state === "DRAFTED") variant = "secondary";
          if (state === "APPROVED") variant = "success";
          if (state === "SUBMITTED") variant = "default";
          if (state === "RESOLVED") variant = "success";
          if (state === "NEEDS_ATTENTION") variant = "destructive";

          return (
            <div className="flex items-center h-full">
              <Badge variant={variant} className="text-[10px] font-mono uppercase">
                {state}
              </Badge>
            </div>
          );
        },
      },
      {
        headerName: "Response Deadline",
        field: "sellerResponseDueAt",
        sortable: true,
        width: 170,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => {
          if (!params.value) return <span className="text-muted-foreground">—</span>;

          const due = new Date(params.value).getTime();
          const now = Date.now();
          const diffHours = Math.round((due - now) / (1000 * 60 * 60));

          if (diffHours < 0) {
            return <span className="text-destructive font-semibold text-xs">EXPIRED</span>;
          }

          if (diffHours <= 48) {
            return (
              <span className="text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs font-semibold">
                ⚠️ {diffHours}h remaining
              </span>
            );
          }

          const diffDays = Math.round(diffHours / 24);
          return <span className="text-muted-foreground text-xs">{diffDays} days remaining</span>;
        },
      },
      {
        headerName: "AI Recommendation",
        field: "recommendation",
        sortable: true,
        width: 160,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => {
          const rec = params.value;
          if (!rec) {
            return <span className="text-muted-foreground text-xs italic">Pending</span>;
          }

          if (rec === "FIGHT") {
            return (
              <div className="flex items-center gap-1.5 h-full">
                <Badge variant="success" className="text-[10px] font-bold">FIGHT</Badge>
                {params.data?.strengthScore !== null && (
                  <span className="text-[11px] text-muted-foreground">({params.data?.strengthScore}%)</span>
                )}
              </div>
            );
          }

          if (rec === "REFUND") {
            return (
              <div className="flex items-center gap-1.5 h-full">
                <Badge variant="warning" className="text-[10px] font-bold">REFUND</Badge>
              </div>
            );
          }

          return (
            <div className="flex items-center gap-1.5 h-full">
              <Badge variant="destructive" className="text-[10px] font-bold">ACCEPT</Badge>
            </div>
          );
        },
      },
    ];
  }, []);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      resizable: true,
    };
  }, []);

  return (
    <div className="ag-theme-quartz w-full h-[520px] rounded-lg border border-border shadow-xs overflow-hidden">
      <AgGridReact<CaseRow>
        rowData={rowData}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        rowSelection="single"
        animateRows={true}
        onRowClicked={onRowClicked}
      />
    </div>
  );
}
