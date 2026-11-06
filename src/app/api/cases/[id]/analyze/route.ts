import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { disputes } from "@/lib/db/schema";
import { verifyMerchantAuth } from "@/lib/auth";
import { rebuildFacts } from "@/lib/agent/facts";
import { runAnalysis } from "@/lib/agent/analyze";
import { defaultAgentModel } from "@/lib/agent/llm";

export const dynamic = "force-dynamic";

/** States where the analysis may be refreshed. Sent or closed cases keep the analysis they were decided on. */
const ANALYZABLE_STATES = new Set(["NEW", "ANALYZED", "DRAFTED", "APPROVED", "NEEDS_ATTENTION"]);

const AnalyzeBodySchema = z
  .object({
    modelId: z.string().trim().min(1).max(80).optional(),
  })
  .optional();

/** Re-runs the analysis on fresh facts (for example after the order was marked delivered). */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = verifyMerchantAuth(req);
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: auth.error || "Authentication required" }, { status: auth.status || 401 });
  }

  const rawBody = await req.json().catch(() => undefined);
  const parsedBody = AnalyzeBodySchema.safeParse(rawBody);
  const selectedModelId = parsedBody.success ? parsedBody.data?.modelId : undefined;

  const dispute = (await db.select().from(disputes).where(eq(disputes.paypalDisputeId, params.id)))[0];
  if (!dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }
  if (!ANALYZABLE_STATES.has(dispute.caseState)) {
    return NextResponse.json(
      { error: `The analysis is locked because the case is '${dispute.caseState}'.` },
      { status: 409 }
    );
  }

  try {
    const builtFacts = await rebuildFacts(params.id);
    const analysis = await runAnalysis(params.id, { model: defaultAgentModel(selectedModelId) });
    return NextResponse.json({ success: true, factCount: builtFacts.length, analysis });
  } catch (err) {
    console.error(`[ANALYZE_ERROR] ${params.id}:`, err);
    return NextResponse.json({ error: "The analysis could not be completed. Try again." }, { status: 500 });
  }
}
