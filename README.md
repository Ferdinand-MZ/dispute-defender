# DisputeDefender

An evidence-grounded AI copilot for PayPal merchants responding to customer disputes. Built for the PayPal AI Hackathon 2026.

When a customer opens a dispute, a small merchant faces a hard deadline and usually has no team to assemble evidence. DisputeDefender pulls the dispute from the PayPal Disputes API, combines it with the merchant's own order, shipping, policy, and message records, recommends **fight, refund, or accept** with a visible cost comparison, and drafts an evidence response in which every paragraph cites a real record. Nothing is sent to PayPal until the merchant approves it.

## Quick start

Requirements: Node.js 20+, pnpm, and Docker (for PostgreSQL).

```bash
git clone https://github.com/Ferdinand-MZ/dispute-defender.git
cd dispute-defender
pnpm install
cp .env.example .env      # defaults work as they are
docker compose up -d      # PostgreSQL on localhost:5433
pnpm run demo:reset       # create tables and seed scenarios S1 to S4
pnpm run dev              # http://localhost:3000
```

The default `DEMO_MODE=true` needs **no PayPal or AI credentials**: it uses seeded data, simulates every PayPal action locally, and writes drafts with the rule-based engine. To let the model write, set `AI_API_KEY` (Google Gemini) in `.env`.

No Docker? Point `DATABASE_URL` at any PostgreSQL 14+ database. Tables are created on first start.

## Try the demo

Run `pnpm run demo:reset` at any time to restore this starting state.

| Step | Where | What to do | What you should see |
|---|---|---|---|
| 1 | `/cases` | Open the queue | Four disputes, nearest deadline first, each with a recommendation |
| 2 | `/cases/PP-D-1001` | Read the recommendation and the draft; select a citation chip | **Fight**, evidence strength 100%, expected loss $17.00 versus a $48.00 refund. Each paragraph links to its source record |
| 3 | Same page | **Edit text**, add `Tracking number FAKE12345678` to a paragraph, save | The fact check fails, the unsupported claim is listed, approval is blocked |
| 4 | Same page | **Regenerate draft**, then **Review and send evidence**, then **Approve and send** | The case moves to *Sent to PayPal*; the approval and submission appear in the activity log |
| 5 | `/admin/simulate` | Enter `PP-D-1001` and choose **Merchant wins** | The case becomes *Resolved* |
| 6 | `/cases/PP-D-1002` | Review the weak-evidence case | **Refund** is recommended; no draft is pushed |
| 7 | `/cases/PP-D-1004` | Read the buyer message in the fact base | The injected "SYSTEM OVERRIDE" text is labeled buyer-written, treated as data only, and cannot be cited. **Accept** is recommended |

Scenario reference:

| Scenario | Dispute | Records on file | Result |
|---|---|---|---|
| S1: not received, strong proof | `PP-D-1001`, $48.00 | Tracking, delivery confirmation, matching address, shipping policy, merchant message | Fight, grounded draft ready to approve |
| S2: not received, weak proof | `PP-D-1002`, $120.00 | Tracking only, no delivery confirmation | Refund |
| S3: not as described | `PP-D-1003`, $89.00 | Item record, tracking, delivery, return policy | Fight, grounded draft |
| S4: prompt injection | `PP-D-1004`, $35.00 | Never shipped; buyer message contains instructions | Accept; buyer text is quarantined |

Tracking numbers, names, and addresses are fictional.

## How it works

1. **Intake.** PayPal sends a `CUSTOMER.DISPUTE.*` webhook to `/api/webhooks/paypal`. The signature is verified with `POST /v1/notifications/verify-webhook-signature` and the event is deduplicated by its `id`. A polling job (`/api/cron/deadlines`) covers missed webhooks.
2. **Facts.** Order, payment, address, tracking, delivery, policies, and messages become fact rows with stable IDs. Buyer-written text is stored as untrusted.
3. **Analysis.** Code scores the evidence for the dispute reason, compares the expected cost of fighting with refunding, and picks the recommendation. The LLM only writes the plain-language explanation.
4. **Draft.** The LLM writes the evidence response with fact IDs on every paragraph. A deterministic validator checks tracking numbers, dates, amounts, and URLs against the cited facts. On failure the model gets one retry; a draft that still fails cannot be approved. If no model is available, a rule-based draft restates one fact per paragraph.
5. **Approval.** The merchant reviews, optionally edits (edits are fact-checked again), and approves. The approval is tied to a hash of the exact draft.
6. **Action.** Only then does the app call `provide-evidence` (with a generated PDF evidence packet), `accept-claim`, or the Payments v2 refund endpoint, with a `PayPal-Request-Id` for idempotency. Every step is written to the audit log.

## Safety design

- **Grounded, never fabricated.** Drafts may only restate records from the fact base (`src/lib/agent/grounding.ts`).
- **Code decides, the LLM writes.** Scoring, cost math, and state transitions are deterministic and unit-tested (`scoring.ts`, `decision.ts`, `state.ts`). Analysis and drafting calls have no tools.
- **Human approval before any PayPal write** that affects money or the outcome.
- **Untrusted input stays data.** Buyer messages are wrapped in delimited blocks, excluded from evidence scoring, and rejected if cited.
- **Exact money.** Amounts are computed in integer minor units (`src/lib/money.ts`), including zero-decimal currencies.
- **Sandbox only.** Any `PAYPAL_ENV` other than `sandbox` is rejected at startup.

## PayPal and AI usage

