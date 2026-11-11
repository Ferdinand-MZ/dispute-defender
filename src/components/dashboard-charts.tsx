"use client";

import { useEffect, useMemo, useState } from "react";
import { AgCharts } from "ag-charts-react";
import { AllCommunityModule, ModuleRegistry } from "ag-charts-community";
import type { AgBarSeriesTooltipRendererParams, AgChartOptions, AgChartTheme } from "ag-charts-community";
import { formatMoney } from "@/lib/money";
import { caseStateMeta } from "@/lib/case-labels";

// AG Charts v13+ is modular: series types must be registered before first render.
ModuleRegistry.registerModules([AllCommunityModule]);

export interface DashboardCaseItem {
  paypalDisputeId: string;
  amountMinor: number;
  currency: string;
  caseState: string;
  paypalStatus: string;
}

const NAVY = "#001c64";
const BLUE = "#0070e0";
const INK = "#0b1d3f";
const MUTED = "#55657f";
const GRID = "#e3e8ef";

function buildTheme(fontFamily: string): AgChartTheme {
  return {
    baseTheme: "ag-default",
    params: {
      fontFamily,
      fontSize: 13,
      textColor: INK,
      subtleTextColor: MUTED,
      backgroundColor: "transparent",
    },
    overrides: {
      common: {
        axes: {
          number: { gridLine: { style: [{ stroke: GRID, lineDash: [] }] }, label: { color: MUTED } },
          category: { label: { color: INK }, line: { stroke: GRID } },
        },
      },
    },
  };
}

// The chart canvas defaults to its own height; pin it to the figure so the axis stays inside the card.
const CHART_STYLE = { width: "100%", height: "100%" } as const;

const OPEN_STATES = ["NEW", "ANALYZED", "DRAFTED", "APPROVED", "SUBMITTED"];

interface BarDatum {
  label: string;
  value: number;
}

// Outcome buckets with fixed colours so the same outcome reads the same everywhere.
const OUTCOMES: Array<{ label: string; states: string[]; fill: string }> = [
  { label: "Open", states: ["NEW", "ANALYZED", "DRAFTED", "APPROVED", "NEEDS_ATTENTION"], fill: BLUE },
  { label: "With PayPal", states: ["SUBMITTED"], fill: "#7aa7e6" },
  { label: "Resolved", states: ["RESOLVED"], fill: "#0f7a4c" },
  { label: "Refunded", states: ["REFUNDED"], fill: "#b86e00" },
  { label: "Claim accepted", states: ["ACCEPTED"], fill: NAVY },
  { label: "Expired", states: ["EXPIRED"], fill: "#c0392b" },
];

export function DashboardCharts({ cases }: { cases: DashboardCaseItem[] }) {
  const currency = cases[0]?.currency ?? "USD";

  // Canvas text cannot resolve CSS variables, so read the loaded font family from the page.
  const [fontFamily, setFontFamily] = useState("ui-sans-serif, system-ui, sans-serif");
  useEffect(() => setFontFamily(getComputedStyle(document.body).fontFamily), []);
  const chartTheme = useMemo(() => buildTheme(fontFamily), [fontFamily]);

  const onHoldOptions = useMemo<AgChartOptions>(() => {
    // Sum in integer minor units; only the axis and tooltip format them as money.
    const totals = new Map<string, number>(OPEN_STATES.map((s) => [s, 0]));
    for (const c of cases) {
      if (totals.has(c.caseState)) totals.set(c.caseState, (totals.get(c.caseState) ?? 0) + c.amountMinor);
    }
    const data: BarDatum[] = OPEN_STATES.map((state) => ({
      label: caseStateMeta(state).label,
      value: totals.get(state) ?? 0,
    }));

    return {
      theme: chartTheme,
      data,
      series: [
        {
          type: "bar" as const,
          direction: "horizontal" as const,
          xKey: "label",
          yKey: "value",
          yName: "On hold",
          fill: BLUE,
          cornerRadius: 4,
          tooltip: {
            renderer: ({ datum }: AgBarSeriesTooltipRendererParams<BarDatum>) => ({
              heading: datum.label,
              data: [{ label: "On hold", value: formatMoney(datum.value, currency) }],
            }),
          },
        },
      ],
      axes: {
        x: { type: "category" as const, position: "left" as const },
        y: {
          type: "number" as const,
          position: "bottom" as const,
          label: { formatter: ({ value }) => formatMoney(Math.round(Number(value)), currency).replace(/\.00$/, "") },
        },
      },
    };
  }, [cases, currency, chartTheme]);

  // With a single outcome the chart repeats the summary sentence, so it is left out.
  const outcomeCount = OUTCOMES.filter((o) => cases.some((c) => o.states.includes(c.caseState))).length;
  const showOutcomes = outcomeCount > 1;

  const outcomesOptions = useMemo<AgChartOptions>(() => {
    const data = OUTCOMES.map((o) => ({
      label: o.label,
      value: cases.filter((c) => o.states.includes(c.caseState)).length,
      fill: o.fill,
    }));

    return {
      theme: chartTheme,
      data,
      series: [
        {
          type: "bar" as const,
          direction: "horizontal" as const,
          xKey: "label",
          yKey: "value",
          yName: "Disputes",
          cornerRadius: 4,
          itemStyler: ({ datum }: { datum: { fill: string } }) => ({ fill: datum.fill }),
        },
      ],
      axes: {
        x: { type: "category" as const, position: "left" as const },
        y: { type: "number" as const, position: "bottom" as const, interval: { step: 1 } },
      },
    };
  }, [cases, chartTheme]);

  return (
    <section aria-label="Charts" className={showOutcomes ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
      <figure className="rounded-xl border bg-card p-5">
        <figcaption>
          <h2 className="text-base font-semibold text-foreground">Money on hold, by stage</h2>
          <p className="text-sm text-muted-foreground">Amounts PayPal holds while each open dispute is decided.</p>
        </figcaption>
        <div className="mt-4 h-[240px] w-full">
          <AgCharts options={onHoldOptions} style={CHART_STYLE} />
        </div>
      </figure>

      {showOutcomes && (
        <figure className="rounded-xl border bg-card p-5">
          <figcaption>
            <h2 className="text-base font-semibold text-foreground">Outcomes</h2>
            <p className="text-sm text-muted-foreground">All {cases.length} disputes recorded in the sandbox.</p>
          </figcaption>
          <div className="mt-4 h-[240px] w-full">
            <AgCharts options={outcomesOptions} style={CHART_STYLE} />
          </div>
        </figure>
      )}
    </section>
  );
}
