"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/money";
import {
  AI_MODEL_OPTIONS,
  AI_MODEL_STORAGE_KEY,
  DEFAULT_AI_MODEL_ID,
  OPERATOR_NAME_STORAGE_KEY,
  WORKSPACE_PREFS_EVENT,
} from "@/lib/ai-models";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
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
  Check,
  CircleAlert,
  FileDown,
  Loader2,
  Pencil,
  RefreshCw,
  RotateCcw,
  Send,
  Sparkles,
  Trash2,
  ShieldAlert,
  ShieldCheck,
  Truck,
  X,
} from "lucide-react";
import type { Dispute, Order, Fact, Analysis, Draft, Action, AuditLogEntry } from "@/lib/db/schema";
import type { DraftPayload, GroundingError } from "@/lib/agent/grounding";
import { CaseStateBadge, DeadlinePill } from "@/components/case-status";
import {
  caseStateMeta,
  humanizeEnum,
  isClosed,
  lifecycleSteps,
  reasonLabel,
  recommendationMeta,
  winBandLabel,
} from "@/lib/case-labels";
import { cn } from "@/lib/utils";

// Fixed locale and UTC so server and browser render identical text (no hydration mismatch).
const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});
function formatUtc(iso: string): string {
  return `${dateTimeFormat.format(new Date(iso))} UTC`;
}

const ACTOR_LABELS: Record<string, string> = {
  human: "You",
  agent: "AI agent",
  paypal: "PayPal",
  system: "System",
};

const DEFAULT_APPROVER = "Rina (store owner)";

// Same demo credential the other case actions send; with APP_PASSWORD set, the browser's Basic auth applies.
const MERCHANT_HEADERS = { "Content-Type": "application/json", "x-merchant-auth": "demo-merchant-admin" };

/** Who wrote the text the merchant is reading, in plain words. */
function authorLabel(author: string | null | undefined, kind: "draft" | "rationale"): string {
  if (!author || author === "rules" || author === "template") {
    return kind === "draft"
      ? "Assembled by rules: each paragraph restates one fact"
      : "Explanation written by rules";
  }
  if (author === "merchant_edit") return "Edited by you, then fact-checked again";
  return kind === "draft"
    ? `Written by AI (${author}), then fact-checked by code`
    : `Explanation written by AI (${author}); the numbers and recommendation come from code`;
}

interface CaseDetailViewProps {
  dispute: Dispute;
  order: Order | null;
  facts: Fact[];
  analysis: Analysis | null;
  draft: Draft | null;
  actions: Action[];
  auditLog: AuditLogEntry[];
}

