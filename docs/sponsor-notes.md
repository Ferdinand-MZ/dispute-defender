# Sponsor notes (T36)

Dicek 27 Okt 2026. Halaman Devpost (`/rules`, `/prizes`, `/resources`) belum bisa dibaca lewat tool otomatis (HTTP 403), jadi semua yang ditandai **belum terverifikasi** harus dicek manual di browser sebelum dipakai.

## Fakta terverifikasi

| Topik | Isi | Sumber |
|---|---|---|
| Syarat inti | Proyek harus memakai PayPal **dan** AI secara bermakna. Tidak ada track wajib | [Blog PayPal](https://developer.paypal.com/community/blog/PayPal_AI_Hackathon) |
| Jadwal | Submit tutup 12 Nov 2026, pemenang diumumkan 21 Des 2026 | Blog PayPal |
| Hadiah umum | Overall $12k / $8k / $5k. $5k masing-masing: Most Creative, Most Impactful, Best Demo Delivery, Best Use of PayPal + AI, Best Use of Agentic Commerce | Blog PayPal |
| AG Grid | Best Use of AG Grid: $5k / $2k / 3 × $1k (hadiah sponsor terbesar) | Blog PayPal |
| Render | Best Use of Render: $1k / $750 / $500 dalam **kredit Render**. Sponsor menonjolkan Render Workflows | Blog PayPal |
| Sponsor lain | APIMatic (3 × $1k), Bryntum (3 × $1k), Channel3 ($1.5k). Kernel, Postman, Astropods, Elastic tanpa hadiah | Blog PayPal |
| PayPal Agent Toolkit | `@paypal/agent-toolkit` punya ekspor `./ai-sdk`. Tool dispute: `list_disputes`, `get_dispute`, `accept_dispute_claim`. Tidak ada tool provide-evidence | [Agent tools](https://developer.paypal.com/ai-tools/agent-tools) |
| PayPal Tracking API | `POST /v1/shipping/trackers-batch`. Resi penting untuk seller protection dan membantu PayPal menyelesaikan klaim Item Not Received | [Tracking](https://developer.paypal.com/api/tracking/track-orders/integrate) |
| AG Grid versi | Versi terbaru 36.x. Sejak v33 wajib registrasi modul dan memakai Theming API | [Getting started](https://www.ag-grid.com/react-data-grid/getting-started/) |
| AG Grid Enterprise | Integrated charts, row grouping, AI Toolkit, dll. adalah Enterprise. Tanpa lisensi muncul watermark | [Community vs Enterprise](https://www.ag-grid.com/react-data-grid/community-vs-enterprise/) |
| Render free tier | Web service tidur setelah 15 menit idle, filesystem ephemeral, tidak bisa pasang disk. Postgres gratis kedaluwarsa 30 hari | [Render free](https://render.com/docs/free) |
| Render cron | Minimal $1/bulan, tanpa akses disk | [Cron jobs](https://render.com/docs/cronjobs) |

## Belum terverifikasi (cek manual)

- Bobot tiap kriteria juri dan durasi maksimum video.
- Syarat detail hadiah AG Grid, Render, dan APIMatic (fitur apa yang harus dipakai, cara klaim).
- Apakah demo hosted wajib tetap hidup sampai penjurian selesai (21 Des).
- Aturan kelayakan peserta.

## Implikasi untuk kita

1. AG Grid paling layak dikejar karena antrean kasus sudah inti produk.
2. Tracking API dan Agent Toolkit (read-only) menambah pemakaian PayPal tanpa melanggar aturan approval di `AGENTS.md`.
3. SQLite di Render free akan hilang saat tidur, jadi reseed saat boot (`DEMO_MODE`) wajib untuk demo hosted.
