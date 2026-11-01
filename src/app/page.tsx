import Link from "next/link";
import { db } from "@/lib/db";
import { disputes, analyses, orders } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatMoney } from "@/lib/money";
import { getDeadlineStatus } from "@/lib/deadline";
import { isClosed, nextStep, reasonLabel } from "@/lib/case-labels";
import { buttonVariants } from "@/components/ui/button";
import { DashboardCharts } from "@/components/dashboard-charts";
import { DeadlinePill, PageHeader, RecommendationBadge } from "@/components/case-status";
import { ArrowRight, ChevronRight, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const HOW_IT_WORKS = [
  { title: "Dispute arrives", body: "PayPal's webhook brings the dispute in. Your order records become a fact base." },
  { title: "You get a recommendation", body: "Fight, refund, or accept, with the expected cost of each. The math is code, not AI." },
  { title: "AI drafts the evidence", body: "Every sentence cites a fact. Unsupported claims block approval." },
  { title: "You approve and send", body: "Only your sign-off sends evidence, refunds, or accepts the claim." },
];

type OverviewRow = {
  paypalDisputeId: string;
  reason: string;
  amountMinor: number;
  currency: string;
  caseState: string;
  sellerResponseDueAt: string | null;
  recommendation: string | null;
  buyerName: string | null;
};

const byDeadline = (a: OverviewRow, b: OverviewRow) =>
  (a.sellerResponseDueAt ?? "9999").localeCompare(b.sellerResponseDueAt ?? "9999");

function CaseList({ rows, now, quiet }: { rows: OverviewRow[]; now: number; quiet?: boolean }) {
  return (
    <ul className={cn("divide-y overflow-hidden rounded-xl border", quiet ? "bg-card/60" : "bg-card")}>
      {rows.map((d) => {
        const step = nextStep(d.caseState, d.recommendation);
        return (
          <li key={d.paypalDisputeId}>
            <Link
              href={`/cases/${d.paypalDisputeId}`}
              className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 px-4 py-4 transition-colors hover:bg-accent/60 sm:px-5 md:grid-cols-[minmax(0,1.5fr)_6.5rem_10.5rem_minmax(0,1fr)_minmax(0,1.3fr)_1.25rem]"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{reasonLabel(d.reason)}</p>
                <p className="truncate text-sm text-muted-foreground">
                  <span className="font-mono text-xs">{d.paypalDisputeId}</span>
                  {d.buyerName && <> · {d.buyerName}</>}
                </p>
              </div>
              <p className="text-right font-semibold tabular-nums text-foreground md:text-left">
                {formatMoney(d.amountMinor, d.currency)}
              </p>
              <div className="col-span-2 flex flex-wrap items-center gap-2 md:contents">
                <DeadlinePill dueAt={d.sellerResponseDueAt} now={now} className="md:justify-self-start" />
                <RecommendationBadge recommendation={d.recommendation} />
                <p
                  className={cn(
                    "text-sm max-md:ml-auto",
                    step.actionable ? "font-semibold text-foreground" : "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
              </div>
              <ChevronRight
                className="hidden h-5 w-5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 md:block"
                aria-hidden="true"
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default async function DashboardPage() {
  const allDisputes = await db
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
      buyerName: orders.buyerName,
    })
    .from(disputes)
    .leftJoin(analyses, eq(disputes.paypalDisputeId, analyses.disputeId))
    .leftJoin(orders, eq(disputes.orderId, orders.id))
    .orderBy(desc(disputes.createdAt));

  const now = Date.now();
  const openCases = allDisputes.filter((d) => !isClosed(d.caseState));
  const totalAtRiskMinor = openCases.reduce((sum, d) => sum + d.amountMinor, 0);

  // The merchant's move first; cases still being analyzed or with PayPal are listed separately.
  const needsDecision = openCases.filter((d) => nextStep(d.caseState, d.recommendation).actionable).sort(byDeadline);
  const inProgress = openCases.filter((d) => !nextStep(d.caseState, d.recommendation).actionable).sort(byDeadline);

  const dueSoon = openCases.filter((d) => {
    if (!d.sellerResponseDueAt) return false;
    const urgency = getDeadlineStatus(d.sellerResponseDueAt, now).urgency;
    return urgency === "urgent" || urgency === "critical";
  }).length;

  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  // Seed data is USD-only; the total assumes a single currency.
  const summary =
    openCases.length === 0
      ? "No open disputes. Nothing is on hold."
      : `${plural(openCases.length, "open dispute", "open disputes")}, ${formatMoney(totalAtRiskMinor, "USD")} on hold by PayPal. ` +
        (needsDecision.length > 0
          ? `${plural(needsDecision.length, "needs", "need")} your decision`
          : "None need your decision yet") +
        (dueSoon > 0 ? `, and ${plural(dueSoon, "is", "are")} due within 48 hours.` : ".");

  return (
    <div className="space-y-10">
      <PageHeader
        title="Overview"
        description={summary}
        actions={
          <Link href="/cases" className={buttonVariants()}>
            <Inbox className="h-4 w-4" aria-hidden="true" />
            Open dispute queue
          </Link>
        }
      />

      <section aria-labelledby="needs-decision" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="needs-decision" className="text-lg font-semibold text-foreground">
            Needs your decision
          </h2>
          <Link href="/cases" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            All disputes <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {needsDecision.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card px-6 py-10 text-center">
            <p className="font-medium text-foreground">Nothing needs you right now</p>
            <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
              Disputes show up here once there is a recommendation or draft to review. To try the flow, open one in
              the{" "}
              <Link href="/admin/simulate" className="font-medium text-primary hover:underline">
                Simulator
              </Link>
              .
            </p>
          </div>
        ) : (
          <CaseList rows={needsDecision} now={now} />
        )}
      </section>

      {inProgress.length > 0 && (
        <section aria-labelledby="in-progress" className="space-y-3">
          <div>
            <h2 id="in-progress" className="text-base font-semibold text-foreground">
              Being prepared or with PayPal
            </h2>
            <p className="text-sm text-muted-foreground">No action from you yet. Deadlines still apply.</p>
          </div>
          <CaseList rows={inProgress} now={now} quiet />
        </section>
      )}

      <DashboardCharts cases={allDisputes} />

      <section aria-labelledby="how-it-works" className="space-y-4 border-t pt-8">
        <h2 id="how-it-works" className="text-lg font-semibold text-foreground">
          How a dispute moves through DisputeDefender
        </h2>
        <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((step, i) => (
            <li key={step.title} className="flex gap-3">
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy text-[13px] font-semibold text-white"
              >
                {i + 1}
              </span>
              <div>
                <p className="font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
