# Rencana Publikasi POKEMONKEY — Siap Dipakai dengan Data Sungguhan

Dokumen kerja. Disusun dari pemeriksaan langsung terhadap kode pada **17 September 2026**.
Tujuannya: siapa pun — manusia atau AI — bisa mengerjakan tugas di bawah **berurutan tanpa perlu menganalisis ulang**.

---

## Cara memakai dokumen ini

**Untuk AI pelaksana:**

1. Kerjakan fase **berurutan** (Fase 1 → 10). Di dalam satu fase, kerjakan tugas sesuai nomor kecuali ditulis "boleh paralel".
2. Setiap tugas punya: **Tujuan**, **Berkas**, **Langkah**, **Selesai bila**. Tugas dianggap selesai hanya jika semua butir "Selesai bila" terpenuhi dan diverifikasi.
3. Tugas bertanda **[PEMILIK]** membutuhkan akun, uang, atau keputusan manusia. AI menyiapkan perintah/berkasnya, pemilik yang menjalankan. Jangan mencoba menjalankannya sendiri.
4. Jangan mengubah keputusan di **Bagian 1**. Bila pemilik belum menjawab, pakai kolom **Bawaan**.
5. Jangan mengedit migrasi lama (`0001`–`0010`); perubahan skema selalu lewat berkas migrasi baru bernomor berikutnya.
6. Setelah menyelesaikan tugas: centang `[x]`, tulis satu baris hasil di bawahnya (mis. "tsc: 0 galat").
7. Ikuti gaya kode yang sudah ada: nama dan komentar berbahasa Indonesia, WITA untuk semua jam, data demo di `lib/demo.ts` harus ikut diperbarui setiap kali rute server berubah.

**Konvensi perintah:** semua perintah dijalankan dari akar repo `D:\pokemonkey (2)` kecuali ditulis lain.

---

## 0. Kondisi saat ini (hasil pemeriksaan)

| Area | Temuan | Dampak |
|---|---|---|
| Build | `npm run build` **lulus**. Bundel utama 560 kB (163 kB gzip), `xlsx` 429 kB sudah terpisah, `dist/runner.js` 6,6 kB | Siap dibangun |
| Tipe | `npx tsc --noEmit` = **29 galat**: 22 galat tipe frontend + 7 karena `tsconfig.json` akar ikut memeriksa `server/` tanpa tipe Workers | Harus 0 sebelum rilis |
| Dependensi server | `server/node_modules` **kosong** | Wrangler & pustaka Web Push belum terpasang |
| Dependensi app | Capacitor 8.5.2, background-runner 3.0.0, app 8.1.1 **sudah terpasang** | — |
| Cloudflare | `wrangler.jsonc`: `database_id` = `ISI_SETELAH_D1_CREATE`, `VAPID_PUBLIC_KEY` kosong, `VAPID_SUBJECT` = `mailto:admin@pokemonkey.local` (bukan email nyata) | Belum bisa deploy |
| Data awal | Migrasi `0002_seed.sql` berisi 3 anggota (tanpa WA & password), 10 PICA periode `26W36`, baris KPI, pengaturan. `0006` libur nasional & `0009` realisasi revegetasi = data nyata | Perlu keputusan simpan/hapus |
| Login | Tanpa pembatas percobaan gagal · satu **kode undangan bersama** untuk semua akun · PBKDF2 25.000 iterasi · sesi 30 hari **tanpa perpanjangan** | Risiko keamanan & notifikasi mati diam-diam |
| API | CORS `Access-Control-Allow-Origin: *` | Terlalu terbuka |
| Layar login | Tombol **"Lihat demo"** dan pengaturan alamat server (ikon gerigi) tampil untuk semua orang | Membingungkan pemakai sungguhan |
| Alamat server bawaan | `lib/api.ts`: `http://localhost:8787` bila `VITE_API_URL` tidak diisi | APK produksi tidak akan tersambung |
| Rahasia lokal | `.env.local` berisi `GEMINI_API_KEY` sisa templat awal, tidak dipakai kode | Kunci aktif menganggur di disk |
| Git | 1 commit ("Re-upload workspace"); hampir seluruh pekerjaan **belum di-commit**; remote `github.com/Ebastari/pokemonkey` | Risiko kehilangan pekerjaan |
| Aset | Hanya `public/ikon.svg`; tidak ada ikon PNG, splash, `apple-touch-icon` | Wajib untuk Play Store & iPhone |
| Android | Folder `android/` belum dibuat | Belum ada APK |
| Pustaka | `xlsx` 0.18.5 (versi npm lama, memiliki CVE untuk *membaca* berkas; aplikasi hanya *menulis*) | Risiko rendah, akan ditandai `npm audit` |
| Tes | Tidak ada tes otomatis | Uji manual wajib (Fase 9) |
| Fungsi | Periode mingguan **tidak bisa dibuat** dari aplikasi · pengumuman WA tetap diantre saat `wa_aktif = 0` · tabel `kpi` tanpa layar | Dua yang pertama adalah blocker data sungguhan |

---

## 1. Keputusan pemilik (isi sebelum mulai)

Bila kolom **Jawaban** kosong, AI memakai **Bawaan**.

| # | Keputusan | Pilihan | Bawaan | Jawaban |
|---|---|---|---|---|
| K1 | Jalur distribusi Android | (a) APK dibagikan langsung · (b) Google Play jalur *Internal testing* · (c) Google Play publik | **(b)** | |
| K2 | Jenis akun Google Play Console | Pribadi · Organisasi (butuh nomor D-U-N-S perusahaan) | **Organisasi** — akun pribadi baru wajib uji tertutup ≥12 penguji selama 14 hari sebelum rilis produksi | |
| K3 | Alamat server | `*.workers.dev` · domain perusahaan (mis. `pokemonkey.domain.co.id`) | **workers.dev** | |
| K4 | 10 PICA periode `26W36` dari seed | Simpan sebagai riwayat · Hapus | **Simpan** (itu data rapat nyata) | |
| K5 | Mode demo di layar login versi produksi | Tampil · Sembunyikan | **Sembunyikan** | |
| K6 | Nomor WhatsApp di kartu anggota | Semua anggota · Hanya Admin & Supervisor | **Semua anggota** | |
| K7 | Fitur permainan (XP, SHOP, GAME, pisang) di rilis 1.0 | Tetap · Sembunyikan | **Tetap** | |
| K8 | Paket Cloudflare Workers | Free · Paid (± USD 5/bulan) | **Free dulu.** Naik ke Paid hanya bila pengukuran P4-10 menunjukkan batas CPU terlampaui | |
| K9 | Pengiriman WA grup saat rilis | Langsung aktif · Aktif setelah uji di grup percobaan | **Setelah uji** | |
| K10 | Visibilitas repo GitHub | Publik · Privat | **Privat** | |

