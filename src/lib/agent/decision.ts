export type Recommendation = "FIGHT" | "REFUND" | "ACCEPT";

export interface DecisionInputs {
  amountMinor: number;
  feeMinor: number;
  effortCostMinor: number;
  pWin: number; // 0.0 to 1.0
  hasValidEvidence: boolean;
}

export interface DecisionResult {
  recommendation: Recommendation;
  expectedLossIfFightMinor: number;
  lossIfRefundMinor: number;
  netBenefitOfFightingMinor: number;
  rationale: string;
  formula: {
    amountMinor: number;
    feeMinor: number;
    effortCostMinor: number;
    pWin: number;
    calculationText: string;
  };
}

/**
 * Deterministic cost comparison and recommendation.
 * Principle: Code decides money and recommendations, never the LLM.
 */
export function evaluateDecision({
  amountMinor,
  feeMinor,
  effortCostMinor,
  pWin,
  hasValidEvidence,
}: DecisionInputs): DecisionResult {
  const lossIfRefundMinor = amountMinor;

  // expectedLossIfFight = (1 - pWin) * (amount + fee) + effortCost
  const probabilityOfLoss = Math.max(0, Math.min(1, 1 - pWin));
  const lossIfFightLost = amountMinor + feeMinor;
  const expectedLossIfFightMinor = Math.round(
    probabilityOfLoss * lossIfFightLost + effortCostMinor
  );

  const netBenefitOfFightingMinor = lossIfRefundMinor - expectedLossIfFightMinor;

  const calculationText = `(1 - ${(pWin).toFixed(2)}) * (${(amountMinor / 100).toFixed(2)} + ${(feeMinor / 100).toFixed(2)}) + ${(effortCostMinor / 100).toFixed(2)} = $${(expectedLossIfFightMinor / 100).toFixed(2)}`;

  let recommendation: Recommendation;
  let rationale: string;

  if (!hasValidEvidence) {
    recommendation = "ACCEPT";
    rationale =
      "No valid fulfillment or delivery evidence on record. Defending without evidence results in automatic loss; accepting the claim prevents further dispute escalation.";
  } else if (expectedLossIfFightMinor < lossIfRefundMinor) {
    recommendation = "FIGHT";
    rationale = `Favorable expected outcome: Fighting is projected to save $${(netBenefitOfFightingMinor / 100).toFixed(2)} compared to an immediate refund, supported by strong verified evidence.`;
  } else {
    recommendation = "REFUND";
    rationale = `Unfavorable expected value: The estimated loss of fighting ($${(expectedLossIfFightMinor / 100).toFixed(2)} factoring fees and merchant effort) exceeds the direct refund amount of $${(lossIfRefundMinor / 100).toFixed(2)}. Immediate refund is cost-optimal.`;
  }

  return {
    recommendation,
    expectedLossIfFightMinor,
    lossIfRefundMinor,
    netBenefitOfFightingMinor,
    rationale,
    formula: {
      amountMinor,
      feeMinor,
      effortCostMinor,
      pWin,
      calculationText,
    },
  };
}
