import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { analyses, disputes } from "../db/schema";
import type { Analysis } from "../db/schema";
import { env } from "../env";
import { logAudit } from "../audit";
import { calculateStrengthScore, type FactSummary, type StrengthScoreResult } from "./scoring";
import { evaluateDecision, type DecisionResult } from "./decision";
import { buildFacts, loadFactSources, summarizeEvidence, type FactSourceInput } from "./facts";
import { ANALYSIS_SYSTEM_PROMPT } from "./prompts";
import { canTransition, type CaseState } from "./state";
import type { AgentModel } from "./llm";

type Database = ReturnType<typeof getDb>;

export const RULES_AUTHOR = "rules";

export interface AnalysisComputation {
  summary: FactSummary;
  score: StrengthScoreResult;
  decision: DecisionResult;
  hasValidEvidence: boolean;
}

/** What counts as defensible evidence for each in-scope dispute reason. */
export function hasValidEvidenceFor(reason: string, summary: FactSummary): boolean {
  if (reason === "MERCHANDISE_OR_SERVICE_NOT_RECEIVED") return summary.hasTracking;
  return Boolean(summary.hasListingMatch || summary.hasTracking);
}

/** Deterministic part of the analysis: score, cost comparison, recommendation. No LLM. */
export function computeAnalysis(
  sources: FactSourceInput,
  costs: { feeMinor: number; effortCostMinor: number } = {
    // Fee and effort are configured in USD; applied as-is to the dispute currency (MVP is USD only).
    feeMinor: env.DISPUTE_FEE,
    effortCostMinor: env.EFFORT_COST,
  }
): AnalysisComputation {
  const summary = summarizeEvidence(sources);
  const score = calculateStrengthScore(sources.dispute.reason, summary);
  const hasValidEvidence = hasValidEvidenceFor(sources.dispute.reason, summary);
  const decision = evaluateDecision({
    amountMinor: sources.dispute.amountMinor,
    feeMinor: costs.feeMinor,
    effortCostMinor: costs.effortCostMinor,
    pWin: score.pWin,
    hasValidEvidence,
    currency: sources.dispute.currency,
  });
  return { summary, score, decision, hasValidEvidence };
}

const RationaleSchema = z.object({
  rationale: z.string().min(20).max(600),
});

/**
 * Asks the model to explain the decision in plain language. The model sees the result, never
 * decides it. Any digit in the output is rejected so it cannot restate or invent amounts.
 */
async function writeRationale(
  model: AgentModel,
  sources: FactSourceInput,
  computed: AnalysisComputation
): Promise<string | null> {
  const trustedFacts = buildFacts(sources)
    .filter((f) => f.untrusted === 0)
    .map((f) => `- ${f.label}`)
    .join("\n");
  const checklist = computed.score.breakdown
    .map((b) => `- ${b.signal}: ${b.satisfied ? "present" : "missing"}`)
    .join("\n");

  const prompt = `Dispute reason: ${sources.dispute.reason}
Recommendation (decided by code, do not change it): ${computed.decision.recommendation}
Evidence strength band: ${computed.score.pWinBand}

Evidence checklist:
${checklist}

Records on file:
${trustedFacts}

Rule-based explanation of the cost comparison:
${computed.decision.rationale}

Write 2 to 3 plain sentences for the merchant explaining why this recommendation fits, naming the evidence that is present or missing. Do not write any numbers, amounts, percentages, or dates; the screen already shows them.`;

  const result = await model.generate({ schema: RationaleSchema, system: ANALYSIS_SYSTEM_PROMPT, prompt });
  const text = result.rationale.trim();
  return /\d/.test(text) ? null : text;
}

export interface RunAnalysisOptions {
  database?: Database;
  model?: AgentModel | null;
}

/** Runs and stores an analysis. Moves a NEW case to ANALYZED; other states are left alone. */
export async function runAnalysis(disputeId: string, options: RunAnalysisOptions = {}): Promise<Analysis> {
  const database = options.database ?? getDb();
  const sources = loadFactSources(disputeId, database);
  if (!sources) throw new Error(`Dispute ${disputeId} not found`);

  const computed = computeAnalysis(sources);
  let rationale = computed.decision.rationale;
  let author = RULES_AUTHOR;

  if (options.model) {
    try {
      const written = await writeRationale(options.model, sources, computed);
      if (written) {
        rationale = written;
        author = options.model.id;
      }
    } catch (err) {
      // The rule-based rationale is always valid; a model failure must not block the case.
      console.warn(`[ANALYSIS_LLM_FALLBACK] ${disputeId}:`, (err as Error).message);
    }
  }

  const now = new Date().toISOString();
  const row: Analysis = {
    id: `ANA-${disputeId}-${Date.now()}`,
    disputeId,
    strengthScore: computed.score.scorePercent,
    strengthBreakdownJson: JSON.stringify(computed.score.breakdown),
    pWinBand: computed.score.pWinBand,
    fightLossMinor: computed.decision.expectedLossIfFightMinor,
    refundLossMinor: computed.decision.lossIfRefundMinor,
    recommendation: computed.decision.recommendation,
    rationale,
    model: author,
    createdAt: now,
  };

  const currentState = sources.dispute.caseState as CaseState;
  const moveToAnalyzed =
    (currentState === "NEW" || currentState === "NEEDS_ATTENTION") && canTransition(currentState, "ANALYZED");

  database.transaction((tx) => {
    tx.insert(analyses).values(row).run();
    if (moveToAnalyzed) {
      tx.update(disputes)
        .set({ caseState: "ANALYZED", updatedAt: now })
        .where(eq(disputes.paypalDisputeId, disputeId))
        .run();
    }
  });

  await logAudit({
    database,
    actor: "agent",
    disputeId,
    action: "EVIDENCE_ANALYSIS_COMPLETED",
    detail: {
      recommendation: row.recommendation,
      score: row.strengthScore,
      band: row.pWinBand,
      expectedLossIfFight: row.fightLossMinor,
      lossIfRefund: row.refundLossMinor,
      rationaleBy: author,
    },
  });

  return row;
}