---

## 2. Bahan yang harus disiapkan pemilik

Checklist ini boleh dikerjakan **paralel** dengan Fase 1–3.

### 2.1 Akun & langganan [PEMILIK]
- [ ] Akun Cloudflare (disarankan paket Workers Paid, lihat K8)
- [ ] Akun Fonnte aktif + perangkat WhatsApp pengirim tersambung + token perangkat
- [ ] Akun Google Play Console (biaya pendaftaran satu kali) — urus **paling awal**, verifikasi organisasi/D-U-N-S bisa memakan waktu beberapa minggu
- [ ] Email kontak nyata untuk `VAPID_SUBJECT` dan halaman Play Store
- [ ] Persetujuan internal perusahaan (IT/Legal/pimpinan departemen) untuk memakai aplikasi dan menyimpan data di Cloudflare

### 2.2 Data sungguhan [PEMILIK]
Simpan sebagai CSV UTF-8, pemisah koma, baris pertama = judul kolom persis seperti di bawah.

**`data/tim.csv`**
```csv
id,nama,jabatan,bidang,peran,wa
agung,Agung Laksono,Supervisor Revegetasi,Revegetasi,admin,6281234567890
```
Aturan: `id` huruf kecil tanpa spasi (dipakai untuk login) · `peran` ∈ `admin|supervisor|anggota|pemantau` · `wa` diawali `62`, boleh kosong.

**`data/pica.csv`**
```csv
bidang,prioritas,judul,akar,tindakan,pic_id,due_date,status,target,realisasi,satuan
Nursery,Tinggi,Nangka baru 27%,Stok tidak tersedia,Tetapkan sumber bibit,daniel,2026-09-30,Open,26250,7013,batang
```
Aturan: `prioritas` ∈ `Tinggi|Sedang|Rendah` · `status` ∈ `Open|In Progress|Continue|Verifikasi|Closed` · `due_date` format `YYYY-MM-DD` · `pic_id` harus ada di `tim.csv` · `target`/`realisasi` angka dengan titik desimal atau kosong.

**`data/roster.csv`**
```csv
user_id,tanggal,kode,catatan
daniel,2026-10-01,S1,
```
Aturan: `kode` ∈ `M|S1|S2|L|C|I`.

- [ ] `data/tim.csv` lengkap seluruh anggota departemen
- [ ] `data/pica.csv` register PICA yang masih berjalan
- [ ] `data/roster.csv` bulan berjalan
- [ ] ID grup WhatsApp tujuan rekap (berakhiran `@g.us`)
- [ ] Angka realisasi revegetasi 2026 terbaru (bila berubah dari `lib/revegetasi.ts`)
- [ ] Daftar libur perusahaan tambahan (tanggal + nama)

> Folder `data/` **tidak boleh masuk git** (berisi nomor telepon). Tugas P1-01 menambahkannya ke `.gitignore`.

---

## Fase 1 — Kode bersih dan bisa dibangun

### - [ ] P1-01 Amankan pekerjaan di git
- **Tujuan:** tidak ada pekerjaan yang hilang; rilis punya cabang sendiri.
- **Berkas:** `.gitignore`
- **Langkah:**
  1. Tambahkan ke `.gitignore`: `data/`, `.env.production.local`, `cadangan-*.sql`, `server/alat/*.sql`.
  2. Pastikan `.dev.vars`, `.env.local`, `*.keystore` tidak ter-*stage*: `git status --short`.
  3. Buat cabang `rilis/1.0`, commit seluruh perubahan dengan pesan `Persiapan rilis 1.0`.
- **Selesai bila:** `git status` bersih; `git log --all -p | findstr /i "FONNTE_TOKEN= VAPID_PRIVATE_KEY= GEMINI_API_KEY="` hanya menemukan baris **tanpa nilai** (mis. `FONNTE_TOKEN=` kosong di `server/.dev.vars.example`).

### - [ ] P1-02 Pisahkan pemeriksaan tipe app dan server
- **Tujuan:** menghilangkan 7 galat palsu karena `server/` diperiksa dengan konfigurasi browser.
- **Berkas:** `tsconfig.json`
- **Langkah:** tambahkan `"exclude": ["node_modules", "dist", "server", "runner", "android"]`. Buat `runner/tsconfig.json` minimal (`target ES2019`, `lib ["ES2019"]`, `noEmit true`, `strict true`, `include ["index.ts"]`).
- **Selesai bila:** `npx tsc --noEmit` hanya melaporkan galat di `App.tsx`, `components/`, `lib/`.

### - [ ] P1-03 Perbaiki 22 galat tipe frontend
- **Berkas & perbaikan persis:**
  | Berkas:baris | Galat | Perbaikan |
  |---|---|---|
  | `lib/tipe-api.ts` (interface `JadwalItem`) | `rrule` tidak ada (7 galat di `FormJadwal.tsx:36`, `KalenderScreen.tsx:458`, `lib/acara.ts:68-70`) | Tambahkan `rrule: string \| null;` |
  | `App.tsx:672, 709, 717` | `React.cloneElement` overload | Ketik ikon sebagai `React.ReactElement<{ size?: number }>` di `INFO_TAB`, `SidebarItem`, `NavButton` |
  | `lib/demo.ts:326` | `tanggal`/`jam_mulai` tidak ada pada hasil `map` | Beri tipe hasil `map` sebagai `Baris` (`.map((j): Baris => ({ ... }))`) |
  | `lib/demo.ts:543-544` | `dibuat_pada`/`disematkan`/`diubah_pada` | Sama: `.map((x): Baris => ({ ... }))` |
