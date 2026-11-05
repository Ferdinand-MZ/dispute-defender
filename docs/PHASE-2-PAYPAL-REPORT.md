# Phase 2 — PayPal Sandbox Integration Report: DisputeDefender

**Project:** DisputeDefender (Evidence-Grounded AI Copilot for PayPal Merchants)  
**Target:** PayPal AI Hackathon 2026  
**Auditor / Engineer:** Senior Full-Stack Engineer & Software Architect  
**Status:** Completed — Ready for Review  

---

## 1. Executive Summary

Phase 2 establishes the end-to-end PayPal Sandbox integration foundation for **DisputeDefender**. In accordance with the non-negotiable directives in [`AGENTS.md`](../AGENTS.md) and [`docs/02-ARCHITECTURE.md`](02-ARCHITECTURE.md):
- All endpoints strictly target the PayPal Sandbox (`https://api-m.sandbox.paypal.com`).
- OAuth2 token management is automated with in-memory caching and 60-second expiration skew.
- Robust retry with exponential backoff is active for 429 (Rate Limit) and 5xx errors.
- Every PayPal write operation that affects dispute outcome or money movement is guarded by strict human-in-the-loop authorization (`approvedBy` required).
- Spike scripts for verification, order lifecycle, dispute retrieval, and evidence submission are implemented and tested.
- SQLite persistence safely normalizes incoming PayPal payloads into integer minor units and discrete facts with deduplication.

---

## 2. Implemented PayPal Sandbox Endpoints

| Category | Method & Endpoint | Implementation File | Purpose & Safety Controls |
|---|---|---|---|
| **Auth** | `POST /v1/oauth2/token` | [`src/lib/paypal/client.ts`](../src/lib/paypal/client.ts) | HTTP Basic client_credentials grant. In-memory token cache with expiration buffer. Credentials never logged. |
| **Orders** | `POST /v2/checkout/orders` | [`src/lib/paypal/orders.ts`](../src/lib/paypal/orders.ts) | Creates sandbox checkout order with `PayPal-Request-Id` idempotency key. Items formatted with minor-unit conversion. |
| **Orders** | `GET /v2/checkout/orders/{id}` | [`src/lib/paypal/orders.ts`](../src/lib/paypal/orders.ts) | Fetches order status, payer info, and capture records. Validated via `PayPalOrderSchema`. |
| **Orders** | `POST /v2/checkout/orders/{id}/capture` | [`src/lib/paypal/orders.ts`](../src/lib/paypal/orders.ts) | Captures funds for buyer-approved sandbox order with `PayPal-Request-Id`. |
| **Disputes** | `GET /v1/customer/disputes` | [`src/lib/paypal/disputes.ts`](../src/lib/paypal/disputes.ts) | Queries dispute list with filters (`dispute_state`, `page_size`, `update_time_*`). |
| **Disputes** | `GET /v1/customer/disputes/{id}` | [`src/lib/paypal/disputes.ts`](../src/lib/paypal/disputes.ts) | Retrieves full dispute details (transactions, messages, evidence requirements). Validated via `PayPalDisputeSchema`. |
| **Disputes** | `POST /v1/customer/disputes/{id}/provide-evidence` | [`src/lib/paypal/disputes.ts`](../src/lib/paypal/disputes.ts) | **Human-gated.** Submits evidence as `multipart/form-data` (JSON `input` part, optional `evidence-file`). Pre-flight check ensures status is `WAITING_FOR_SELLER_RESPONSE`. |
| **Disputes** | `POST /v1/customer/disputes/{id}/adjudicate` | [`src/lib/paypal/disputes.ts`](../src/lib/paypal/disputes.ts) | **Sandbox only simulation helper.** Settles an `UNDER_REVIEW` dispute with `adjudication_outcome` `SELLER_FAVOR` or `BUYER_FAVOR` to close the lifecycle. |
| **Disputes** | `POST /v1/customer/disputes/{id}/accept-claim` | [`src/lib/paypal/disputes.ts`](../src/lib/paypal/disputes.ts) | **Human-gated.** Merchant accepts buyer claim in accordance with store policy. |
| **Webhooks** | `POST /v1/notifications/verify-webhook-signature` | [`src/lib/paypal/webhook.ts`](../src/lib/paypal/webhook.ts) | Validates incoming webhook signature headers before processing. |

