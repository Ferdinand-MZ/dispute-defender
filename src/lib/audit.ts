import { db } from "./db";
import { auditLog } from "./db/schema";

export type AuditActor = "agent" | "human" | "system" | "paypal";

export interface LogAuditParams {
  actor: AuditActor;
  action: string;
  disputeId?: string | null;
  detail?: Record<string, unknown> | null;
}

export async function logAudit({
  actor,
  action,
  disputeId = null,
  detail = null,
}: LogAuditParams): Promise<string> {
  const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const ts = new Date().toISOString();

  try {
    await db.insert(auditLog).values({
      id,
      ts,
      actor,
      disputeId,
      action,
      detailJson: detail ? JSON.stringify(detail) : null,
    });
  } catch (err) {
    // Audit failures should not crash the primary process, but should be logged to stderr
    console.error(`[AUDIT_FAILURE] Failed to record audit log ${id}:`, err);
  }

  return id;
}