- **Selesai bila:** `npx tsc --noEmit` = **0 galat** dan `npm run build` tetap lulus.

### - [ ] P1-04 Pasang dan periksa server
- **Perintah:**
  ```bash
  npm run server:pasang
  npx tsc --noEmit -p server/tsconfig.json
  npx tsc --noEmit -p runner/tsconfig.json
  ```
- **Selesai bila:** ketiganya selesai tanpa galat.

### - [ ] P1-05 Buang kunci sisa templat [PEMILIK untuk pencabutan]
- **Langkah:** hapus baris `GEMINI_API_KEY` dari `.env.local` (AI). Pemilik mencabut kunci tersebut di Google AI Studio karena pernah tersimpan.
- **Selesai bila:** `.env.local` tidak berisi `GEMINI_API_KEY`.

### - [ ] P1-06 Satu perintah pemeriksaan
- **Berkas:** `package.json`
- **Langkah:** tambahkan skrip `"cek": "tsc --noEmit && tsc --noEmit -p server/tsconfig.json && tsc --noEmit -p runner/tsconfig.json && npm run build"`.
- **Selesai bila:** `npm run cek` lulus. Skrip ini wajib dijalankan di akhir setiap fase berikutnya.

---

## Fase 2 — Perbaikan fungsional wajib sebelum data sungguhan

### - [ ] P2-01 Siklus periode mingguan
- **Tujuan:** Admin bisa membuat periode rapat baru dan menjadikannya aktif; PICA baru bernomor periode yang benar.
- **Berkas:** `server/src/index.ts`, `lib/demo.ts`, `components/PicaScreen.tsx` (komponen `PanelAtur`), `lib/tipe-api.ts`
- **Langkah:**
  1. Rute `POST /api/periode` (hanya Admin). Body `{ mulai: 'YYYY-MM-DD', selesai: 'YYYY-MM-DD', judul?: string }`. `id = kodePeriode(mulai)` dari `server/src/waktu.ts`. Tolak (409) bila id sudah ada. `INSERT INTO periode (id, mulai, selesai, judul, terkunci) VALUES (?, ?, ?, ?, 0)`.
  2. Rute `POST /api/periode/:id/aktifkan` (hanya Admin): `UPDATE pengaturan SET nilai = :id WHERE kunci = 'periode_aktif'`.
  3. Salin kedua rute ke `lib/demo.ts` dengan perilaku sama.
  4. Di `PanelAtur` blok "Rapat mingguan": tombol **Periode baru** (isi tanggal mulai = Senin minggu ini, selesai = Jumat) → buat → aktifkan → `onSelesai()` (muat ulang bootstrap). Tampilkan daftar 12 periode terakhir dengan tanda "aktif".
  5. PICA lama **tidak** dipindah periode; ID-nya tetap.
- **Selesai bila:** di demo, membuat periode minggu ini lalu membuat PICA baru menghasilkan ID `PICA-<periode baru>-01`; rekap harian tetap menghitung seluruh PICA terbuka lintas periode.

### - [ ] P2-02 Pengumuman WhatsApp tidak menumpuk
- **Berkas:** `server/src/index.ts` (fungsi `buatPengumuman`), `server/src/wa.ts` (fungsi `prosesAntrean`)
- **Langkah:**
  1. Di `buatPengumuman`, antre hanya bila `grup` terisi **dan** `ambilPengaturan(env, 'wa_aktif') === '1'` (samakan dengan blok rekap di `jalankanTerjadwal`).
  2. Di `prosesAntrean`, sebelum mengirim: pesan berjenis `pengumuman` atau `rekap` yang `kirim_pada` lebih tua dari 24 jam ditandai `status = 'gagal', galat = 'kedaluwarsa'` dan tidak dikirim.
- **Selesai bila:** dengan `wa_aktif = 0`, membuat pengumuman tidak menambah baris `pesan_wa`.

### - [ ] P2-03 Perpanjang sesi saat dipakai
- **Tujuan:** penjadwal notifikasi di HP dan Web Push tidak berhenti diam-diam setelah 30 hari.
- **Berkas:** `server/src/auth.ts` (fungsi yang membaca sesi dari header)
- **Langkah:** setelah sesi terbukti sah, bila `kedaluwarsa` kurang dari 7 hari lagi, `UPDATE sesi SET kedaluwarsa = <sekarang + 30 hari> WHERE token_hash = ?`.
- **Selesai bila:** sesi yang dipakai minimal sekali per minggu tidak pernah kedaluwarsa.

### - [ ] P2-04 Sembunyikan mode demo dan pengaturan server di produksi (K5)
- **Berkas:** `components/AuthScreen.tsx`, `vite-env.d.ts`, `.env.production` (baru)
- **Langkah:**
  1. Tambahkan `readonly VITE_DEMO?: string;` di `vite-env.d.ts`.
  2. Bungkus tombol **Lihat demo** dan tombol gerigi pengaturan server dengan `import.meta.env.VITE_DEMO !== '0'`.
  3. Buat `.env.production` berisi `VITE_DEMO=0` dan `VITE_API_URL=https://<ALAMAT_WORKER>` (placeholder; diisi pada P4-06).
- **Selesai bila:** `npm run build` lalu buka `dist/index.html` lewat `npx vite preview` → layar login tanpa tombol demo & gerigi; `npm run dev` tetap menampilkannya.