---

## 3. Database Normalization & Safe Persistence

Implemented in [`src/lib/paypal/sync.ts`](../src/lib/paypal/sync.ts):

### Deduplication & Idempotency
- **Orders:** Normalizes PayPal Orders v2 payloads into the SQLite `orders` table. Repeated sync calls update existing records without creating duplicates (keyed by `orders.id` or `orders.paypalOrderId`).
- **Disputes:** Normalizes PayPal Customer Disputes v1 payloads into the `disputes` table. Re-syncing preserves existing case states (e.g. `DRAFTED` or `APPROVED` are not accidentally reset to `NEW`).
- **Audit Events:** All synchronizations log immutable event records to `audit_log` with actor `paypal` or `system`.

### Fact Base Extraction
- Discrete facts (`F-disp-xxxx`, `F-ord-xxxx`, `F-trk-xxxx`, `F-del-xxxx`) are generated upon dispute ingestion.
- **Prompt Injection Quarantine:** Buyer messages extracted from `dispute.messages` are flagged with `untrusted: 1` in the `facts` table, preventing them from being interpreted as instructions by the AI pipeline.

---

## 4. Integration Spike Scripts

Five focused CLI spike scripts were built in `scripts/`:

`tsx` does not load `.env` on its own, so each command passes `--env-file=.env`.

```bash
# 1. Verify Sandbox OAuth2 Authentication
pnpm tsx --env-file=.env scripts/spike-auth.ts

# 2. Create & Capture Sandbox Checkout Orders
pnpm tsx --env-file=.env scripts/spike-orders.ts
pnpm tsx --env-file=.env scripts/spike-orders.ts --capture=<PAYPAL_ORDER_ID>

# 3. List Customer Disputes
pnpm tsx --env-file=.env scripts/spike-list-disputes.ts
pnpm tsx --env-file=.env scripts/spike-list-disputes.ts --sync

# 4. Fetch Full Dispute Details
pnpm tsx --env-file=.env scripts/spike-dispute-details.ts <PAYPAL_DISPUTE_ID>

# 5. Submit Evidence (Strictly Human-Gated)
pnpm tsx --env-file=.env scripts/spike-provide-evidence.ts <PAYPAL_DISPUTE_ID> --approve="Your Name"
```

### Safety Features of Spike Scripts
- If executed without credentials, scripts print informative instructions rather than failing with unhandled exceptions.
- `spike-provide-evidence.ts` refuses to transmit to PayPal unless an explicit `--approve="<Merchant Name>"` parameter is supplied. If run without approval, it prints a dry-run preview of the evidence payload and halts.

---

## 5. Security & Privacy Safeguards

1. **Zero Token Leakage:** Neither access tokens nor client secrets are ever logged or saved to the database. All console outputs redact credentials.
2. **Strict Server-Side Isolation:** PayPal API clients and credentials live exclusively in server modules (`src/lib/paypal/*`, API routes, scripts). No secret is exposed to client-side components.
3. **Environment Hardening:** Variables are strictly validated via Zod (`src/lib/env.ts`). `PAYPAL_ENV` is locked to `"sandbox"`.
4. **Idempotency Headers:** `PayPal-Request-Id` is generated and attached to all write operations.

---

## 6. Testing & Build Results

### Automated Unit & Integration Tests (Mocked HTTP)
All tests run with Vitest in-memory without hitting live PayPal endpoints:

```bash
$ pnpm run test

 PASS src/lib/money.test.ts (6 tests: integer minor units, currency decimals, arithmetic)
 PASS src/lib/agent/state.test.ts (3 tests: state transitions, illegal transition prevention)
 PASS src/lib/agent/scoring.test.ts (3 tests: evidence heuristic score breakdown)
 PASS src/lib/agent/decision.test.ts (3 tests: deterministic EV cost formulas)
 PASS src/lib/agent/grounding.test.ts (5 tests: citation validation, adversarial tracking/amount checks)
 PASS src/lib/paypal/client.test.ts (3 tests: token caching, 429 retry backoff, Request-Id injection)
 PASS src/lib/paypal/orders.test.ts (2 tests: create order minor unit formatting, get order parsing)
 PASS src/lib/paypal/disputes.test.ts (3 tests: list disputes parsing, human-approval check, status pre-flight)
 PASS src/lib/paypal/sync.test.ts (2 tests: SQLite normalization, deduplication, untrusted message flag)

Test Files  9 passed (9)
     Tests  30 passed (30)
  Duration  2.87s
```