| Area | What is used |
|---|---|
| PayPal REST APIs (sandbox) | OAuth2, Orders v2, Payments v2 refund, Customer Disputes v1 (list, get, provide-evidence, accept-claim, adjudicate), Shipment Tracking, Webhooks signature verification |
| PayPal Agent Toolkit | `@paypal/agent-toolkit` read-only tools (`list_disputes`, `get_dispute`, `get_shipment_tracking`) for the "Ask" assistant on the case page in sandbox mode |
| LLM | Google Gemini through the Vercel AI SDK, model set by `AI_MODEL`. Writes the evidence draft and the recommendation explanation; output is zod-validated and fact-checked |
| Development | AI coding assistants (including Claude Code) wrote parts of the code, reviewed by the team |

## Configuration

All settings live in `.env` (see `.env.example`).

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection URL. The default matches `docker-compose.yml` |
| `DEMO_MODE` | `true`: seeded data and simulated PayPal actions. `false`: real PayPal sandbox calls |
| `AI_PROVIDER`, `AI_MODEL`, `AI_API_KEY` | LLM settings. Only `google` is installed. Without a key the rule-based engine is used |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | Sandbox REST app credentials. Required when `DEMO_MODE=false` |
| `PAYPAL_WEBHOOK_ID` | ID of the registered dispute webhook, used for signature verification |
| `PAYPAL_ENV` | Must be `sandbox` |
| `APP_PASSWORD` | Optional. When set, the app requires HTTP basic auth with this password |
| `CRON_SECRET` | Shared secret for `/api/cron/deadlines` |
| `DISPUTE_FEE`, `EFFORT_COST` | Inputs to the fight-versus-refund cost comparison |
| `AUTOPILOT` | Keep `false`. No autonomous submission path exists |
| `PAYPAL_WEBHOOK_SKIP_VERIFY` | Local testing only. Ignored in production |

### Running against the PayPal sandbox

1. Create a sandbox REST app in the PayPal Developer Dashboard and set `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET`.
2. Set `DEMO_MODE=false` and restart.
3. Create orders in `/demo-shop`, mark them shipped, then open disputes from `/admin/simulate`.
4. To receive webhooks, expose the app on a public HTTPS URL, register a webhook for the dispute events pointing to `/api/webhooks/paypal`, and set `PAYPAL_WEBHOOK_ID`. Without a public URL, poll instead:

```bash
curl -X POST -H "x-cron-secret: <your CRON_SECRET>" http://localhost:3000/api/cron/deadlines
```

## Project structure

```
src/
  app/                  # Next.js routes: pages and API
    api/webhooks/       #   PayPal webhook receiver (signature check, dedupe)
    api/cases/          #   analyze, draft, approve, submit, accept, refund, ask, packet
    api/cron/           #   deadline job and dispute polling fallback
    cases/              #   dispute queue and case detail
    demo-shop/          #   demo storefront for sandbox orders
    admin/simulate/     #   open and settle sandbox disputes
  components/           # UI components (AG Grid queue, case view, charts)
  lib/
    agent/              # facts, scoring, decision, draft, grounding validator, state machine
    paypal/             # REST client: auth, disputes, orders, tracking, webhooks
    evidence/           # reason-to-evidence mapping, PDF evidence packet
    db/                 # Drizzle schema, queries, seed
    money.ts            # integer minor-unit arithmetic
fixtures/paypal/        # recorded sandbox responses used by tests
scripts/                # demo-reset, plus manual PayPal sandbox checks in scripts/sandbox/
tests-e2e/              # Playwright specs
docs/                   # PRD and architecture
```

Unit and route tests sit next to the code they cover (`*.test.ts`).

## Commands

```bash
pnpm run dev         # development server on :3000
pnpm run build       # production build
pnpm run start       # start the production build
pnpm run typecheck   # tsc --noEmit
pnpm run lint        # ESLint
pnpm run test        # Vitest (needs the PostgreSQL container)
pnpm run db:push     # apply the Drizzle schema
pnpm run db:seed     # seed store data
pnpm run demo:reset  # wipe and reseed the demo state
```

## Troubleshooting

| Symptom | Fix |
|---|---|
| "This page could not load", or "Database unreachable" in the top bar | Check that the container is running (`docker compose ps`) and that `DATABASE_URL` is a `postgresql://` URL |
| Draft says "Assembled by rules" after **Regenerate draft** | No `AI_API_KEY`, or the model was unavailable. The reason is in the activity log |
| Port 5433 already in use | Change the port in `docker-compose.yml` and `DATABASE_URL` |

## Tech stack

Next.js 14 (App Router), React 18, TypeScript strict · Tailwind CSS, shadcn/ui · AG Grid and AG Charts · PostgreSQL, Drizzle ORM · Vercel AI SDK with `@ai-sdk/google` · `pdf-lib` · Vitest, Playwright

## Limitations

- Sandbox only. On live PayPal, merchants respond to disputes but cannot create them.
- Win likelihood is a labeled heuristic based on evidence completeness, not a statistical prediction.
- Two dispute reasons are in scope: item not received, and not as described.
- PayPal makes the final decision on every dispute. DisputeDefender helps merchants respond faster and more completely; it does not guarantee outcomes.

## Documentation

- [docs/01-PRD.md](docs/01-PRD.md): product requirements and scope
- [docs/02-ARCHITECTURE.md](docs/02-ARCHITECTURE.md): data model, PayPal endpoints, agent pipeline
- [PRODUCT.md](PRODUCT.md), [DESIGN.md](DESIGN.md): product brief and UI design system
- [AGENTS.md](AGENTS.md): rules given to AI coding agents working on this repository
- [docs/internal/](docs/internal/): team working notes (plan, prompts, submission checklist)

## License

MIT. See [LICENSE](LICENSE).
