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
  RowClickedEvent,
  themeQuartz,
} from "ag-grid-community";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Download, Inbox, Search } from "lucide-react";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { CaseStateBadge, DeadlinePill, RecommendationBadge } from "@/components/case-status";
import { getDeadlineStatus } from "@/lib/deadline";
import { caseStateMeta, isClosed, nextStep, reasonLabel } from "@/lib/case-labels";
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
  fontSize: 14,
  accentColor: "hsl(var(--primary))",
  foregroundColor: "hsl(var(--foreground))",
  textColor: "hsl(var(--foreground))",
  backgroundColor: "hsl(var(--card))",
  borderColor: "hsl(var(--border))",
  headerBackgroundColor: "hsl(var(--muted))",
  headerTextColor: "hsl(var(--muted-foreground))",
  headerFontWeight: 600,
  headerFontSize: 13,
  rowHoverColor: "hsl(var(--accent))",
  selectedRowBackgroundColor: "hsl(var(--accent))",
  wrapperBorderRadius: 12,
  rowHeight: 60,
  headerHeight: 44,
  cellHorizontalPadding: 16,
  columnBorder: false,
  wrapperBorder: true,
  rowBorder: true,
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

function DeadlineCell({ value }: ICellRendererParams<CaseRow, string | null>) {
  const now = useNow();
  return (
    <div className="flex h-full items-center">
      <DeadlinePill dueAt={value ?? null} now={now} />
    </div>
  );
}

function isActionable(row: CaseRow | undefined): boolean {
  return !!row && nextStep(row.caseState, row.recommendation).actionable;
}

type FilterKey = "action" | "due" | "prep" | "paypal" | "closed" | "all";

function isDueSoon(row: CaseRow): boolean {
  if (!row.sellerResponseDueAt || isClosed(row.caseState)) return false;
  const urgency = getDeadlineStatus(row.sellerResponseDueAt).urgency;
  return urgency === "urgent" || urgency === "critical";
}

const FILTERS: Array<{ key: FilterKey; label: string; match: (row: CaseRow) => boolean }> = [
  { key: "action", label: "Needs action", match: (r) => isActionable(r) },
  { key: "due", label: "Due in 48h", match: isDueSoon },
  { key: "prep", label: "Being prepared", match: (r) => !isClosed(r.caseState) && r.caseState !== "SUBMITTED" && !isActionable(r) },
  { key: "paypal", label: "With PayPal", match: (r) => r.caseState === "SUBMITTED" },
  { key: "closed", label: "Closed", match: (r) => isClosed(r.caseState) },
  { key: "all", label: "All", match: () => true },
];

function matchesSearch(row: CaseRow, query: string): boolean {
  if (!query) return true;
  const haystack = [
    row.paypalDisputeId,
    row.orderId ?? "",
    reasonLabel(row.reason),
    caseStateMeta(row.caseState).label,
    row.recommendation ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query.toLowerCase());
}

interface CasesGridProps {
  rowData: CaseRow[];
}

