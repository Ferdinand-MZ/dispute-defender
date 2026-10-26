# 03 - Rencana dan Tugas

Semua waktu dalam **WIB**. Hari ini Minggu 25 Okt 2026. Deadline resmi: **Kamis 12 Nov 12:00 PST = Jumat 13 Nov 03:00 WIB**. Target internal: **submit Rabu 11 Nov malam**. Kamis 12 Nov hanya buffer darurat, tanpa fitur baru.

## 1. Asumsi

- Tim 2 orang: **Dev A** (backend, PayPal, agent) dan **Dev B** (frontend, UX, demo, dokumen). Ganti nama sesuai tim kalian.
- Kapasitas sekitar 3 jam per hari kerja dan 6 jam per hari akhir pekan, jadi sekitar 66 jam per orang. Estimasi di bawah sudah memperhitungkan vibecoding dengan AI agent.
- Beban: Dev A sekitar 60 jam (jalur kritis), Dev B sekitar 45 jam. Kalau A tertinggal, B mengambil T09, T21 (bagian cron), dan T27.
- **Kalau solo:** gabungkan A dan B, buang semua item Should kecuali T16 dan T17, dan lewati Nice.

## 2. Milestone dan gerbang keputusan

| Kode | Tanggal | Keluaran |
|---|---|---|
| **G1** (gerbang) | Rab 28 Okt, malam | Siklus sandbox terbukti: order -> sengketa -> webhook -> provide-evidence 200 -> adjudicate -> RESOLVED. Lihat kriteria di bawah |
| **M1** | Min 1 Nov | Irisan vertikal S1 jalan di URL hosted, tanpa LLM |
| **M2** | Jum 6 Nov | AI lengkap: analisis, draft, validator, persetujuan, aksi. **Feature freeze** malam ini (satu-satunya pengecualian: T22 boleh selesai Sab 7 Nov) |
| **M3** | Sen 9 Nov | Polish, tes, README selesai. **Code freeze 23:59** |
| **M4** | Rab 11 Nov | Video diunggah dan Devpost ter-submit |

**Kriteria G1 (semua harus terpenuhi, atau ada fallback yang disepakati):**
1. Order sandbox ter-capture lewat skrip.
2. Sengketa ada di akun merchant sandbox (via API, atau fallback manual dari akun buyer).
3. Webhook `CUSTOMER.DISPUTE.CREATED` tiba di URL hosted (atau lewat simulator).
4. `GET dispute` tersimpan sebagai fixture.
5. `provide-evidence` mengembalikan 200 dengan resi dan catatan.
6. `adjudicate` membuat status resolved dan webhook `RESOLVED` tiba.

**Jika G1 gagal di poin 5 setelah 4 jam debugging:** tanya di forum Devpost hackathon dan Discord PayPal Developer. Jika sampai Kamis 29 Okt malam siklus tetap tidak bisa dibuktikan, hentikan dan putuskan bersama apakah pindah ke ide cadangan (pemulihan langganan gagal). Jangan lanjut membangun UI di atas siklus yang belum terbukti.

## 3. Kalender harian

| Tgl | Hari | D | Dev A | Dev B | Keluaran akhir hari |
|---|---|---|---|---|---|
| 26 Okt | Sen | 1 | T01, T03 | T02, mulai T05 | Repo dan CI jalan. Token PayPal berhasil |
| 27 Okt | Sel | 2 | T04 (spike), T36 | T05 selesai | Aplikasi skeleton hosted. Webhook terdaftar |
| 28 Okt | Rab | 3 | T04 selesai, **G1** | mulai T08 | Keputusan G1 |
| 29 Okt | Kam | 4 | T06, mulai T07 | T08 | Skema DB. Webhook diterima |
| 30 Okt | Jum | 5 | T07 selesai, T10 | T08 selesai | Order -> sengketa -> fakta |
| 31 Okt | Sab | 6 | T11, T09 | T12 | Kirim bukti berbasis aturan |
| 1 Nov | Min | 7 | T13 integrasi | T12, T13 | **M1** irisan vertikal hosted |
| 2 Nov | Sen | 8 | T14 | mulai T17 | LLM client dan skema |
| 3 Nov | Sel | 9 | T15 (draft + grounding) | T17 | Draft terverifikasi |
| 4 Nov | Rab | 10 | T16 | T18 | Rekomendasi dan UI persetujuan. **Cek cut-line 1** |
| 5 Nov | Kam | 11 | T19 | T21 (badge), T23 | Aksi terima dan refund |
| 6 Nov | Jum | 12 | T20, T21 (cron) | T23 | **M2**, feature freeze |
| 7 Nov | Sab | 13 | T22 (pengecualian freeze, hanya jika cut-line 1 lolos), perbaikan bug | T26 | Alasan kedua dan polish |
| 8 Nov | Min | 14 | T24, T25 | T26, T27 | Keamanan, error handling, seed |
| 9 Nov | Sen | 15 | T28, perbaikan bug | T30 | **M3**, code freeze 23:59 |
| 10 Nov | Sel | 16 | T32 uji dari nol | T31 latihan dan rekam | Video mentah, QA bersih |
| 11 Nov | Rab | 17 | bantu video, cek ulang | T33, T31 unggah | **M4**: T34 submit sebelum 20:00 |
| 12 Nov | Kam | 18 | buffer | buffer | Hanya perbaikan darurat |

