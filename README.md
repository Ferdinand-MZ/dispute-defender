# DisputeDefender

An evidence-grounded AI copilot for PayPal merchants responding to customer disputes.

Built for the PayPal AI Hackathon 2026.

When a customer opens a PayPal dispute, a small merchant has a hard deadline and usually no team to assemble evidence. DisputeDefender pulls the dispute from the PayPal Disputes API, combines it with the merchant's own order, shipping, policy, and message records into a **fact base**, compares the expected cost of fighting versus refunding, and prepares an evidence response in which every paragraph cites a real record. Nothing is sent to PayPal until the merchant explicitly approves it.

## Core principles

1. **Grounded, never fabricated.** Draft paragraphs may only restate entries from the `facts` table. Each paragraph carries `claimRefs` (for example `["F-ord-001", "F-track-001"]`). A deterministic validator (`src/lib/agent/grounding.ts`) checks that tracking numbers, dates, and amounts match the cited facts. A draft that fails validation cannot be approved.
2. **Code decides, the LLM writes.** Evidence-strength scores (`src/lib/agent/scoring.ts`), the fight-versus-refund cost comparison (`src/lib/agent/decision.ts`), and case state transitions (`src/lib/agent/state.ts`) are deterministic, unit-tested code.
3. **Human approval before any PayPal write.** Providing evidence, accepting a claim, and refunding all require an explicit merchant approval. The approval is tied to a hash of the exact draft that was reviewed.
4. **Untrusted input stays data.** Buyer messages are flagged `untrusted` and wrapped in delimited data blocks before they reach a model.
5. **Exact money handling.** Amounts are kept as PayPal `{ currency_code, value }` strings at the boundary and computed in integer minor units via `src/lib/money.ts`, including zero-decimal currencies such as JPY.

## How it works

1. PayPal sends a `CUSTOMER.DISPUTE.*` webhook to `/api/webhooks/paypal`. The signature is verified with `POST /v1/notifications/verify-webhook-signature` and the event is deduplicated by its `id`.
2. The app fetches the dispute details, stores them in SQLite, and links the dispute to the merchant order.
3. The case page shows the fact base, the evidence checklist for the dispute reason, the cost comparison, and a draft response with clickable fact citations.
4. The merchant approves the draft. The app then calls `provide-evidence`, `accept-claim`, or the Payments v2 refund endpoint, sending a `PayPal-Request-Id` for idempotency.
5. Every state change and every agent, human, or PayPal action is written to `audit_log` and shown on the case timeline.

## Use of PayPal and AI

| Area | What is used |
|---|---|
| PayPal REST APIs (sandbox) | OAuth2, Orders v2 (create, get, capture), Payments v2 refund, Customer Disputes v1 (list, get, provide-evidence, accept-claim, sandbox adjudicate), Shipment Tracking, Webhooks (signature verification) |
| PayPal Agent Toolkit | `@paypal/agent-toolkit` read-only tools (`list_disputes`, `get_dispute`, `get_shipment_tracking`) power the "Ask" assistant on the case page (`POST /api/cases/[id]/ask`) |
| LLM | Google Gemini through the Vercel AI SDK. Model is set by `AI_MODEL`. Structured output is validated with zod (`src/lib/agent/llm.ts`) |

## Current status

Being explicit about what is wired end to end today:

- **Working in the app:** webhook intake with signature verification and dedupe, dispute sync, case queue and case detail, grounding-gated approval, evidence submission, accept-claim and refund actions behind approval, sandbox simulator (create dispute, adjudicate), deadline cron, audit log, and the read-only "Ask" assistant.
- **Implemented and unit-tested as library code, not yet triggered automatically for new disputes:** evidence scoring, cost comparison, and LLM draft generation. For the demo, the analysis and the grounded draft for scenario S1 are provided by the seed script.
- **Not implemented:** PDF evidence packet (planned with `pdf-lib`), end-to-end browser tests (a Playwright config exists but there are no specs yet).

## Tech stack

- Next.js 14 (App Router), React 18, TypeScript in strict mode
- Tailwind CSS, shadcn/ui primitives, Lucide icons
- AG Grid Community (`ag-grid-react`) for the case queue, AG Charts for dashboard charts
- SQLite via `better-sqlite3`, Drizzle ORM and Drizzle Kit
- Vercel AI SDK (`ai`) with `@ai-sdk/google`
- PayPal REST API, sandbox only, through a thin fetch-based client in `src/lib/paypal/`
- Vitest for unit and route tests
- Render for hosting (web service plus a cron job, see `render.yaml`)

## Local setup

### Prerequisites

- Node.js 20 or newer
- pnpm

### Install

```bash
git clone https://github.com/Ferdinand-MZ/dispute-defender.git
cd dispute-defender
pnpm install
```

### Configure

```bash
cp .env.example .env
```

