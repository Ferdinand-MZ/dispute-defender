# DisputeDefender 🛡️
> **An evidence-grounded AI copilot for PayPal merchants responding to customer disputes.**

Built for the **PayPal AI Hackathon 2026**.

DisputeDefender automates the critical, time-sensitive workflow of handling PayPal disputes without ever fabricating evidence or making autonomous financial decisions. It combines merchant order and shipment records into a verified **fact base**, deterministically calculates evidence strength and expected cost comparison, drafts structured responses where every claim cites a real record, and requires **explicit human approval** before submitting to PayPal's Customer Disputes API.

---

## ⚡ Core Philosophy: "LLM for Language, Code for Decisions"

1. **Strictly Grounded (No Hallucinations):** The AI may only reference verified entries from the `facts` table. Every paragraph carries `claimRefs` (e.g. `["F-ord-001", "F-track-001"]`). A deterministic validator enforces that tracking numbers, dates, and amounts match cited facts before human approval is unlocked.
2. **Deterministic Financial Math:** Win probabilities, Expected Value (EV) cost formulas (`expectedLossIfFight` vs `lossIfRefund`), and state transitions are pure code. The LLM writes language only.
3. **Strict Human Gatekeeper:** Zero autonomous write operations to PayPal. Evidence submission, claim acceptance, and refunds always require explicit merchant confirmation.
4. **Prompt Injection Defense:** Buyer messages and external claims are quarantined with `untrusted: true` and wrapped inside data blocks. LLM calls for analysis and drafting have no tools.
5. **Exact Money Handling:** All financial arithmetic is performed in integer minor units (cents) via `src/lib/money.ts`. Floating-point arithmetic is forbidden. Zero-decimal currencies (e.g., JPY) are fully handled.

---

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router) + TypeScript Strict Mode + React
- **UI:** Tailwind CSS + shadcn/ui primitives + Lucide Icons
- **Data Grid:** AG Grid Community (`ag-grid-react`) for high-performance dispute queue management
- **Database:** SQLite (via `better-sqlite3`) + Drizzle ORM + Drizzle Kit
- **AI Engine:** Vercel AI SDK (`ai`) with structured JSON schema outputs (defaults to Google Gemini / configurable via env)
- **Payment & Disputes:** PayPal REST API (Sandbox environment only)
- **Testing:** Vitest for unit & integration tests; Playwright for E2E
- **PDF Generation:** `pdf-lib` for pure JS evidence packet generation

---

## 🚀 Quick Start (Local Setup in Under 5 Minutes)

### 1. Prerequisites
- Node.js LTS (v20+ or v22+)
- `pnpm` (recommended) or `npm`

### 2. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/dispute-defender.git
cd dispute-defender
pnpm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Key variables:
- `PAYPAL_ENV=sandbox` (strictly sandbox only)
- `PAYPAL_CLIENT_ID` & `PAYPAL_CLIENT_SECRET` (from your PayPal Developer Dashboard)
- `AI_PROVIDER=google`
- `AI_API_KEY=your_gemini_api_key`
- `DATABASE_URL=file:./data/app.db`
- `DEMO_MODE=true`

### 4. Initialize Database & Seed Demo Data
```bash
# Push SQLite schema and seed demo store, policies, and scenarios S1-S4
pnpm run db:push
pnpm run db:seed

# Or reset database cleanly at any time:
pnpm run demo:reset
```

### 5. Launch Development Server
```bash
pnpm run dev
```
Open [http://localhost:3000](http://localhost:3000) to access the DisputeDefender Dashboard.

---

## 🧭 Application Routes

- `/` — **Executive Summary Dashboard:** Overview of active disputes, capital at risk, urgent 48h deadlines, and system safeguards.
- `/cases` — **AG Grid Dispute Queue:** High-performance grid with sorting, filtering, countdown timers, and recommendation tags.
- `/cases/[id]` — **Case Detail & Evidence Room:**
  - *Left:* Dispute metadata, linked store order, carrier tracking, and audit log.
  - *Center:* Verified fact base, deterministic cost formula, grounded draft response with interactive fact citations.
  - *Right:* Evidence checklist, human approval gatekeeper, and PayPal submission modal.
- `/demo-shop` — **Demo Storefront:** Catalog generating sandbox orders and tracking updates.
- `/admin/simulate` — **Sandbox Simulator:** Controls to trigger test disputes, simulate PayPal adjudication, and test negative-path error handling.

---

## 📋 Available Commands

```bash
pnpm run dev         # Start Next.js development server on :3000
pnpm run build       # Build production application
pnpm run start       # Start production server
pnpm run typecheck   # Typecheck codebase (tsc --noEmit)
pnpm run lint        # Run ESLint checks
pnpm run test        # Execute Vitest test suite
pnpm run db:push     # Apply Drizzle ORM schema to SQLite
pnpm run db:seed     # Seed demo store policies, orders, and facts
pnpm run demo:reset  # Wipe database and reseed clean demo state
```

---

## 🧪 Demo Scenarios Seeded (`pnpm run demo:reset`)

1. **Scenario S1 (Not Received • Strong Proof):** Order O-1001 ($48.00) with FedEx tracking and verified delivery scan to customer zip code. Recommendation: **FIGHT** ($31.00 net EV advantage). Grounding validator passes; ready for human approval and submission.
2. **Scenario S2 (Not Received • Weak Proof):** Order O-1002 ($120.00) shipped without confirmed delivery scan. Recommendation: **REFUND** to prevent dispute fee escalation.
3. **Scenario S3 (Not as Described • SNAD):** Order O-1003 ($89.00) with listing snapshots and return policy on file.
4. **Scenario S4 (Prompt Injection Defense):** Order O-1004 ($35.00) where buyer message includes malicious instruction overrides ("Ignore previous rules..."). Quarantined as untrusted data; grounding validator blocks false claims.

---

## 🔒 Security & Non-Negotiable Rules

- **Sandbox Only:** Base URL is strictly `https://api-m.sandbox.paypal.com`. Live credentials are never accepted.
- **Human Authorization Required:** Financial write operations (`provide-evidence`, `accept-claim`, `refund`) cannot execute autonomously.
- **Audit Logging:** Every state change, LLM run, and human or PayPal interaction is recorded to `audit_log`.
- **Zero Secrets Committed:** Environment variables are strictly validated with Zod at runtime.

---

## ⚖️ Limitations & Disclaimers

- **Sandbox Focus:** Designed and tested against the PayPal Sandbox environment.
- **Heuristic Likelihood Bands:** Probability estimates are heuristics based on merchant evidence completeness, not guaranteed statistical predictions.
- **PayPal Authority:** The final adjudication decision rests solely with PayPal dispute arbiters. DisputeDefender optimizes merchant response speed, completeness, and adherence to evidence criteria.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