**Cut-line 1 (Rab 4 Nov malam):** jika T15 atau T16 belum selesai, buang S2, S6, N1 sampai N3 dan fokus menyelesaikan M1 sampai M11.
**Cut-line 2 (Jum 6 Nov):** apa pun yang belum selesai dan bukan Must dibuang (kecuali T22 sesuai catatan M2). Waktu setelahnya hanya untuk stabilitas.

## 4. Daftar tugas

Prioritas: **M** Must, **S** Should, **N** Nice. Estimasi dalam jam. Kriteria penerimaan ringkas, kriteria lengkap mengikuti `01-PRD.md`.

### Fase 0: Setup dan spike

| ID | Tugas | Owner | Jam | Prio | Bergantung | Penerimaan |
|---|---|---|---|---|---|---|
| T01 | Daftar PayPal Developer. Buat app Sandbox dengan Disputes dan Webhooks aktif. Buat akun sandbox: 1 business (merchant), 2 personal (buyer). Simpan kredensial di password manager | A | 1.5 | M | - | Client ID dan secret ada. Bisa login ke ketiga akun sandbox |
| T02 | Inisialisasi repo: Next.js, TypeScript strict, Tailwind, shadcn/ui, eslint, prettier, vitest. Lisensi MIT. `.env.example`. Salin `AGENTS.md` dan dokumen ini. GitHub Actions: typecheck, lint, test. Pasang skrip npm dari AGENTS.md | B | 2 | M | - | `npm run dev/build/typecheck/lint/test` hijau. CI hijau. Repo publik dengan lisensi tampil di About |
| T03 | Klien PayPal: OAuth dengan cache token, fetch wrapper (debug id, retry 429/5xx, `PayPal-Request-Id`). Skrip membuat order dan capture (persetujuan buyer bisa manual lewat tautan approve). Simpan respons sebagai fixture | A | 2 | M | T01 | Skrip menghasilkan capture id. Fixture tersimpan tanpa rahasia |
| T04 | **Spike sengketa.** Skrip: buat sengketa sandbox (API dengan Auth-Assertion atau fallback manual), GET detail, `provide-evidence` multipart dengan resi dan catatan, `adjudicate`. Catat nama field asli dan batas file. Simpan semua respons sebagai fixture | A | 5 | M | T03 | Kriteria G1 poin 1 sampai 6 (kecuali webhook hosted) |
| T05 | Deploy skeleton ke Render (web service). Route `/api/health`. Daftarkan webhook ke 3 event sengketa. Simpan `PAYPAL_WEBHOOK_ID` | B | 2 | M | T02 | URL publik hidup. Simulator webhook PayPal menghasilkan log di server |
| T36 | Baca halaman sponsor AG Grid dan Render di Devpost, dan halaman Rules. Catat syarat hadiah, aturan masa live demo, dan kelayakan peserta | A | 1 | M | - | Catatan 10 baris di repo (`docs/sponsor-notes.md`) |

### Fase 1: Irisan vertikal (tanpa LLM)

