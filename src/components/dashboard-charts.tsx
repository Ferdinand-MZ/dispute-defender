"use client";

import { useMemo } from "react";
import { AgCharts } from "ag-charts-react";
import { AllCommunityModule, ModuleRegistry } from "ag-charts-community";
import type { AgChartOptions } from "ag-charts-community";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { BarChart3, PieChart } from "lucide-react";

// AG Charts v13+ is modular: series types must be registered before first render.
ModuleRegistry.registerModules([AllCommunityModule]);

export interface DashboardCaseItem {
  paypalDisputeId: string;
  amountMinor: number;
  currency: string;
  caseState: string;
  paypalStatus: string;
}

export function DashboardCharts({ cases }: { cases: DashboardCaseItem[] }) {
  const riskByStateOptions = useMemo<AgChartOptions>(() => {
    const stateAmounts: Record<string, number> = {
      NEW: 0,
      ANALYZED: 0,
      DRAFTED: 0,
      APPROVED: 0,
      SUBMITTED: 0,
    };

    for (const c of cases) {
      if (stateAmounts[c.caseState] !== undefined) {
        stateAmounts[c.caseState] += c.amountMinor / 100;
      }
    }

    const data = Object.entries(stateAmounts).map(([state, amount]) => ({
      state,
      amount: Number(amount.toFixed(2)),
    }));

    return {
      data,
      series: [
        {
          type: "bar" as const,
          xKey: "state",
          yKey: "amount",
          yName: "Amount ($)",
        },
      ],
    };
  }, [cases]);

  const outcomesOptions = useMemo<AgChartOptions>(() => {
    const outcomeCounts: Record<string, number> = {};

    for (const c of cases) {
      let label: string;
      if (c.caseState === "RESOLVED") {
        label = "Resolved (PayPal)";
      } else if (c.caseState === "ACCEPTED") {
        label = "Accepted Claim";
      } else if (c.caseState === "REFUNDED") {
        label = "Merchant Refunded";
      } else if (c.caseState === "EXPIRED") {
        label = "Deadline Expired";
      } else if (c.caseState === "SUBMITTED") {
        label = "Under Review";
      } else {
        label = "In Progress";
      }
      outcomeCounts[label] = (outcomeCounts[label] || 0) + 1;
    }

    const data = Object.entries(outcomeCounts).map(([status, count]) => ({
      status,
      count,
    }));

    return {
      data,
      theme: "ag-default",
      series: [
        {
          type: "donut" as const,
          calloutLabelKey: "status",
          angleKey: "count",
          innerRadiusRatio: 0.55,
          sectorLabel: {
            formatter: (params) => `${params.value}`,
          },
        },
      ],
    };
  }, [cases]);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Chart 1: Capital at risk by state */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Open Capital at Risk by Case State
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <AgCharts options={riskByStateOptions} />
          </div>
        </CardContent>
      </Card>

      {/* Chart 2: Resolution & Lifecycle Breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <PieChart className="h-4 w-4 text-primary" />
            Dispute Lifecycle & Resolution Outcomes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full">
            <AgCharts options={outcomesOptions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
