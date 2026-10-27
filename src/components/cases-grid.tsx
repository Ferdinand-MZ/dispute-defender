"use client";

import { useMemo, useCallback, useEffect, useRef, useState } from "react";
import { AgGridProvider, AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  CellKeyDownEvent,
  ColDef,
  FullWidthCellKeyDownEvent,
  ICellRendererParams,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  RowClassRules,
  RowClickedEvent,
  themeQuartz,
} from "ag-grid-community";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download, Inbox, Search } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
const REFRESH_MS = 15_000;

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

  // Re-fetch the server component so disputes created by the webhook show up without a manual reload (US1).
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
      setLastRefreshed(new Date());
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router]);

  // Flash rows that were not in the previous render, so a new dispute is easy to spot.
  const seenIdsRef = useRef<Set<string> | null>(null);
  useEffect(() => {
    const ids = new Set(rowData.map((row) => row.paypalDisputeId));
    const previous = seenIdsRef.current;
    seenIdsRef.current = ids;
    const api = gridApiRef.current;
    if (!previous || !api) return;

    const rowNodes = rowData
      .filter((row) => !previous.has(row.paypalDisputeId))
      .map((row) => api.getRowNode(row.paypalDisputeId))
      .filter((node) => node !== undefined);
    if (rowNodes.length > 0) {
      api.flashCells({ rowNodes, flashDuration: 2000, fadeDuration: 1000 });
    }
  }, [rowData]);

  const getRowId = useCallback((params: GetRowIdParams<CaseRow>) => params.data.paypalDisputeId, []);

  const [quickFilter, setQuickFilter] = useState("");

  const openCase = useCallback(
    (disputeId: string | undefined) => {
      if (disputeId) router.push(`/cases/${disputeId}`);
    },
    [router]
  );

  const onRowClicked = useCallback(
    (event: RowClickedEvent<CaseRow>) => {
      // The ID cell is a real link; let it handle its own click (incl. middle-click / new tab).
      if ((event.event?.target as HTMLElement | null)?.closest("a")) return;
      openCase(event.data?.paypalDisputeId);
    },
    [openCase]
  );

  const onCellKeyDown = useCallback(
    (event: CellKeyDownEvent<CaseRow> | FullWidthCellKeyDownEvent<CaseRow>) => {
      if ((event.event as KeyboardEvent | null)?.key === "Enter") {
        openCase(event.data?.paypalDisputeId);
      }
    },
    [openCase]
  );

  const exportCsv = useCallback(() => {
    gridApiRef.current?.exportDataAsCsv({ fileName: "dispute-queue.csv" });
  }, []);

  const columnDefs = useMemo<ColDef<CaseRow>[]>(() => {
    return [
      {
        headerName: "Dispute ID",
        field: "paypalDisputeId",
        filter: "agTextColumnFilter",
        sortable: true,
        width: 170,
        pinned: "left",
        cellRenderer: (params: ICellRendererParams<CaseRow>) => {
          return (
            <Link
              href={`/cases/${params.value}`}
              className="font-mono text-primary font-medium hover:underline"
              tabIndex={-1}
            >
              {params.value}
            </Link>
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

  if (rowData.length === 0) {
    return (
      <div className="flex h-[320px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-card text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">No disputes yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          New PayPal disputes appear here when the dispute webhook arrives. In the sandbox, open a dispute from
          the buyer account to see one.
        </p>
      </div>
    );
  }

  return (
    <AgGridProvider modules={gridModules}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search cases</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="search"
            value={quickFilter}
            onChange={(e) => setQuickFilter(e.target.value)}
            placeholder="Search ID, reason, state…"
            className="h-9 w-full rounded-md border border-input bg-card pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" aria-live="polite">
            Auto-refresh every {REFRESH_MS / 1000}s
            {lastRefreshed ? ` · updated ${lastRefreshed.toLocaleTimeString()}` : ""}
          </span>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Export CSV
          </Button>
        </div>
      </div>
      <div className="w-full h-[520px]">
        <AgGridReact<CaseRow>
          theme={gridTheme}
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          animateRows={true}
          rowClassRules={rowClassRules}
          getRowId={getRowId}
          quickFilterText={quickFilter}
          onGridReady={onGridReady}
          onRowClicked={onRowClicked}
          onCellKeyDown={onCellKeyDown}
        />
      </div>
    </AgGridProvider>
  );
}