| ID | Tugas | Owner | Jam | Prio | Bergantung | Penerimaan |
|---|---|---|---|---|---|---|
| T06 | Skema Drizzle dan migrasi sesuai `02-ARCHITECTURE.md` bagian 4. Seed dasar (kebijakan toko) | A | 2 | M | T02 | `db:push` dan `db:seed` jalan. Tipe terhasilkan |
| T07 | Penerima webhook: verifikasi tanda tangan, dedupe `event_id`, respons 200 cepat, intake job (GET detail, upsert, tautkan order). Tes dengan fixture | A | 3 | M | T05, T06 | Webhook valid membuat kasus. Duplikat diabaikan. Tanda tangan salah ditolak (403). Tes lulus |
| T08 | Toko demo `/demo-shop`: katalog kecil, tombol PayPal (create dan capture order), simpan ke `orders`. Panel admin: tandai dikirim (carrier dan resi, catat juga ke PayPal), tandai delivered | B | 5 | M | T03, T06 | Beli produk dengan akun buyer sandbox menghasilkan order berstatus paid. Resi tercatat |
| T09 | Admin simulate: tombol buat sengketa (sesuai hasil T04) dan tombol adjudicate (menang merchant atau buyer) | A | 3 | M | T04, T07 | Tombol memicu aksi PayPal. Webhook kembali dan status kasus berubah |
| T10 | Facts builder: dari order, pembayaran, resi, delivery, kebijakan, komunikasi menjadi baris `facts` dengan ID stabil. Teks buyer ditandai `untrusted` | A | 3 | M | T06, T07 | Untuk kasus S1 tercipta fakta lengkap dengan sumber. Tes snapshot |
| T11 | Pemetaan alasan -> evidence dan pengiriman berbasis aturan (tanpa LLM): bangun `input` JSON dan unggah multipart ke `provide-evidence` | A | 4 | M | T04, T10 | Kasus S1 terkirim dari tombol. Respons tersimpan di `actions` dan audit log |
| T12 | Antrean `/cases` (AG Grid: sortir, filter, hitung mundur) dan kerangka `/cases/[id]` (info, timeline, fakta, tombol aksi) | B | 5 | M | T06 | Kasus tampil dan terklik. Hitung mundur benar |
| T13 | Integrasi irisan vertikal S1 di URL hosted. Perbaiki yang pecah | A+B | 3 | M | T07 sampai T12 | **M1**: beli -> sengketa -> kasus muncul -> kirim bukti -> adjudicate -> resolved, di server hosted |

### Fase 2: AI dan alur persetujuan

| ID | Tugas | Owner | Jam | Prio | Bergantung | Penerimaan |
|---|---|---|---|---|---|---|
| T14 | Klien LLM (AI SDK, provider via env), skema zod, struktur prompt, pembungkus data tak tepercaya | A | 3 | M | T02 | Satu panggilan terstruktur berhasil dengan fixture. Provider bisa diganti lewat env |
| T15 | Draft writer dan **validator grounding** (aturan di arsitektur bagian 6). Satu kali retry. Tes adversarial: tanggal palsu, resi palsu, rujukan hilang, URL palsu | A | 5 | M | T10, T14 | Draft lolos untuk S1. Semua kasus tes gagal terdeteksi. Draft gagal memblokir approve |
| T16 | Skor kekuatan bukti, perbandingan biaya, rekomendasi (deterministik) plus rasional dari LLM | A | 3 | M | T10, T14 | S1 menghasilkan lawan, S2 menghasilkan refund. Tes unit mencakup batas band |
| T17 | UI detail kasus: panel fakta, kartu rekomendasi dengan rumus biaya, editor draft dengan chip rujukan fakta yang bisa diklik, checklist bukti | B | 6 | M | T12, T15, T16 | Klik chip membuka fakta sumber. Kesalahan grounding tampil jelas |
| T18 | Alur persetujuan: modal konfirmasi yang menampilkan isi kiriman, status, audit timeline | B | 3 | M | T17 | Tidak ada jalur kirim tanpa klik setuju. Audit log tampil |
| T19 | Aksi terima klaim dan refund (`/v2/payments/captures/{id}/refund`) di balik persetujuan. Perbarui status | A | 4 | S | T11 | Keduanya jalan di sandbox. Tercatat di audit |
| T20 | Paket bukti PDF (`pdf-lib`) dan lampirkan di `provide-evidence` | A | 3 | S | T15 | PDF terunggah dan diterima PayPal sandbox |
| T21 | Cron tenggat: hitung urgensi, tandai EXPIRED, polling sengketa sebagai fallback webhook. A: endpoint cron (2 jam). B: badge dan filter urgensi (1 jam) | A+B | 3 | S | T07, T12 | Kasus di bawah 48 jam berlabel urgent. Cron lolos dengan secret |
| T22 | Alasan kedua: tidak sesuai deskripsi (`OTHER`), skor, fixture, seed S3 | A | 4 | S | T16 | S3 dari awal sampai kirim bukti |
| T23 | Ringkasan dashboard di `/`: kasus terbuka, nilai berisiko, jatuh tempo 48 jam | B | 3 | S | T12 | Angka cocok dengan data |

