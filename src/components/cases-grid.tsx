"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ColDef,
  ICellRendererParams,
  GridApi,
  GridReadyEvent,
  RowClassRules,
  RowClickedEvent,
  themeQuartz,
} from "ag-grid-community";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { getDeadlineStatus, Urgency } from "@/lib/deadline";
import { cn } from "@/lib/utils";

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

const gridModules = [AllCommunityModule];

// Map the grid onto the app's design tokens instead of AG Grid's default blue.
const gridTheme = themeQuartz.withParams({
  fontFamily: "inherit",
  accentColor: "hsl(var(--primary))",
  foregroundColor: "hsl(var(--foreground))",
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  headerBackgroundColor: "hsl(var(--muted))",
  headerTextColor: "hsl(var(--muted-foreground))",
  headerFontWeight: 600,
  rowHoverColor: "hsl(var(--accent))",
  wrapperBorderRadius: 8,
});

const TICK_MS = 30_000;

/** Current time that re-renders the caller every TICK_MS, so countdowns stay live. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

const urgencyStyles: Record<Urgency, string> = {
  expired: "bg-destructive/10 text-destructive border-destructive/30",
  critical: "bg-red-50 text-red-700 border-red-200",
  urgent: "bg-amber-50 text-amber-800 border-amber-200",
  normal: "text-muted-foreground border-transparent",
};

function DeadlineCell({ value }: ICellRendererParams<CaseRow, string | null>) {
  const now = useNow();
  if (!value) return <span className="text-muted-foreground">—</span>;

  const status = getDeadlineStatus(value, now);
  return (
    <span
      className={cn("rounded border px-2 py-0.5 text-xs font-semibold", urgencyStyles[status.urgency])}
      title={new Date(value).toUTCString()}
    >
      {status.urgency === "urgent" || status.urgency === "critical" ? `Urgent · ${status.label}` : status.label}
    </span>
  );
}

const rowClassRules: RowClassRules<CaseRow> = {
  "row-urgency-expired": (p) =>
    !!p.data?.sellerResponseDueAt && getDeadlineStatus(p.data.sellerResponseDueAt).urgency === "expired",
  "row-urgency-critical": (p) =>
    !!p.data?.sellerResponseDueAt && getDeadlineStatus(p.data.sellerResponseDueAt).urgency === "critical",
  "row-urgency-urgent": (p) =>
    !!p.data?.sellerResponseDueAt && getDeadlineStatus(p.data.sellerResponseDueAt).urgency === "urgent",
};

interface CasesGridProps {
  rowData: CaseRow[];
}

export function CasesGrid({ rowData }: CasesGridProps) {
  const router = useRouter();
  const gridApiRef = useRef<GridApi<CaseRow> | null>(null);

  const onGridReady = useCallback((event: GridReadyEvent<CaseRow>) => {
    gridApiRef.current = event.api;
  }, []);

  // Row highlight classes depend on the clock, so re-evaluate them on the same tick as the countdown.
  useEffect(() => {
    const id = setInterval(() => gridApiRef.current?.redrawRows(), TICK_MS);
    return () => clearInterval(id);
  }, []);

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
        sort: "asc",
        width: 190,
        // ISO strings sort chronologically; cases without a deadline go last.
        comparator: (a: string | null, b: string | null) => {
          if (a === b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return a < b ? -1 : 1;
        },
        cellRenderer: DeadlineCell,
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
    <AgGridProvider modules={gridModules}>
      <div className="w-full h-[520px]">
        <AgGridReact<CaseRow>
          theme={gridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          rowClassRules={rowClassRules}
          onGridReady={onGridReady}
          onRowClicked={onRowClicked}
        />
      </div>
    </AgGridProvider>
  );
}
