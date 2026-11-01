"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, CircleAlert, CircleCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ScenarioType = "S1" | "S2" | "S3" | "S4";

interface FeedbackMessage {
  type: "success" | "error" | "info";
  text: string;
  disputeId?: string;
}

const SCENARIOS: Array<{ id: ScenarioType; title: string; detail: string; expect: string; disputeId: string }> = [
  {
    id: "S1",
    title: "Item not received, strong proof",
    detail: "FedEx tracking with a confirmed delivery scan.",
    expect: "Expect: fight",
    disputeId: "PP-D-1001",
  },
  {
    id: "S2",
    title: "Item not received, weak proof",
    detail: "Shipped, but no delivery scan on file.",
    expect: "Expect: refund",
    disputeId: "PP-D-1002",
  },
  {
    id: "S3",
    title: "Not as described",
    detail: "Linen jacket with its product description on file.",
    expect: "Tests the second dispute reason",
    disputeId: "PP-D-1003",
  },
  {
    id: "S4",
    title: "Prompt injection attempt",
    detail: "Buyer message tries to give the AI instructions.",
    expect: "Tests that buyer text is treated as data",
    disputeId: "PP-D-1004",
  },
];

const fieldClass =
  "h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm";

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
        text: `Dispute ${data.disputeId} is in the queue.`,
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
      setFeedback({ type: "error", text: "Enter the ID of the dispute to settle." });
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
        text: `Dispute ${data.disputeId} settled in the ${outcome === "SELLER_FAVOR" ? "merchant's" : "buyer's"} favor. It is now resolved.`,
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
      {feedback && (
        <div
          role={feedback.type === "error" ? "alert" : "status"}
          className={cn(
            "flex flex-col gap-3 rounded-xl p-4 text-sm sm:flex-row sm:items-center sm:justify-between",
            feedback.type === "error" ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success"
          )}
        >
          <p className="flex items-start gap-2">
            {feedback.type === "error" ? (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            ) : (
              <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            )}
            <span className="font-medium">{feedback.text}</span>
          </p>
          {feedback.disputeId && (
            <Link
              href={`/cases/${feedback.disputeId}`}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 font-semibold text-foreground hover:underline"
            >
              Open the case <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          )}
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="open-dispute" className="rounded-xl border bg-card p-5">
          <h2 id="open-dispute" className="text-base font-semibold text-foreground">
            Open a dispute
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a demo scenario. Running it again resets that dispute to its starting state.
          </p>

          <fieldset className="mt-4" disabled={!!customOrderId.trim()}>
            <legend className="sr-only">Scenario</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SCENARIOS.map((s) => {
                const checked = selectedScenario === s.id && !customOrderId.trim();
                return (
                  <label
                    key={s.id}
                    className={cn(
                      "relative flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      checked ? "border-primary bg-accent/60" : "border-border hover:border-foreground/30",
                      customOrderId.trim() && "cursor-not-allowed opacity-50"
                    )}
                  >
                    <input
                      type="radio"
                      name="scenario"
                      value={s.id}
                      checked={checked}
                      onChange={() => setSelectedScenario(s.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-[hsl(var(--primary))]"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{s.title}</span>
                      <span className="mt-0.5 block text-sm text-muted-foreground">{s.detail}</span>
                      <span className="mt-1.5 block text-xs text-muted-foreground">
                        {s.expect} · <span className="whitespace-nowrap font-mono">{s.disputeId}</span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 space-y-1.5">
            <label htmlFor="custom-order" className="text-sm font-medium text-foreground">
              Or dispute your own demo order
            </label>
            <input
              id="custom-order"
              type="text"
              placeholder="Order ID, for example O-1001"
              value={customOrderId}
              onChange={(e) => setCustomOrderId(e.target.value)}
              className={fieldClass}
            />
            <p className="text-xs text-muted-foreground">Orders come from the Demo store. Leave empty to use the scenario.</p>
          </div>

          <Button onClick={handleSimulateDispute} disabled={loadingDispute} className="mt-5 w-full sm:w-auto">
            {loadingDispute && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {loadingDispute ? "Opening…" : "Open dispute"}
          </Button>
        </section>

        <section aria-labelledby="settle-dispute" className="rounded-xl border bg-card p-5">
          <h2 id="settle-dispute" className="text-base font-semibold text-foreground">
            Settle a dispute
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Play PayPal&apos;s part: decide the outcome with the sandbox{" "}
            <span className="font-mono text-xs">adjudicate</span> call. The case becomes resolved.
          </p>

          <div className="mt-4 space-y-1.5">
            <label htmlFor="adjudicate-id" className="text-sm font-medium text-foreground">
              Dispute ID
            </label>
            <input
              id="adjudicate-id"
              type="text"
              placeholder="PP-D-1001"
              value={disputeIdToAdjudicate}
              onChange={(e) => setDisputeIdToAdjudicate(e.target.value)}
              className={cn(fieldClass, "font-mono")}
            />
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row lg:flex-col xl:flex-row">
            <Button
              variant="outline"
              onClick={() => handleAdjudicate("SELLER_FAVOR")}
              disabled={loadingAdjudicate !== null || !disputeIdToAdjudicate.trim()}
              className="flex-1"
            >
              {loadingAdjudicate === "SELLER_FAVOR" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Merchant wins
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAdjudicate("BUYER_FAVOR")}
              disabled={loadingAdjudicate !== null || !disputeIdToAdjudicate.trim()}
              className="flex-1"
            >
              {loadingAdjudicate === "BUYER_FAVOR" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Buyer wins
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
