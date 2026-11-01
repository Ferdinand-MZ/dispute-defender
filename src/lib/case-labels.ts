/**
 * Plain-language labels for PayPal enums and case states, shared by every screen.
 * Display only: no state transitions or money logic live here.
 */

export type Tone = "neutral" | "info" | "success" | "warning" | "danger";

const REASON_LABELS: Record<string, string> = {
  MERCHANDISE_OR_SERVICE_NOT_RECEIVED: "Item not received",
  MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED: "Not as described",
};

/** "SOME_ENUM_VALUE" -> "Some enum value" */
export function humanizeEnum(value: string): string {
  const words = value.replace(/[._]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function reasonLabel(reason: string): string {
  return REASON_LABELS[reason] ?? humanizeEnum(reason.replace(/^MERCHANDISE_OR_SERVICE_/, ""));
}

interface StateMeta {
  label: string;
  tone: Tone;
}

const STATE_META: Record<string, StateMeta> = {
  NEW: { label: "New", tone: "info" },
  ANALYZED: { label: "Analyzed", tone: "info" },
  DRAFTED: { label: "Draft ready", tone: "info" },
  APPROVED: { label: "Approved", tone: "success" },
  SUBMITTED: { label: "Sent to PayPal", tone: "neutral" },
  RESOLVED: { label: "Resolved", tone: "success" },
  ACCEPTED: { label: "Claim accepted", tone: "neutral" },
  REFUNDED: { label: "Refunded", tone: "neutral" },
  EXPIRED: { label: "Expired", tone: "danger" },
  NEEDS_ATTENTION: { label: "Needs attention", tone: "danger" },
};

export function caseStateMeta(state: string): StateMeta {
  return STATE_META[state] ?? { label: humanizeEnum(state), tone: "neutral" };
}

/** States where the merchant has nothing left to do. */
export const CLOSED_STATES = new Set(["RESOLVED", "ACCEPTED", "REFUNDED", "EXPIRED"]);

export function isClosed(state: string): boolean {
  return CLOSED_STATES.has(state);
}

interface RecommendationMeta {
  label: string;
  /** Imperative headline for the case page. */
  headline: string;
  tone: Tone;
}

const RECOMMENDATION_META: Record<string, RecommendationMeta> = {
  FIGHT: { label: "Fight", headline: "Fight this dispute", tone: "info" },
  REFUND: { label: "Refund", headline: "Refund the buyer", tone: "warning" },
  ACCEPT: { label: "Accept", headline: "Accept the claim", tone: "neutral" },
};

export function recommendationMeta(recommendation: string): RecommendationMeta {
  return (
    RECOMMENDATION_META[recommendation] ?? {
      label: humanizeEnum(recommendation),
      headline: humanizeEnum(recommendation),
      tone: "neutral",
    }
  );
}

const WIN_BAND_LABELS: Record<string, string> = {
  high: "High chance to win",
  medium: "Medium chance to win",
  low: "Low chance to win",
  very_low: "Very low chance to win",
};

export function winBandLabel(band: string): string {
  return WIN_BAND_LABELS[band] ?? humanizeEnum(band);
}

export interface NextStep {
  label: string;
  /** True when the merchant can act on the case right now. */
  actionable: boolean;
}

/** What happens next on a case, in a few words, and whether it is the merchant's move. */
export function nextStep(state: string, recommendation: string | null): NextStep {
  if (isClosed(state)) return { label: "No action needed", actionable: false };
  if (state === "SUBMITTED") return { label: "Waiting for PayPal", actionable: false };
  if (state === "NEEDS_ATTENTION") return { label: "Check what went wrong", actionable: true };
  if (recommendation === "REFUND") return { label: "Review refund", actionable: true };
  if (recommendation === "ACCEPT") return { label: "Review and accept claim", actionable: true };
  if (state === "APPROVED") return { label: "Send evidence to PayPal", actionable: true };
  if (state === "DRAFTED") return { label: "Review and approve evidence", actionable: true };
  if (state === "ANALYZED") return { label: "Waiting for evidence draft", actionable: false };
  return { label: "Waiting for analysis", actionable: false };
}

/** The case lifecycle shown as a track on the case page. */
export const LIFECYCLE_STEPS = ["NEW", "ANALYZED", "DRAFTED", "APPROVED", "SUBMITTED", "RESOLVED"] as const;

const STEP_LABELS: Record<(typeof LIFECYCLE_STEPS)[number], string> = {
  NEW: "Received",
  ANALYZED: "Analyzed",
  DRAFTED: "Draft ready",
  APPROVED: "Approved",
  SUBMITTED: "Sent to PayPal",
  RESOLVED: "Resolved",
};

export interface LifecycleStep {
  key: string;
  label: string;
  status: "done" | "current" | "upcoming";
}

/**
 * Map a case state onto the lifecycle track. Refund, accept and expiry end the case early:
 * the final step takes that outcome's name and everything before it counts as done.
 */
export function lifecycleSteps(state: string): LifecycleStep[] {
  const endedEarly = state === "ACCEPTED" || state === "REFUNDED" || state === "EXPIRED";
  const index = LIFECYCLE_STEPS.indexOf(state as (typeof LIFECYCLE_STEPS)[number]);
  const currentIndex = endedEarly ? LIFECYCLE_STEPS.length - 1 : index === -1 ? 0 : index;

  return LIFECYCLE_STEPS.map((key, i) => {
    const isLast = i === LIFECYCLE_STEPS.length - 1;
    const label = isLast && endedEarly ? caseStateMeta(state).label : STEP_LABELS[key];
    const finished = state === "RESOLVED" || endedEarly;
    let status: LifecycleStep["status"] = "upcoming";
    if (i < currentIndex || (finished && i === currentIndex)) status = "done";
    else if (i === currentIndex) status = "current";
    return { key, label, status };
  });
}
