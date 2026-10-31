import { NextRequest, NextResponse } from "next/server";
import { generateGroundedDraft, saveEditedDraft, DraftPayloadSchema } from "@/lib/agent/draft";
import { verifyMerchantAuth } from "@/lib/auth";
import { z } from "zod";

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

    const result = await generateGroundedDraft(disputeId);

    return NextResponse.json({
      success: true,
      draft: result.draft,
      groundingResult: result.groundingResult,
      regenerated: result.regenerated,
    });
  } catch (err) {
    const message = (err as Error).message || "Failed to generate grounded draft";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

const EditDraftRequestSchema = z.object({
  draftId: z.string().min(1, "draftId is required"),
  payload: DraftPayloadSchema,
  notesText: z.string().optional(),
});

export async function PUT(
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
    const parseResult = EditDraftRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid draft edit payload" },
        { status: 400 }
      );
    }

    const { draftId, payload, notesText } = parseResult.data;

    const result = await saveEditedDraft(disputeId, draftId, payload, notesText);

    return NextResponse.json({
      success: true,
      draft: result.draft,
      groundingResult: result.groundingResult,
      previousApprovalInvalidated: result.previousApprovalInvalidated,
    });
  } catch (err) {
    const message = (err as Error).message || "Failed to save edited draft";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
