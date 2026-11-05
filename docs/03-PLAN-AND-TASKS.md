# 03 - Plan and Tasks

All times are in **WIB** (UTC+7). The plan was written on Sunday, Oct 25, 2026. Official deadline: **Thursday Nov 12, 12:00 PST = Friday Nov 13, 03:00 WIB**. Internal target: **submit Wednesday Nov 11 evening**. Thursday Nov 12 is an emergency buffer only, with no new features.

## 1. Assumptions

- Two-person team: **Dev A** (backend, PayPal, agent) and **Dev B** (frontend, UX, demo, docs).
- Capacity is about 3 hours per weekday and 6 hours per weekend day, roughly 66 hours per person. The estimates below already account for vibecoding with AI agents.
- Load: Dev A about 60 hours (critical path), Dev B about 45 hours. If A falls behind, B takes T09, T21 (the cron part), and T27.
- **If solo:** merge A and B, drop every Should item except T16 and T17, and skip Nice.

## 2. Milestones and decision gates

| Code | Date | Output |
|---|---|---|
| **G1** (gate) | Wed Oct 28, evening | Sandbox loop proven: order -> dispute -> webhook -> provide-evidence 200 -> adjudicate -> RESOLVED. See criteria below |
| **M1** | Sun Nov 1 | S1 vertical slice running on the hosted URL, without the LLM |
| **M2** | Fri Nov 6 | AI complete: analysis, draft, validator, approval, actions. **Feature freeze** that evening (only exception: T22 may finish Sat Nov 7) |
| **M3** | Mon Nov 9 | Polish, tests, README done. **Code freeze 23:59** |
| **M4** | Wed Nov 11 | Video uploaded and Devpost submitted |

**G1 criteria (all must be met, or an agreed fallback exists):**
1. Sandbox order captured by a script.
2. Dispute exists on the sandbox merchant account (via the API, or the manual fallback from the buyer account).
3. `CUSTOMER.DISPUTE.CREATED` webhook arrives at the hosted URL (or through the simulator).
4. `GET dispute` saved as a fixture.
5. `provide-evidence` returns 200 with tracking and notes.
6. `adjudicate` resolves the dispute and the `RESOLVED` webhook arrives.

**If G1 fails at point 5 after 4 hours of debugging:** ask on the hackathon Devpost forum and the PayPal Developer Discord. If the loop still cannot be proven by Thursday Oct 29 evening, stop and decide together whether to switch to the backup idea (failed subscription recovery). Do not keep building UI on top of an unproven loop.

## 3. Daily calendar

| Date | Day | D | Dev A | Dev B | End-of-day output |
|---|---|---|---|---|---|
| Oct 26 | Mon | 1 | T01, T03 | T02, start T05 | Repo and CI running. PayPal token works |
| Oct 27 | Tue | 2 | T04 (spike), T36 | T05 done | Skeleton app hosted. Webhook registered |
| Oct 28 | Wed | 3 | T04 done, **G1** | start T08 | G1 decision |
| Oct 29 | Thu | 4 | T06, start T07 | T08 | DB schema. Webhook received |
| Oct 30 | Fri | 5 | T07 done, T10 | T08 done | Order -> dispute -> facts |
| Oct 31 | Sat | 6 | T11, T09 | T12 | Rule-based evidence submission |
| Nov 1 | Sun | 7 | T13 integration | T12, T13 | **M1** hosted vertical slice |
| Nov 2 | Mon | 8 | T14 | start T17 | LLM client and schemas |
| Nov 3 | Tue | 9 | T15 (draft + grounding) | T17 | Verified draft |
| Nov 4 | Wed | 10 | T16 | T18 | Recommendation and approval UI. **Cut-line 1 check** |
| Nov 5 | Thu | 11 | T19 | T21 (badge), T23 | Accept and refund actions |
| Nov 6 | Fri | 12 | T20, T21 (cron) | T23 | **M2**, feature freeze |
| Nov 7 | Sat | 13 | T22 (freeze exception, only if cut-line 1 passed), bug fixes | T26 | Second reason and polish |
| Nov 8 | Sun | 14 | T24, T25 | T26, T27 | Security, error handling, seed |
| Nov 9 | Mon | 15 | T28, bug fixes | T30 | **M3**, code freeze 23:59 |
| Nov 10 | Tue | 16 | T32 test from scratch | T31 rehearse and record | Raw video, clean QA |
| Nov 11 | Wed | 17 | help with video, re-check | T33, T31 upload | **M4**: T34 submit before 20:00 |
| Nov 12 | Thu | 18 | buffer | buffer | Emergency fixes only |

