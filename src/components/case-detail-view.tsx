"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Lock,
  Package,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
  XCircle,
} from "lucide-react";
import type { Dispute, Order, Fact, Analysis, Draft, Action, AuditLogEntry } from "@/lib/db/schema";
import type { GroundingError } from "@/lib/agent/grounding";

// Fixed locale and UTC so server and browser render identical text (no hydration mismatch).
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
function formatUtc(iso: string): string {
  return `${dateTimeFormat.format(new Date(iso))} UTC`;
}

const recommendationVariant: Record<string, "success" | "warning" | "destructive"> = {
  FIGHT: "success",
  REFUND: "warning",
  ACCEPT: "destructive",
};

interface CaseDetailViewProps {
  dispute: Dispute;
  order: Order | null;
  facts: Fact[];
  analysis: Analysis | null;
  draft: Draft | null;
  actions: Action[];
  auditLog: AuditLogEntry[];
}

export function CaseDetailView({
  dispute,
  order,
  facts,
  analysis,
  draft,
  actions,
  auditLog: initialAuditLog,
}: CaseDetailViewProps) {
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  // Parse draft body JSON if present
  let parsedDraftBody: {
    summary?: string;
    sections?: Array<{
      heading: string;
      paragraphs: Array<{ text: string; claimRefs: string[] }>;
    }>;
  } | null = null;

  if (draft?.bodyJson) {
    try {
      parsedDraftBody = JSON.parse(draft.bodyJson);
    } catch {
      parsedDraftBody = null;
    }
  }

  // Parse breakdown JSON if present
  let breakdown: Array<{ signal: string; weight: number; satisfied: boolean; notes: string }> = [];
  if (analysis?.strengthBreakdownJson) {
    try {
      breakdown = JSON.parse(analysis.strengthBreakdownJson);
    } catch {
      breakdown = [];
    }
  }

  const showFact = (factId: string) => {
    setSelectedFactId(factId);
    document.getElementById(`fact-${factId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  let groundingErrors: GroundingError[] = [];
  if (draft?.groundingErrorsJson) {
    try {
      groundingErrors = JSON.parse(draft.groundingErrorsJson);
    } catch {
      groundingErrors = [];
    }
  }

  const groundingPassed = draft?.groundingStatus === "pass" || draft?.groundingStatus === "edited_pass";
  const citedFactIds = Array.from(
    new Set(
      parsedDraftBody?.sections?.flatMap((section) => section.paragraphs.flatMap((p) => p.claimRefs)) ?? []
    )
  );
  const paragraphCount =
    parsedDraftBody?.sections?.reduce((count, section) => count + section.paragraphs.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Status Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/cases">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-4 w-4" />
              Back to Queue
            </Button>
          </Link>
          <div className="h-4 w-px bg-border" />
          <h2 className="text-xl font-bold font-mono tracking-tight text-foreground">
            {dispute.paypalDisputeId}
          </h2>
          <Badge variant="outline" className="font-mono text-xs">
            {dispute.reason.replace(/MERCHANDISE_OR_SERVICE_/g, "")}
          </Badge>
          <Badge
            variant={
              dispute.caseState === "APPROVED" || dispute.caseState === "RESOLVED"
                ? "success"
                : "secondary"
            }
            className="font-mono text-xs uppercase"
          >
            {dispute.caseState}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {draft && groundingPassed && (
            <Badge variant="success" className="gap-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              Grounding passed · {paragraphCount} paragraphs, {citedFactIds.length} facts cited
            </Badge>
          )}
          {draft && draft.groundingStatus === "fail" && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              Grounding failed · {groundingErrors.length} {groundingErrors.length === 1 ? "issue" : "issues"}
            </Badge>
          )}
          {!draft && (
            <Badge variant="outline" className="text-xs">
              No draft yet
            </Badge>
          )}
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Dispute Info & Timeline (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase text-muted-foreground font-semibold">
                Dispute Metadata
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div>
                <span className="text-muted-foreground">Disputed Capital:</span>
                <p className="text-base font-bold text-foreground">
                  {formatMoney(dispute.amountMinor, dispute.currency)}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">PayPal Status:</span>
                <p className="font-mono font-medium text-foreground">{dispute.paypalStatus}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Lifecycle Stage:</span>
                <p className="font-medium text-foreground">{dispute.lifeCycleStage || "INQUIRY"}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Response Deadline:</span>
                <p className="font-medium text-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3.5 w-3.5 text-amber-600" />
                  {dispute.sellerResponseDueAt ? formatUtc(dispute.sellerResponseDueAt) : "No deadline specified"}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Linked Order */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-primary" />
                Linked Store Order
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              {order ? (
                <>
                  <div>
                    <span className="text-muted-foreground">Order ID:</span>
                    <p className="font-mono font-medium text-foreground">{order.id}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <p className="font-medium text-foreground">{order.buyerName || "N/A"}</p>
                    <p className="text-muted-foreground text-[11px]">{order.buyerEmail}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Fulfillment Status:</span>
                    <Badge variant="outline" className="mt-0.5 uppercase text-[10px]">
                      {order.status}
                    </Badge>
                  </div>
                  {order.trackingNumber && (
                    <div>
                      <span className="text-muted-foreground">Carrier Tracking:</span>
                      <p className="font-mono text-primary font-medium flex items-center gap-1 mt-0.5">
                        <Truck className="h-3.5 w-3.5" />
                        {order.carrier} - {order.trackingNumber}
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-muted-foreground italic">No linked order identified</p>
              )}
            </CardContent>
          </Card>

          {/* Audit Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase text-muted-foreground font-semibold">
                Audit Timeline
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="relative border-l border-border pl-4 space-y-4">
                {initialAuditLog.map((log) => (
                  <div key={log.id} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-primary" />
                    <p className="font-semibold text-foreground">{log.action}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Actor: <span className="font-mono text-primary">{log.actor}</span> • {formatUtc(log.ts)}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CENTER COLUMN: Facts, Analysis, and Draft Response (6 cols) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Recommendation Card */}
          {analysis && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={recommendationVariant[analysis.recommendation] ?? "outline"}
                      className="text-xs font-bold px-2.5 py-0.5"
                    >
                      RECOMMENDATION: {analysis.recommendation}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-medium">
                      Evidence Strength: <strong>{analysis.strengthScore}%</strong> ({analysis.pWinBand})
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p className="text-foreground leading-relaxed font-medium">
                  {analysis.rationale}
                </p>

                {/* Deterministic Cost Formula Breakdown */}
                <div className="rounded-md border border-border bg-background/80 p-3 font-mono text-[11px] space-y-1">
                  <div className="text-muted-foreground font-sans font-medium text-xs mb-1">
                    Expected Value Cost Math (Deterministic Code):
                  </div>
                  <div>Expected Loss (Fight): <strong>{formatMoney(analysis.fightLossMinor, dispute.currency)}</strong> (includes fees & effort)</div>
                  <div>Loss If Refunded: <strong>{formatMoney(analysis.refundLossMinor, dispute.currency)}</strong></div>
                  {analysis.refundLossMinor - analysis.fightLossMinor >= 0 ? (
                    <div className="text-emerald-700 font-semibold pt-1">
                      Fighting saves (expected): {formatMoney(analysis.refundLossMinor - analysis.fightLossMinor, dispute.currency)}
                    </div>
                  ) : (
                    <div className="text-amber-700 font-semibold pt-1">
                      Fighting costs more (expected): {formatMoney(analysis.fightLossMinor - analysis.refundLossMinor, dispute.currency)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Draft Narrative Editor / Viewer */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-primary" />
                  Grounded Evidence Response Draft
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every claim is strictly cited to verified fact IDs. Click any chip to inspect source.
                </p>
              </div>
              {analysis?.model && (
                <Badge variant="outline" className="text-[10px] font-mono">
                  Model: {analysis.model}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              {groundingErrors.length > 0 && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1.5">
                  <p className="font-semibold text-destructive flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Approval blocked: fix these grounding issues first
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-foreground">
                    {groundingErrors.map((err, idx) => (
                      <li key={idx}>
                        <span className="font-mono text-[10px] text-destructive">{err.code}</span> {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {parsedDraftBody ? (
                <div className="space-y-4">
                  <div className="p-3 bg-muted/30 rounded-md border text-muted-foreground italic">
                    <strong>Summary:</strong> {parsedDraftBody.summary}
                  </div>

                  {parsedDraftBody.sections?.map((section, sIdx) => (
                    <div key={sIdx} className="space-y-2">
                      <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider text-muted-foreground">
                        {section.heading}
                      </h4>
                      {section.paragraphs.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-3 rounded-md border border-border bg-card space-y-2 hover:border-primary/40 transition-colors"
                        >
                          <p className="text-foreground text-xs leading-relaxed">{p.text}</p>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            {p.claimRefs.map((ref) => (
                              <button
                                key={ref}
                                type="button"
                                onClick={() => showFact(ref)}
                                aria-label={`Show source fact ${ref}`}
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                                  selectedFactId === ref
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-muted text-foreground border-border hover:border-primary"
                                }`}
                              >
                                #{ref}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">No draft response generated yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Fact Base Viewer */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-primary" />
                Verified Ground-Truth Fact Base ({facts.length} facts)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {facts.map((fact) => {
                const isSelected = selectedFactId === fact.id;
                return (
                  <div
                    key={fact.id}
                    id={`fact-${fact.id}`}
                    onClick={() => setSelectedFactId(fact.id)}
                    className={`p-3 rounded-md border transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary bg-primary/10 ring-1 ring-primary"
                        : "border-border bg-card hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-primary text-[11px]">
                          {fact.id}
                        </span>
                        <span className="font-medium text-foreground">{fact.label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Source: {fact.source}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-normal">{fact.value}</p>
                    {fact.untrusted === 1 && (
                      <Badge variant="destructive" className="mt-2 text-[9px]">
                        Untrusted External Text
                      </Badge>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Evidence Checklist & Human Approval (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase text-muted-foreground font-semibold">
                Required Evidence Checklist
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-xs">
              {breakdown.length > 0 ? (
                breakdown.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2">
                    {item.satisfied ? (
                      <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className={`font-medium ${item.satisfied ? "text-foreground" : "text-muted-foreground"}`}>
                        {item.signal}
                      </p>
                      <p className="text-[11px] text-muted-foreground">{item.notes}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground italic">Checklist pending analysis</p>
              )}
            </CardContent>
          </Card>

          {/* Action Station (Strict Human-in-the-Loop) */}
          <Card className="border-primary/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase text-muted-foreground font-semibold flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5 text-amber-600" />
                Human Authorization Gate
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Autonomous PayPal submissions are forbidden. An authorized merchant representative must explicitly approve this evidence packet.
              </p>

              <Button
                onClick={() => setShowApprovalModal(true)}
                disabled={!draft || !groundingPassed}
                className="w-full gap-2 text-xs font-semibold"
              >
                <Send className="h-3.5 w-3.5" />
                Review & Approve Submission
              </Button>
              {!draft && (
                <p className="text-[11px] text-muted-foreground">Approval unlocks once an evidence draft exists.</p>
              )}
              {draft && !groundingPassed && (
                <p className="text-[11px] text-destructive">
                  Approval is blocked until the draft passes grounding.
                </p>
              )}

              <div className="pt-2 border-t space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Refund and accept are not connected to PayPal yet.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground gap-2"
                  disabled
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  Refund Dispute ({formatMoney(dispute.amountMinor, dispute.currency)})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground gap-2"
                  disabled
                >
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  Accept Buyer Claim
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Human Approval Modal */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Merchant Approval Confirmation
          </DialogTitle>
          <DialogDescription>
            You are authorizing DisputeDefender to transmit the following evidence packet to the PayPal Disputes API (Sandbox).
          </DialogDescription>
        </DialogHeader>

        <dl className="space-y-2 text-xs border rounded-lg p-3 bg-muted/20">
          <div>
            <dt className="font-semibold">Dispute ID</dt>
            <dd className="font-mono">{dispute.paypalDisputeId}</dd>
          </div>
          <div>
            <dt className="font-semibold">Evidence type</dt>
            <dd className="font-mono">{draft?.evidenceType ?? "—"}</dd>
          </div>
          {order?.carrier && order.trackingNumber && (
            <div>
              <dt className="font-semibold">Tracking</dt>
              <dd className="font-mono">
                {order.carrier} · {order.trackingNumber}
              </dd>
            </div>
          )}
          <div>
            <dt className="font-semibold">Notes sent to PayPal</dt>
            <dd className="whitespace-pre-wrap">{draft?.notesText || "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Cited facts ({citedFactIds.length})</dt>
            <dd className="font-mono">{citedFactIds.length > 0 ? citedFactIds.join(", ") : "—"}</dd>
          </div>
          <div>
            <dt className="font-semibold">Grounding</dt>
            <dd>
              {groundingPassed
                ? "Passed"
                : `Not passed (${draft?.groundingStatus ?? "no draft"})`}
            </dd>
          </div>
        </dl>

        <p className="text-xs text-muted-foreground">
          Sending to PayPal is not connected yet, so nothing will be submitted from this screen.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowApprovalModal(false)}>
            Cancel
          </Button>
          <Button disabled className="gap-2">
            Confirm & Submit to PayPal
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
