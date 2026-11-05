import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { disputes } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { canTransition, transitionState, CaseState } from "@/lib/agent/state";
import { isDemoMode } from "@/lib/mode";
import { listSandboxDisputes, getSandboxDispute } from "@/lib/paypal/disputes";
import { syncPayPalDisputeToDb } from "@/lib/paypal/sync";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

function isCronSecretValid(headerSecret: string | null, expectedSecret: string): boolean {
  if (!headerSecret || !expectedSecret) return false;
  const headerBuf = Buffer.from(headerSecret);
  const expectedBuf = Buffer.from(expectedSecret);
  if (headerBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(headerBuf, expectedBuf);
}

export async function POST(req: NextRequest) {
  // Enforce Issue #8: CRON_SECRET must not use insecure default in production
  if (process.env.NODE_ENV === "production" && env.CRON_SECRET === "dev-cron-secret") {
    console.error("[CRON_SECURITY_ERROR] Insecure default CRON_SECRET used in production.");
    return NextResponse.json({ error: "Unauthorized: Insecure cron secret" }, { status: 401 });
  }

  const secretHeader = req.headers.get("x-cron-secret");

  if (!isCronSecretValid(secretHeader, env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized: Invalid cron secret" }, { status: 401 });
  }

  try {
    const nowIso = new Date().toISOString();
    let polledDisputes = 0;

    // 1. Webhook Fallback Polling (T21): Poll PayPal Sandbox Disputes API when in sandbox mode with credentials
    if (!isDemoMode() && env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
      try {
        const listRes = await listSandboxDisputes({ pageSize: 20 });
        for (const item of listRes.items || []) {
          if (item.dispute_id) {
            const fullDispute = await getSandboxDispute(item.dispute_id);
            await syncPayPalDisputeToDb(fullDispute);
            polledDisputes++;
          }
        }
      } catch (pollErr) {
        console.warn("[CRON_POLL_WARNING] PayPal dispute fallback poll skipped or failed:", (pollErr as Error).message);
      }
    }

    // 2. Check for open disputes whose response due date has passed without submission
    const openDisputes = await db
      .select()
      .from(disputes)
      .where(sql`case_state NOT IN ('SUBMITTED', 'RESOLVED', 'ACCEPTED', 'REFUNDED', 'EXPIRED')`);

    let expiredCount = 0;
    for (const d of openDisputes) {
      // Must ignore disputes that are not waiting for seller response (e.g. resolved in PayPal or under review)
      if (d.paypalStatus !== "WAITING_FOR_SELLER_RESPONSE") {
        continue;
      }

      if (d.sellerResponseDueAt && new Date(d.sellerResponseDueAt).getTime() < Date.now()) {
        const currentState = d.caseState as CaseState;
        if (canTransition(currentState, "EXPIRED")) {
          const nextState = transitionState(currentState, "EXPIRED");
          await db
            .update(disputes)
            .set({ caseState: nextState, updatedAt: nowIso })
            .where(eq(disputes.paypalDisputeId, d.paypalDisputeId));

          await logAudit({
            actor: "system",
            disputeId: d.paypalDisputeId,
            action: "CASE_DEADLINE_EXPIRED",
            detail: { fromState: currentState, toState: nextState, dueAt: d.sellerResponseDueAt },
          });

          expiredCount++;
        }
      }
    }

    return NextResponse.json({
      status: "SUCCESS",
      checkedCases: openDisputes.length,
      expiredCases: expiredCount,
      polledDisputes,
      timestamp: nowIso,
    });
  } catch (err) {
    console.error("[CRON_ERROR] Deadlines job failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
