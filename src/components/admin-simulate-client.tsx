"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SlidersHorizontal,
  CheckCircle,
  AlertTriangle,
  Terminal,
  Loader2,
  ExternalLink,
  Sparkles,
  ShieldAlert,
} from "lucide-react";

type ScenarioType = "S1" | "S2" | "S3" | "S4";

interface FeedbackMessage {
  type: "success" | "error" | "info";
  text: string;
  disputeId?: string;
}

export function AdminSimulateClient() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>("S1");
  const [customOrderId, setCustomOrderId] = useState("");
  const [disputeIdToAdjudicate, setDisputeIdToAdjudicate] = useState("PP-D-1001");
  const [loadingDispute, setLoadingDispute] = useState(false);
  const [loadingAdjudicate, setLoadingAdjudicate] = useState<"SELLER_FAVOR" | "BUYER_FAVOR" | null>(null);
  const [feedback, setFeedback] = useState<FeedbackMessage | null>(null);

  async function handleSimulateDispute() {
    setLoadingDispute(true);
    setFeedback(null);

    try {
      const payload: { scenario?: ScenarioType; orderId?: string } = {};
      if (customOrderId.trim()) {
        payload.orderId = customOrderId.trim();
      } else {
        payload.scenario = selectedScenario;
      }

      const res = await fetch("/api/admin/simulate/dispute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-merchant-auth": "demo-merchant-admin",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to simulate dispute");
      }

      setDisputeIdToAdjudicate(data.disputeId);
      setFeedback({
        type: "success",
        text: `Successfully initialized ${data.disputeId} in sandbox queue.`,
        disputeId: data.disputeId,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: (err as Error).message,
      });
    } finally {
      setLoadingDispute(false);
    }
  }

  async function handleAdjudicate(outcome: "SELLER_FAVOR" | "BUYER_FAVOR") {
    if (!disputeIdToAdjudicate.trim()) {
      setFeedback({ type: "error", text: "Please enter a dispute ID to adjudicate." });
      return;
    }

    setLoadingAdjudicate(outcome);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/simulate/adjudicate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-merchant-auth": "demo-merchant-admin",
        },
        body: JSON.stringify({
          disputeId: disputeIdToAdjudicate.trim(),
          outcome,
          approvedBy: "Merchant Admin Simulator",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to adjudicate dispute");
      }

      setFeedback({
        type: "success",
        text: `Dispute ${data.disputeId} successfully adjudicated in ${outcome === "SELLER_FAVOR" ? "Merchant's" : "Buyer's"} favor! State transitioned to RESOLVED.`,
        disputeId: data.disputeId,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        text: (err as Error).message,
      });
    } finally {
      setLoadingAdjudicate(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Feedback banner */}
      {feedback && (
        <div
          className={`p-4 rounded-lg border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/20 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === "success" ? (
              <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          {feedback.disputeId && (
            <Link href={`/cases/${feedback.disputeId}`}>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 ml-4 bg-background">
                View Case Detail
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          )}
        </div>
      )}

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
              Trigger a dispute against an existing captured sandbox order. Uses standard scenarios or custom order ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground">Select Preset Scenario:</label>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Button
                  type="button"
                  variant={selectedScenario === "S1" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedScenario("S1");
                    setCustomOrderId("");
                  }}
                  className="h-auto py-2 flex flex-col items-start text-left justify-start"
                >
                  <span className="font-semibold">S1: Not Received</span>
                  <span className="text-[10px] opacity-80">Strong proof (FIGHT)</span>
                </Button>
                <Button
                  type="button"
                  variant={selectedScenario === "S2" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedScenario("S2");
                    setCustomOrderId("");
                  }}
                  className="h-auto py-2 flex flex-col items-start text-left justify-start"
                >
                  <span className="font-semibold">S2: Not Received</span>
                  <span className="text-[10px] opacity-80">Weak proof (REFUND)</span>
                </Button>
                <Button
                  type="button"
                  variant={selectedScenario === "S3" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedScenario("S3");
                    setCustomOrderId("");
                  }}
                  className="h-auto py-2 flex flex-col items-start text-left justify-start"
                >
                  <span className="font-semibold">S3: Not As Described</span>
                  <span className="text-[10px] opacity-80">Linen Jacket (SNAD)</span>
                </Button>
                <Button
                  type="button"
                  variant={selectedScenario === "S4" ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setSelectedScenario("S4");
                    setCustomOrderId("");
                  }}
                  className="h-auto py-2 flex flex-col items-start text-left justify-start"
                >
                  <span className="font-semibold flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-destructive" />
                    S4: Prompt Injection
                  </span>
                  <span className="text-[10px] opacity-80">Adversarial message</span>
                </Button>
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-xs font-medium text-foreground">Or custom Order ID (optional):</label>
              <input
                type="text"
                placeholder="e.g. O-1001"
                value={customOrderId}
                onChange={(e) => setCustomOrderId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <Button
              onClick={handleSimulateDispute}
              disabled={loadingDispute}
              className="w-full text-xs font-semibold gap-1.5"
            >
              {loadingDispute && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Create / Reset Dispute in Sandbox Queue
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
              Once evidence is submitted or reviewed for an open dispute, use PayPal&apos;s adjudication sandbox hook to settle and transition the state to <code>RESOLVED</code>.
            </p>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Target Dispute ID:</label>
              <input
                type="text"
                placeholder="e.g. PP-D-1001"
                value={disputeIdToAdjudicate}
                onChange={(e) => setDisputeIdToAdjudicate(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAdjudicate("SELLER_FAVOR")}
                disabled={loadingAdjudicate !== null || !disputeIdToAdjudicate.trim()}
                className="flex-1 text-xs text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 gap-1"
              >
                {loadingAdjudicate === "SELLER_FAVOR" && <Loader2 className="h-3 w-3 animate-spin" />}
                Settle: Favor Merchant (Win)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAdjudicate("BUYER_FAVOR")}
                disabled={loadingAdjudicate !== null || !disputeIdToAdjudicate.trim()}
                className="flex-1 text-xs text-destructive hover:bg-destructive/10 gap-1"
              >
                {loadingAdjudicate === "BUYER_FAVOR" && <Loader2 className="h-3 w-3 animate-spin" />}
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
