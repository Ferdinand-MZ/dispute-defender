# Phase 0 — Technical Audit Report: DisputeDefender

**Project:** DisputeDefender (Evidence-Grounded AI Copilot for PayPal Merchants)  
**Hackathon Target:** PayPal AI Hackathon 2026  
**Auditor:** Senior Full-Stack Engineer, Software Architect & AI Engineering Specialist  
**Status:** Complete — Proceeding to Phase 1 Foundation  

---

## 1. Executive Summary

This audit assesses the technical, architectural, and operational feasibility of **DisputeDefender**, based on:
1. Project specifications (`AGENTS.md`, `01-PRD.md`, `02-ARCHITECTURE.md`, `03-PLAN-AND-TASKS.md`, `04-VIBECODE-PROMPTS.md`, `05-DEMO-AND-SUBMISSION.md`).
2. Current official PayPal developer documentation (Customer Disputes API, Orders v2, Webhooks Management API).
3. Modern Next.js App Router, SQLite/Drizzle ORM, and Vercel AI SDK capabilities.

The core premise of the application is sound and architecturally defensible:
> **"LLM for language, deterministic code for decisions and money."**

The system does not allow autonomous money movement or dispute submission; every action that interacts with the PayPal Disputes or Payments API is gated by explicit human approval.

---

## 2. Minimum Viable Product (MVP) Scope Definition

Per `01-PRD.md` and `03-PLAN-AND-TASKS.md`, the MVP is defined by requirements **M1 through M11** and Scenario **S1**:

1. **Webhook Receiver (M1):** Ingest `CUSTOMER.DISPUTE.CREATED`, `CUSTOMER.DISPUTE.UPDATED`, `CUSTOMER.DISPUTE.RESOLVED` with cryptographic signature verification via `POST /v1/notifications/verify-webhook-signature` and event idempotency deduplication.
2. **Dispute Ingestion & Persistence (M2):** Fetch full dispute details (`GET /v1/customer/disputes/{id}`) and store in SQLite using Drizzle ORM.
3. **Demo Storefront (M3):** `/demo-shop` generating real PayPal sandbox orders with capture and tracking updates.
4. **Fact Base Builder (M4):** Collate structured facts (`orders`, `comms`, `policies`, `tracking`) with stable IDs (`F-ord-001`) and untrusted data markers.
5. **Deterministic Strength Scoring & EV Decision (M5):** Compute evidence strength score (0.00–1.00) and Expected Value (EV) cost formula (`expectedLossIfFight` vs `lossIfRefund`) without LLM interference.
6. **Grounding Validator & Draft Generation (M6):** LLM drafts structured narrative citing fact IDs (`claimRefs`); deterministic regex/entity validator enforces no unreferenced claims or hallucinated dates/tracking numbers.
7. **Merchant Dashboard & Case Queue (M7):** AG Grid Community case queue with urgency countdowns (<48h warning) and comprehensive case detail screen.
8. **Human Approval Workflow & Submission (M8):** Modal preview and explicit confirmation before executing `POST /v1/customer/disputes/{id}/provide-evidence`.
9. **Dispute Reason Scope (M9):** Initial focus strictly on `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` (INR), expandable to `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` (SNAD).
10. **Full Sandbox Lifecycle (M10):** End-to-end sandbox flow through adjudication (`adjudicate` endpoint) to `RESOLVED` status.
11. **Production Deployment & Verification (M11):** Clean deployable codebase with zero test failures, type errors, or hardcoded secrets.

---

## 3. Critical Technical Dependencies & Compatibility

