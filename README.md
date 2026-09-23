# POKEMONKEY

Sistem kerja Departemen Revegetasi & Rehabilitasi dengan kulit game retro:
register PICA gaya Notion, kalender tim, pengumuman, laporan lapangan, dan
pengingat WhatsApp otomatis. Satu kode React untuk web dan Android.

```
.
├── App.tsx, components/, lib/     aplikasi (React 19 + Vite + Tailwind 3)
├── index.css                      seluruh gaya retro (Press Start 2P, retro-box)
├── capacitor.config.ts            pembungkus Android
└── server/                        Cloudflare Worker + D1 + R2 + cron
    ├── migrations/                skema & data awal (10 PICA periode 26W36)
    └── src/                       API, auth, WhatsApp (Fonnte), penjadwal
```

## 1. Menjalankan di komputer

Prasyarat: Node.js 20+. Jalankan ulang `npm install` setiap kali `package.json`
berubah (huruf Pixelify Sans dan pustaka ekspor Excel dipasang dari sini).

```bash
npm install
```

```bash
npm run server:pasang
```

Buat rahasia lokal server: salin `server/.dev.vars.example` menjadi `server/.dev.vars`
(token Fonnte boleh kosong dulu). Lalu isi database lokal:

```bash
npm run db:lokal
```

Jalankan server (terminal 1) dan aplikasi (terminal 2):

```bash
npm run server
```

```bash
npm run dev
```

Buka http://localhost:3000. Login pertama: user `agung`, password apa pun
(min. 6 karakter) + kode undangan dari `.dev.vars` (`REVDAS2026`). Password
yang diketik saat itu menjadi password akun.

## 2. Naik ke Cloudflare

```bash
cd server && npx wrangler login
```

```bash
cd server && npx wrangler d1 create pokemonkey
```

Salin `database_id` yang muncul ke `server/wrangler.jsonc`, lalu:

```bash
cd server && npx wrangler r2 bucket create pokemonkey-lampiran
```

```bash
cd server && npx wrangler d1 migrations apply pokemonkey --remote
```

```bash
cd server && npx wrangler secret put FONNTE_TOKEN
```

```bash
cd server && npx wrangler secret put WEBHOOK_KUNCI
```

```bash
cd server && npx wrangler secret put KODE_UNDANGAN
```

Bangun aplikasi web lalu deploy (Worker menyajikan `dist/` sekaligus API-nya):

```bash
npm run build
```

```bash
cd server && npx wrangler deploy
```

Alamat `https://pokemonkey-api.<akun>.workers.dev` dipakai untuk browser
komputer, tautan berbagi kalender, dan diisi di layar login APK (ikon gerigi)
atau lewat `VITE_API_URL` di `.env.local` sebelum `npm run build`.

## 3. WhatsApp (Fonnte)

1. Di dasbor fonnte.com, sambungkan nomor perusahaan khusus dan salin tokennya
   ke secret `FONNTE_TOKEN`.
2. Daftarkan webhook: `https://<worker>/wa/webhook?kunci=<WEBHOOK_KUNCI>`.
3. Ambil ID grup departemen lewat API daftar grup Fonnte, masukkan ke
   Pengaturan `wa_grup_id`, lalu ubah `wa_aktif` menjadi `1`.
4. Isi nomor WA tiap anggota di menu TEAM (ikon telepon).

Cron tunggal (`*/15 * * * *`, UTC) mengirim tangga pengingat H-3 / H-1 / H /
H+1 / H+3 pukul 07:00 WITA, rekap Senin pagi dan Jumat sore ke grup.

## 4. APK Android

```bash
npm run android:sync
```

```bash
npm run android:buka
```

Di Android Studio: Build > Build Bundle(s) / APK(s) > Build APK(s).
