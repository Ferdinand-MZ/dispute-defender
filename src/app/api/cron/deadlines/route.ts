import { NextRequest, NextResponse } from "next/server";
import { env } from "@/lib/env";
import { db } from "@/lib/db";
import { disputes } from "@/lib/db/schema";
import { logAudit } from "@/lib/audit";
import { eq, and, sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  const secretHeader = req.headers.get("x-cron-secret");

  if (secretHeader !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized: Invalid cron secret" }, { status: 401 });
  }

  try {
    const nowIso = new Date().toISOString();

    // Check for open disputes whose response due date has passed without submission
    const openDisputes = await db
      .select()
      .from(disputes)
      .where(sql`case_state NOT IN ('SUBMITTED', 'RESOLVED', 'ACCEPTED', 'REFUNDED', 'EXPIRED')`);

    let expiredCount = 0;
    for (const d of openDisputes) {
      if (d.sellerResponseDueAt && new Date(d.sellerResponseDueAt).getTime() < Date.now()) {
        await db
          .update(disputes)
          .set({ caseState: "EXPIRED", updatedAt: nowIso })
          .where(eq(disputes.paypalDisputeId, d.paypalDisputeId));

        await logAudit({
          actor: "system",
          disputeId: d.paypalDisputeId,
          action: "CASE_DEADLINE_EXPIRED",
          detail: { dueAt: d.sellerResponseDueAt },
        });

        expiredCount++;
      }
    }

    return NextResponse.json({
      status: "SUCCESS",
      checkedCases: openDisputes.length,
      expiredCases: expiredCount,
      timestamp: nowIso,
    });
  } catch (err) {
    console.error("[CRON_ERROR] Deadlines job failed:", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