| Dependency | Purpose | Risk Level | Mitigation / Compatibility Strategy |
|---|---|---|---|
| **Next.js (App Router)** | Full-stack framework (UI + Route Handlers) | Low | Standard modern web stack. Node.js LTS v20+ / v22. |
| **better-sqlite3 + Drizzle ORM** | Local / serverless SQLite persistence | Low-Medium | Zero-config local development; ephemeral disk on Render can be seeded automatically on startup in demo mode. |
| **AG Grid Community (`ag-grid-react`)** | Data grid for dispute queue | Low | Verify official React module registration (`@ag-grid-community/core` & `@ag-grid-community/react`). |
| **Vercel AI SDK (`ai`)** | Structured output generation via Zod | Medium | Standardize with `generateObject` / typed schemas. Guard against model API changes using pluggable providers. |
| **PayPal REST API** | Sandbox payments, disputes, webhooks | Medium-High | Use pure fetch-based client with typed schemas, debug ID logging, and in-memory OAuth token caching. |
| **pdf-lib** | Client/server PDF generation for evidence packet | Low | Pure JavaScript, runs anywhere without Chromium / headless browser binaries. |
| **Vitest** | Unit & integration testing | Low | Fast in-memory runner with fixture playback, avoiding real external network calls in CI. |

---

## 4. Security-Sensitive Payment Operations & Safeguards

Financial and state transitions carry severe risk if left unchecked. The architecture enforces non-negotiable boundaries:

1. **Strict Human-in-the-Loop Boundary:**
   - No autonomous write operations to PayPal.
   - Financial actions (`POST /v1/customer/disputes/{id}/provide-evidence`, `accept-claim`, `POST /v2/payments/captures/{id}/refund`) can ONLY be executed via an authenticated route with an explicit human approval record in the database.
   - Autopilot is `false` by default and not enabled in MVP.
2. **Deterministic Money Math:**
   - PayPal amounts are formatted as `{ currency_code, value }` string pairs at network boundaries.
   - Internal storage and calculations MUST use integer minor units (e.g. cents, pence, or whole yen for zero-decimal currencies) implemented in `src/lib/money.ts`. Floating-point arithmetic is forbidden.
3. **Prompt Injection & Untrusted Data Quarantine:**
   - Buyer-submitted dispute messages, communication history, and product descriptions are classified as `untrusted` (`untrusted: true` in `facts`).
   - All untrusted input is wrapped inside explicit delimiters (e.g. `<UNTRUSTED_BUYER_MESSAGE>...</UNTRUSTED_BUYER_MESSAGE>`) in LLM prompts.
   - LLM generation calls for analysis and drafting DO NOT have tool-execution capabilities.
4. **Webhook Security & Idempotency:**
   - Webhooks are cryptographically validated using PayPal's signature verification endpoint (`POST /v1/notifications/verify-webhook-signature`) comparing `PAYPAL-TRANSMISSION-ID`, `PAYPAL-TRANSMISSION-TIME`, `PAYPAL-TRANSMISSION-SIG`, `PAYPAL-CERT-URL`, and `PAYPAL-AUTH-ALGO`.
   - Incoming webhook events are idempotently recorded by unique `event_id` in `webhook_events`. Duplicates return HTTP 200 immediately without reprocessing.
5. **Secret Hygiene:**
   - Environment variables validated via Zod (`src/lib/env.ts`). Server-only credentials (`PAYPAL_CLIENT_SECRET`, `AI_API_KEY`, `CRON_SECRET`) are never leaked to client bundles.

---

## 5. PayPal Disputes API Feasibility & Verification

### Verified Official Endpoints & Behaviors
- **Dispute Ingestion:** `GET /v1/customer/disputes/{id}` and `GET /v1/customer/disputes`. Verified response structure includes `dispute_id`, `reason`, `status`, `dispute_amount`, `seller_response_due_date`, `disputed_transactions`, `evidences`.
- **Evidence Submission:** `POST /v1/customer/disputes/{id}/provide-evidence`. Allowed ONLY when `status === 'WAITING_FOR_SELLER_RESPONSE'`. Supports multipart/form-data with field `input` (JSON string) and file attachments.
- **Webhook Verification:** `POST /v1/notifications/verify-webhook-signature` returns `{ "verification_status": "SUCCESS" | "FAILURE" }`.
- **Capture Refund:** `POST /v2/payments/captures/{capture_id}/refund` requires `PayPal-Request-Id` for idempotency.
- **Sandbox Simulation:**
  - `POST /v1/customer/disputes/{id}/adjudicate` accepts `{ "adjudication_type": "REVERT_PAYMENT" }` to settle in merchant or buyer favor.
  - Error simulation via standard negative testing IDs (e.g. `/v1/customer/disputes/ERRDIS015` returning 403 Forbidden).