**Cut-line 1 (Wed Nov 4 evening):** if T15 or T16 is not done, drop S2, S6, and N1 to N3, and focus on finishing M1 to M11.
**Cut-line 2 (Fri Nov 6):** anything unfinished that is not a Must is dropped (except T22, per the M2 note). Time after that is for stability only.

## 4. Task list

Priority: **M** Must, **S** Should, **N** Nice. Estimates in hours. Acceptance criteria are summarized here; the full criteria follow `01-PRD.md`.

### Phase 0: Setup and spike

| ID | Task | Owner | Hours | Prio | Depends on | Acceptance |
|---|---|---|---|---|---|---|
| T01 | Register for PayPal Developer. Create a Sandbox app with Disputes and Webhooks enabled. Create sandbox accounts: 1 business (merchant), 2 personal (buyer). Store credentials in a password manager | A | 1.5 | M | - | Client ID and secret exist. Can log in to all three sandbox accounts |
| T02 | Initialize the repo: Next.js, TypeScript strict, Tailwind, shadcn/ui, eslint, prettier, vitest. MIT license. `.env.example`. Copy `AGENTS.md` and these docs. GitHub Actions: typecheck, lint, test. Add the scripts from AGENTS.md | B | 2 | M | - | `pnpm run dev/build/typecheck/lint/test` green. CI green. Public repo with the license shown in About |
| T03 | PayPal client: OAuth with token caching, fetch wrapper (debug id, retry on 429/5xx, `PayPal-Request-Id`). Script to create and capture an order (buyer approval can be manual through the approve link). Save responses as fixtures | A | 2 | M | T01 | Script produces a capture id. Fixtures saved without secrets |
| T04 | **Dispute spike.** Scripts: create a sandbox dispute (API with Auth-Assertion, or manual fallback), GET details, multipart `provide-evidence` with tracking and notes, `adjudicate`. Record the real field names and file limits. Save every response as a fixture | A | 5 | M | T03 | G1 criteria 1 to 6 (except the hosted webhook) |
| T05 | Deploy the skeleton to Render (web service). `/api/health` route. Register the webhook for the 3 dispute events. Save `PAYPAL_WEBHOOK_ID` | B | 2 | M | T02 | Public URL is live. The PayPal webhook simulator produces a server log |
| T36 | Read the AG Grid and Render sponsor pages on Devpost, and the Rules page. Record prize requirements, live-demo duration rules, and participant eligibility | A | 1 | M | - | 10-line note in the repo (`docs/sponsor-notes.md`) |

### Phase 1: Vertical slice (no LLM)

| ID | Task | Owner | Hours | Prio | Depends on | Acceptance |
|---|---|---|---|---|---|---|
| T06 | Drizzle schema and migrations per `02-ARCHITECTURE.md` section 4. Base seed (store policies) | A | 2 | M | T02 | `db:push` and `db:seed` run. Types generated |
| T07 | Webhook receiver: signature verification, `event_id` dedupe, fast 200 response, intake job (GET details, upsert, link order). Tests with fixtures | A | 3 | M | T05, T06 | A valid webhook creates a case. Duplicates are ignored. A bad signature is rejected (403). Tests pass |
| T08 | Demo store `/demo-shop`: small catalog, PayPal button (create and capture order), save to `orders`. Admin panel: mark shipped (carrier and tracking, also sent to PayPal), mark delivered | B | 5 | M | T03, T06 | Buying a product with the sandbox buyer account produces an order with status paid. Tracking is recorded |
| T09 | Admin simulate: create-dispute button (based on T04 results) and adjudicate button (merchant or buyer wins) | A | 3 | M | T04, T07 | Buttons trigger PayPal actions. The webhook comes back and the case status changes |
| T10 | Facts builder: turn order, payment, tracking, delivery, policy, and messages into `facts` rows with stable IDs. Buyer text is flagged `untrusted` | A | 3 | M | T06, T07 | For case S1, a complete set of sourced facts is created. Snapshot test |
| T11 | Reason -> evidence mapping and rule-based submission (no LLM): build the `input` JSON and upload multipart to `provide-evidence` | A | 4 | M | T04, T10 | Case S1 is submitted from a button. The response is stored in `actions` and the audit log |
| T12 | Queue `/cases` (AG Grid: sort, filter, countdown) and the `/cases/[id]` skeleton (info, timeline, facts, action buttons) | B | 5 | M | T06 | Cases are shown and clickable. Countdown is correct |
| T13 | Integrate the S1 vertical slice on the hosted URL. Fix what breaks | A+B | 3 | M | T07 to T12 | **M1**: buy -> dispute -> case appears -> submit evidence -> adjudicate -> resolved, on the hosted server |

