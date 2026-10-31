import { db } from "../db";
import { disputes, orders, facts, analyses, Fact, Order, Dispute } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { calculateStrengthScore, FactSummary, StrengthScoreResult } from "./scoring";
import { evaluateDecision, DecisionResult } from "./decision";
import { canTransition, transitionState, CaseState } from "./state";
import { logAudit } from "../audit";
import { env } from "../env";
import { getAIModel } from "./llm";
import { ANALYSIS_SYSTEM_PROMPT, wrapUntrusted } from "./prompts";
import { generateText } from "ai";

/**
 * Extracts a structured FactSummary boolean checklist from the database facts and order record.
 */
export function buildFactSummary(
  caseFacts: Fact[],
  order: Order | null,
  reason: string
): FactSummary {
  const hasOrderTracking = !!(order?.carrier && order?.trackingNumber);
  const hasTrackingFact = caseFacts.some(
    (f) => f.kind === "tracking" && f.value && !f.value.toLowerCase().includes("not available")
  );
  const hasTracking = hasOrderTracking || hasTrackingFact;

  const hasOrderDelivered =
    order?.status === "delivered" || !!order?.deliveredAt;
  const hasDeliveredFact = caseFacts.some(
    (f) =>
      f.kind === "delivery" &&
      (f.value.toLowerCase().includes("delivered") ||
        f.value.toLowerCase().includes("confirmation"))
  );
  const hasDelivered = hasOrderDelivered || hasDeliveredFact;

  const addressMatch = caseFacts.some(
    (f) =>
      f.label.toLowerCase().includes("address") &&
      (f.value.toLowerCase().includes("match") ||
        f.value.toLowerCase().includes("verified") ||
        f.value.toLowerCase().includes("identical"))
  ) || (!!order?.shipToJson && hasDelivered);

  const hasShippingPolicy = caseFacts.some(
    (f) =>
      f.kind === "policy" &&
      (f.label.toLowerCase().includes("shipping") ||
        f.value.toLowerCase().includes("delivery window") ||
        f.value.toLowerCase().includes("carrier"))
  );

  const hasReturnPolicy = caseFacts.some(
    (f) =>
      f.kind === "policy" &&
      (f.label.toLowerCase().includes("return") ||
        f.value.toLowerCase().includes("return window") ||
        f.value.toLowerCase().includes("rma"))
  );

  const hasComms = caseFacts.some(
    (f) => f.kind === "comms" && f.value.trim().length > 0
  );

  const hasListingMatch = caseFacts.some(
    (f) =>
      f.label.toLowerCase().includes("item") ||
      f.label.toLowerCase().includes("description") ||
      f.label.toLowerCase().includes("specification")
  ) || !!order?.itemsJson;

  const hasPhotos = caseFacts.some(
    (f) =>
      f.label.toLowerCase().includes("photo") ||
      f.label.toLowerCase().includes("image") ||
      f.value.toLowerCase().includes("photo")
  );

  return {
    hasTracking,
    hasDelivered,
    addressMatch,
    hasShippingPolicy,
    hasReturnPolicy,
    hasComms,
    hasListingMatch,
    hasPhotos,
  };
}

export interface RunAnalysisResult {
  analysis: typeof analyses.$inferSelect;
  scoreResult: StrengthScoreResult;
  decisionResult: DecisionResult;
}

/**
 * Runs the deterministic scoring and decision engine, supplemented by an LLM-generated
 * merchant rationale. The LLM NEVER decides money movement, win probabilities, or scores.
 */