export function CasesGrid({ rowData }: CasesGridProps) {
  const router = useRouter();
  const now = useNow();
  const gridApiRef = useRef<GridApi<CaseRow> | null>(null);

  const onGridReady = useCallback((event: GridReadyEvent<CaseRow>) => {
    gridApiRef.current = event.api;
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

  const [search, setSearch] = useState("");
  // Start on the work that needs the merchant; fall back to everything when that view is empty.
  const [filter, setFilter] = useState<FilterKey>(() => (rowData.some(FILTERS[0].match) ? "action" : "all"));

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, rowData.filter(f.match).length])) as Record<FilterKey, number>,
    [rowData]
  );

  const visibleRows = useMemo(() => {
    const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
    // Nearest deadline first (the grid sorts itself the same way; the phone cards rely on this order).
    return rowData
      .filter((row) => active.match(row) && matchesSearch(row, search.trim()))
      .sort((a, b) => (a.sellerResponseDueAt ?? "9999").localeCompare(b.sellerResponseDueAt ?? "9999"));
  }, [rowData, filter, search]);

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
        headerName: "Dispute",
        field: "paypalDisputeId",
        sortable: true,
        flex: 1.3,
        minWidth: 180,
        pinned: "left",
        // Search and export see the plain-language reason too.
        getQuickFilterText: (params) => `${params.data?.paypalDisputeId} ${reasonLabel(params.data?.reason ?? "")}`,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => (
          <div className="flex h-full flex-col justify-center leading-tight">
            <Link
              href={`/cases/${params.value}`}
              className="font-medium text-foreground hover:text-primary hover:underline"
              tabIndex={-1}
            >
              {reasonLabel(params.data?.reason ?? "")}
            </Link>
            <span className="mt-1 font-mono text-xs text-muted-foreground">{params.value}</span>
          </div>
        ),
      },
      {
        headerName: "Amount",
        field: "amountMinor",
        sortable: true,
        width: 105,
        type: "rightAligned",
        // Keep AG Grid's right-aligned class so values sit under the right-aligned header.
        cellClass: "ag-right-aligned-cell tabular-nums font-semibold",
        valueFormatter: (params) => formatMoney(params.value || 0, params.data?.currency || "USD"),
      },
      {
        headerName: "Respond by",
        field: "sellerResponseDueAt",
        sortable: true,
        sort: "asc",
        width: 185,
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
        headerName: "Status",
        field: "caseState",
        sortable: true,
        width: 145,
        valueFormatter: (params) => caseStateMeta(params.value ?? "").label,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => (
          <div className="flex h-full items-center">
            <CaseStateBadge state={params.value} />
          </div>
        ),
      },
      {
        headerName: "Recommendation",
        field: "recommendation",
        sortable: true,
        width: 135,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => (
          <div className="flex h-full items-center">
            <RecommendationBadge recommendation={params.value} />
          </div>
        ),
      },
      {
        headerName: "Next step",
        colId: "nextStep",
        flex: 1,
        minWidth: 200,
        valueGetter: (params) => nextStep(params.data?.caseState ?? "", params.data?.recommendation ?? null).label,
        cellRenderer: (params: ICellRendererParams<CaseRow>) => (
          <div
            className={cn(
              "flex h-full items-center justify-between gap-2",
              isActionable(params.data) ? "font-semibold text-foreground" : "text-muted-foreground"
            )}
          >
            <span className="truncate" title={params.value}>
              {params.value}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          </div>
        ),
      },
    ];
  }, []);

  const defaultColDef = useMemo<ColDef>(() => {
    return {
      resizable: true,
      suppressMovable: true,
    };
  }, []);

  if (rowData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card px-6 py-16 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-medium text-foreground">No disputes yet</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          PayPal disputes appear here as soon as the webhook arrives. To try the flow, open one in the{" "}
          <Link href="/admin/simulate" className="font-medium text-primary hover:underline">
            Simulator
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <AgGridProvider modules={gridModules}>
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <div
            role="tablist"
            aria-label="Filter disputes"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
          >
            {FILTERS.map((f) => {
              const selected = filter === f.key;
              return (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors duration-150",
                    selected
                      ? "border-navy bg-navy text-white"
                      : "border-border bg-card text-foreground hover:border-foreground/30"
                  )}
                >
                  {f.label}
                  <span
                    className={cn(
                      "rounded-full px-1.5 text-xs tabular-nums",
                      selected ? "bg-white/15 text-white" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {counts[f.key]}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <label className="relative flex-1 sm:max-w-sm">
              <span className="sr-only">Search disputes</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search ID, order, reason"
                className="h-10 w-full rounded-full border border-input bg-card pl-9 pr-4 text-base placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm"
              />
            </label>
            <Button variant="outline" className="hidden xl:inline-flex" onClick={exportCsv}>
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </Button>
          </div>
        </div>

        {visibleRows.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
            <p className="font-medium text-foreground">No disputes match</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {search ? "Try a different search, or " : "Nothing in this view. "}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => { setFilter("all"); setSearch(""); }}>
                show all disputes
              </button>
              .
            </p>
          </div>
        ) : (
          <>
            {/* Desktop: AG Grid */}
            <div className="queue-grid hidden xl:block">
              <AgGridReact<CaseRow>
                theme={gridTheme}
                rowData={visibleRows}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                domLayout="autoHeight"
                animateRows={true}
                getRowId={getRowId}
                onGridReady={onGridReady}
                onRowClicked={onRowClicked}
                onCellKeyDown={onCellKeyDown}
                rowClass="cursor-pointer"
              />
            </div>

            {/* Phone and tablet: one card per dispute */}
            <ul className="grid gap-3 md:grid-cols-2 xl:hidden">
              {visibleRows.map((row) => (
                <li key={row.paypalDisputeId}>
                  <Link
                    href={`/cases/${row.paypalDisputeId}`}
                    className="flex h-full flex-col rounded-xl border bg-card p-4 transition-colors hover:border-foreground/30 active:bg-accent"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-foreground">{reasonLabel(row.reason)}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{row.paypalDisputeId}</p>
                      </div>
                      <p className="font-semibold tabular-nums text-foreground">
                        {formatMoney(row.amountMinor, row.currency)}
                      </p>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <DeadlinePill dueAt={row.sellerResponseDueAt} now={now} />
                      <CaseStateBadge state={row.caseState} />
                      <RecommendationBadge recommendation={row.recommendation} />
                    </div>
                    <p
                      className={cn(
                        "mt-auto flex items-center justify-between border-t pt-3 text-sm",
                        isActionable(row) ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {nextStep(row.caseState, row.recommendation).label}
                      <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}

        <p className="text-xs text-muted-foreground" aria-live="polite">
          Showing {visibleRows.length} of {rowData.length} · refreshes every {REFRESH_MS / 1000}s
          {lastRefreshed ? ` · last update ${lastRefreshed.toLocaleTimeString()}` : ""}
        </p>
      </div>
    </AgGridProvider>
  );
}