### - [ ] P2-05 Alat impor CSV
- **Tujuan:** memasukkan data sungguhan dari Bagian 2.2 tanpa mengetik manual.
- **Berkas:** `server/alat/impor-csv.mjs` (baru)
- **Perilaku:** `node server/alat/impor-csv.mjs <tim|pica|roster> <berkas.csv> <periode_id> > server/alat/impor-<jenis>.sql`
  - Membaca CSV (tangani tanda kutip dan koma di dalam teks).
  - Validasi setiap baris sesuai aturan Bagian 2.2; **berhenti dengan pesan baris mana yang salah** bila ada satu saja yang tidak valid.
  - Escape petik tunggal (`'` → `''`).
  - `tim`: `INSERT INTO tim (id, nama, jabatan, bidang, wa, peran) VALUES (...) ON CONFLICT(id) DO UPDATE SET nama=excluded.nama, jabatan=excluded.jabatan, bidang=excluded.bidang, wa=excluded.wa, peran=excluded.peran;` diikuti `INSERT OR IGNORE INTO profil_game (user_id) VALUES (...);`
  - `pica`: id `PICA-<periode_id>-NN` (NN berurutan mulai dari nomor tertinggi yang sudah ada + 1 — minta angka awal lewat argumen ke-4 opsional, bawaan 1), `nomor`, `periode_id`, `dibuat_oleh` = id Admin pertama di CSV tim atau argumen `--oleh`. Tambahkan baris `pica_riwayat` kolom `dibuat` per PICA. Bidang yang belum ada di tabel `opsi` grup `bidang` ditambahkan dengan `INSERT OR IGNORE`.
  - `roster`: `INSERT INTO roster (user_id, tanggal, kode, catatan) VALUES (...) ON CONFLICT DO UPDATE SET kode=excluded.kode, catatan=excluded.catatan;` (periksa nama kunci unik di `0005_roster_memo_misi.sql` sebelum menulis klausa ON CONFLICT).
- **Selesai bila:** mengimpor contoh CSV di Bagian 2.2 ke D1 lokal (`npx wrangler d1 execute pokemonkey --local --file server/alat/impor-tim.sql` dari folder `server`) berhasil, dan CSV dengan satu baris rusak ditolak dengan nomor barisnya.

---

## Fase 3 — Keamanan

### - [ ] P3-01 Batasi percobaan login
- **Berkas:** `server/migrations/0018_login_gagal.sql` (baru; 0017 sudah dipakai dokumen & foto profil), `server/src/index.ts` (fungsi `login`)
- **Langkah:**
  1. Tabel `login_gagal (kunci TEXT PRIMARY KEY, jumlah INTEGER NOT NULL DEFAULT 0, sampai TEXT NOT NULL)`; `kunci` = `userId` + `|` + header `CF-Connecting-IP`.
  2. Sebelum memeriksa password: bila `jumlah >= 5` dan `sampai` > sekarang → jawab 429 "Terlalu banyak percobaan. Coba lagi 15 menit lagi."
  3. Gagal → tambah `jumlah`, `sampai = sekarang + 15 menit`. Berhasil → hapus baris.
- **Selesai bila:** percobaan ke-6 dalam 15 menit ditolak 429; login benar setelah jeda berhasil.

### - [ ] P3-02 Tutup celah kode undangan bersama
- **Tujuan:** orang yang tahu user ID dan kode undangan tidak bisa mengambil alih akun yang belum berpassword.
- **Langkah minimum (wajib):** dokumentasikan di Fase 10 bahwa setelah seluruh anggota membuat password (P5-08), secret `KODE_UNDANGAN` **dihapus** (`npx wrangler secret delete KODE_UNDANGAN`) — login pertama otomatis tertutup. Admin yang menambah anggota baru memasang kode baru sementara.
- **Langkah lanjutan (disarankan):** kode undangan sekali pakai per anggota — kolom `tim.undangan_hash`, `tim.undangan_sampai` (migrasi baru), tombol **Buat kode undangan** di `components/TeamScreen.tsx` (Admin) yang menampilkan kode 8 karakter sekali saja; `login` memeriksa hash itu dan mengosongkannya setelah dipakai.
- **Selesai bila:** langkah minimum tercatat; bila langkah lanjutan dikerjakan, kode yang sama tidak bisa dipakai dua kali.

### - [ ] P3-03 Persempit CORS
- **Berkas:** `server/src/index.ts` (konstanta `CORS` dan pemakaiannya), `server/wrangler.jsonc`
- **Langkah:** var `ASAL_DIIZINKAN` = `https://<ALAMAT_WORKER>,https://localhost` (`https://localhost` = WebView Capacitor Android). Jawab `Access-Control-Allow-Origin` dengan nilai `Origin` permintaan **hanya** bila ada di daftar; tambahkan `Vary: Origin`. Rute `/wa/webhook` tidak memerlukan CORS.
- **Selesai bila:** permintaan dari asal lain tidak menerima header izin; aplikasi web & APK tetap berfungsi.

### - [ ] P3-04 Header keamanan untuk halaman web
- **Berkas:** `public/_headers` (baru)
- **Isi:**
  ```
  /*
    X-Content-Type-Options: nosniff
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: geolocation=(), microphone=()
    X-Frame-Options: DENY
  ```
- **Selesai bila:** setelah deploy, `curl -I https://<ALAMAT_WORKER>/` menampilkan header tersebut.

### - [ ] P3-05 Batasi jenis berkas unggahan
- **Berkas:** `server/src/index.ts` (fungsi `unggahLampiran`)
- **Langkah:** tolak (415) bila `berkas.type` bukan `image/jpeg`, `image/png`, `image/webp`, atau `application/pdf`. Batas 8 MB tetap.
- **Selesai bila:** unggah `.exe` atau `.html` ditolak; foto dan PDF diterima.

### - [ ] P3-06 Audit izin setiap rute
- **Tujuan:** memastikan rute tulis dicek perannya di server, bukan hanya disembunyikan di layar.
- **Langkah:** periksa setiap rute di `server/src/index.ts`, `personal.ts`, `game.ts`, `push.ts` terhadap tabel berikut; perbaiki yang tidak sesuai.
  | Rute | Minimal |
  |---|---|
  | `POST /api/pica`, `PATCH /api/pica/:id`, `POST /api/pica/:id/update`, `POST /api/lampiran`, `POST /api/laporan` | Anggota (bukan Pemantau) |
  | `DELETE /api/pica/:id`, `POST /api/periode*`, `POST /api/pengaturan`, `POST /api/revegetasi`, `POST /api/libur`, `POST /api/misi`, `POST /api/tim`, `POST /api/notify/rekap-pica`, `POST /api/wa/uji` | Admin |
  | `POST /api/pengumuman`, `POST /api/properti`, `POST /api/opsi`, `POST /api/bagi`, `POST /api/roster/isi` | Admin/Supervisor |
  | `PATCH /api/tim/:id` | Admin, atau pemilik akun untuk kolom `wa` saja |
  | `GET /api/tim/:id/profil` | Semua yang login (nomor WA sesuai K6) |
