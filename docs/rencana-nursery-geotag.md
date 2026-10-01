# Rencana: Memo ↔ Data Dasbor Smart Nursery & Geotagging

Status: **disiapkan, belum dikerjakan** (1 Okt 2026). Dikerjakan di sesi berikutnya setelah pertanyaan di §6 dijawab.

Menggantikan usulan §5.3 di `docs/analisis-arsitektur-notion-vs-memo.md` (tabel baru `nursery_mutasi` & `geotag_bibit`) — lihat §2 untuk alasannya.

---

## 1. Temuan: sumber datanya sudah ada (dan harus tetap satu)

Proyek pendamping `D:\Belajar Koding\AI suara\eracc-terminal` sudah membaca kedua data ini. Pelajaran terpentingnya tertulis di kode sana: **satu sumber kebenaran**, jangan membuat salinan yang bisa berselisih.

| | Smart Nursery | Geotagging |
|---|---|---|
| Worker | `smart-nursery-api` (repo `D:\Nursery apk 21042026`) | Worker aplikasi kamera lapangan (proyek `camera.v8-native`) |
| D1 | `nursery-entries` | `montana-entries` |
| R2 | `montananursery` (`suratjalan/{nomor}.pdf`) | `montanacamera` (`photos/{id}.jpg`) |
| Baca | `GET /api/entries?limit&offset&since` · `GET /api/pdf/{nomor}` | `GET /api/entries?since=` (keyset `updated_at`) · `GET /api/photo/:id` |
| Kunci | header `X-Api-Key` = secret `STORAGE_API_KEY` Worker itu | header `X-Api-Key` (config `GEOTAG_KEY`, URL `GEOTAG_URL`) |
| Ukuran | ribuan baris mutasi | target ±50.000 titik |

**Kolom Nursery** (balasan Worker, camelCase): `id, tanggal, bulan, bibit, bedengan, masuk, keluar, mati, total, sumber, tujuan, nomorSurat, statusKirim, statusTerima, kodeVerifikasi, dibuatOleh, driver, namaPenerima, tanggalTerima, jumlahDiterima, statusApproval, approvedBy, approvedAt, alasanTolak, updatedAt, pdfKey, fotoKey, ttdKey, createdAt`.

**Kolom Geotag**: `id, tanggal, timestamp, lat, lon, akurasi, lokasi, pekerjaan, tinggi (cm), tanaman, tahun_tanam, pengawas, vendor, tim, kesehatan (Sehat/Merana/Mati), no_pohon, deskripsi, mode, ai_kesehatan, ai_confidence, hcv_input, photo_key, updated_at`.

### Rumus yang disalin apa adanya (jangan dikarang ulang)

Nursery (`nursery_analitik.py`):
- `stok = Σmasuk − Σkeluar − Σmati`, **hanya sah tanpa saringan selain jenis bibit** (saring per tujuan → bukan stok; kartu berganti nama).
- `mortalitas % = mati / masuk × 100` · aktivitas hari ini (masuk/keluar/mati) · hari aktif & rentang tanggal.
- Sebaran per jenis, Pareto tujuan (blok penyerap bibit), proyeksi habis stok dari laju keluar belakangan (tidak dihitung bila tersaring).

Geotag (`geotag_analitik.py`, salinan `ecology/biomass.ts` & `carbon.ts` aplikasi kamera):
- `% hidup = (Sehat + Merana) / total × 100`, `% sehat = Sehat / total × 100`, berkoordinat, berfoto, tinggi rata/min/maks.
- `DBH(cm) = h ≤ 1,3 m → maks(0,5; 0,85h) ; selain itu maks(1; 0,85·h^1,2)`
- `AGB(kg) = 0,0673 × (ρ·D²·H)^0,976` dengan ρ = 0,60 · `Karbon = AGB × 0,47` · `CO₂e = Karbon × 44/12`.
- **Empat batas wajib tampil bersama angka karbon**: diameter diduga dari tinggi; ρ dipukul rata; hanya biomassa atas tanah; luas dari convex hull = luas cakupan survei, bukan luas tanam (tolak bila rentang titik > 25 km).

---

## 2. Arsitektur yang diusulkan

**Tidak membuat tabel nursery/geotag baru di D1 POKEMONKEY.** Tabel kembar = dua sumber kebenaran, persis masalah yang baru dibereskan eracc-terminal (Apps Script → D1).

Batasan Cloudflare Free: CPU 10 ms per permintaan/cron, 50 subrequest. Menarik 50.000 titik lalu menghitung di JS pasti melewati batas CPU — **agregasi harus terjadi di SQL**.

Pilihan (urut rekomendasi):

1. **Ikatan D1 hanya-baca langsung** *(direkomendasikan bila ketiga Worker satu akun Cloudflare)*
   `wrangler.jsonc` POKEMONKEY menambah binding `NURSERY_DB` → `nursery-entries` dan `GEOTAG_DB` → `montana-entries`. KPI dihitung dengan `SELECT SUM/COUNT … GROUP BY` di D1 (waktu kueri tidak memakan jatah CPU Worker), hasilnya kecil.
   - Kode hanya boleh `SELECT` — dijaga satu modul `server/src/sumber-lapangan.ts` (sesuai aturan "hanya sumber.ts yang kenal tabel").
   - Risiko: skema D1 sumber berubah → modul ini ikut diubah. Nama kolom D1 snake_case (Worker mengubahnya ke camelCase), cek ulang saat mengerjakan.