### Phase 2: AI and approval flow

| ID | Task | Owner | Hours | Prio | Depends on | Acceptance |
|---|---|---|---|---|---|---|
| T14 | LLM client (AI SDK, provider via env), zod schemas, prompt structure, untrusted-data wrapper | A | 3 | M | T02 | One structured call succeeds with a fixture. Provider can be switched via env |
| T15 | Draft writer and **grounding validator** (rules in architecture section 6). One retry. Adversarial tests: fake date, fake tracking number, missing reference, fake URL | A | 5 | M | T10, T14 | Draft passes for S1. All failing test cases are detected. A failed draft blocks approval |
| T16 | Evidence strength score, cost comparison, recommendation (deterministic) plus LLM rationale | A | 3 | M | T10, T14 | S1 yields fight, S2 yields refund. Unit tests cover band boundaries |
| T17 | Case detail UI: facts panel, recommendation card with the cost formula, draft editor with clickable fact reference chips, evidence checklist | B | 6 | M | T12, T15, T16 | Clicking a chip opens the source fact. Grounding errors are shown clearly |
| T18 | Approval flow: confirmation modal showing the content to be sent, status, audit timeline | B | 3 | M | T17 | No submit path without an approval click. Audit log is shown |
| T19 | Accept-claim and refund actions (`/v2/payments/captures/{id}/refund`) behind approval. Update status | A | 4 | S | T11 | Both work in the sandbox. Recorded in the audit log |
| T20 | PDF evidence packet (`pdf-lib`) attached to `provide-evidence` | A | 3 | S | T15 | PDF uploaded and accepted by the PayPal sandbox |
| T21 | Deadline cron: compute urgency, mark EXPIRED, poll disputes as a webhook fallback. A: cron endpoint (2 hours). B: urgency badge and filter (1 hour) | A+B | 3 | S | T07, T12 | Cases under 48 hours are labeled urgent. Cron passes with the secret |
| T22 | Second reason: not as described (`OTHER`), scoring, fixtures, seed S3 | A | 4 | S | T16 | S3 from start through evidence submission |
| T23 | Dashboard summary on `/`: open cases, amount at risk, due within 48 hours | B | 3 | S | T12 | Numbers match the data |

### Phase 3: Polish and hardening

| ID | Task | Owner | Hours | Prio | Depends on | Acceptance |
|---|---|---|---|---|---|---|
| T24 | Prompt injection defense and seed S4. Test that the draft does not contain customer instructions | A | 2 | M | T15 | S4 produces a correct draft. Tests pass |
| T25 | Hardening: user-friendly PayPal errors, retries, tests with `ERRDIS...` values, simple rate limiting on admin endpoints | A | 3 | M | T11 | Every error reads clearly in the UI. Tests pass |
| T26 | UX polish: empty, loading, and error states. Basic responsiveness. "Sandbox" badge. Copy. Basic accessibility | B | 4 | M | T17 | Full review with no broken screens |
| T27 | `demo:reset` and seed S1 to S4. One-page demo runbook | B | 2 | M | T10 | One command restores a clean demo state |
| T28 | Critical tests and a smoke script against the sandbox: order -> dispute -> evidence -> adjudicate | A | 4 | M | all features | CI green. Smoke script passes twice in a row |
| T30 | README (setup, architecture, screenshots, honest limitations), LICENSE, AI tool disclosure | B | 3 | M | - | A stranger can run the project from scratch with the README alone |

### Phase 4: Delivery

| ID | Task | Owner | Hours | Prio | Depends on | Acceptance |
|---|---|---|---|---|---|---|
| T31 | Rehearse the demo twice, record, edit, upload to YouTube as public, under 3 minutes, no copyrighted music | B (A helps) | 5 | M | M3 | Public YouTube link. Duration under 3:00 |
| T32 | Test from scratch: clone on a clean machine, follow the README, run the demo. Scan the repo and git history for secrets | A | 2 | M | M3 | Runs with the README only. No secrets |
| T33 | Devpost text (template in doc 05), screenshots, sponsor categories | B | 2 | M | T31 | Text complete, links correct |
| T34 | **Submit** and verify the "Submitted" status (not draft) | A+B | 1 | M | T31 to T33 | The public project page shows all links |