- **Selesai bila:** akun Pemantau di D1 lokal mendapat 403 untuk setiap rute tulis.

### - [ ] P3-07 Rahasia dan repo [PEMILIK]
- **Langkah:** jadikan repo GitHub privat (K10). Rahasia hanya lewat `wrangler secret put`. Jangan pernah menaruh token di `wrangler.jsonc`, `.env.production`, atau APK.
- **Selesai bila:** repo privat; `grep -r "FONNTE_TOKEN\s*=" --include=*.ts --include=*.jsonc .` tidak menemukan nilai.

### - [ ] P3-08 (Disarankan) Naikkan iterasi PBKDF2
- **Syarat:** paket Workers Paid (K8).
- **Berkas:** `server/src/auth.ts`
- **Langkah:** `ITERASI = 100_000`. Format hash sudah menyimpan jumlah iterasi, jadi hash lama tetap bisa diverifikasi; setelah login berhasil dengan hash lama, simpan ulang dengan iterasi baru.
- **Selesai bila:** login akun lama tetap berhasil dan hash-nya berubah menjadi `pbkdf2$100000$...`.

### - [ ] P3-09 (Disarankan) Ganti `xlsx` npm lama
- **Langkah:** pasang SheetJS versi terbaru dari CDN resmi SheetJS (`npm install https://cdn.sheetjs.com/xlsx-<versi-terbaru>/xlsx-<versi-terbaru>.tgz`); API `writeFile`/`utils` yang dipakai `PicaScreen.tsx` tidak berubah.
- **Selesai bila:** ekspor Excel PICA tetap berjalan; `npm audit` tidak lagi menandai `xlsx`.

---

## Fase 4 — Infrastruktur Cloudflare produksi

Semua perintah fase ini **[PEMILIK]** kecuali disebut lain. Jalankan dari folder `server`.

### - [ ] P4-01 Masuk ke Cloudflare
```bash
npx wrangler login
```

### - [ ] P4-02 Buat basis data dan penyimpanan
```bash
npx wrangler d1 create pokemonkey
npx wrangler r2 bucket create pokemonkey-lampiran
```
- **AI:** tempel `database_id` hasil perintah pertama ke `server/wrangler.jsonc`.

### - [ ] P4-03 Kunci Web Push
```bash
npx web-push generate-vapid-keys
```
- **AI:** isi `VAPID_PUBLIC_KEY` dengan Public Key dan `VAPID_SUBJECT` dengan `mailto:<email nyata dari 2.1>` di `wrangler.jsonc`.

### - [ ] P4-04 Rahasia
```bash
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put FONNTE_TOKEN
npx wrangler secret put WEBHOOK_KUNCI
npx wrangler secret put KODE_UNDANGAN
```
- `WEBHOOK_KUNCI`: string acak minimal 32 karakter. `KODE_UNDANGAN`: kode sementara untuk onboarding (lihat P3-02).

### - [ ] P4-05 Migrasi basis data
```bash
npm run db:awan
```
- **Selesai bila:** seluruh migrasi `0001`–`0017` tercatat berhasil.

### - [ ] P4-06 Bangun dan deploy
1. Deploy pertama untuk mendapatkan alamat:
   ```bash
   npm run deploy
   ```
2. **AI:** isi alamat `https://pokemonkey-api.<akun>.workers.dev` (atau domain K3) ke `.env.production` (`VITE_API_URL`) dan `ASAL_DIIZINKAN` (P3-03).
3. Dari akar repo, bangun ulang lalu deploy ulang:
   ```bash
   npm run build
   npm --prefix server run deploy
   ```
- **Selesai bila:** `https://<ALAMAT_WORKER>/api` menjawab `{"nama":"POKEMONKEY","siap":true}` dan halaman login tampil di alamat yang sama.

### - [ ] P4-07 (Bila K3 = domain) Domain perusahaan
- Tambahkan Custom Domain ke Worker `pokemonkey-api` di dasbor Cloudflare, lalu ulangi langkah 2–3 P4-06 dengan domain tersebut.

### - [ ] P4-08 Webhook Fonnte
- Di dasbor Fonnte, isi webhook perangkat: `https://<ALAMAT_WORKER>/wa/webhook?kunci=<WEBHOOK_KUNCI>`.

### - [ ] P4-09 Cadangan
- Aktifkan kebiasaan cadangan mingguan (dicatat juga di Fase 10):
  ```bash
  npx wrangler d1 export pokemonkey --remote --output=cadangan-YYYYMMDD.sql
  ```
- D1 Time Travel memungkinkan pemulihan ke titik waktu sebelumnya (7 hari di paket Free, 30 hari di Paid).

### - [ ] P4-10 Ukur pemakaian CPU sebelum memutuskan paket (K8)
- **Latar:** paket Free membatasi 10 ms CPU per permintaan. Hampir semua pekerjaan aplikasi adalah menunggu basis data (tidak dihitung CPU), dan login sudah disetel muat di batas itu (PBKDF2 25.000 iterasi). Satu-satunya bagian yang berisiko adalah cron yang mengirim **Web Push** ke banyak perangkat iPhone/browser sekaligus, karena setiap kiriman dienkripsi. Notifikasi APK Android tidak lewat server, jadi tidak terpengaruh.
- **Langkah:**
  1. Setelah minimal 20 perangkat iPhone/browser berlangganan, lihat dasbor Cloudflare → Workers → `pokemonkey-api` → Metrics → **CPU time**, khusus pada jam 07.00, 12.00, dan 17.00 WITA.
  2. Cari galat `Exceeded CPU time limit` di Workers Logs pada jam yang sama.