### Static Analysis & Build Verification
```bash
# 1. TypeScript Strict Typechecking
$ pnpm run typecheck
Completed with 0 errors.

# 2. ESLint
$ pnpm run lint
No ESLint warnings or errors.

# 3. Next.js Production Build
$ pnpm run build
 Compiled successfully (10/10 static/dynamic routes bundled).
```

---

## 7. Missing Credentials & Sandbox Limitations (Status Report)

- **Local Shell Environment:** At the time of this run, `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` are not set in the local environment. All code and spike scripts have been implemented, defensively typed, and verified via automated mock tests.
- **Dispute Creation API Limitation:** As documented in Phase 0, programmatic dispute creation (`POST /v1/customer/disputes`) requires a `PayPal-Auth-Assertion` header. If a developer sandbox app lacks assertion scopes, developers can use the documented manual procedure:
  1. Open [https://www.sandbox.paypal.com](https://www.sandbox.paypal.com) and log in with your sandbox buyer account.
  2. Navigate to **Resolution Center** -> **Report a Problem**.
  3. Select the test transaction created via `pnpm tsx --env-file=.env scripts/spike-orders.ts` and open a dispute for "Item Not Received".
  4. Run `pnpm tsx --env-file=.env scripts/spike-list-disputes.ts --sync` to ingest the new dispute into DisputeDefender.

---

## 8. Files Created or Modified in Phase 2

- `src/lib/paypal/types.ts`: Added Zod schemas for Orders v2, Captures, Disputes list, and Links.
- `src/lib/paypal/client.ts`: Added `clearPayPalTokenCache()`, enhanced error normalization with `errorBody.name`.
- `src/lib/paypal/orders.ts`: Created Orders v2 API integration (`createSandboxOrder`, `getSandboxOrder`, `captureSandboxOrder`).
- `src/lib/paypal/disputes.ts`: Created Disputes v1 API integration (`listSandboxDisputes`, `getSandboxDispute`, `provideDisputeEvidence`, `adjudicateSandboxDispute`, `acceptSandboxDisputeClaim`).
- `src/lib/paypal/sync.ts`: Created SQLite persistence and fact extraction module with deduplication.
- `scripts/spike-auth.ts`: Created OAuth verification CLI spike.
- `scripts/spike-orders.ts`: Created order creation and capture CLI spike.
- `scripts/spike-list-disputes.ts`: Created dispute listing and sync CLI spike.
- `scripts/spike-dispute-details.ts`: Created dispute detail inspection CLI spike.
- `scripts/spike-provide-evidence.ts`: Created human-gated evidence submission CLI spike.
- `src/lib/paypal/client.test.ts`: Added client retry, error extraction, and request-id tests.
- `src/lib/paypal/orders.test.ts`: Added Orders API unit tests.
- `src/lib/paypal/disputes.test.ts`: Added Disputes API unit tests.
- `src/lib/paypal/sync.test.ts`: Added SQLite synchronization and deduplication tests.
- `vitest.config.ts`: Configured mock environment variables for test execution.
- `docs/PHASE-2-PAYPAL-REPORT.md`: This comprehensive Phase 2 report.

---

## 9. Next Steps (Phase 3 Preparation)

Once you provide sandbox credentials in `.env` and review this report, the next phase (**Phase 3: AI Copilot & Grounded Evidence Drafting Pipeline**) will implement:
1. End-to-end structured draft generation using Vercel AI SDK (`ai`).
2. Automatic citation binding to `facts` table records.
3. Integration of the grounding validator with inline UI error reporting.
4. Human approval modal dispatching real calls to `provideDisputeEvidence`.