export async function runDisputeAnalysis(disputeId: string): Promise<RunAnalysisResult> {
  const disputeRows = await db
    .select()
    .from(disputes)
    .where(eq(disputes.paypalDisputeId, disputeId));

  if (!disputeRows.length) {
    throw new Error(`Dispute '${disputeId}' not found`);
  }

  const dispute = disputeRows[0];

  const orderRows = dispute.orderId
    ? await db.select().from(orders).where(eq(orders.id, dispute.orderId))
    : [];
  const order = orderRows[0] || null;

  const caseFacts = await db
    .select()
    .from(facts)
    .where(eq(facts.disputeId, disputeId));

  // 1. Deterministic Evidence Scoring (Code decides score, not LLM)
  const factSummary = buildFactSummary(caseFacts, order, dispute.reason);
  const scoreResult = calculateStrengthScore(dispute.reason, factSummary);

  // 2. Deterministic Cost Comparison & Recommendation (Code decides EV math, not LLM)
  // Standard PayPal dispute fee minor units = $20.00 (2000 minor units)
  // Estimated merchant handling effort cost = $15.00 (1500 minor units)
  const standardFeeMinor = 2000;
  const standardEffortMinor = 1500;
  const hasValidEvidence = scoreResult.score >= 0.35;

  const decisionResult = evaluateDecision({
    amountMinor: dispute.amountMinor,
    feeMinor: standardFeeMinor,
    effortCostMinor: standardEffortMinor,
    pWin: scoreResult.pWin,
    hasValidEvidence,
    currency: dispute.currency,
  });

  // 3. Generate Explainable Merchant Rationale
  let finalRationale = decisionResult.rationale;
  let modelName = "deterministic-rule-engine";

  if (env.AI_API_KEY && env.AI_PROVIDER === "google") {
    try {
      const model = getAIModel();
      modelName = env.AI_MODEL || "gemini-1.5-flash";

      const promptContext = `
Dispute Reason: ${dispute.reason}
Disputed Capital: ${dispute.amountMinor / 100} ${dispute.currency}
Deterministic Recommendation: ${decisionResult.recommendation}
Evidence Strength Score: ${scoreResult.scorePercent}% (${scoreResult.pWinBand})
Projected Win Likelihood: ${(scoreResult.pWin * 100).toFixed(0)}%
Expected Loss If Fighting: ${decisionResult.expectedLossIfFightMinor / 100} ${dispute.currency}
Direct Refund Loss: ${decisionResult.lossIfRefundMinor / 100} ${dispute.currency}

Evidence Checklist Signals:
${scoreResult.breakdown.map((b) => `- ${b.signal}: ${b.satisfied ? "VERIFIED" : "MISSING"} (${b.notes})`).join("\n")}

Facts on Record:
${caseFacts.map((f) => `[${f.id}] ${f.label}: ${f.untrusted ? wrapUntrusted("external_buyer_claim", f.value) : f.value}`).join("\n")}

Write a concise, professional 2-3 sentence merchant rationale explaining why ${decisionResult.recommendation} is recommended based on the evidence strength and cost math above. Do not alter any numbers or recommendations.`;

      const { text } = await generateText({
        model,
        system: ANALYSIS_SYSTEM_PROMPT,
        prompt: promptContext,
      });

      if (text && text.trim().length > 10) {
        finalRationale = text.trim();
      }
    } catch {
      // In case of AI API failure or rate limit, fallback safely to deterministic rationale
      finalRationale = decisionResult.rationale;
    }
  }

  const now = new Date().toISOString();
  const analysisId = `an_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const analysisRecord = {
    id: analysisId,
    disputeId,
    strengthScore: scoreResult.scorePercent,
    strengthBreakdownJson: JSON.stringify(scoreResult.breakdown),
    pWinBand: scoreResult.pWinBand,
    fightLossMinor: decisionResult.expectedLossIfFightMinor,
    refundLossMinor: decisionResult.lossIfRefundMinor,
    recommendation: decisionResult.recommendation,
    rationale: finalRationale,
    model: modelName,
    createdAt: now,
  };

  // 4. Persist in Database
  db.insert(analyses).values(analysisRecord).run();

  // If dispute is in NEW state, transition to ANALYZED
  if (canTransition(dispute.caseState as CaseState, "ANALYZED")) {
    const nextState = transitionState(dispute.caseState as CaseState, "ANALYZED");
    db.update(disputes)
      .set({ caseState: nextState, updatedAt: now })
      .where(eq(disputes.paypalDisputeId, disputeId))
      .run();
  }

  // 5. Append Immutable Audit Record
  await logAudit({
    actor: "agent",
    disputeId,
    action: "DISPUTE_ANALYZED",
    detail: {
      analysisId,
      recommendation: decisionResult.recommendation,
      strengthScore: scoreResult.scorePercent,
      pWinBand: scoreResult.pWinBand,
      model: modelName,
    },
  });

  return {
    analysis: analysisRecord,
    scoreResult,
    decisionResult,
  };
}