- **Keputusan:**
  - Tidak ada galat → tetap Free.
  - Ada galat → pilih salah satu: (a) naik ke Paid, atau (b) tetap Free dengan memecah pengiriman — cron memanggil jalur internal `POST /api/push/kirim-satu` sekali per anggota lewat `ctx.waitUntil(fetch(...))`, sehingga setiap anggota diproses dalam permintaan terpisah yang masing-masing punya jatah 10 ms. Jalur itu wajib dilindungi kunci rahasia (mis. `WEBHOOK_KUNCI`).
- **Selesai bila:** keputusan K8 tercatat beserta angka CPU time yang diamati.

---

## Fase 5 — Memasukkan data sungguhan

### - [ ] P5-01 Periode aktif minggu ini
- **AI:** siapkan SQL berdasarkan tanggal Senin minggu rilis:
  ```sql
  INSERT OR IGNORE INTO periode (id, mulai, selesai, judul, terkunci)
  VALUES ('<kodePeriode(senin)>', '<senin>', '<jumat>', 'Weekly Rev DAS <tanggal>', 0);
  UPDATE pengaturan SET nilai = '<kodePeriode(senin)>' WHERE kunci = 'periode_aktif';
  ```
- **[PEMILIK]:** `npx wrangler d1 execute pokemonkey --remote --file <berkas>.sql`

### - [ ] P5-02 (Hanya bila K4 = Hapus) Buang PICA contoh 26W36
Jalankan **setelah** P5-01.
```sql
UPDATE pica    SET terkait_id = NULL WHERE terkait_id LIKE 'PICA-26W36-%';
UPDATE laporan SET pica_id    = NULL WHERE pica_id    LIKE 'PICA-26W36-%';
UPDATE jadwal  SET pica_id    = NULL WHERE pica_id    LIKE 'PICA-26W36-%';
DELETE FROM kpi          WHERE periode_id = '26W36';
DELETE FROM pica_update  WHERE pica_id LIKE 'PICA-26W36-%';
DELETE FROM pica_riwayat WHERE pica_id LIKE 'PICA-26W36-%';
DELETE FROM lampiran     WHERE entitas = 'pica' AND entitas_id LIKE 'PICA-26W36-%';
DELETE FROM pesan_wa     WHERE ref_id LIKE 'PICA-26W36-%';
DELETE FROM pica         WHERE id LIKE 'PICA-26W36-%';
DELETE FROM periode      WHERE id = '26W36';
```

### - [ ] P5-03 Tim
```bash
node server/alat/impor-csv.mjs tim data/tim.csv - > server/alat/impor-tim.sql
```
**[PEMILIK]** eksekusi ke `--remote`. Anggota seed (`agung`, `daniel`, `mariano`) yang ada di CSV akan diperbarui; yang tidak ada biarkan, atau nonaktifkan dengan `UPDATE tim SET aktif = 0 WHERE id = '<id>'`.

### - [ ] P5-04 PICA
```bash
node server/alat/impor-csv.mjs pica data/pica.csv <periode_aktif> > server/alat/impor-pica.sql
```
**[PEMILIK]** eksekusi ke `--remote`.

### - [ ] P5-05 Roster
```bash
node server/alat/impor-csv.mjs roster data/roster.csv - > server/alat/impor-roster.sql
```
**[PEMILIK]** eksekusi ke `--remote`.

### - [ ] P5-06 Pengaturan WhatsApp dan jam
- Lewat aplikasi (Admin): **PICA → ⚙ Atur → Rekap PICA ke grup WhatsApp** → isi ID grup; **biarkan "Pengiriman WhatsApp aktif" mati** sampai P9 lulus (K9).
- Jam notifikasi bawaan 07.00/12.00/17.00 dan rekap 16.00 sudah ada di tabel `pengaturan`; ubah hanya bila diminta.

### - [ ] P5-07 Libur dan realisasi revegetasi
- Tambahkan libur perusahaan lewat layar JADWAL (Admin).
- Bila angka 2026 berubah: panel realisasi di KEBUN → **Isi data** (Admin). Perbarui juga `lib/revegetasi.ts` (AI) agar cadangan offline sama.

### - [ ] P5-08 Onboarding akun
- Setiap anggota login pertama dengan user ID + password baru + `KODE_UNDANGAN`.
- Setelah semua anggota berhasil: jalankan langkah minimum P3-02 (hapus secret `KODE_UNDANGAN`).
- **Selesai bila:** `SELECT id FROM tim WHERE aktif = 1 AND password_hash IS NULL` kosong.

---

## Fase 6 — Aplikasi Android

### - [ ] P6-01 Buat proyek Android
```bash
npm run android:tambah
```

### - [ ] P6-02 Manifest
- **Berkas:** `android/app/src/main/AndroidManifest.xml`
- **Langkah:** terapkan persis bagian "Memasang" di `docs/alur-notifikasi.md` (atribut `xmlns:tools`, intent-filter `.NOTIFICATION_CLICKED`, `POST_NOTIFICATIONS`, pembuangan izin lokasi & alarm presisi). Tambahkan juga `<uses-permission android:name="android.permission.CAMERA" />` dan `<uses-feature android:name="android.hardware.camera" android:required="false" />` untuk tombol Kamera di FEED.

### - [ ] P6-03 Ikon dan layar pembuka
- **Berkas:** `assets/icon-only.png` (1024×1024), `assets/icon-foreground.png` (1024×1024, latar transparan), `assets/icon-background.png` (1024×1024, hijau `#1f6b3a`), `assets/splash.png` dan `assets/splash-dark.png` (2732×2732), `public/apple-touch-icon.png` (180×180)
- **Langkah (AI):**
  1. `npm install -D sharp @capacitor/assets`
  2. Skrip `alat/buat-ikon.mjs` yang merender `public/ikon.svg` ke ukuran di atas dengan `sharp('public/ikon.svg', { density: 4800 }).resize(w, h, { kernel: 'nearest' }).png().toFile(...)` agar piksel tetap tajam; splash = ikon 512 px di tengah kanvas hitam/`#e6eae3`.
  3. `npx @capacitor/assets generate --android`
  4. Tambahkan `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` di `index.html` dan ikon PNG 192/512 ke `public/manifest.webmanifest`.
