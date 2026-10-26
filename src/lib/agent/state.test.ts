import { describe, it, expect } from "vitest";
import {
  canTransition,
  transitionState,
  IllegalStateTransitionError,
  CaseStates,
} from "./state";

describe("Case State Machine", () => {
  it("allows standard happy path lifecycle transitions", () => {
    expect(canTransition(CaseStates.NEW, CaseStates.ANALYZED)).toBe(true);
    expect(transitionState(CaseStates.NEW, CaseStates.ANALYZED)).toBe(CaseStates.ANALYZED);

    expect(canTransition(CaseStates.ANALYZED, CaseStates.DRAFTED)).toBe(true);
    expect(transitionState(CaseStates.ANALYZED, CaseStates.DRAFTED)).toBe(CaseStates.DRAFTED);

    expect(canTransition(CaseStates.DRAFTED, CaseStates.APPROVED)).toBe(true);
    expect(transitionState(CaseStates.DRAFTED, CaseStates.APPROVED)).toBe(CaseStates.APPROVED);

    expect(canTransition(CaseStates.APPROVED, CaseStates.SUBMITTED)).toBe(true);
    expect(transitionState(CaseStates.APPROVED, CaseStates.SUBMITTED)).toBe(CaseStates.SUBMITTED);

    expect(canTransition(CaseStates.SUBMITTED, CaseStates.RESOLVED)).toBe(true);
    expect(transitionState(CaseStates.SUBMITTED, CaseStates.RESOLVED)).toBe(CaseStates.RESOLVED);
  });

  it("allows direct refund and accept paths from open states", () => {
    expect(canTransition(CaseStates.NEW, CaseStates.REFUNDED)).toBe(true);
    expect(canTransition(CaseStates.ANALYZED, CaseStates.ACCEPTED)).toBe(true);
    expect(canTransition(CaseStates.DRAFTED, CaseStates.REFUNDED)).toBe(true);
  });

  it("throws IllegalStateTransitionError on forbidden jumps", () => {
    // Cannot skip approval directly to submit
    expect(canTransition(CaseStates.DRAFTED, CaseStates.SUBMITTED)).toBe(false);
    expect(() => transitionState(CaseStates.DRAFTED, CaseStates.SUBMITTED)).toThrow(
      IllegalStateTransitionError
    );

    // Terminal states cannot transition
    expect(canTransition(CaseStates.RESOLVED, CaseStates.NEW)).toBe(false);
    expect(() => transitionState(CaseStates.RESOLVED, CaseStates.NEW)).toThrow(
      IllegalStateTransitionError
    );

    expect(canTransition(CaseStates.EXPIRED, CaseStates.APPROVED)).toBe(false);
    expect(() => transitionState(CaseStates.EXPIRED, CaseStates.APPROVED)).toThrow(
      IllegalStateTransitionError
    );
  });
});
