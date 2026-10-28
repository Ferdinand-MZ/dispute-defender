export const CaseStates = {
  NEW: "NEW",
  ANALYZED: "ANALYZED",
  DRAFTED: "DRAFTED",
  APPROVED: "APPROVED",
  SUBMITTED: "SUBMITTED",
  RESOLVED: "RESOLVED",
  ACCEPTED: "ACCEPTED",
  REFUNDED: "REFUNDED",
  EXPIRED: "EXPIRED",
  NEEDS_ATTENTION: "NEEDS_ATTENTION",
} as const;

export type CaseState = (typeof CaseStates)[keyof typeof CaseStates];

export const ALLOWED_TRANSITIONS: Record<CaseState, CaseState[]> = {
  NEW: ["ANALYZED", "ACCEPTED", "REFUNDED", "EXPIRED", "NEEDS_ATTENTION", "RESOLVED"],
  ANALYZED: ["DRAFTED", "ACCEPTED", "REFUNDED", "EXPIRED", "NEEDS_ATTENTION", "ANALYZED", "RESOLVED"],
  DRAFTED: ["APPROVED", "ACCEPTED", "REFUNDED", "EXPIRED", "NEEDS_ATTENTION", "DRAFTED", "ANALYZED", "RESOLVED"],
  APPROVED: ["SUBMITTED", "DRAFTED", "NEEDS_ATTENTION", "EXPIRED", "ACCEPTED", "REFUNDED", "RESOLVED"],
  SUBMITTED: ["RESOLVED", "NEEDS_ATTENTION"],
  ACCEPTED: ["RESOLVED"],
  REFUNDED: ["RESOLVED"],
  NEEDS_ATTENTION: ["NEW", "ANALYZED", "DRAFTED", "APPROVED", "ACCEPTED", "REFUNDED", "RESOLVED", "EXPIRED"],
  RESOLVED: [],
  EXPIRED: [],
};

export class IllegalStateTransitionError extends Error {
  constructor(public from: CaseState, public to: CaseState) {
    super(`Illegal case state transition from ${from} to ${to}`);
    this.name = "IllegalStateTransitionError";
  }
}

export function canTransition(from: CaseState, to: CaseState): boolean {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function transitionState(from: CaseState, to: CaseState): CaseState {
  if (!canTransition(from, to)) {
    throw new IllegalStateTransitionError(from, to);
  }
  return to;
}
