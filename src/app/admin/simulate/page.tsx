import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal, ShieldAlert, CheckCircle, RefreshCcw, AlertTriangle, Terminal } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminSimulatePage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <SlidersHorizontal className="h-6 w-6 text-primary" />
            Sandbox Dispute Simulator
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Exercise full PayPal dispute lifecycle loops in the Sandbox environment without live risk.
          </p>
        </div>
        <Badge variant="warning" className="font-mono text-xs">
          SANDBOX SIMULATION ONLY
        </Badge>
      </div>

      {/* Simulator Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Dispute Trigger Simulation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              1. Simulate Incoming Dispute
            </CardTitle>
            <CardDescription className="text-xs">
              Trigger a dispute against an existing captured sandbox order. Uses <code>POST /v1/customer/disputes</code> with <code>PayPal-Auth-Assertion</code> or webhooks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Dispute Reason Scenario:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Button variant="outline" size="sm" className="h-auto py-2 flex flex-col items-start text-left">
                  <span className="font-semibold text-foreground">S1: Not Received</span>
                  <span className="text-[10px] text-muted-foreground">Strong tracking & delivery proof</span>
                </Button>
                <Button variant="outline" size="sm" className="h-auto py-2 flex flex-col items-start text-left">
                  <span className="font-semibold text-foreground">S2: Not Received</span>
                  <span className="text-[10px] text-muted-foreground">Weak proof (refund path)</span>
                </Button>
              </div>
            </div>

            <Button className="w-full text-xs font-semibold" variant="default">
              Create Test Dispute in Sandbox
            </Button>
          </CardContent>
        </Card>

        {/* Adjudication Simulation */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              2. Settle & Adjudicate Dispute
            </CardTitle>
            <CardDescription className="text-xs">
              Simulate PayPal&apos;s arbitration outcome using <code>POST /v1/customer/disputes/&#123;id&#125;/adjudicate</code> to close the dispute loop.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground leading-relaxed">
              Once evidence is submitted for an open dispute, use PayPal&apos;s adjudication sandbox hook to transition the state to <code>RESOLVED</code>.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 text-xs text-emerald-700 hover:bg-emerald-50">
                Settle: Favor Merchant (Win)
              </Button>
              <Button variant="outline" size="sm" className="flex-1 text-xs text-destructive hover:bg-destructive/10">
                Settle: Favor Buyer (Loss)
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Negative-Path Error Simulations */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              3. Negative Path & Error Handling Verification
            </CardTitle>
            <CardDescription className="text-xs">
              Verify resilience against documented PayPal negative-path error fixtures.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-md border bg-muted/20">
                <p className="font-mono font-semibold text-foreground">ERRDIS015</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">HTTP 403 Forbidden</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tests non-admin permission boundaries and friendly error logging.
                </p>
              </div>
              <div className="p-3 rounded-md border bg-muted/20">
                <p className="font-mono font-semibold text-foreground">ERRDIS001</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">HTTP 404 Not Found</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tests handling of invalid or expired dispute identifiers.
                </p>
              </div>
              <div className="p-3 rounded-md border bg-muted/20">
                <p className="font-mono font-semibold text-foreground">ERRDIS035</p>
                <p className="text-muted-foreground text-[11px] mt-0.5">HTTP 400 Bad Request</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Tests invalid evidence payload formatting validation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
