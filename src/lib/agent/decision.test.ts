import { describe, it, expect } from "vitest";
import { evaluateDecision } from "./decision";

describe("Deterministic Cost Comparison & Decision Engine", () => {
  it("recommends FIGHT for Scenario S1 (strong evidence, favorable EV)", () => {
    // S1: $48.00 amount, 0 fee, $5.00 effort, pWin 0.75
    // expectedLossIfFight = (1 - 0.75) * (4800 + 0) + 500 = 1200 + 500 = 1700 ($17.00)
    // lossIfRefund = 4800 ($48.00)
    // 1700 < 4800 -> FIGHT
    const decision = evaluateDecision({
      amountMinor: 4800,
      feeMinor: 0,
      effortCostMinor: 500,
      pWin: 0.75,
      hasValidEvidence: true,
    });

    expect(decision.recommendation).toBe("FIGHT");
    expect(decision.expectedLossIfFightMinor).toBe(1700);
    expect(decision.lossIfRefundMinor).toBe(4800);
    expect(decision.netBenefitOfFightingMinor).toBe(3100);
  });

  it("recommends REFUND when expected loss of fighting exceeds refund amount", () => {
    // Low amount ($10.00), low pWin (0.30), high effort ($8.00), fee ($15.00)
    // expectedLossIfFight = 0.70 * (1000 + 1500) + 800 = 1750 + 800 = 2550 ($25.50)
    // lossIfRefund = 1000 ($10.00)
    // 2550 > 1000 -> REFUND
    const decision = evaluateDecision({
      amountMinor: 1000,
      feeMinor: 1500,
      effortCostMinor: 800,
      pWin: 0.3,
      hasValidEvidence: true,
    });

    expect(decision.recommendation).toBe("REFUND");
    expect(decision.expectedLossIfFightMinor).toBe(2550);
    expect(decision.lossIfRefundMinor).toBe(1000);
  });

  it("recommends ACCEPT when no valid evidence exists", () => {
    const decision = evaluateDecision({
      amountMinor: 15000,
      feeMinor: 0,
      effortCostMinor: 500,
      pWin: 0.75,
      hasValidEvidence: false,
    });

    expect(decision.recommendation).toBe("ACCEPT");
  });
});
