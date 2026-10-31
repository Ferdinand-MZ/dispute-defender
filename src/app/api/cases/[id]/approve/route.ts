import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, drafts, actions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { logAudit } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const ApproveRequestSchema = z.object({
  approvedBy: z.string().min(1, "Merchant representative name ('approvedBy') is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    const rawBody = await req.json().catch(() => ({}));
    const parseResult = ApproveRequestSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid approval request" },
        { status: 400 }
      );
    }

    const { approvedBy } = parseResult.data;

    // 1. Fetch Dispute Record
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];

    // 2. Fetch Latest Draft
    const draftRows = await db
      .select()
      .from(drafts)
      .where(eq(drafts.disputeId, disputeId))
      .orderBy(desc(drafts.createdAt));

    if (!draftRows.length) {
      return NextResponse.json(
        { error: "No draft available to approve. Generate or save an evidence draft first." },
        { status: 400 }
      );
    }

    const draft = draftRows[0];

    // 3. Enforce Non-Negotiable Rule 2 & Grounding Gate:
    // Only drafts with passing grounding status can be approved.
    if (draft.groundingStatus !== "pass" && draft.groundingStatus !== "edited_pass") {
      return NextResponse.json(
        {
          error: `Grounding validation has not passed (status: '${draft.groundingStatus}'). Unreferenced claims or hallucinated facts block approval.`,
        },
        { status: 400 }
      );
    }

    // 4. Verify FSM State Transition
    if (!canTransition(dispute.caseState as CaseState, "APPROVED")) {
      return NextResponse.json(
        { error: `Cannot transition case state from '${dispute.caseState}' to 'APPROVED'` },
        { status: 400 }
      );
    }

    const nextState = transitionState(dispute.caseState as CaseState, "APPROVED");
    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_app`;

    // 5. Update State & Record Action in Database
    db.transaction((tx) => {
      tx.update(disputes)
        .set({
          caseState: nextState,
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId))
        .run();

      tx.update(drafts)
        .set({
          status: "approved",
        })
        .where(eq(drafts.id, draft.id))
        .run();

      tx.insert(actions)
        .values({
          id: actionId,
          disputeId,
          type: "approve",
          payloadJson: JSON.stringify({ draftId: draft.id, approvedBy }),
          paypalResponseJson: null,
          status: "APPROVED",
          approvedBy,
          createdAt: now,
        })
        .run();
    });

    // 6. Append Immutable Audit Record
    await logAudit({
      actor: "human",
      disputeId,
      action: "DRAFT_APPROVED",
      detail: { draftId: draft.id, approvedBy, caseState: nextState },
    });

    return NextResponse.json({
      success: true,
      caseState: nextState,
      draftId: draft.id,
      approvedBy,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during approval" },
      { status: 500 }
    );
  }
}