### Fase 3: Polish dan penguatan

| ID | Tugas | Owner | Jam | Prio | Bergantung | Penerimaan |
|---|---|---|---|---|---|---|
| T24 | Pertahanan prompt injection dan seed S4. Tes bahwa draft tidak memuat instruksi pelanggan | A | 2 | M | T15 | S4 menghasilkan draft yang benar. Tes lulus |
| T25 | Penguatan: error PayPal ramah pengguna, retry, tes dengan nilai `ERRDIS...`, rate limit sederhana pada endpoint admin | A | 3 | M | T11 | Setiap error terbaca jelas di UI. Tes lulus |
| T26 | Polish UX: state kosong, loading, error. Responsif dasar. Lencana "Sandbox". Salinan teks. Aksesibilitas dasar | B | 4 | M | T17 | Tinjauan menyeluruh tanpa tampilan rusak |
| T27 | `demo:reset` dan seed S1 sampai S4. Runbook demo satu halaman | B | 2 | M | T10 | Satu perintah mengembalikan keadaan demo bersih |
| T28 | Tes kritis dan skrip smoke terhadap sandbox: order -> sengketa -> bukti -> adjudicate | A | 4 | M | semua fitur | CI hijau. Skrip smoke lulus dua kali berturut-turut |
| T30 | README (setup, arsitektur, tangkapan layar, batasan jujur), LICENSE, pengungkapan alat AI | B | 3 | M | - | Orang asing bisa menjalankan dari nol dengan README saja |

### Fase 4: Pengiriman

| ID | Tugas | Owner | Jam | Prio | Bergantung | Penerimaan |
|---|---|---|---|---|---|---|
| T31 | Latihan demo 2 kali, rekam, edit, unggah YouTube publik, di bawah 3 menit, tanpa musik berhak cipta | B (A bantu) | 5 | M | M3 | Tautan YouTube publik. Durasi di bawah 3:00 |
| T32 | Uji dari nol: clone di mesin bersih, ikuti README, jalankan demo. Pindai rahasia di repo dan riwayat git | A | 2 | M | M3 | Berjalan hanya dengan README. Tidak ada rahasia |
| T33 | Teks Devpost (template di dokumen 05), tangkapan layar, kategori sponsor | B | 2 | M | T31 | Teks lengkap, tautan benar |
| T34 | **Submit** dan verifikasi status "Submitted" (bukan draft) | A+B | 1 | M | T31 sampai T33 | Halaman proyek publik menampilkan semua tautan |

### Nice (hanya jika M2 tercapai lebih awal)

| ID | Tugas | Owner | Jam |
|---|---|---|---|
| T29 | MCP server: tool daftar kasus, ambil kasus, jalankan analisis. Tool setuju **tidak** diekspos | A | 4 |
| T35 | Koleksi Postman untuk API internal | B | 1.5 |

## 5. Ritual harian

- **Awal hari (async, 5 menit):** tulis di chat tim "hari ini saya kerjakan T__, risikonya __".
- **Akhir hari (async):** "selesai T__, tersangkut di T__, butuh dari kamu __".
- Satu tugas, satu branch, satu PR kecil. Saling review dalam 12 jam. Gabung ke `main` hanya jika CI hijau.
- Setelah setiap gabung ke `main`, cek deploy hosted tidak rusak.
- Jangan simpan konteks hanya di kepala. Keputusan penting masuk ke dokumen yang relevan.

## 6. Risiko utama dan jaring pengaman

Daftar lengkap ada di `02-ARCHITECTURE.md` bagian 12. Tiga yang paling mungkin menggagalkan jadwal:

1. **T04 macet** (auth assertion atau format multipart). Alokasikan buffer, tanya komunitas, gunakan fallback manual. Jangan menunda G1.
2. **Validator grounding terlalu ketat atau terlalu longgar** (T15). Mulai dengan aturan paling sederhana, lalu tambah tes adversarial satu per satu.
3. **Kehabisan waktu untuk video.** Tulis naskah video sebelum T17 selesai, dan bangun hanya yang tampil di naskah.