- **Selesai bila:** ikon launcher di emulator tampil sebagai monyet piksel yang tajam.

### - [ ] P6-04 Versi
- **Berkas:** `android/app/build.gradle`, `package.json`
- **Langkah:** `versionCode 1`, `versionName "1.0.0"`; `package.json` `"version": "1.0.0"`. Setiap rilis berikutnya menaikkan `versionCode` +1.
- **Periksa:** `targetSdkVersion` di `android/variables.gradle` memenuhi syarat terbaru yang tertera di Play Console (Policy status). Naikkan bila kurang.

### - [ ] P6-05 Kunci penandatanganan [PEMILIK]
```bash
keytool -genkeypair -v -keystore pokemonkey-rilis.keystore -alias pokemonkey -keyalg RSA -keysize 2048 -validity 10000
```
- Simpan berkas dan password di dua tempat aman **di luar repo**. Kehilangan kunci = tidak bisa memperbarui aplikasi (kecuali memakai Play App Signing — aktifkan saat unggah pertama).

### - [ ] P6-06 Bangun AAB rilis
```bash
npm run android:sync
cd android
gradlew.bat bundleRelease
```
- Atau lewat Android Studio: **Build → Generate Signed App Bundle**.
- **Selesai bila:** `android/app/build/outputs/bundle/release/app-release.aab` ada.

### - [ ] P6-07 Uji di perangkat nyata
Minimal dua HP, salah satunya merek dengan penghemat baterai agresif (Xiaomi/Oppo/vivo/Samsung).
- [ ] Login ke server produksi
- [ ] NOTIF → Izinkan → **Kirim contoh** muncul
- [ ] **Periksa sekarang** → Diagnosa "Terakhir memeriksa" berubah
- [ ] Alarm acara: buat acara 20 menit lagi dengan pengingat 10 menit → berbunyi saat aplikasi ditutup
- [ ] FEED → Kamera membuka kamera, foto terkirim, tampil di LOG dan bukti PICA
- [ ] Mode pesawat → kirim laporan → matikan mode pesawat → laporan terkirim otomatis
- [ ] Mode terang terbaca di bawah matahari
- [ ] Kartu anggota → Buka WhatsApp membuka chat dengan teks terisi

### - [ ] P6-08 Listing Play Console [PEMILIK, AI menyiapkan teks]
- Nama: `POKEMONKEY` · Kategori: Bisnis/Produktivitas · Negara: Indonesia · Audiens: 18+
- Deskripsi singkat (≤80 karakter) dan panjang — AI menulis draf di `docs/play-store.md`
- Grafis: ikon 512×512, grafis fitur 1024×500, minimal 2 tangkapan layar HP (KEBUN, PICA, JADWAL, NOTIF)
- URL kebijakan privasi (P8-01)
- **Data safety:** mengumpulkan nama, nomor telepon, foto, aktivitas aplikasi; dienkripsi saat transit; tidak dibagikan ke pihak ketiga untuk iklan; pemakai bisa meminta penghapusan
- **Akses aplikasi untuk peninjau:** sediakan akun uji (peran anggota) dan password-nya
- Jalur rilis sesuai K1/K2

---

## Fase 7 — iPhone dan browser (PWA)

### - [ ] P7-01 Ikon iPhone
- Sudah dikerjakan di P6-03 langkah 4. **Selesai bila:** "Tambah ke Layar Utama" di Safari memakai ikon monyet, bukan tangkapan layar.

### - [ ] P7-02 Uji di iPhone (iOS 16.4 atau lebih baru)
- [ ] Buka alamat produksi di Safari → Bagikan → Tambah ke Layar Utama → buka dari ikon
- [ ] NOTIF → Izinkan → **Kirim contoh** diterima (Web Push)
- [ ] Menunggu slot 07.00/12.00/17.00 berikutnya → notifikasi datang
- [ ] Ketuk notifikasi → membuka layar yang sesuai

---

## Fase 8 — Legal dan privasi

Boleh dikerjakan **paralel sejak awal**. Dasar: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.

### - [ ] P8-01 Halaman kebijakan privasi
- **Berkas:** `public/privasi.html` (AI menulis draf; **[PEMILIK]** + Legal perusahaan menyetujui)
- **Isi wajib:** pengendali data (PT Energi Batubara Lestari, departemen & kontak) · data yang dikumpulkan (nama, jabatan, nomor WhatsApp, password dalam bentuk hash, foto lapangan, laporan & capaian, data PICA/roster/memo, langganan notifikasi) · tujuan (koordinasi kerja internal) · tempat penyimpanan (Cloudflare D1 & R2) · pihak ketiga (Fonnte untuk WhatsApp; layanan push Apple/Google) · masa simpan · hak pemakai (akses, koreksi, hapus) dan cara memintanya.
- **Selesai bila:** dapat dibuka di `https://<ALAMAT_WORKER>/privasi.html` dan tautannya ada di layar login.

### - [ ] P8-02 Persetujuan saat login pertama
- **Berkas:** migrasi baru (kolom `tim.setuju_privasi_pada TEXT`), `components/AuthScreen.tsx`, `server/src/index.ts` (`login`)
- **Langkah:** saat pembuatan password pertama, kotak centang "Saya telah membaca Kebijakan Privasi" wajib dicentang; server menyimpan waktunya.
- **Selesai bila:** login pertama tanpa centang ditolak dengan pesan jelas.

### - [ ] P8-03 Prosedur penghapusan data anggota
- **Langkah:** dokumentasikan di `docs/operasional.md` perintah SQL untuk anggota yang keluar: `UPDATE tim SET aktif = 0, wa = NULL, password_hash = NULL WHERE id = ?`, `DELETE FROM sesi WHERE user_id = ?`, `DELETE FROM push_langganan WHERE user_id = ?`; foto di R2 dihapus bila diminta.

### - [ ] P8-04 Catatan risiko Fonnte
- Tulis di `docs/operasional.md`: Fonnte memakai WhatsApp tidak resmi → risiko nomor pengirim diblokir; gunakan nomor khusus aplikasi, bukan nomor pribadi; pertimbangkan WhatsApp Business Platform resmi bila volume pesan naik.

