# Sponsor notes (T36)

Checked Oct 27, 2026. The Devpost pages (`/rules`, `/prizes`, `/resources`) could not be read with automated tools (HTTP 403), so everything marked **unverified** must be checked manually in a browser before relying on it.

## Verified facts

| Topic | Content | Source |
|---|---|---|
| Core requirement | The project must use PayPal **and** AI in a meaningful way. There are no mandatory tracks | [PayPal blog](https://developer.paypal.com/community/blog/PayPal_AI_Hackathon) |
| Schedule | Submissions close Nov 12, 2026; winners announced Dec 21, 2026 | PayPal blog |
| Overall prizes | Overall $12k / $8k / $5k. $5k each: Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce | PayPal blog |
| AG Grid | Best Use of AG Grid: $5k / $2k / 3 x $1k (the largest sponsor prize) | PayPal blog |
| Render | Best Use of Render: $1k / $750 / $500 in **Render credits**. The sponsor highlights Render Workflows | PayPal blog |
| Other sponsors | APIMatic (3 x $1k), Bryntum (3 x $1k), Channel3 ($1.5k). Kernel, Postman, Astropods, Elastic with no prize | PayPal blog |
| PayPal Agent Toolkit | `@paypal/agent-toolkit` has an `./ai-sdk` export. Dispute tools: `list_disputes`, `get_dispute`, `accept_dispute_claim`. There is no provide-evidence tool | [Agent tools](https://developer.paypal.com/ai-tools/agent-tools) |
| PayPal Tracking API | `POST /v1/shipping/trackers-batch`. Tracking matters for seller protection and helps PayPal resolve Item Not Received claims | [Tracking](https://developer.paypal.com/api/tracking/track-orders/integrate) |
| AG Grid version | Latest version is 36.x. Since v33, module registration and the Theming API are required | [Getting started](https://www.ag-grid.com/react-data-grid/getting-started/) |
| AG Grid Enterprise | Integrated charts, row grouping, AI Toolkit, and similar features are Enterprise. Without a license a watermark appears | [Community vs Enterprise](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/) |
| Render free tier | Web services sleep after 15 minutes idle, the filesystem is ephemeral, disks cannot be attached. Free Postgres expires after 30 days | [Render free](https://render.com/docs/free) |
| Render cron | Minimum $1/month, no disk access | [Cron jobs](https://render.com/docs/cronjobs) |

## Unverified (check manually)

- The weight of each judging criterion and the maximum video length.
- Detailed requirements for the AG Grid, Render, and APIMatic prizes (which features must be used, how to claim).
- Whether the hosted demo must stay live until judging ends (Dec 21).
- Participant eligibility rules.

## Implications for us

1. AG Grid is the most worthwhile sponsor prize to pursue because the case queue is already core to the product.
2. The Tracking API and the Agent Toolkit (read-only) add PayPal usage without breaking the approval rules in `AGENTS.md`.
3. SQLite on Render's free tier is lost when the service sleeps, so reseeding on boot (`DEMO_MODE`) is required for the hosted demo.