### Nice (only if M2 is reached early)

| ID | Task | Owner | Hours |
|---|---|---|---|
| T29 | MCP server: tools to list cases, get a case, run analysis. The approve tool is **not** exposed | A | 4 |
| T35 | Postman collection for the internal API | B | 1.5 |

## 5. Daily rituals

- **Start of day (async, 5 minutes):** post in team chat "today I am working on T__, the risk is __".
- **End of day (async):** "finished T__, stuck on T__, need __ from you".
- One task, one branch, one small PR. Review each other's PRs within 12 hours. Merge to `main` only when CI is green.
- After every merge to `main`, check that the hosted deployment is not broken.
- Do not keep context only in your head. Important decisions go into the relevant document.

## 6. Main risks and safety nets

The full list is in `02-ARCHITECTURE.md` section 12. The three most likely to break the schedule:

1. **T04 stalls** (auth assertion or multipart format). Allocate buffer, ask the community, use the manual fallback. Do not delay G1.
2. **Grounding validator too strict or too loose** (T15). Start with the simplest rules, then add adversarial tests one at a time.
3. **Running out of time for the video.** Write the video script before T17 is done, and build only what appears in the script.

## 7. Verified implementation status

Last checked: Nov 5, 2026.

### Done and verified
- **T07 (Webhook receiver):** `POST /api/webhooks/paypal` verifies the PayPal signature, dedupes by event `id`, fetches the dispute, and syncs it to SQLite. Covered by route tests.
- **T18 (Human approval flow):** `POST /api/cases/[id]/approve` and the approval modal. A draft must pass grounding before it can be approved; the approval records `approvedBy`, stores a hash of the approved draft, and moves the case to `APPROVED`.
- **T11 (Rule-based evidence submission and human gate):** `POST /api/cases/[id]/submit` requires `APPROVED`, builds the evidence payload from the order and draft (`src/lib/evidence/mapping.ts`), calls `provideDisputeEvidence` (fully simulated, with no PayPal call, when `DEMO_MODE=true`), and moves the case to `SUBMITTED`.
- **T19 (Accept claim and refund):**
  - `refundCapture` in `src/lib/paypal/orders.ts` uses PayPal Payments v2 (`POST /v2/payments/captures/{id}/refund`) with integer minor-unit conversion and a `PayPal-Request-Id` header.
  - `POST /api/cases/[id]/refund` and `POST /api/cases/[id]/accept`, each with a confirmation modal in the UI.
- **T09 (Admin simulator):**
  - `POST /api/admin/simulate/adjudicate` resolves a dispute (`SELLER_FAVOR` or `BUYER_FAVOR`).
  - `POST /api/admin/simulate/dispute` loads a preset scenario (S1 to S4) or a custom dispute.
  - `/admin/simulate` page with interactive controls.
- **T21 (Deadline cron):** `POST /api/cron/deadlines` protected by `CRON_SECRET`, scheduled every 15 minutes in `render.yaml`.
- **T23 (Dashboard):** `/` shows cases needing a decision, cases in progress, and charts.
- **T27 (Demo reset):** `pnpm run demo:reset` reseeds scenarios S1 to S4.
- **Read-only AI assistant:** `POST /api/cases/[id]/ask` answers merchant questions with `@paypal/agent-toolkit` read-only tools (`list_disputes`, `get_dispute`, `get_shipment_tracking`).

### Implemented as library code, not yet wired into the intake flow
- **T14, T15, T16:** `src/lib/agent/llm.ts` (structured generation), `grounding.ts`, `scoring.ts`, and `decision.ts` are implemented and unit-tested. New disputes do not yet trigger automatic analysis and drafting; the S1 analysis and draft come from the seed script.

### Not started
- **T20 (PDF evidence packet):** `pdf-lib` is a dependency but is not used yet.
- **T28 end-to-end tests:** `playwright.config.ts` exists, but there are no specs.
- **T29, T35 (Nice items).**

### Quality gate results
- `pnpm run typecheck`: 0 errors (TypeScript strict).
- `pnpm run lint`: no ESLint warnings or errors.
- `pnpm run test`: 17 test files, 85 tests passed.
- `pnpm run build`: Next.js 14 production build succeeds (5 pages, 14 API routes).

### Remaining blockers and risks
- Live sandbox credentials (`PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`) must be set in the hosting environment to run the real sandbox loop; local development defaults to `DEMO_MODE=true` with fixtures and simulated actions.
- Automatic analysis and LLM drafting for new disputes still need to be wired into the intake flow.