2. **Lewat API Worker sumber** (bila beda akun): secret `NURSERY_API_KEY`, `GEOTAG_API_KEY` + var URL; cron 15 menit menarik delta `?since=` ke **tabel cermin hanya-baca** (bukan sumber), KPI dari cermin. Tarikan awal dicicil per 1.000 baris per putaran cron agar tidak melewati 10 ms CPU.
3. ~~Tabel baru diisi manual (§5.3 analisis)~~ — ditolak: dua sumber kebenaran.

Cache: ringkasan disimpan 10 menit (Cache API atau tabel kecil `cache_ringkasan`) supaya membuka memo berkali-kali tidak menghitung ulang.

---

## 3. Yang dibangun

### 3.1 API (server)
- `GET /api/lapangan/nursery?bibit=&tujuan=&dari=&sampai=` → `{ ringkasan, jenis[], tujuan[], proyeksi, diambil, sumber }`
- `GET /api/lapangan/geotag?lokasi=&tanaman=&vendor=&dari=&sampai=` → `{ ringkasan (total, sehat, merana, mati, %hidup, %sehat, berkoordinat, berfoto, tinggi), karbon {kg, co2e, batas[]}, per_lokasi[], diambil }`
- `GET /api/lapangan/geotag/foto/:id` → teruskan foto (opsional, untuk blok peta/galeri tahap 2).
- Hak: semua anggota login boleh membaca; mode demo memakai data contoh di `lib/demo.ts`.

### 3.2 Blok memo (menu "/", grup baru **Data lapangan**)
- `/Nursery` dan `/Geotagging` → satu baris teks seperti tabel:
  `!data{"sumber":"nursery","saring":{"bibit":"Sengon"},"tampil":"kpi"}`
  `!data{"sumber":"geotag","saring":{"lokasi":"Blok 3"},"tampil":"kpi"}`
- Parser di `server/src/memo-blok.ts` (`bacaData`/`rakitData`), registri di `lib/blok-jenis.ts`.
- Tampilan kartu (retro): `🌱 Stok 45.200 btg · Mortalitas 2,1% · Masuk hari ini +500` / `📍 12.450 titik · Hidup 94,2% · Karbon 8,4 t C` + "diambil 10.15 WITA", tombol saring & segarkan.
- **Hidup vs beku**: bawaan hidup (selalu terbaru). Pilihan "Bekukan angka" menyimpan angka + waktu ke dalam blok (`"beku":{…,"pada":"…"}`) — untuk laporan bulanan/notulen yang angkanya tidak boleh berubah.
- Ikut di: penyunting, tampilan baca, **gambar unduhan** (angka diambil saat mengunduh) dan **halaman bagikan** (lihat pertanyaan §6.4).
- Angka karbon selalu disertai empat batasnya (tooltip/teks kecil).

### 3.3 Tahap 2 (setelah 3.1–3.2 jalan)
- Tampilan `tampil:"jenis"` / `"tujuan"` (tabel mini per jenis bibit / per blok), `tampil:"peta"` (Leaflet, sudah dipakai di properti lokasi memo) untuk titik geotag.
- Properti memo tipe "Blok/Lokasi" yang menyaring blok data otomatis.
- Kartu ringkasan di dasbor aplikasi (bila dijawab "ya" di §6.3).

---

## 4. Berkas yang disentuh

| Berkas | Isi |
|---|---|
| `server/wrangler.jsonc` | binding D1 baru (pilihan 1) atau var URL (pilihan 2) |
| `server/src/tipe.ts` | `Env`: `NURSERY_DB`/`GEOTAG_DB` atau URL + secret |
| `server/src/sumber-lapangan.ts` *(baru)* | satu-satunya yang kenal tabel sumber; kueri KPI SQL |
| `server/src/lapangan.ts` *(baru)* | rute `/api/lapangan/*`, cache, rumus karbon |
| `server/src/memo-blok.ts` | blok `!data{…}` |
| `lib/blok-jenis.ts`, `components/EditorMemo.tsx`, `components/MemoMarkup.tsx` | menu "/", kartu data |
| `lib/gambar-memo.ts`, `server/src/lihat-memo.ts` | kartu ikut di gambar & halaman bagikan |
| `lib/demo.ts` | data contoh nursery & geotag |
| `server/migrations/0029_…` | hanya bila pilihan 2 (tabel cermin) atau cache |

---

## 5. Uji yang direncanakan
- KPI dibandingkan dengan angka panel eracc-terminal untuk saringan yang sama (harus identik).
- Stok tersaring per tujuan tidak berlabel "stok"; proyeksi tidak muncul saat tersaring.
- Karbon: contoh tinggi 50 cm, 130 cm, 300 cm dibandingkan dengan `agb_kg()` Python.
- Batas CPU: ringkasan 50.000 titik < 10 ms CPU (hanya SQL), cache bekerja.
- Mode demo, tampilan HP, gambar unduhan, halaman bagikan.

---

## 6. Pertanyaan untuk dijawab sebelum mengerjakan
1. Apakah Worker `smart-nursery-api`, Worker kamera, dan `pokemonkey-api` **satu akun Cloudflare**? (menentukan pilihan 1 atau 2)
2. Setuju **tidak** membuat tabel baru `nursery_mutasi`/`geotag_bibit` dan membaca sumber yang sudah ada?
3. Selain blok di memo, perlu **kartu dasbor** di layar lain (mis. KEBUN)?
4. Halaman bagikan publik: angka nursery/geotag **ikut tampil** atau disembunyikan (data operasional perusahaan)?
5. Saringan yang dibutuhkan: jenis bibit, tujuan/blok, periode, vendor/pengawas — ada yang lain?
6. Bawaan blok: **hidup** atau **beku**?
