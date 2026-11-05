import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { disputes, drafts, orders, actions, facts } from "@/lib/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { buildEvidencePayload } from "@/lib/evidence/mapping";
import { generateEvidencePacketPdf } from "@/lib/evidence/packet-pdf";
import { provideDisputeEvidence } from "@/lib/paypal/disputes";
import { logAudit } from "@/lib/audit";
import { verifyMerchantAuth } from "@/lib/auth";
import {
  isDemoMode,
  isSandboxMode,
  assertSandboxCredentials,
  formatDemoSimulationResponse,
  PayPalConfigError,
} from "@/lib/mode";
import { computeDraftApprovalHash } from "@/lib/agent/approval";
import { z } from "zod";

export const dynamic = "force-dynamic";

const SubmitRequestSchema = z.object({
  approvedBy: z
    .string()
    .min(1, "Merchant representative name ('approvedBy') is required")
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const disputeId = params.id;

  try {
    // 1. Strict Server-Side Authentication & Authorization Gate
    const auth = verifyMerchantAuth(req);
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json(
        { error: auth.error || "Authentication required" },
        { status: auth.status || 401 }
      );
    }

    const rawBody = await req.json().catch(() => ({}));
    const parseResult = SubmitRequestSchema.safeParse(rawBody);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0]?.message || "Invalid submission request" },
        { status: 400 }
      );
    }

    const approvedBy = parseResult.data?.approvedBy?.trim() || auth.user.name;

    // 2. Fetch Dispute Record
    const disputeRows = await db
      .select()
      .from(disputes)
      .where(eq(disputes.paypalDisputeId, disputeId));

    if (!disputeRows.length) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    const dispute = disputeRows[0];

    // 3. Duplicate Submission Guard
    if (dispute.caseState === "SUBMITTED") {
      return NextResponse.json(
        {
          error: "Duplicate submission attempt: Evidence has already been submitted for this dispute.",
        },
        { status: 409 }
      );
    }

    const existingSubmissions = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.disputeId, disputeId),
          eq(actions.type, "provide_evidence"),
          eq(actions.status, "SUBMITTED")
        )
      );

    if (existingSubmissions.length > 0) {
      return NextResponse.json(
        {
          error: "Duplicate submission attempt: Evidence has already been submitted for this dispute.",
        },
        { status: 409 }
      );
    }

    // 4. Strict Human Gate: Case must already have been approved
    if (dispute.caseState !== "APPROVED") {
      return NextResponse.json(
        {
          error: `Direct evidence submission rejected: Case must be in 'APPROVED' state before submitting to PayPal. Current state is '${dispute.caseState}'.`,
        },
        { status: 400 }
      );
    }

    // 5. Fetch Approved Draft
    const draftRows = await db
      .select()
      .from(drafts)
      .where(eq(drafts.disputeId, disputeId))
      .orderBy(desc(drafts.createdAt));

    if (!draftRows.length) {
      return NextResponse.json({ error: "No draft found to submit" }, { status: 400 });
    }

    const draft = draftRows[0];
    if (draft.groundingStatus !== "pass" && draft.groundingStatus !== "edited_pass") {
      return NextResponse.json(
        { error: `Cannot submit draft: Grounding validation failed ('${draft.groundingStatus}').` },
        { status: 400 }
      );
    }

    // 6. Fetch Linked Order and Tracking Evidence
    let carrier: string | undefined;
    let trackingNumber: string | undefined;
    let linkedOrder: (typeof orders.$inferSelect) | null = null;

    if (dispute.orderId) {
      const orderRows = await db
        .select()
        .from(orders)
        .where(eq(orders.id, dispute.orderId));
      const order = orderRows[0];
      if (order) {
        linkedOrder = order;
        if (order.carrier && order.trackingNumber) {
          carrier = order.carrier;
          trackingNumber = order.trackingNumber;
        }
      }
    }

    const caseFacts = await db
      .select()
      .from(facts)
      .where(eq(facts.disputeId, disputeId));

    if (!carrier || !trackingNumber) {
      for (const f of caseFacts) {
        if (f.kind === "tracking" && f.value) {
          const match = f.value.match(/(?:FEDEX|UPS|USPS|DHL)/i);
          if (match && !carrier) carrier = match[0].toUpperCase();
          const trkMatch = f.value.match(/\b([A-Z0-9]{8,30})\b/);
          if (trkMatch && !trackingNumber) trackingNumber = trkMatch[1];
        }
      }
    }

    // 7. Verify Database-Backed Approval Integrity & Hash
    const approvalActions = await db
      .select()
      .from(actions)
      .where(
        and(
          eq(actions.disputeId, disputeId),
          eq(actions.type, "approve"),
          eq(actions.status, "APPROVED")
        )
      )
      .orderBy(desc(actions.createdAt));

    if (!approvalActions.length) {
      return NextResponse.json(
        {
          error: "Direct submission rejected: No valid human approval record exists for this dispute.",
        },
        { status: 400 }
      );
    }

    const latestApproval = approvalActions[0];
    let approvalPayload: {
      draftId?: string;
      disputeId?: string;
      approvalHash?: string;
    } = {};

    try {
      approvalPayload = JSON.parse(latestApproval.payloadJson);
    } catch {
      approvalPayload = {};
    }

    // Ensure approval belongs strictly to this dispute (anti-reuse)
    if (approvalPayload.disputeId && approvalPayload.disputeId !== disputeId) {
      return NextResponse.json(
        { error: "Security violation: Approval record cannot be reused for another dispute." },
        { status: 403 }
      );
    }

    // Ensure draft was not regenerated or replaced after approval
    if (approvalPayload.draftId && approvalPayload.draftId !== draft.id) {
      return NextResponse.json(
        { error: "Draft was regenerated after approval. Re-approval is required before submission." },
        { status: 409 }
      );
    }

    // Verify content fingerprint has not changed since approval
    const currentHash = computeDraftApprovalHash({
      draftId: draft.id,
      disputeId,
      evidenceType: draft.evidenceType,
      bodyJson: draft.bodyJson,
      notesText: draft.notesText,
      carrier: carrier || null,
      trackingNumber: trackingNumber || null,
    });

    if (approvalPayload.approvalHash && approvalPayload.approvalHash !== currentHash) {
      return NextResponse.json(
        {
          error: "Draft content or evidence was modified after approval. Re-approval required.",
        },
        { status: 409 }
      );
    }

    // 8. Construct Compliant Evidence Payload & Generate PDF Evidence Packet (T20)
    const evidencePayload = buildEvidencePayload({
      reason: dispute.reason,
      carrier,
      trackingNumber,
      notesText: draft.notesText || undefined,
    });

    const evidencePacket = await generateEvidencePacketPdf({
      dispute,
      order: linkedOrder,
      facts: caseFacts,
      draft,
      approvedBy,
    });

    // 9. Server-Controlled Mode Execution Gate
    let paypalResponse: Record<string, unknown>;

    if (isDemoMode()) {
      // DEMO MODE: Pure local simulation with visible labeling, NEVER contacts PayPal API
      paypalResponse = formatDemoSimulationResponse("provide_evidence", {
        disputeId,
        evidenceType: evidencePayload.evidences[0]?.evidence_type,
        attachedPdf: evidencePacket.filename,
        pdfSizeBytes: evidencePacket.buffer.byteLength,
      });
    } else {
      // SANDBOX MODE: Communicate with PayPal Sandbox API
      // Assert credentials exist; never silently fall back to demo
      try {
        assertSandboxCredentials();
      } catch (configErr) {
        if (configErr instanceof PayPalConfigError) {
          return NextResponse.json(
            { error: configErr.message, mode: "sandbox" },
            { status: configErr.statusCode }
          );
        }
        throw configErr;
      }

      const stableRequestId = `ev_submit_${disputeId}`;
      await provideDisputeEvidence({
        disputeId,
        evidencePayload,
        approvedBy,
        evidenceFile: evidencePacket,
        requestId: stableRequestId,
      });

      paypalResponse = {
        mode: "sandbox",
        simulated: false,
        status: "TRANSMITTED_TO_PAYPAL_SANDBOX",
        endpoint: `/v1/customer/disputes/${disputeId}/provide-evidence`,
        requestId: stableRequestId,
        attachedPdf: evidencePacket.filename,
        pdfSizeBytes: evidencePacket.buffer.byteLength,
      };
    }

    // 10. Verify and Execute State Transition
    if (!canTransition(dispute.caseState as CaseState, "SUBMITTED")) {
      return NextResponse.json(
        { error: `Cannot transition case state from '${dispute.caseState}' to 'SUBMITTED'` },
        { status: 400 }
      );
    }

    const nextState = transitionState(dispute.caseState as CaseState, "SUBMITTED");
    const now = new Date().toISOString();
    const actionId = `act_${Date.now()}_sub`;

    db.transaction((tx) => {
      tx.update(disputes)
        .set({
          caseState: nextState,
          paypalStatus: "UNDER_REVIEW",
          updatedAt: now,
        })
        .where(eq(disputes.paypalDisputeId, disputeId))
        .run();

      tx.update(drafts)
        .set({
          status: "submitted",
          pdfPath: evidencePacket.filename,
        })
        .where(eq(drafts.id, draft.id))
        .run();

      tx.insert(actions)
        .values({
          id: actionId,
          disputeId,
          type: "provide_evidence",
          payloadJson: JSON.stringify(evidencePayload),
          paypalResponseJson: JSON.stringify(paypalResponse),
          status: "SUBMITTED",
          approvedBy,
          createdAt: now,
        })
        .run();
    });

    // 11. Log Immutable Audit Record
    await logAudit({
      actor: "human",
      disputeId,
      action: "EVIDENCE_SUBMITTED_TO_PAYPAL",
      detail: {
        approvedBy,
        evidenceType: evidencePayload.evidences[0]?.evidence_type,
        caseState: nextState,
        mode: isDemoMode() ? "demo" : "sandbox",
        simulated: isDemoMode(),
      },
    });

    return NextResponse.json({
      success: true,
      caseState: nextState,
      actionId,
      approvedBy,
      mode: isDemoMode() ? "demo" : "sandbox",
      simulated: isDemoMode(),
      paypalResponse,
    });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Internal error during evidence submission" },
      { status: 500 }
    );
  }
}
