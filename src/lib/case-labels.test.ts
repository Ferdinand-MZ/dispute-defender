import { describe, expect, it } from "vitest";
import { humanizeEnum, lifecycleSteps, nextStep, reasonLabel } from "./case-labels";

describe("case labels", () => {
  it("names the two in-scope dispute reasons in plain language", () => {
    expect(reasonLabel("MERCHANDISE_OR_SERVICE_NOT_RECEIVED")).toBe("Item not received");
    expect(reasonLabel("MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED")).toBe("Not as described");
    expect(reasonLabel("UNAUTHORISED")).toBe("Unauthorised");
  });

  it("humanizes audit actions", () => {
    expect(humanizeEnum("CUSTOMER.DISPUTE.CREATED")).toBe("Customer dispute created");
  });

  it("tells the merchant what to do next", () => {
    expect(nextStep("DRAFTED", "FIGHT")).toEqual({ label: "Review and approve evidence", actionable: true });
    expect(nextStep("DRAFTED", "REFUND")).toEqual({ label: "Review refund", actionable: true });
    expect(nextStep("SUBMITTED", "FIGHT")).toEqual({ label: "Waiting for PayPal", actionable: false });
    expect(nextStep("REFUNDED", "REFUND")).toEqual({ label: "No action needed", actionable: false });
  });

  it("does not ask the merchant to act before there is anything to review", () => {
    expect(nextStep("NEW", null)).toEqual({ label: "Waiting for analysis", actionable: false });
    expect(nextStep("ANALYZED", "FIGHT")).toEqual({ label: "Waiting for evidence draft", actionable: false });
  });

  it("marks the current lifecycle step", () => {
    const steps = lifecycleSteps("DRAFTED");
    expect(steps.map((s) => s.status)).toEqual(["done", "done", "current", "upcoming", "upcoming", "upcoming"]);
  });

  it("ends the track with the early outcome when the case was refunded", () => {
    const steps = lifecycleSteps("REFUNDED");
    expect(steps.every((s) => s.status === "done")).toBe(true);
    expect(steps[steps.length - 1].label).toBe("Refunded");
  });
});
