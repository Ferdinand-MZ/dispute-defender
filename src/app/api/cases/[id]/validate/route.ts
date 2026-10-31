import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { facts, disputes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { validateGrounding } from "@/lib/agent/grounding";
import { DraftPayloadSchema } from "@/lib/agent/draft";
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

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = DraftPayloadSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid draft payload for validation" },
        { status: 400 }
      );
    }

    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: `Dispute '${disputeId}' not found` }, { status: 404 });
    }

    const caseFacts = await db
      .select()
      .from(facts)
      .where(eq(facts.disputeId, disputeId));

    const groundingResult = validateGrounding(parseResult.data, caseFacts);

    return NextResponse.json({
      success: true,
      groundingResult,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal validation error" },
      { status: 500 }
    );
  }
}
