import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { disputes } from "../db/schema";
import type { Analysis, Draft } from "../db/schema";
import { logAudit } from "../audit";
import { rebuildFacts } from "./facts";
import { runAnalysis } from "./analyze";
import { runDraft } from "./draft";
import { defaultAgentModel, type AgentModel } from "./llm";
import type { CaseState } from "./state";

type Database = ReturnType<typeof getDb>;

/** The agent only works on cases that are still open and not yet approved or sent. */
const PROCESSABLE_STATES: CaseState[] = ["NEW", "ANALYZED", "DRAFTED", "NEEDS_ATTENTION"];

export interface PipelineOptions {
  database?: Database;
  /** Defaults to the configured model; pass null to force the rule-based path. */
  model?: AgentModel | null;
  trigger?: string;
}

export interface PipelineResult {
  disputeId: string;
  skipped: boolean;
  factCount: number;
  analysis: Analysis | null;
  draft: Draft | null;
}

/**
 * Intake to draft for one dispute: rebuild facts, analyze, and draft evidence when the
 * recommendation is to fight. Never sends anything to PayPal; that needs human approval.
 */
export async function processDispute(disputeId: string, options: PipelineOptions = {}): Promise<PipelineResult> {
  const database = options.database ?? getDb();
  const model = options.model === undefined ? defaultAgentModel() : options.model;

  const dispute = (await database.select().from(disputes).where(eq(disputes.paypalDisputeId, disputeId)))[0];
  if (!dispute) throw new Error(`Dispute ${disputeId} not found`);
  if (!PROCESSABLE_STATES.includes(dispute.caseState as CaseState)) {
    return { disputeId, skipped: true, factCount: 0, analysis: null, draft: null };
  }

  const builtFacts = await rebuildFacts(disputeId, database);
  await logAudit({
    database,
    actor: "agent",
    disputeId,
    action: "FACT_BASE_BUILT",
    detail: {
      facts: builtFacts.length,
      untrusted: builtFacts.filter((f) => f.untrusted === 1).length,
      trigger: options.trigger ?? "manual",
    },
  });

  const analysis = await runAnalysis(disputeId, { database, model });
  const draft =
    analysis.recommendation === "FIGHT"
      ? await runDraft(disputeId, { database, model, recommendation: analysis.recommendation })
      : null;

  return { disputeId, skipped: false, factCount: builtFacts.length, analysis, draft };
}

/**
 * Runs the pipeline without blocking the caller (the webhook must answer PayPal quickly).
 * Failures are recorded on the case instead of being lost.
 */
export function processDisputeInBackground(disputeId: string, trigger: string): void {
  processDispute(disputeId, { trigger }).catch(async (err: unknown) => {
    console.error(`[PIPELINE_ERROR] ${disputeId}:`, err);
    await logAudit({
      actor: "system",
      disputeId,
      action: "AGENT_PIPELINE_FAILED",
      detail: { trigger, error: (err as Error).message },
    });
  });
}