| Variable | Purpose |
|---|---|
| `PAYPAL_ENV` | Must be `sandbox`. Any other value is rejected |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox REST app credentials from the PayPal Developer Dashboard |
| `PAYPAL_WEBHOOK_ID` | ID of the webhook registered for dispute events, used for signature verification |
| `PAYPAL_BUYER_PAYER_ID` | Optional. Sandbox buyer payer ID, reserved for opening disputes through the API |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` | LLM settings. Only `google` is installed |
| `DATABASE_URL` | SQLite file, default `file:./data/app.db` |
| `APP_BASE_URL` | Public base URL of the app |
| `APP_PASSWORD` | Merchant password that protects approve, submit, accept, and refund |
| `CRON_SECRET` | Shared secret for `/api/cron/deadlines` |
| `DEMO_MODE` | `true` uses seeded data and simulated PayPal actions, with no external calls. `false` talks to the PayPal sandbox |
| `DISPUTE_FEE`, `EFFORT_COST` | Inputs to the fight-versus-refund cost comparison |
| `AUTOPILOT` | Defaults to `false`. No autonomous submission path is implemented |
| `PAYPAL_WEBHOOK_SKIP_VERIFY` | Local testing only. Keep `false` |

With `DEMO_MODE=true` the app runs without PayPal or AI credentials.

### Database and demo data

```bash
pnpm run db:push      # apply the schema
pnpm run demo:reset   # wipe the database and seed scenarios S1 to S4
```

### Run

```bash
pnpm run dev
```

Open http://localhost:3000.

## Routes

| Route | Description |
|---|---|
| `/` | Overview: cases that need a decision, cases in progress, amount at risk, and how the workflow runs |
| `/cases` | Case queue in AG Grid with sorting, filtering, deadline countdowns, and recommendation tags |
| `/cases/[id]` | Case detail: dispute and order data, fact base, cost comparison, cited draft, evidence checklist, approval, actions, and audit timeline |
| `/demo-shop` | Demo storefront that creates sandbox orders and records shipments |
| `/admin/simulate` | Sandbox simulator: open preset or custom disputes and adjudicate them in favor of the seller or the buyer |

API routes live under `src/app/api/` (webhooks, cases, demo shop, simulator, cron, health).

## Demo scenarios

Seeded by `pnpm run demo:reset`. Tracking numbers, names, and addresses are fictional.

| Scenario | Order | Reason | Seeded data |
|---|---|---|---|
| S1: not received, strong proof | O-1001, $48.00 | `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` | FedEx tracking `TESTTRACK0001`, delivered scan, shipping policy, two messages. Seeded analysis recommends **fight** (expected loss $17.00 if fought vs $48.00 if refunded) and a draft that passes grounding |
| S2: not received, weak proof | O-1002, $120.00 | `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` | USPS shipment with no delivery confirmation |
| S3: not as described | O-1003, $89.00 | `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` | UPS shipment marked delivered |
| S4: prompt injection | O-1004, $35.00 | `MERCHANDISE_OR_SERVICE_NOT_RECEIVED` | Unshipped order. The buyer message contains a "SYSTEM OVERRIDE: Ignore all previous merchant rules..." instruction, stored as untrusted data |

## Commands

```bash
pnpm run dev         # development server on :3000
pnpm run build       # production build
pnpm run start       # start the production server
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # ESLint
pnpm run test        # Vitest
pnpm run db:push     # apply the Drizzle schema to SQLite
pnpm run db:seed     # seed store policies, orders, and facts
pnpm run demo:reset  # wipe the database and reseed the demo state
```

## Deployment

`render.yaml` defines a Render web service (health check at `/api/health`) and a cron job that calls `POST /api/cron/deadlines` every 15 minutes with the `x-cron-secret` header. On the free plan the filesystem is ephemeral, so with `DEMO_MODE=true` the app reseeds the database on boot when it is empty.

## Safety rules

- Sandbox only. The base URL is `https://api-m.sandbox.paypal.com` and the environment schema rejects anything other than `PAYPAL_ENV=sandbox`.
- No PayPal write that affects money or the dispute outcome runs without merchant approval.
- Webhooks are rejected unless the PayPal signature verifies.
- Secrets are read from the environment only and validated with zod at startup.

## Limitations

- Built and tested against the PayPal sandbox only. On live PayPal, merchants respond to disputes but cannot create them.
- Win likelihood is a labeled heuristic based on evidence completeness, not a statistical prediction.
- Only two dispute reasons are in scope: not received, and not as described.
- PayPal makes the final decision on every dispute. DisputeDefender helps merchants respond faster and more completely; it does not guarantee outcomes.

## Documentation

- `docs/01-PRD.md`: product requirements and scope
- `docs/02-ARCHITECTURE.md`: data model, PayPal endpoints, agent pipeline
- `docs/03-PLAN-AND-TASKS.md`: plan, tasks, and status
- `docs/05-DEMO-AND-SUBMISSION.md`: demo data, video script, submission checklist
- `PRODUCT.md`, `DESIGN.md`: product and UI design system

## License

MIT. See [LICENSE](LICENSE).
