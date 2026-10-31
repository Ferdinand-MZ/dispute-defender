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
  Bot,
  CheckCircle,
  Clock,
  ExternalLink,
  FileCheck,
  FileText,
  Loader2,
  Lock,
  Package,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
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
  const [caseState, setCaseState] = useState<string>(dispute.caseState);
  const [auditLogList, setAuditLogList] = useState<AuditLogEntry[]>(initialAuditLog);
  const [approverName, setApproverName] = useState("Sarah Jenkins (Merchant Admin)");

  // Submission state
  const [submittingEvidence, setSubmittingEvidence] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Refund state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState<string | null>(null);

  // Accept claim state
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

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

  async function handleApproveAndSubmit() {
    if (!approverName.trim()) {
      setSubmitError("Please provide an authorized representative name.");
      return;
    }
    setSubmittingEvidence(true);
    setSubmitError(null);

    try {
      // 1. If not yet approved, approve the draft
      if (caseState !== "APPROVED") {
        const appRes = await fetch(`/api/cases/${dispute.paypalDisputeId}/approve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-merchant-auth": "demo-merchant-admin",
          },
          body: JSON.stringify({ approvedBy: approverName.trim() }),
        });
        const appData = await appRes.json();
        if (!appRes.ok) {
          throw new Error(appData.error || "Approval failed");
        }
      }

      // 2. Submit evidence packet to PayPal Disputes API
      const subRes = await fetch(`/api/cases/${dispute.paypalDisputeId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-merchant-auth": "demo-merchant-admin",
        },
        body: JSON.stringify({ approvedBy: approverName.trim() }),
      });
      const subData = await subRes.json();
      if (!subRes.ok) {
        throw new Error(subData.error || "Submission failed");
      }

      setCaseState("SUBMITTED");
      setShowApprovalModal(false);

      setAuditLogList((prev) => [
        {
          id: `aud-${Date.now()}`,
          ts: new Date().toISOString(),
          actor: "human",
          disputeId: dispute.paypalDisputeId,
          action: "EVIDENCE_SUBMITTED_TO_PAYPAL",
          detailJson: JSON.stringify({ approvedBy: approverName.trim() }),
        },
        ...prev,
      ]);
    } catch (err) {
      setSubmitError((err as Error).message);
    } finally {
      setSubmittingEvidence(false);
    }
  }

  async function handleRefund() {
    if (!approverName.trim()) {
      setRefundError("Please provide an authorized representative name.");
      return;
    }
    setRefunding(true);
    setRefundError(null);

    try {
      const res = await fetch(`/api/cases/${dispute.paypalDisputeId}/refund`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-merchant-auth": "demo-merchant-admin",
        },
        body: JSON.stringify({
          approvedBy: approverName.trim(),
          noteToPayer: "Dispute refunded in merchant's favor of customer relation.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Refund failed");
      }

      setCaseState("REFUNDED");
      setShowRefundModal(false);

      setAuditLogList((prev) => [
        {
          id: `aud-${Date.now()}`,
          ts: new Date().toISOString(),
          actor: "human",
          disputeId: dispute.paypalDisputeId,
          action: "CAPTURE_REFUNDED",
          detailJson: JSON.stringify({ approvedBy: approverName.trim() }),
        },
        ...prev,
      ]);
    } catch (err) {
      setRefundError((err as Error).message);
    } finally {
      setRefunding(false);
    }
  }

  async function handleAcceptClaim() {
    if (!approverName.trim()) {
      setAcceptError("Please provide an authorized representative name.");
      return;
    }
    setAccepting(true);
    setAcceptError(null);

    try {
      const res = await fetch(`/api/cases/${dispute.paypalDisputeId}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-merchant-auth": "demo-merchant-admin",
        },
        body: JSON.stringify({
          approvedBy: approverName.trim(),
          note: "Accepting buyer claim in accordance with store policies.",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Claim acceptance failed");
      }

      setCaseState("ACCEPTED");
      setShowAcceptModal(false);

      setAuditLogList((prev) => [
        {
          id: `aud-${Date.now()}`,
          ts: new Date().toISOString(),
          actor: "human",
          disputeId: dispute.paypalDisputeId,
          action: "CLAIM_ACCEPTED",
          detailJson: JSON.stringify({ approvedBy: approverName.trim() }),
        },
        ...prev,
      ]);
    } catch (err) {
      setAcceptError((err as Error).message);
    } finally {
      setAccepting(false);
    }
  }

  const [askQuestion, setAskQuestion] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [askAnswer, setAskAnswer] = useState<string | null>(null);
  const [askToolsUsed, setAskToolsUsed] = useState<string[]>([]);

  async function handleAskSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!askQuestion.trim() || askLoading) return;

    setAskLoading(true);
    setAskAnswer(null);
    setAskToolsUsed([]);

    try {
      const res = await fetch(`/api/cases/${dispute.paypalDisputeId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: askQuestion.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to query case copilot");
      }
      setAskAnswer(data.answer);
      setAskToolsUsed(data.toolsUsed || []);
    } catch (err) {
      setAskAnswer(`Error: ${(err as Error).message}`);
    } finally {
      setAskLoading(false);
    }
  }

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
              caseState === "APPROVED" || caseState === "RESOLVED" || caseState === "SUBMITTED"
                ? "success"
                : caseState === "REFUNDED"
                ? "warning"
                : "secondary"
            }
            className="font-mono text-xs uppercase"
          >
            {caseState}
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
                {auditLogList.map((log) => (
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
                disabled={
                  !draft ||
                  !groundingPassed ||
                  caseState === "SUBMITTED" ||
                  caseState === "RESOLVED" ||
                  caseState === "REFUNDED" ||
                  caseState === "ACCEPTED"
                }
                className="w-full gap-2 text-xs font-semibold"
              >
                {caseState === "SUBMITTED" ? (
                  <>
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                    Evidence Submitted to PayPal
                  </>
                ) : (
                  <>
                    <Send className="h-3.5 w-3.5" />
                    Review & Approve Submission
                  </>
                )}
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRefundModal(true)}
                  disabled={
                    caseState === "REFUNDED" ||
                    caseState === "ACCEPTED" ||
                    caseState === "RESOLVED"
                  }
                  className="w-full justify-start text-xs text-muted-foreground hover:text-foreground gap-2"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  {caseState === "REFUNDED"
                    ? "Capture Refunded"
                    : `Refund Dispute (${formatMoney(dispute.amountMinor, dispute.currency)})`}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAcceptModal(true)}
                  disabled={
                    caseState === "ACCEPTED" ||
                    caseState === "REFUNDED" ||
                    caseState === "RESOLVED"
                  }
                  className="w-full justify-start text-xs text-muted-foreground hover:text-foreground gap-2"
                >
                  <XCircle className="h-3.5 w-3.5 text-destructive" />
                  {caseState === "ACCEPTED" ? "Claim Accepted" : "Accept Buyer Claim"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Read-Only AI Inquiry Panel (PayPal Agent Toolkit) */}
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="text-xs uppercase text-primary font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Bot className="h-4 w-4 text-primary" />
                  Ask Copilot
                </span>
                <Badge variant="outline" className="text-[10px] text-primary bg-primary/5">
                  PayPal Agent Toolkit
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Investigate this dispute using read-only PayPal tools (<code className="text-[10px]">get_dispute</code>, <code className="text-[10px]">get_shipment_tracking</code>).
              </p>

              <form onSubmit={handleAskSubmit} className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={askQuestion}
                    onChange={(e) => setAskQuestion(e.target.value)}
                    placeholder="e.g. What is the delivery tracking proof?"
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-xs font-semibold gap-1 shrink-0"
                    disabled={askLoading || !askQuestion.trim()}
                  >
                    {askLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>Ask</span>
                  </Button>
                </div>
              </form>

              {askAnswer && (
                <div className="p-3 bg-card border rounded-md text-xs space-y-2 mt-2">
                  <div className="flex items-center justify-between border-b pb-1.5 text-muted-foreground text-[10px]">
                    <span className="font-semibold text-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3 text-primary" /> Response
                    </span>
                    {askToolsUsed.length > 0 && (
                      <span className="flex items-center gap-1">
                        Tools: {askToolsUsed.join(", ")}
                      </span>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap leading-relaxed text-foreground">
                    {askAnswer}
                  </div>
                </div>
              )}
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

        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-semibold text-foreground">
            Authorized Merchant Signer:
          </label>
          <input
            type="text"
            value={approverName}
            onChange={(e) => setApproverName(e.target.value)}
            placeholder="e.g. Sarah Jenkins (Merchant Admin)"
            className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {submitError && (
          <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
            {submitError}
          </p>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowApprovalModal(false)}
            disabled={submittingEvidence}
          >
            Cancel
          </Button>
          <Button
            onClick={handleApproveAndSubmit}
            disabled={submittingEvidence || !approverName.trim()}
            className="gap-2"
          >
            {submittingEvidence && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm & Submit to PayPal
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Refund Modal */}
      <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-amber-600" />
            Confirm Capture Refund
          </DialogTitle>
          <DialogDescription>
            You are authorizing an immediate refund of {formatMoney(dispute.amountMinor, dispute.currency)} via PayPal Payments API (Sandbox).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="border rounded-lg p-3 bg-muted/20 space-y-1.5">
            <p>
              <strong>Dispute ID:</strong> <span className="font-mono">{dispute.paypalDisputeId}</span>
            </p>
            <p>
              <strong>Refund Amount:</strong> {formatMoney(dispute.amountMinor, dispute.currency)}
            </p>
            <p className="text-muted-foreground text-[11px]">
              This will execute a refund on capture {dispute.captureId || order?.captureId || "on file"} and transition the case state to REFUNDED.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Authorized Merchant Signer:
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="e.g. Sarah Jenkins (Merchant Admin)"
              className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {refundError && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
              {refundError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowRefundModal(false)}
            disabled={refunding}
          >
            Cancel
          </Button>
          <Button
            onClick={handleRefund}
            disabled={refunding || !approverName.trim()}
            variant="destructive"
            className="gap-2"
          >
            {refunding && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm & Issue Refund
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Accept Buyer Claim Modal */}
      <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Confirm Accept Buyer Claim
          </DialogTitle>
          <DialogDescription>
            You are formally conceding this dispute claim to the customer via PayPal Disputes API (Sandbox).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          <div className="border rounded-lg p-3 bg-muted/20 space-y-1.5">
            <p>
              <strong>Dispute ID:</strong> <span className="font-mono">{dispute.paypalDisputeId}</span>
            </p>
            <p className="text-muted-foreground text-[11px]">
              PayPal will close this dispute in the buyer&apos;s favor and debit the disputed capital.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              Authorized Merchant Signer:
            </label>
            <input
              type="text"
              value={approverName}
              onChange={(e) => setApproverName(e.target.value)}
              placeholder="e.g. Sarah Jenkins (Merchant Admin)"
              className="w-full px-2.5 py-1.5 text-xs rounded-md border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {acceptError && (
            <p className="text-xs text-destructive bg-destructive/10 p-2 rounded-md border border-destructive/20">
              {acceptError}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowAcceptModal(false)}
            disabled={accepting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAcceptClaim}
            disabled={accepting || !approverName.trim()}
            variant="destructive"
            className="gap-2"
          >
            {accepting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Confirm & Accept Claim
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
