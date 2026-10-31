import { NextRequest, NextResponse } from "next/server";
import { runDisputeAnalysis } from "@/lib/agent/analyze";
import { verifyMerchantAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    const auth = verifyMerchantAuth(req);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: auth.status || 401 }
      );
    }

    const result = await runDisputeAnalysis(disputeId);

    return NextResponse.json({
      success: true,
      analysis: result.analysis,
      scoreResult: result.scoreResult,
      decisionResult: result.decisionResult,
    });
  } catch (err) {
    const message = (err as Error).message || "Failed to analyze dispute";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
