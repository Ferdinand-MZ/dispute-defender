import { Pool } from "pg";

export const CREATE_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    paypal_order_id TEXT,
    capture_id TEXT,
    buyer_email TEXT,
    buyer_name TEXT,
    ship_to_json TEXT,
    items_json TEXT,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL,
    carrier TEXT,
    tracking_number TEXT,
    shipped_at TEXT,
    delivered_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body_md TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0'
  );

  CREATE TABLE IF NOT EXISTS comms (
    id TEXT PRIMARY KEY,
    order_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    body TEXT NOT NULL,
    sent_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS disputes (
    paypal_dispute_id TEXT PRIMARY KEY,
    capture_id TEXT,
    order_id TEXT,
    reason TEXT NOT NULL,
    paypal_status TEXT NOT NULL,
    life_cycle_stage TEXT,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    seller_response_due_at TEXT,
    case_state TEXT NOT NULL DEFAULT 'NEW',
    raw_json TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS facts (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    source TEXT NOT NULL,
    untrusted INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS analyses (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL,
    strength_score INTEGER NOT NULL,
    strength_breakdown_json TEXT NOT NULL,
    p_win_band TEXT NOT NULL,
    fight_loss_minor INTEGER NOT NULL,
    refund_loss_minor INTEGER NOT NULL,
    recommendation TEXT NOT NULL,
    rationale TEXT NOT NULL,
    model TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS drafts (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    evidence_type TEXT NOT NULL,
    body_json TEXT NOT NULL,
    notes_text TEXT,
    pdf_path TEXT,
    grounding_status TEXT NOT NULL,
    grounding_errors_json TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    author TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    dispute_id TEXT NOT NULL,
    type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    paypal_response_json TEXT,
    status TEXT NOT NULL,
    approved_by TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    ts TEXT NOT NULL,
    actor TEXT NOT NULL,
    dispute_id TEXT,
    action TEXT NOT NULL,
    detail_json TEXT
  );

  CREATE TABLE IF NOT EXISTS webhook_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    received_at TEXT NOT NULL,
    processed_at TEXT
  );

  ALTER TABLE drafts ADD COLUMN IF NOT EXISTS author TEXT;
`;

export async function ensureTables(pool: Pool): Promise<void> {
  await pool.query(CREATE_TABLES_SQL);
}
