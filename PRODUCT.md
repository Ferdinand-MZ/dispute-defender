# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** small PayPal merchants (demo persona: "Rina Dropship Store") who receive customer disputes and must respond before PayPal's seller deadline. They are not dispute experts; they need to know what to do next and why.
- **Evaluators:** PayPal AI Hackathon judges watching a short demo video or clicking the hosted demo. The flow (dispute arrives → recommendation → cited draft → human approval → submit) must be readable in seconds.

## Product Purpose

DisputeDefender is an AI co-pilot for PayPal disputes. It pulls a dispute from the PayPal Disputes API, combines it with the merchant's own order records into a fact base, recommends fight / refund / accept with a deterministic cost comparison, and drafts an evidence response where every claim cites a fact. A human approves before anything is sent to PayPal. Success: the merchant answers every dispute before the deadline with evidence they can trust.

## Positioning

Evidence that cannot be invented: every paragraph of the draft carries fact IDs, and a deterministic grounding validator blocks approval if any claim is unsupported. Money decisions (scores, expected-value math, state transitions) are code, never the LLM.

## Operating Context

- Merchant at a desk, daytime, checking a queue of open disputes ordered by deadline.
- Demo recorded as a screen video; also opened on phones and tablets by judges.
- PayPal Sandbox only (`api-m.sandbox.paypal.com`). Demo tools: a demo storefront that creates sandbox orders and ships them with tracking, and a simulator that opens and adjudicates sandbox disputes.

## Capabilities and Constraints

- Dispute reasons in scope: `MERCHANDISE_OR_SERVICE_NOT_RECEIVED`, `MERCHANDISE_OR_SERVICE_NOT_AS_DESCRIBED` only.
- Case states: NEW, ANALYZED, DRAFTED, APPROVED, SUBMITTED, RESOLVED, ACCEPTED, REFUNDED, EXPIRED, NEEDS_ATTENTION.
- Recommendations: FIGHT, REFUND, ACCEPT, with strength score (%) and win band (high / medium / low / very_low).
- Human approval required for provide-evidence, accept-claim, refund. Approval is blocked unless grounding passes.
- Read-only "Ask copilot" uses PayPal Agent Toolkit tools (`get_dispute`, shipment tracking).
- Sponsor tech in the UI: AG Grid (case queue), AG Charts (overview).
- Money is integer minor units; display via `formatMoney`.

## Brand Commitments

- Visual language aligned with PayPal's merchant tools (confirmed by the team 2026-11-01): PayPal navy and blue, clean neutral surfaces, so the product reads as native to the PayPal ecosystem. Not a copy of PayPal's own UI or logo.
- Product name: DisputeDefender.

## Evidence on Hand

- Seeded demo data: disputes PP-D-1001.. with orders O-1001.., facts, analyses, drafts (`src/lib/db/seed.ts`).
- No real customers, testimonials, or win-rate statistics exist. Do not invent them.

## Product Principles

1. Always show the next step: every case says where it is and what the merchant should do now.
2. Show the evidence, not the AI: claims link to their source facts.
3. The human signs: money-moving actions are explicit, named, and confirmable.
4. Deadlines first: urgency is visible everywhere a case appears.
5. Plain language over PayPal enum strings.

## Accessibility & Inclusion

WCAG 2.1 AA contrast, keyboard operable queue and dialogs, touch targets ≥44px on mobile.
