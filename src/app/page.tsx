import Link from "next/link";
import { db } from "@/lib/db";
import { disputes, analyses } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { formatMoney } from "@/lib/money";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  DollarSign,
  Inbox,
  Shield,
  ShoppingBag,
  SlidersHorizontal,
} from "lucide-react";

export const dynamic = "force-dynamic";

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
    })
    .from(disputes)
    .leftJoin(analyses, eq(disputes.paypalDisputeId, analyses.disputeId))
    .orderBy(desc(disputes.createdAt));

  const now = new Date().getTime();
  const openCases = allDisputes.filter(
    (d) => !["RESOLVED", "ACCEPTED", "REFUNDED", "EXPIRED"].includes(d.caseState)
  );

  const totalAtRiskMinor = openCases.reduce((sum, d) => sum + d.amountMinor, 0);

  const dueWithin48h = openCases.filter((d) => {
    if (!d.sellerResponseDueAt) return false;
    const dueTime = new Date(d.sellerResponseDueAt).getTime();
    const diffHours = (dueTime - now) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 48;
  });

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Dispute Defense Dashboard
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Automated fact collection, grounding validation, and PayPal dispute management.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/demo-shop">
            <Button variant="outline" size="sm" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Demo Storefront
            </Button>
          </Link>
          <Link href="/cases">
            <Button size="sm" className="gap-2">
              <Inbox className="h-4 w-4" />
              Open Case Queue
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Summary Tiles */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Open Cases */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Active Disputes
            </CardTitle>
            <Inbox className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{openCases.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {allDisputes.length} total cases recorded in sandbox
            </p>
          </CardContent>
        </Card>

        {/* Capital At Risk */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Disputed Capital At Risk
            </CardTitle>
            <DollarSign className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">
              {formatMoney(totalAtRiskMinor, "USD")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Held funds pending response submission
            </p>
          </CardContent>
        </Card>

        {/* Due Within 48h */}
        <Card className={dueWithin48h.length > 0 ? "border-amber-200 bg-amber-50/20" : ""}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Urgent Response Required
            </CardTitle>
            <Clock className={`h-4 w-4 ${dueWithin48h.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${dueWithin48h.length > 0 ? "text-amber-700" : ""}`}>
              {dueWithin48h.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              PayPal deadline expires within 48 hours
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Access & Recent Cases */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left 2 Cols: Recent Disputes Preview */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Recent Disputes Requiring Attention</h3>
            <Link href="/cases" className="text-xs text-primary hover:underline flex items-center gap-1">
              View full AG Grid queue <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="rounded-lg border bg-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b text-muted-foreground font-medium">
                <tr>
                  <th className="py-2.5 px-4">Dispute ID</th>
                  <th className="py-2.5 px-4">Reason</th>
                  <th className="py-2.5 px-4">Amount</th>
                  <th className="py-2.5 px-4">State</th>
                  <th className="py-2.5 px-4">Recommendation</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allDisputes.slice(0, 5).map((d) => (
                  <tr key={d.paypalDisputeId} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground">
                      <Link href={`/cases/${d.paypalDisputeId}`} className="hover:text-primary hover:underline">
                        {d.paypalDisputeId}
                      </Link>
                    </td>
                    <td className="py-3 px-4 max-w-[180px] truncate">
                      {d.reason.replace(/MERCHANDISE_OR_SERVICE_/g, "")}
                    </td>
                    <td className="py-3 px-4 font-medium">
                      {formatMoney(d.amountMinor, d.currency)}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="outline" className="text-[10px]">
                        {d.caseState}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {d.recommendation === "FIGHT" && (
                        <Badge variant="success" className="text-[10px]">FIGHT</Badge>
                      )}
                      {d.recommendation === "REFUND" && (
                        <Badge variant="warning" className="text-[10px]">REFUND</Badge>
                      )}
                      {d.recommendation === "ACCEPT" && (
                        <Badge variant="destructive" className="text-[10px]">ACCEPT</Badge>
                      )}
                      {!d.recommendation && (
                        <span className="text-muted-foreground text-[11px]">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Link href={`/cases/${d.paypalDisputeId}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          Inspect
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Col: System Safeguards & Demo Hub */}
        <div className="space-y-4">
          <h3 className="font-semibold text-sm text-foreground">Governance & Safeguards</h3>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                Guaranteed Boundaries
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Strict Grounding:</strong> AI drafts cite fact IDs. Hallucinated tracking numbers or dates are deterministically rejected.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Human Gatekeeper:</strong> Evidence submission or refunds require explicit merchant click.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Deterministic EV:</strong> Cost formulas are computed in integer cents by code, not LLMs.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs uppercase text-muted-foreground font-semibold">
                Developer Sandbox Tools
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/simulate" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Dispute Simulator & Adjudication
                </Button>
              </Link>
              <Link href="/demo-shop" className="block">
                <Button variant="outline" size="sm" className="w-full justify-start gap-2 text-xs">
                  <ShoppingBag className="h-3.5 w-3.5" />
                  Sandbox Checkout Store
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