---

## Fase 9 — Uji terima sebelum go-live

Uji di server **produksi** dengan data sungguhan, grup WhatsApp **percobaan** (bukan grup departemen).

| # | Peran | Skenario | Hasil yang diharapkan |
|---|---|---|---|
| U1 | Anggota | Login pertama dengan kode undangan | Password tersimpan, masuk ke KEBUN |
| U2 | Anggota | Lapor lapangan ke satu PICA dengan foto | Realisasi PICA bertambah, baris perkembangan & riwayat tercatat, foto tampil di bukti PICA |
| U3 | Anggota | Ubah status PICA ke Closed | Ditolak: harus Verifikasi oleh Supervisor/Admin |
| U4 | Supervisor | Verifikasi & tutup PICA yang punya bukti | Berhasil, `ditutup_pada` terisi |
| U5 | Pemantau | Coba membuat PICA, memo tim, pengumuman | Semua ditolak 403 |
| U6 | Admin | Buat periode baru & aktifkan | PICA baru bernomor periode baru |
| U7 | Admin | PICA → Atur → Pratinjau rekap harian & mingguan | Angka sama dengan tabel PICA |
| U8 | Admin | Nyalakan WA ke grup percobaan → Kirim sekarang | Pesan tiba di grup percobaan |
| U9 | Semua | Notifikasi 07.00, 12.00, 17.00 (Android & iPhone) | Datang, isinya sesuai data |
| U10 | Semua | Alarm acara 10 menit sebelum | Berbunyi (Android tepat waktu, iPhone ≤15 menit terlambat) |
| U11 | Admin | Ekspor PICA ke Excel | Berkas terbuka di Excel, kolom lengkap |
| U12 | Anggota | Ketuk monyet rekan → Buka WhatsApp | Chat terbuka dengan daftar PICA rekan |
| U13 | Semua | Mode terang di luar ruangan | Semua teks terbaca |
| U14 | Admin | Isi data realisasi revegetasi | Grafik & total di KEBUN berubah |
| U15 | — | Login salah 6× berturut-turut | Percobaan ke-6 ditolak 429 |

**Go-live bila:** U1–U15 lulus, `npm run cek` lulus, tidak ada galat di Workers Logs selama 48 jam uji.
Setelah itu: ganti ID grup ke grup departemen dan nyalakan pengiriman WhatsApp (K9).

---

## Fase 10 — Operasional setelah rilis

AI menulis ringkasan ini ke `docs/operasional.md`.

| Kapan | Tugas | Cara |
|---|---|---|
| Harian, minggu pertama | Periksa galat | Dasbor Cloudflare → Workers → `pokemonkey-api` → Logs |
| Harian, minggu pertama | Pesan WA gagal | `npx wrangler d1 execute pokemonkey --remote --command "SELECT id, jenis, galat, kirim_pada FROM pesan_wa WHERE status = 'gagal' ORDER BY id DESC LIMIT 20"` |
| Setiap Senin | Periode rapat baru | PICA → ⚙ Atur → Periode baru (P2-01) |
| Setiap minggu | Cadangan basis data | `npx wrangler d1 export pokemonkey --remote --output=cadangan-YYYYMMDD.sql`, simpan di luar repo |
| Setelah onboarding / anggota baru | Kode undangan | Pasang `KODE_UNDANGAN` sementara, hapus lagi setelah dipakai (P3-02) |
| Setiap rilis aplikasi | Pembaruan | Naikkan `versionCode`, `npm run cek`, `npm run android:sync`, bangun AAB, unggah; `npm run build` + `npm --prefix server run deploy` untuk web |
| Setiap terbit SKB libur tahun berikutnya | Libur nasional | Migrasi baru berisi libur + perbarui `lib/libur.ts` |
| Setiap tutup tahun | Realisasi revegetasi | KEBUN → Isi data, lalu perbarui `lib/revegetasi.ts` |
| Bila token bocor | Rotasi rahasia | `npx wrangler secret put <NAMA>` lalu deploy ulang |

---

## Lampiran A — Daftar rahasia dan variabel

| Nama | Jenis | Diisi di | Keterangan |
|---|---|---|---|
| `FONNTE_TOKEN` | Secret | `wrangler secret put` | Token perangkat Fonnte |
| `WEBHOOK_KUNCI` | Secret | `wrangler secret put` | Acak ≥32 karakter, juga di URL webhook Fonnte |
| `KODE_UNDANGAN` | Secret | `wrangler secret put` | Sementara, hapus setelah onboarding |
| `VAPID_PRIVATE_KEY` | Secret | `wrangler secret put` | Pasangan dari `web-push generate-vapid-keys` |
| `VAPID_PUBLIC_KEY` | Var | `server/wrangler.jsonc` | Tidak rahasia |
| `VAPID_SUBJECT` | Var | `server/wrangler.jsonc` | `mailto:` email nyata |
| `ASAL_DIIZINKAN` | Var | `server/wrangler.jsonc` | Baru (P3-03) |
| `APP_NAMA`, `TZ_OFFSET_MENIT` | Var | `server/wrangler.jsonc` | Sudah ada |
| `VITE_API_URL` | Build | `.env.production` | Alamat Worker |
| `VITE_DEMO` | Build | `.env.production` | `0` di produksi |

## Lampiran B — Urutan perintah ringkas

```text
Fase 1  : git (cabang rilis/1.0) → perbaiki tipe → npm run server:pasang → npm run cek
Fase 2-3: kode (periode, WA, sesi, demo, impor, keamanan) → npm run cek
Fase 4  : wrangler login → d1 create → r2 bucket create → vapid → secrets → db:awan → deploy → build → deploy
Fase 5  : periode aktif → (hapus contoh) → impor tim → impor pica → impor roster → onboarding
Fase 6-7: android:tambah → manifest → ikon → versi → keystore → android:sync → bundleRelease → uji HP → Play Console
Fase 8  : privasi (paralel sejak awal)
Fase 9  : uji terima U1–U15 → go-live
Fase 10 : operasional rutin
```