function Section({
  title,
  description,
  aside,
  children,
  className,
  id,
}: {
  title: string;
  description?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} aria-label={title} className={cn("rounded-xl border bg-card", className)}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {aside}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SignerField({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        Signed by
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Your name and role"
        autoComplete="name"
        className="h-11 w-full rounded-lg border border-input bg-card px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm"
      />
      <p className="text-xs text-muted-foreground">Recorded in the audit log with this action.</p>
    </div>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive-soft p-3 text-sm text-destructive">
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}

export function CaseDetailView({
  dispute,
  order,
  facts,
  analysis,
  draft,
  auditLog: initialAuditLog,
}: CaseDetailViewProps) {
  const [selectedFactId, setSelectedFactId] = useState<string | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [caseState, setCaseState] = useState<string>(dispute.caseState);
  const [auditLogList, setAuditLogList] = useState<AuditLogEntry[]>(initialAuditLog);
  const [approverName, setApproverName] = useState(DEFAULT_APPROVER);

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

  // Agent actions: analysis, drafting, and merchant edits
  const router = useRouter();
  const [agentBusy, setAgentBusy] = useState<null | "analyze" | "draft" | "save">(null);
  const [agentError, setAgentError] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftPayload | null>(null);
  const [selectedAiModel, setSelectedAiModel] = useState<string>(DEFAULT_AI_MODEL_ID);

  useEffect(() => {
    const syncPrefs = () => {
      const savedModel = window.localStorage.getItem(AI_MODEL_STORAGE_KEY);
      if (savedModel) setSelectedAiModel(savedModel);
      const savedOperator = window.localStorage.getItem(OPERATOR_NAME_STORAGE_KEY);
      if (savedOperator) setApproverName(savedOperator);
    };
    syncPrefs();
    window.addEventListener(WORKSPACE_PREFS_EVENT, syncPrefs);
    return () => window.removeEventListener(WORKSPACE_PREFS_EVENT, syncPrefs);
  }, []);

  function updateSelectedAiModel(modelId: string) {
    setSelectedAiModel(modelId);
    window.localStorage.setItem(AI_MODEL_STORAGE_KEY, modelId);
    window.dispatchEvent(new CustomEvent(WORKSPACE_PREFS_EVENT));
  }

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

  let groundingErrors: GroundingError[] = [];
  if (draft?.groundingErrorsJson) {
    try {
      groundingErrors = JSON.parse(draft.groundingErrorsJson);
    } catch {
      groundingErrors = [];
    }
  }

  const groundingPassed = draft?.groundingStatus === "pass" || draft?.groundingStatus === "edited_pass";
  const allClaimRefs = parsedDraftBody?.sections?.flatMap((section) => section.paragraphs.flatMap((p) => p.claimRefs)) ?? [];
  const citedFactIds = Array.from(new Set(allClaimRefs));
  const citationCounts = allClaimRefs.reduce<Record<string, number>>((acc, ref) => {
    acc[ref] = (acc[ref] ?? 0) + 1;
    return acc;
  }, {});
  const paragraphCount =
    parsedDraftBody?.sections?.reduce((count, section) => count + section.paragraphs.length, 0) ?? 0;

  // Two-way citation link: a chip jumps to its fact, a fact lights up every paragraph that cites it.
  const showFact = (factId: string) => {
    setSelectedFactId(factId);
    document.getElementById(`fact-${factId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };
  const toggleFact = (factId: string) => setSelectedFactId((current) => (current === factId ? null : factId));

  async function runAgentRequest(kind: "analyze" | "draft" | "save", method: "POST" | "PUT", path: string, body?: unknown) {
    setAgentBusy(kind);
    setAgentError(null);
    try {
      const res = await fetch(`/api/cases/${dispute.paypalDisputeId}/${path}`, {
        method,
        headers: MERCHANT_HEADERS,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong. Try again.");
      }
      setEditDraft(null);
      // Server components reload the case; the page remounts this view with the new data.
      router.refresh();
    } catch (err) {
      setAgentError((err as Error).message);
    } finally {
      setAgentBusy(null);
    }
  }

  const handleAnalyze = () => runAgentRequest("analyze", "POST", "analyze", { modelId: selectedAiModel });
  const handleDraft = () => runAgentRequest("draft", "POST", "draft", { modelId: selectedAiModel });
  const handleSaveEdit = () =>
    editDraft && runAgentRequest("save", "PUT", "draft", { draft: editDraft, editedBy: approverName.trim() || undefined });

  function startEditing() {
    if (!parsedDraftBody?.sections) return;
    setEditDraft({
      summary: parsedDraftBody.summary ?? "",
      sections: parsedDraftBody.sections.map((s) => ({
        heading: s.heading,
        paragraphs: s.paragraphs.map((p) => ({ text: p.text, claimRefs: [...p.claimRefs] })),
      })),
    });
  }

  function updateParagraph(sIdx: number, pIdx: number, text: string) {
    setEditDraft((current) =>
      current && {
        ...current,
        sections: current.sections.map((s, i) =>
          i !== sIdx ? s : { ...s, paragraphs: s.paragraphs.map((p, j) => (j === pIdx ? { ...p, text } : p)) }
        ),
      }
    );
  }

  function removeParagraph(sIdx: number, pIdx: number) {
    setEditDraft((current) =>
      current && {
        ...current,
        sections: current.sections
          .map((s, i) => (i !== sIdx ? s : { ...s, paragraphs: s.paragraphs.filter((_, j) => j !== pIdx) }))
          .filter((s) => s.paragraphs.length > 0),
      }
    );
  }

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
        body: JSON.stringify({ question: askQuestion.trim(), modelId: selectedAiModel }),
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

  // Which actions are open in the current state (same rules as before the redesign).
  const closed = isClosed(caseState);
  const canApprove = !!draft && groundingPassed && !["SUBMITTED", "RESOLVED", "REFUNDED", "ACCEPTED"].includes(caseState);
  const canRefund = !["REFUNDED", "ACCEPTED", "RESOLVED"].includes(caseState);
  const canAccept = !["ACCEPTED", "REFUNDED", "RESOLVED"].includes(caseState);
  // The agent may re-analyze or re-draft until evidence is sent or the case is closed.
  const canWorkOnCase = !closed && caseState !== "SUBMITTED";
  const recommendation = analysis?.recommendation ?? null;
  const recMeta = recommendation ? recommendationMeta(recommendation) : null;
  const amount = formatMoney(dispute.amountMinor, dispute.currency);

  // The primary action follows the recommendation; the other options stay one tap away.
  type ActionKey = "approve" | "refund" | "accept";
  const primaryAction: ActionKey | null =
    closed || caseState === "SUBMITTED"
      ? null
      : recommendation === "REFUND" && canRefund
        ? "refund"
        : recommendation === "ACCEPT" && canAccept
          ? "accept"
          : "approve";

  const actionConfig: Record<ActionKey, { label: string; icon: typeof Send; open: () => void; enabled: boolean }> = {
    approve: { label: "Review and send evidence", icon: Send, open: () => setShowApprovalModal(true), enabled: canApprove },
    refund: { label: `Refund ${amount}`, icon: RotateCcw, open: () => setShowRefundModal(true), enabled: canRefund },
    accept: { label: "Accept the claim", icon: X, open: () => setShowAcceptModal(true), enabled: canAccept },
  };
  const secondaryActions = (["approve", "refund", "accept"] as ActionKey[]).filter(
    (key) => key !== primaryAction && actionConfig[key].enabled
  );

  let nextStepTitle: string;
  let nextStepBody: string;
  if (caseState === "SUBMITTED") {
    nextStepTitle = "Evidence sent to PayPal";
    nextStepBody = "PayPal reviews the evidence and decides. The outcome will show up here.";
  } else if (closed) {
    nextStepTitle = `Closed: ${caseStateMeta(caseState).label.toLowerCase()}`;
    nextStepBody = "Nothing left to do on this dispute.";
  } else if (primaryAction === "refund") {
    nextStepTitle = "Refund the buyer";
    nextStepBody =
      (analysis?.fightLossMinor ?? 0) > (analysis?.refundLossMinor ?? 0)
        ? "Fighting is expected to cost more than refunding. Refunding closes the dispute."
        : "Your evidence is too weak to expect a win, so refunding is the safer choice. Refunding closes the dispute.";
  } else if (primaryAction === "accept") {
    nextStepTitle = "Accept the claim";
    nextStepBody = "PayPal closes the dispute in the buyer's favor.";
  } else {
    nextStepTitle = "Approve the evidence";
    nextStepBody = "Read the draft below, then sign to send it to PayPal. Nothing is sent without you.";
  }

  let approveBlocker: string | null = null;
  if (primaryAction === "approve" && !canApprove) {
    approveBlocker = !draft
      ? "There is no evidence draft yet. Use \"Draft evidence\" below."
      : `Approval is blocked: ${groundingErrors.length || "some"} ${groundingErrors.length === 1 ? "claim isn't" : "claims aren't"} backed by a fact.`;
  }

  const steps = lifecycleSteps(caseState);
  const currentStep = steps.findIndex((s) => s.status === "current");

  const fightLoss = analysis?.fightLossMinor ?? 0;
  const refundLoss = analysis?.refundLossMinor ?? 0;
  const maxLoss = Math.max(fightLoss, refundLoss, 1);
  const costRows = [
    { key: "FIGHT", label: "If you fight", minor: fightLoss, note: "expected loss, incl. fees and effort" },
    { key: "REFUND", label: "If you refund", minor: refundLoss, note: "the disputed amount" },
  ];

  const PrimaryIcon = primaryAction ? actionConfig[primaryAction].icon : Send;
  const showMobileBar = primaryAction !== null;

  // Rendered after the recommendation on small screens and in the sticky side column on desktop.
  const nextStepPanel = (className: string) => (
    <section aria-label="Next step" className={cn("rounded-xl border-2 border-navy bg-card p-5", className)}>
      <h2 className="text-lg font-semibold text-foreground">
        {primaryAction ? `Next: ${nextStepTitle.charAt(0).toLowerCase()}${nextStepTitle.slice(1)}` : nextStepTitle}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{nextStepBody}</p>

      {primaryAction && (
        <div className="mt-4 space-y-2">
          <Button
            size="lg"
            className="w-full"
            variant={primaryAction === "approve" ? "default" : "outline"}
            onClick={actionConfig[primaryAction].open}
            disabled={!actionConfig[primaryAction].enabled}
          >
            <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
            {actionConfig[primaryAction].label}
          </Button>
          {approveBlocker && <p className="text-sm text-destructive">{approveBlocker}</p>}
        </div>
      )}
      {caseState === "SUBMITTED" && (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-success">
          <Check className="h-4 w-4" aria-hidden="true" />
          Sent with {citedFactIds.length} cited facts
        </p>
      )}

      {secondaryActions.length > 0 && (
        <div className="mt-5 border-t pt-4">
          <p className="text-sm font-medium text-foreground">Other options</p>
          <div className="mt-2 flex flex-col gap-2">
            {secondaryActions.map((key) => {
              const Icon = actionConfig[key].icon;
              return (
                <Button key={key} variant="outline" className="w-full justify-start" onClick={actionConfig[key].open}>
                  <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  {actionConfig[key].label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );

  return (
    <div className={cn("space-y-6", showMobileBar && "pb-24 lg:pb-0")}>
      {/* Header */}
      <div className="space-y-5">
        <Link
          href="/cases"
          className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Dispute queue
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0 space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[28px] sm:leading-9">
              {reasonLabel(dispute.reason)}
            </h1>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <CaseStateBadge state={caseState} />
              <span className="font-mono text-xs">{dispute.paypalDisputeId}</span>
              <span aria-hidden="true">·</span>
              {order ? (
                <>
                  Order <span className="font-mono text-xs">{order.id}</span>
                  {order.buyerName && <> · {order.buyerName}</>}
                </>
              ) : (
                "No linked order"
              )}
              {" · "}PayPal: {humanizeEnum(dispute.paypalStatus)}
            </p>
          </div>
          <div className="flex items-end justify-between gap-4 sm:block sm:text-right">
            <div>
              <p className="text-sm text-muted-foreground">Disputed amount</p>
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">{amount}</p>
            </div>
            {dispute.sellerResponseDueAt && !closed && caseState !== "SUBMITTED" && (
              <div className="sm:mt-1.5">
                <DeadlinePill dueAt={dispute.sellerResponseDueAt} />
              </div>
            )}
          </div>
        </div>

        {/* Lifecycle track */}
        <div>
          <p className="mb-2 text-sm text-muted-foreground sm:hidden">
            {currentStep === -1
              ? steps[steps.length - 1].label
              : `Step ${currentStep + 1} of ${steps.length}: ${steps[currentStep].label}`}
          </p>
          <ol className="grid grid-cols-6 gap-1.5" aria-label="Dispute progress">
            {steps.map((step) => (
              <li key={step.key} aria-current={step.status === "current" ? "step" : undefined}>
                <span
                  className={cn(
                    "block h-1.5 rounded-full",
                    step.status === "done" && "bg-navy",
                    step.status === "current" && "bg-primary",
                    step.status === "upcoming" && "bg-border"
                  )}
                />
                <span
                  className={cn(
                    "mt-2 hidden text-xs sm:block",
                    step.status === "current" ? "font-semibold text-primary" : "text-muted-foreground",
                    step.status === "done" && "text-foreground"
                  )}
                >
                  {step.label}
                </span>
                <span className="sr-only">{step.status === "done" ? "(done)" : step.status === "current" ? "(current)" : ""}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Main column */}
        <div className="min-w-0 space-y-6">
          {/* Recommendation */}
          {analysis && recMeta ? (
            <section aria-label="Recommendation" className="overflow-hidden rounded-xl border bg-card">
              <div className="border-b bg-accent/50 px-5 py-4">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="text-xl font-semibold text-foreground">
                    Recommended: {recMeta.headline.charAt(0).toLowerCase()}
                    {recMeta.headline.slice(1)}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Evidence strength <span className="font-semibold tabular-nums text-foreground">{analysis.strengthScore}%</span>
                    {" · "}
                    {winBandLabel(analysis.pWinBand)}
                  </p>
                </div>
              </div>
              <div className="grid gap-6 p-5 xl:grid-cols-2">
                <div className="space-y-4">
                  <p className="max-w-[65ch] text-[15px] leading-relaxed text-foreground">{analysis.rationale}</p>
                  <div className="space-y-3">
                    {costRows.map((row) => {
                      const recommended = row.key === recommendation;
                      return (
                        <div key={row.key}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className={cn("font-medium", recommended ? "text-foreground" : "text-muted-foreground")}>
                              {row.label}
                              {recommended && <span className="ml-2 text-xs font-semibold text-primary">Recommended</span>}
                            </span>
                            <span className="font-semibold tabular-nums text-foreground">
                              {formatMoney(row.minor, dispute.currency)}
                            </span>
                          </div>
                          <div className="mt-1.5 h-2.5 rounded-full bg-muted">
                            <div
                              className={cn("h-full rounded-full", recommended ? "bg-primary" : "bg-input")}
                              style={{ width: `${Math.max(2, Math.round((row.minor * 100) / maxLoss))}%` }}
                            />
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{row.note}</p>
                        </div>
                      );
                    })}
                    <p className="text-sm font-medium text-foreground">
                      {refundLoss - fightLoss < 0
                        ? `Fighting costs about ${formatMoney(fightLoss - refundLoss, dispute.currency)} more on average.`
                        : recommendation === "REFUND"
                          ? `On average fighting saves ${formatMoney(refundLoss - fightLoss, dispute.currency)}, but the win odds are low, so most outcomes lose the full amount.`
                          : `Fighting saves about ${formatMoney(refundLoss - fightLoss, dispute.currency)} on average.`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Calculated by code from fees, effort, and win probability. {authorLabel(analysis.model, "rationale")}.
                    </p>
                    {canWorkOnCase && (
                      <Button variant="ghost" size="sm" onClick={handleAnalyze} disabled={agentBusy !== null}>
                        {agentBusy === "analyze" ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="h-4 w-4" aria-hidden="true" />
                        )}
                        {agentBusy === "analyze" ? "Re-checking the evidence…" : "Re-run analysis"}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="xl:border-l xl:pl-6">
                  <h3 className="text-sm font-semibold text-foreground">What PayPal looks for</h3>
                  {breakdown.length > 0 ? (
                    <ul className="mt-3 space-y-3">
                      {breakdown.map((item, idx) => (
                        <li key={idx} className="flex gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                              item.satisfied ? "bg-success-soft text-success" : "bg-muted text-muted-foreground"
                            )}
                          >
                            {item.satisfied ? (
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <X className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            <span className="sr-only">{item.satisfied ? "Present" : "Missing"}</span>
                          </span>
                          <div className="min-w-0">
                            <p className={cn("text-sm font-medium", item.satisfied ? "text-foreground" : "text-muted-foreground")}>
                              {item.signal}
                            </p>
                            <p className="text-sm text-muted-foreground">{item.notes}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-muted-foreground">The checklist appears once the analysis is done.</p>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section aria-label="Recommendation" className="rounded-xl border border-dashed bg-card p-5">
              <h2 className="text-base font-semibold text-foreground">No recommendation yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                The analysis scores your evidence and compares the cost of fighting against refunding, using the facts below.
              </p>
              {canWorkOnCase && (
                <Button className="mt-4" onClick={handleAnalyze} disabled={agentBusy !== null}>
                  {agentBusy === "analyze" ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-4 w-4" aria-hidden="true" />
                  )}
                  {agentBusy === "analyze" ? "Analyzing…" : "Analyze this dispute"}
                </Button>
              )}
            </section>
          )}

          {nextStepPanel("lg:hidden")}

          <ErrorNote message={agentError} />

          {/* Evidence draft */}
          <Section
            title="Evidence for PayPal"
            description="Every sentence cites the record it comes from. Select a citation to see the source."
            aside={
              draft ? (
                groundingPassed ? (
                  <Badge variant="success">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    All claims backed · {citedFactIds.length} facts in {paragraphCount} paragraphs
                  </Badge>
                ) : (
                  <Badge variant="destructive">
                    <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                    {groundingErrors.length} unsupported {groundingErrors.length === 1 ? "claim" : "claims"}
                  </Badge>
                )
              ) : undefined
            }
          >
            {!editDraft && (canWorkOnCase || draft) && (
              <div className="mb-5 flex flex-wrap items-center gap-2">
                {canWorkOnCase && (
                  <>
                    <Button
                      variant={draft ? "outline" : "default"}
                      size="sm"
                      onClick={handleDraft}
                      disabled={agentBusy !== null}
                    >
                      {agentBusy === "draft" ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      ) : (
                        <Sparkles className="h-4 w-4" aria-hidden="true" />
                      )}
                      {agentBusy === "draft" ? "Drafting and fact-checking…" : draft ? "Regenerate draft" : "Draft evidence"}
                    </Button>
                    <select
                      aria-label="Select AI Model for drafting"
                      value={selectedAiModel}
                      onChange={(e) => updateSelectedAiModel(e.target.value)}
                      disabled={agentBusy !== null}
                      className="h-9 rounded-lg border border-input bg-card px-2.5 text-xs font-medium text-foreground focus:border-primary focus:outline-none"
                    >
                      {AI_MODEL_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          Engine: {opt.label}
                        </option>
                      ))}
                      {!AI_MODEL_OPTIONS.some((m) => m.id === selectedAiModel) && (
                        <option value={selectedAiModel}>Engine: {selectedAiModel}</option>
                      )}
                    </select>
                    {parsedDraftBody?.sections && (
                      <Button variant="outline" size="sm" onClick={startEditing} disabled={agentBusy !== null}>
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                        Edit text
                      </Button>
                    )}
                  </>
                )}
                {draft && groundingPassed && (
                  <a
                    href={`/api/cases/${dispute.paypalDisputeId}/packet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <FileDown className="h-4 w-4" aria-hidden="true" />
                    Preview Evidence PDF
                  </a>
                )}
                {draft && caseState === "APPROVED" && (
                  <p className="text-xs text-muted-foreground">Changing the draft withdraws your approval.</p>
                )}
              </div>
            )}

            {editDraft && (
              <div className="space-y-5">
                <p className="text-sm text-muted-foreground">
                  Edit the wording or remove paragraphs. Citations stay attached, and the fact check runs again when you
                  save: any date, amount, carrier, or tracking number must match the cited facts.
                </p>
                <div className="space-y-1.5">
                  <label htmlFor="edit-summary" className="text-sm font-medium text-foreground">
                    Summary
                  </label>
                  <textarea
                    id="edit-summary"
                    value={editDraft.summary}
                    onChange={(e) => setEditDraft({ ...editDraft, summary: e.target.value })}
                    rows={2}
                    className="w-full rounded-lg border border-input bg-card p-3 text-sm text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                  />
                </div>
                {editDraft.sections.map((section, sIdx) => (
                  <div key={sIdx} className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">{section.heading}</h3>
                    {section.paragraphs.map((p, pIdx) => (
                      <div key={pIdx} className="rounded-lg border p-3">
                        <label htmlFor={`edit-${sIdx}-${pIdx}`} className="sr-only">
                          Paragraph {pIdx + 1} of {section.heading}
                        </label>
                        <textarea
                          id={`edit-${sIdx}-${pIdx}`}
                          value={p.text}
                          onChange={(e) => updateParagraph(sIdx, pIdx, e.target.value)}
                          rows={3}
                          className="w-full rounded-md border border-input bg-card p-2 text-sm leading-relaxed text-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-1.5">
                          {p.claimRefs.map((ref) => (
                            <span
                              key={ref}
                              className="inline-flex h-7 items-center rounded-md border bg-card px-2 font-mono text-xs text-accent-foreground"
                            >
                              {ref}
                            </span>
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="ml-auto"
                            onClick={() => removeParagraph(sIdx, pIdx)}
                            aria-label={`Remove paragraph ${pIdx + 1} of ${section.heading}`}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleSaveEdit} disabled={agentBusy !== null || editDraft.sections.length === 0}>
                    {agentBusy === "save" ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                    )}
                    {agentBusy === "save" ? "Fact-checking…" : "Save and fact-check"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditDraft(null)} disabled={agentBusy !== null}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {!editDraft && groundingErrors.length > 0 && (
              <div role="alert" className="mb-5 rounded-lg bg-destructive-soft p-4 text-sm">
                <p className="flex items-center gap-2 font-semibold text-destructive">
                  <ShieldAlert className="h-4 w-4" aria-hidden="true" />
                  Approval is blocked until these are fixed
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-6 text-foreground">
                  {groundingErrors.map((err, idx) => (
                    <li key={idx}>
                      {err.message} <span className="font-mono text-xs text-destructive">{err.code}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {editDraft ? null : parsedDraftBody ? (
              <div className="space-y-6">
                {parsedDraftBody.summary && (
                  <p className="max-w-[65ch] text-[15px] font-medium leading-relaxed text-foreground">
                    {parsedDraftBody.summary}
                  </p>
                )}
                {parsedDraftBody.sections?.map((section, sIdx) => (
                  <div key={sIdx}>
                    <h3 className="text-sm font-semibold text-foreground">{section.heading}</h3>
                    <div className="mt-2 space-y-2">
                      {section.paragraphs.map((p, pIdx) => {
                        const linked = selectedFactId !== null && p.claimRefs.includes(selectedFactId);
                        return (
                          <div
                            key={pIdx}
                            className={cn(
                              "rounded-lg border p-3 transition-colors duration-200",
                              linked ? "border-primary bg-accent/60" : "border-transparent bg-muted/60"
                            )}
                          >
                            <p className="max-w-[70ch] text-sm leading-relaxed text-foreground">{p.text}</p>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {p.claimRefs.map((ref) => (
                                <button
                                  key={ref}
                                  type="button"
                                  onClick={() => showFact(ref)}
                                  aria-label={`Show source fact ${ref}`}
                                  aria-pressed={selectedFactId === ref}
                                  className={cn(
                                    "inline-flex h-7 items-center rounded-md border px-2 font-mono text-xs transition-colors duration-150",
                                    selectedFactId === ref
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-card text-accent-foreground hover:border-primary"
                                  )}
                                >
                                  {ref}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">
                  {authorLabel(draft?.author, "draft")} · version {draft?.version ?? 1}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {recommendation && recommendation !== "FIGHT"
                  ? "No draft was written because the recommendation is not to fight. You can still draft evidence if you want to respond."
                  : "The evidence draft hasn't been written yet."}
              </p>
            )}
          </Section>

          {/* Fact base */}
          <Section
            id="facts"
            title={`Fact base (${facts.length})`}
            description="Records from your store and PayPal. The draft may only restate these."
          >
            <ul className="space-y-2">
              {facts.map((fact) => {
                const isSelected = selectedFactId === fact.id;
                const cited = citationCounts[fact.id] ?? 0;
                return (
                  <li key={fact.id} id={`fact-${fact.id}`} className="scroll-mt-24">
                    <button
                      type="button"
                      onClick={() => toggleFact(fact.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "w-full rounded-lg border p-3 text-left transition-colors duration-200",
                        isSelected ? "animate-cite-flash border-primary bg-accent/60" : "border-border hover:bg-muted/60"
                      )}
                    >
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-xs font-semibold text-accent-foreground">{fact.id}</span>
                        <span className="text-sm font-medium text-foreground">{fact.label}</span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {cited > 0 ? `Cited ${cited}×` : "Not cited"}
                        </span>
                      </span>
                      <span className="mt-1 block text-sm text-muted-foreground">{fact.value}</span>
                      <span className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{fact.source}</span>
                        {fact.untrusted === 1 && (
                          <Badge variant="warning">Buyer-written text · treated as data only</Badge>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Section>
        </div>

        {/* Side column */}
        <aside className="min-w-0 space-y-6 lg:sticky lg:top-6">
          {nextStepPanel("hidden lg:block")}

          {/* Order */}
          <Section title="Order">
            {order ? (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2.5 text-sm">
                <dt className="text-muted-foreground">Order</dt>
                <dd className="font-mono text-xs leading-5 text-foreground">{order.id}</dd>
                <dt className="text-muted-foreground">Buyer</dt>
                <dd className="min-w-0 text-foreground">
                  {order.buyerName || "—"}
                  {order.buyerEmail && <span className="block truncate text-muted-foreground">{order.buyerEmail}</span>}
                </dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="text-foreground">{humanizeEnum(order.status)}</dd>
                {order.trackingNumber && (
                  <>
                    <dt className="text-muted-foreground">Tracking</dt>
                    <dd className="flex items-center gap-1.5 text-foreground">
                      <Truck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="font-mono text-xs">
                        {order.carrier} {order.trackingNumber}
                      </span>
                    </dd>
                  </>
                )}
                <dt className="text-muted-foreground">PayPal stage</dt>
                <dd className="text-foreground">{humanizeEnum(dispute.lifeCycleStage || "INQUIRY")}</dd>
                {dispute.sellerResponseDueAt && (
                  <>
                    <dt className="text-muted-foreground">Respond by</dt>
                    <dd className="text-foreground">{formatUtc(dispute.sellerResponseDueAt)}</dd>
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-muted-foreground">No store order is linked to this dispute.</p>
            )}
          </Section>

          {/* Ask copilot */}
          <Section
            title="Ask about this dispute"
            description={
              <>
                Read-only answers from this dispute&apos;s records and, in sandbox mode, PayPal Agent Toolkit (
                <span className="font-mono text-xs">get_dispute</span>, shipment tracking). It can&apos;t change anything.
              </>
            }
          >
            <form onSubmit={handleAskSubmit} className="flex gap-2">
              <label htmlFor="ask-question" className="sr-only">
                Question
              </label>
              <input
                id="ask-question"
                type="text"
                value={askQuestion}
                onChange={(e) => setAskQuestion(e.target.value)}
                placeholder="Was the package delivered?"
                className="h-10 min-w-0 flex-1 rounded-full border border-input bg-card px-4 text-base text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 sm:text-sm"
              />
              <Button type="submit" variant="secondary" disabled={askLoading || !askQuestion.trim()}>
                {askLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Bot className="h-4 w-4" aria-hidden="true" />
                )}
                Ask
              </Button>
            </form>
            {askLoading && (
              <p className="mt-3 text-sm text-muted-foreground" role="status">
                Checking the records…
              </p>
            )}
            {askAnswer && (
              <div className="mt-3 rounded-lg bg-muted/70 p-3 text-sm" aria-live="polite">
                <p className="whitespace-pre-wrap leading-relaxed text-foreground">{askAnswer}</p>
                {askToolsUsed.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Tools used: <span className="font-mono">{askToolsUsed.join(", ")}</span>
                  </p>
                )}
              </div>
            )}
          </Section>

          {/* Activity */}
          <Section title="Activity">
            {auditLogList.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ol className="space-y-4">
                {auditLogList.map((log, i) => (
                  <li key={log.id} className="relative flex gap-3">
                    {i < auditLogList.length - 1 && (
                      <span aria-hidden="true" className="absolute left-[5px] top-4 h-[calc(100%+0.25rem)] w-px bg-border" />
                    )}
                    <span
                      aria-hidden="true"
                      className={cn(
                        "relative mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 bg-card",
                        log.actor === "human" ? "border-primary" : "border-navy"
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{humanizeEnum(log.action)}</p>
                      <p className="text-xs text-muted-foreground">
                        {ACTOR_LABELS[log.actor] ?? humanizeEnum(log.actor)} · {formatUtc(log.ts)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </aside>
      </div>

      {/* Phone and tablet: keep the primary action in thumb reach */}
      {showMobileBar && primaryAction && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_hsl(var(--navy)/0.25)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{nextStepTitle}</p>
              <p className="truncate text-xs text-muted-foreground">
                {approveBlocker ?? `${amount} · ${reasonLabel(dispute.reason).toLowerCase()}`}
              </p>
            </div>
            <Button
              onClick={actionConfig[primaryAction].open}
              disabled={!actionConfig[primaryAction].enabled}
              variant={primaryAction === "approve" ? "default" : "outline"}
            >
              <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
              {primaryAction === "approve" ? "Review" : primaryAction === "refund" ? "Refund" : "Accept"}
            </Button>
          </div>
        </div>
      )}

      {/* Approve and send */}
      <Dialog open={showApprovalModal} onOpenChange={setShowApprovalModal}>
        <DialogHeader>
          <DialogTitle>Send this evidence to PayPal?</DialogTitle>
          <DialogDescription>
            You are approving the evidence packet below. DisputeDefender sends it through the PayPal Disputes API
            (Sandbox).
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg bg-muted/70 p-4 text-sm">
          <dt className="text-muted-foreground">Dispute</dt>
          <dd className="font-mono text-xs leading-5">{dispute.paypalDisputeId}</dd>
          <dt className="text-muted-foreground">Evidence type</dt>
          <dd>{draft?.evidenceType ? humanizeEnum(draft.evidenceType) : "—"}</dd>
          {order?.carrier && order.trackingNumber && (
            <>
              <dt className="text-muted-foreground">Tracking</dt>
              <dd className="font-mono text-xs leading-5">
                {order.carrier} {order.trackingNumber}
              </dd>
            </>
          )}
          <dt className="text-muted-foreground">Cited facts</dt>
          <dd className="font-mono text-xs leading-5">{citedFactIds.length > 0 ? citedFactIds.join(", ") : "—"}</dd>
          <dt className="text-muted-foreground">Fact check</dt>
          <dd>{groundingPassed ? "All claims backed" : `Not passed (${draft?.groundingStatus ?? "no draft"})`}</dd>
        </dl>

        <div className="mt-4">
          <p className="text-sm font-medium text-foreground">Note sent to PayPal</p>
          <p className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border p-3 text-sm text-foreground">
            {draft?.notesText || "—"}
          </p>
        </div>

        <div className="mt-4 space-y-3">
          <SignerField id="approve-signer" value={approverName} onChange={setApproverName} />
          <ErrorNote message={submitError} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowApprovalModal(false)} disabled={submittingEvidence}>
            Cancel
          </Button>
          <Button onClick={handleApproveAndSubmit} disabled={submittingEvidence || !approverName.trim()}>
            {submittingEvidence ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Send className="h-4 w-4" aria-hidden="true" />
            )}
            {submittingEvidence ? "Sending…" : "Approve and send"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Refund */}
      <Dialog open={showRefundModal} onOpenChange={setShowRefundModal}>
        <DialogHeader>
          <DialogTitle>Refund {amount} to the buyer?</DialogTitle>
          <DialogDescription>
            The refund goes out right away through the PayPal Payments API (Sandbox) and closes this dispute.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 rounded-lg bg-muted/70 p-4 text-sm">
          <dt className="text-muted-foreground">Dispute</dt>
          <dd className="font-mono text-xs leading-5">{dispute.paypalDisputeId}</dd>
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="font-semibold tabular-nums">{amount}</dd>
          <dt className="text-muted-foreground">Capture</dt>
          <dd className="font-mono text-xs leading-5">{dispute.captureId || order?.captureId || "On file"}</dd>
        </dl>

        <div className="mt-4 space-y-3">
          <SignerField id="refund-signer" value={approverName} onChange={setApproverName} />
          <ErrorNote message={refundError} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowRefundModal(false)} disabled={refunding}>
            Cancel
          </Button>
          <Button onClick={handleRefund} disabled={refunding || !approverName.trim()} variant="destructive">
            {refunding && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {refunding ? "Refunding…" : `Refund ${amount}`}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Accept claim */}
      <Dialog open={showAcceptModal} onOpenChange={setShowAcceptModal}>
        <DialogHeader>
          <DialogTitle>Accept the buyer&apos;s claim?</DialogTitle>
          <DialogDescription>
            PayPal closes this dispute in the buyer&apos;s favor and debits the disputed {amount} from your account.
            This can&apos;t be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <SignerField id="accept-signer" value={approverName} onChange={setApproverName} />
          <ErrorNote message={acceptError} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setShowAcceptModal(false)} disabled={accepting}>
            Cancel
          </Button>
          <Button onClick={handleAcceptClaim} disabled={accepting || !approverName.trim()} variant="destructive">
            {accepting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {accepting ? "Accepting…" : "Accept the claim"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