### Documented Assumptions Requiring Live Sandbox Spike (Task T04)
1. **API Dispute Creation (`POST /v1/customer/disputes`):** Requires `PayPal-Auth-Assertion` header containing an unsigned JWT payload identifying the sandbox buyer account. If developer app permissions lack custom assertion scopes, fallback is documented: create dispute manually via the Sandbox Buyer Resolution Center.
2. **Multipart Field Names for File Upload:** PayPal documentation examples commonly specify field `input` for JSON and `evidence-file` or `file` for document uploads. Needs validation against sandbox upload limits (~50MB per dispute).
3. **Webhook Simulator Behavior:** The developer dashboard simulator may omit certain live signature headers or supply mock certificate URLs. Integration tests must use recorded fixtures or mock verification.

---

## 6. Discrepancy & Inconsistency Analysis

1. **Package Manager:**
   - `AGENTS.md` and `docs/03-PLAN-AND-TASKS.md` refer to `npm run ...`.
   - Prompt instructions mention both `npm` and `pnpm`.
   - *Resolution:* All configuration files, `package.json`, and lockfiles will follow standard scripts compatible with both `npm` and `pnpm`.
2. **AI Provider Specification:**
   - PRD mentions Vercel AI SDK with Anthropic/Google/OpenAI configurable via `AI_PROVIDER` and `AI_API_KEY`.
   - Prompt instructions specify Gemini API / server-side structured outputs.
   - *Resolution:* Use the Vercel AI SDK (`ai` + `@ai-sdk/google` / `@ai-sdk/openai` / `@ai-sdk/anthropic`) or a clean typed provider abstraction that easily defaults to Gemini (Google) while satisfying the architecture's provider-agnostic requirement.
3. **Database Setup for Hosted Demo:**
   - Render uses ephemeral disks on free web services.
   - *Resolution:* Support SQLite (`better-sqlite3`) with automatic `db:push` / `db:seed` on boot when `DEMO_MODE=true` and database is uninitialized, matching `02-ARCHITECTURE.md`.

---

## 7. Recommended Phase 1 Architecture & Execution Plan

1. **Project Scaffolding:**
   - Root Next.js 14+ App Router project with TypeScript strict mode, Tailwind CSS, Lucide icons, and shadcn/ui component primitives.
   - Path aliases: `@/*` pointing to `./src/*`.
   - Setup Vitest with testing utilities.
2. **Core Domain Libraries:**
   - `src/lib/money.ts`: Integer minor-unit representation, parsing, and zero-decimal currency support.
   - `src/lib/env.ts`: Type-safe environment variable parsing with Zod.
   - `src/lib/audit.ts`: Append-only audit logger.
3. **Database Layer:**
   - `src/lib/db/schema.ts`: Drizzle schema matching `02-ARCHITECTURE.md` section 4.
   - `src/lib/db/index.ts`: SQLite client connection.
   - `src/lib/db/seed.ts`: Seed data for store policies.
   - `src/lib/agent/state.ts`: Finite state machine for case states.
4. **Integration Layer:**
   - `src/lib/paypal/client.ts`: OAuth token caching, typed fetch wrapper, retry handling, error normalization.
   - `src/lib/paypal/types.ts`: Zod schemas & TypeScript types for Disputes, Orders, Evidences, Webhooks.
   - `src/lib/agent/llm.ts`: Structured AI generation abstraction.
   - `src/lib/agent/grounding.ts`: Pure deterministic grounding validator.
   - `src/lib/agent/scoring.ts` & `decision.ts`: Heuristic scoring and EV cost comparison.
5. **UI Shell & Navigation:**
   - Global dashboard layout with persistent sidebar, header, and sandbox indicator.
   - `/` (Summary Dashboard).
   - `/cases` (AG Grid dispute queue with countdowns and filters).
   - `/cases/[id]` (Dispute detail view with facts, recommendation, draft, and approval modal).
   - `/demo-shop` & `/admin/simulate` entry points.
6. **Verification & Baseline Testing:**
   - Unit tests covering `money.ts`, `state.ts`, `grounding.ts`, `scoring.ts`, `decision.ts`.
   - Typecheck, lint, and build verification.
