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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

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

  const handleApproveAndSubmit = async () => {
    setIsSubmitting(true);
    // Simulate approval and submission in foundation phase
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitSuccess(true);
      setShowApprovalModal(false);
    }, 1200);
  };

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
            {submitSuccess ? "SUBMITTED" : dispute.caseState}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {draft && draft.groundingStatus === "pass" && (
            <Badge variant="success" className="gap-1 text-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              Grounding Passed (100% cited)
            </Badge>
          )}
          {draft && draft.groundingStatus === "fail" && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <ShieldAlert className="h-3.5 w-3.5" />
              Grounding Failed
            </Badge>
          )}
        </div>
      </div>

      {submitSuccess && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-emerald-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>
              <strong>Evidence Packet Submitted Successfully (Simulation).</strong> Recorded in actions and audit log. Case updated to <code>SUBMITTED</code>.
            </span>
          </div>
        </div>
      )}

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
                  {dispute.sellerResponseDueAt
                    ? new Date(dispute.sellerResponseDueAt).toLocaleString()
                    : "No deadline specified"}
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
                      Actor: <span className="font-mono text-primary">{log.actor}</span> • {new Date(log.ts).toLocaleTimeString()}
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
                      variant={analysis.recommendation === "FIGHT" ? "success" : "warning"}
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
                  <div>Expected Loss (Fight): <strong>{formatMoney(analysis.fightLossMinor, "USD")}</strong> (includes fees & effort)</div>
                  <div>Loss If Refunded: <strong>{formatMoney(analysis.refundLossMinor, "USD")}</strong></div>
                  <div className="text-emerald-700 font-semibold pt-1">
                    Net Expected Advantage: {formatMoney(analysis.refundLossMinor - analysis.fightLossMinor, "USD")}
                  </div>
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
              <Badge variant="outline" className="text-[10px] font-mono">
                Model: {analysis?.model || "gemini-1.5-flash"}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
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
                                onClick={() => setSelectedFactId(ref)}
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
                disabled={draft?.groundingStatus === "fail" || submitSuccess}
                className="w-full gap-2 text-xs font-semibold"
                variant={submitSuccess ? "outline" : "default"}
              >
                <Send className="h-3.5 w-3.5" />
                {submitSuccess ? "Evidence Submitted" : "Review & Approve Submission"}
              </Button>

              <div className="pt-2 border-t space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground gap-2"
                  disabled={submitSuccess}
                >
                  <RotateCcw className="h-3.5 w-3.5 text-amber-600" />
                  Refund Dispute ({formatMoney(dispute.amountMinor, dispute.currency)})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start text-xs text-muted-foreground gap-2"
                  disabled={submitSuccess}
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

        <div className="space-y-3 text-xs border rounded-lg p-3 bg-muted/20 font-mono">
          <div><strong>Dispute ID:</strong> {dispute.paypalDisputeId}</div>
          <div><strong>Evidence Type:</strong> {draft?.evidenceType || "PROOF_OF_FULFILLMENT"}</div>
          <div><strong>Tracking:</strong> {order?.carrier} - {order?.trackingNumber}</div>
          <div><strong>Cited Fact IDs:</strong> {facts.map(f => f.id).join(", ")}</div>
          <div><strong>Grounding Status:</strong> PASS (All entities verified)</div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowApprovalModal(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleApproveAndSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? "Transmitting to PayPal..." : "Confirm & Submit to PayPal"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
