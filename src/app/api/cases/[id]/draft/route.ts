import { NextRequest, NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { analyses } from "@/lib/db/schema";
import { verifyMerchantAuth } from "@/lib/auth";
import { DraftNotAllowedError, DraftPayloadSchema, runDraft, saveEditedDraft } from "@/lib/agent/draft";
import { defaultAgentModel } from "@/lib/agent/llm";

export const dynamic = "force-dynamic";

function unauthorized(error: string | undefined, status: number | undefined) {
  return NextResponse.json({ error: error || "Authentication required" }, { status: status || 401 });
}

function failure(disputeId: string, err: unknown) {
  if (err instanceof DraftNotAllowedError) {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  if ((err as Error).message?.includes("not found")) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }
  console.error(`[DRAFT_ERROR] ${disputeId}:`, err);
  return NextResponse.json({ error: "The draft could not be saved. Try again." }, { status: 500 });
}

/** Writes a new evidence draft from the fact base. Any earlier approval no longer applies. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = verifyMerchantAuth(req);
  if (!auth.authenticated || !auth.user) return unauthorized(auth.error, auth.status);

  try {
    const latest = (
      await db.select().from(analyses).where(eq(analyses.disputeId, params.id)).orderBy(desc(analyses.createdAt))
    )[0];
    const draft = await runDraft(params.id, {
      model: defaultAgentModel(),
      recommendation: latest?.recommendation ?? null,
    });
    return NextResponse.json({ success: true, draft });
  } catch (err) {
    return failure(params.id, err);
  }
}

const EditDraftSchema = z.object({
  draft: DraftPayloadSchema,
  editedBy: z.string().trim().min(1).max(120).optional(),
});

/** Saves the merchant's edits. The fact check runs again before the draft can be approved. */
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = verifyMerchantAuth(req);
  if (!auth.authenticated || !auth.user) return unauthorized(auth.error, auth.status);

  const parsed = EditDraftSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.errors[0]?.message || "Invalid draft" },
      { status: 400 }
    );
  }

  try {
    const draft = await saveEditedDraft(params.id, parsed.data.draft, parsed.data.editedBy ?? auth.user.name);
    return NextResponse.json({ success: true, draft });
  } catch (err) {
    return failure(params.id, err);
  }
}
