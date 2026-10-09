# Rencana Perubahan: Skin, TEAM, Kotak Surat, dan Memo

Status: **disetujui dan sedang dikerjakan** (10 Oktober 2026). Ditulis berdasarkan permintaan pengguna dan pemeriksaan
kode saat ini. Keputusan atas semua bagian **[Putuskan]** ada di bagian berikut; isi bagian lain tetap sebagai rujukan.

## Keputusan putaran 2 (10 Oktober 2026)

| Topik | Keputusan |
|---|---|
| Foto profil (2a) | Skin aktif = foto profil **bawaan**; pemakai boleh menggantinya dengan foto sendiri. Tanpa foto, tampil skin. |
| Skin Prestasi (3a) | Empat contoh dari pengguna (First Responder, Pemburu PICA, Penyelamat Tim, Fotografer Lapangan) dibuat sebagai skin **khusus, langka, dan lebih mewah** dari Rimbawan Legenda. Penyelamat Tim memakai definisi "update/bukti pada PICA telat milik orang lain yang lalu ditutup". |
| Notifikasi surat (7b) | Saran A: surat biasa ikut ringkasan 12.00; hanya surat **Penting** yang langsung berbunyi. |
| Formulir (12a) | Pembuat memilih: **terbuka lewat tautan** (diisi tanpa akun) atau **hanya anggota** yang login. |
| Memo Rahasia (14a) | Hanya pembuat dan orang yang dituju; **semua yang dituju bisa menyunting** (contoh: rencana anggaran tahun depan untuk Mariano — keduanya bisa edit). Admin/SPV tidak otomatis melihat. **Tangkapan layar diblokir.** |
| Enkripsi (14b) | **Ya.** Isi memo rahasia dienkripsi di database (AES-GCM, kunci di secret Worker `KUNCI_RAHASIA_MEMO` yang dipasang pengguna sendiri). |

## Tambahan putaran 2

| No | Bagian | Perubahan | Ukuran |
|---|---|---|---|
| 15 | Memo | Tombol **Dilihat oleh**: siapa saja yang sudah membuka memo, kapan terakhir, berapa kali | S |
| 16 | Memo | Tombol **Suka** (jumlah dan siapa saja), di samping komentar yang sudah ada | S |
| 17 | Memo | **Folder Dokumen** di atas Sampah: Folder Tim (unggah sesuai peran) dan Folder Pribadi (hanya pemiliknya). Hanya dokumen (PDF, Word, Excel, PowerPoint, CSV, TXT). Disimpan di server (R2), bisa dipratinjau tanpa unduh. | M |
| 18 | Memo | **Mode Word**: menyunting di tampilan halaman A4 seperti Word, dan **Ekspor ke Word (.docx)** | M |
| 19 | Memo | Halaman **"Yang baru di Memo"** yang memamerkan fitur (tabel, ceklis, berkas, kolom, callout) dan kegunaannya di pekerjaan | S |

## Status pengerjaan (10 Oktober 2026)

Semua 19 butir sudah dikerjakan dan diuji di mode demo. Belum di-build ke APK, belum di-commit, dan belum dipasang di server.

| No | Hasil | Berkas utama |
|---|---|---|
| 1 | Detail skin layar lebar: animasi, kelangkaan, sejarah, filosofi, jumlah pemilik | `components/MarketScreen.tsx`, `components/LatarSkin.tsx`, `constants.ts` |
| 2 | Avatar TEAM (foto sendiri, atau skin aktif bila belum ada) dan wallpaper skin di panel anggota | `components/AvatarAnggota.tsx`, `TeamScreen.tsx`, `PanelAnggota.tsx` |
| 3 | 4 Skin Prestasi (tier 6 Mitis, halo emas berputar) yang terbuka otomatis | `server/src/prestasi*.ts`, `lib/pixel.ts`, `MonkeySprite.tsx` |
| 4–5 | Pesan antar anggota, minta progres (dijawab otomatis saat update PICA), kirim progres saya | `server/src/surat.ts`, `components/KotakSurat.tsx` |
| 6–7 | Chip NOTIF & FIRE dihapus; kotak surat piksel di KEBUN dan amplop di kepala layar | `components/Habitat.tsx`, `App.tsx` |
| 8 | Paku di kepala halaman: "untuk saya" atau "untuk semua"; bagian Disematkan di sidebar | `server/src/memo-sosial.ts`, `SidebarMemo.tsx` |
| 9 | Halaman baru bersih; properti lewat `/properti` atau "+ Tambah properti" | `MemoScreen.tsx`, `lib/blok-jenis.ts` |
| 10 | Penampil dokumen: PDF (pdf.js), Word, Excel, PowerPoint (teks per slide), CSV, gambar | `components/PenampilBerkas.tsx`, `lib/pratinjau-dok.ts` |
| 11, 13 | Tipe kolom (ceklis di kolom mana pun, angka, rupiah, persen, tanggal, rumus) dan baris hitung | `lib/rumus-tabel.ts`, `EditorMemo.tsx`, `MemoMarkup.tsx` |
| 12 | Blok formulir: tab Isi/Jawaban/Atur, mode anggota atau tautan publik `/f/<token>` | `server/src/formulir*.ts`, `components/BlokFormulir.tsx` |
| 14 | Memo Rahasia: izin per orang, AES-GCM, tanpa AI/tautan/unduh, FLAG_SECURE, watermark | `server/src/sandi-memo.ts`, `components/MemoRahasia.tsx`, `WidgetBridgePlugin.java` |
| 15–16 | Dilihat oleh dan Suka | `components/SosialMemo.tsx` |
| 17 | Folder Dokumen sebagai pohon folder di sidebar memo (Awan PT EBL › … , Pribadi) di atas "Sampah · 30 hari" | `server/src/folder-dok.ts`, `components/FolderDokumen.tsx` |
| 18 | Mode Word (lembar A4) dan ekspor .docx | `lib/ekspor-docx-memo.ts` |
| 19 | Memo tersemat "Panduan Memo — fitur baru & fitur lama" berisi contoh hidup semua fitur | `server/migrations/0033_memo_panduan.sql`, `lib/memo-panduan.ts` |

**Perbaikan yang ikut dikerjakan:**
- Akses berkas di `/api/berkas/` sekarang dicek per memo, per Folder Pribadi, dan per peserta pesan.
- Ikon tombol kepala memo sebelumnya tidak terlihat di tema Terang dan Putih Bersih (putih di atas putih); sudah diperbaiki di `index.css`.

**Langkah pasang di server (dijalankan pengelola):**
1. Migrasi D1 (`0031` bila belum, lalu `0032`, `0033`):
   `npx wrangler d1 migrations apply pokemonkey --remote`
2. Kunci sandi memo rahasia (pengelola sendiri):
   `npx wrangler secret put KUNCI_RAHASIA_MEMO`
   Isi dengan teks acak yang panjang. Kunci ini tidak boleh hilang atau diganti, karena memo rahasia yang sudah tersandi tidak bisa dibuka lagi tanpanya.
3. Deploy Worker, lalu build APK baru. APK baru diperlukan untuk blokir tangkapan layar dan penampil PDF.

**Batasan:**
- Yang disandikan hanya isi memo rahasia dan komentarnya. Judul dan berkas lampiran di R2 tidak disandikan. Orang yang memegang Worker secara teknis tetap bisa membuka.
- Blokir tangkapan layar hanya berlaku di APK Android. Di peramban, perlindungannya berupa watermark nama pembaca.
- Pesan Penting langsung berbunyi lewat Web Push (iPhone/PWA). Di APK, pesan masuk ke ringkasan 12.00 dan terlihat saat aplikasi dibuka.
- Formulir publik dilindungi jebakan robot dan batas 300 jawaban per hari, tanpa captcha.
- Ekspor .docx sudah diuji dengan membaca ulang isinya. Belum dibuka di Microsoft Word sungguhan. Video, grafik, dan data lapangan menjadi teks penanda di dokumen Word.
- Folder "WhatsApp (otomatis)" pada gambar contoh belum dibuat. Pengisian otomatis dari WhatsApp perlu rancangan tersendiri.
- Memo tim baru tidak lagi otomatis berkategori/berstatus "Draf", jadi muncul di kolom "Tanpa kategori" sampai kategorinya diisi.

**Aturan Folder Dokumen:**
- **Folder Tim:** semua anggota (kecuali Pemantau) bisa melihat dan mengunduh.
  - Anggota boleh mengunggah, dan menghapus atau mengganti nama berkasnya sendiri.
  - Admin/Supervisor boleh membuat, mengganti nama, dan menghapus folder serta berkas siapa pun.
- **Folder Pribadi:** hanya pemiliknya, dengan semua hak.
- **Batas:** 25 MB per berkas. Ekstensi yang ditolak: foto, video, program (apk/exe), dan arsip.

## Ringkasan: 14 perubahan

| No | Bagian | Perubahan | Ukuran | Kondisi sekarang |
|---|---|---|---|---|
| 1 | SHOP | Detail skin layar lebar, dengan sejarah dan filosofi | S | Kartu kecil, deskripsi satu kalimat |
| 2 | TEAM | Skin aktif menjadi foto profil dan wallpaper anggota | M | Daftar TEAM hanya nama, tanpa gambar |
| 3 | SHOP | Skin Prestasi: koleksi langka, tidak bisa dibeli | M | Belum ada |
| 4 | TEAM | Kirim pesan ke anggota (seperti email) | M | Hanya tombol WA |
| 5 | TEAM | Minta dan kirim progres pekerjaan | S–M | Belum ada |
| 6 | KEBUN | Hapus chip NOTIF dan FIRE | XS | Keduanya sudah ada di MENU |
| 7 | KEBUN | Kotak Surat: pesan dan pemberitahuan sistem | M | Belum ada kotak masuk dalam aplikasi |
| 8 | Memo | Tombol sematkan (pin) terlihat; memo penting selalu di atas | S | **Sudah ada**, tapi tersembunyi di menu ⋮ dan hanya mengurutkan memo pribadi |
| 9 | Memo | Properti lewat perintah "/"; halaman baru bersih | S–M | Properti tampil di semua halaman |
| 10 | Memo | Pratinjau dokumen di dalam memo tanpa mengunduh | M | Blok berkas hanya tombol unduh |
| 11 | Memo | Ceklis di setiap kolom tabel (tipe kolom) | M | Hanya satu kolom status yang terdeteksi otomatis |
| 12 | Memo | Formulir di dalam memo | L | Belum ada |
| 13 | Memo | Kalkulator: jumlah per kolom dan kolom rumus | M | Blok "Rumus" hanya untuk menampilkan persamaan (LaTeX), bukan menghitung |
| 14 | Memo | Memo Rahasia: hanya orang yang ditunjuk | L | Memo hanya pribadi (pemilik saja) atau tim (semua anggota) |

Ukuran: XS < setengah hari · S ≈ 1 hari · M ≈ 2–3 hari · L ≈ 4–6 hari kerja.

**Temuan keamanan yang harus dibereskan apa pun keputusannya.** Saat ini setiap akun yang login bisa mengambil berkas
apa pun lewat `/api/berkas/<kunci>` asalkan tahu kuncinya. Server tidak memeriksa apakah ia berhak melihat memo atau PICA
pemilik berkas itu (`server/src/index.ts`, fungsi `ambilBerkas`). Untuk memo rahasia (No. 14) ini wajib ditutup lebih dulu.

---

## A. SHOP dan Skin

### 1. Detail skin layar lebar

Kartu skin di SHOP bisa diketuk dan membuka layar detail:

- **Gambar besar.** Monyet ukuran penuh dengan animasi bergantian (diam → jalan → lompat) di atas latar sesuai tingkatnya:
  - ★ hutan pagi
  - ★★ persemaian
  - ★★★ malam berkabut
  - ★★★★ langit senja
  - ★★★★★ emas berkilau
- **Kelangkaan:**
  - Umum (★)
  - Biasa (★★)
  - Langka (★★★)
  - Epik (★★★★)
  - Legenda (★★★★★)
  - Mitis (khusus Skin Prestasi)
- **Harga atau syarat**, termasuk kekurangan saldo atau kemajuan prestasi (mis. "7/10 PICA").
- **Sejarah** dan **Filosofi**: masing-masing dua sampai tiga kalimat (draf di Lampiran A).
- **"Dimiliki oleh N dari M anggota"**, supaya terasa langka.
- **Tombol:** Beli / Pakai / Jadikan wallpaper.
- Geser kiri-kanan untuk berpindah skin.

Teks sejarah dan filosofi disimpan di `constants.ts` bersama data skin, tanpa tabel baru.

### 2. Skin menjadi foto profil dan wallpaper di TEAM

- **Daftar TEAM, Beban PICA, dan Forester Ranking:** setiap nama diberi kotak avatar berisi kepala monyet dari skin
  yang sedang dipakai, dengan bingkai warna sesuai kelangkaan.
- **Panel anggota** (ketuk nama): bagian atas memakai wallpaper skin, yaitu monyet besar di atas latar tingkatnya.
  Di bawahnya nama, jabatan, level, dan koleksi skin/prestasi yang dimiliki.
- **Data:** `/api/tim` ditambah `skin_aktif` (dan `wallpaper` bila berbeda). Tidak perlu tabel baru; cukup satu kolom
  `profil_game.wallpaper` bila wallpaper boleh berbeda dari skin yang dipakai.

**[Putuskan] 2a. Foto asli.** Foto profil asli yang sudah bisa diunggah di Profil:
- (A, disarankan) Tetap ada, tapi hanya tampil di detail profil untuk mengenali orang. Avatar di semua daftar memakai skin.
- (B) Dihapus seluruhnya; identitas visual hanya dari skin.

### 3. Skin Prestasi (koleksi)

Skin yang **tidak bisa dibeli**. Skin ini terbuka sendiri saat syarat kerja tercapai, sehingga setiap prestasi berujung
pada sebuah skin. Membuka skin ini tidak memakai saldo XP.

Semua syarat bisa dihitung dari data yang sudah ada (`xp_log`, `pica`, `titik_api`, `laporan`). Setelah "Hitung ulang
XP" dijalankan, prestasi lama ikut terbuka sehingga orang yang sudah rajin langsung mendapatkannya.

**Usulan dari Anda:**

| Skin | Syarat | Kelangkaan | Sumber data |
|---|---|---|---|
| First Responder | Pengecek pertama sebuah titik api (ground check) | Langka | `xp_log` sumber `titik_pertama` |
| Pemburu PICA | Menutup 10 PICA sebagai PIC | Epik | `pica` Closed dengan `pic_id` = orang itu |
| Penyelamat Tim | Membantu menutup PICA telat milik orang lain | Epik | lihat catatan di bawah |
| Fotografer Lapangan | 30 laporan berfoto di hari yang sama | Langka | `xp_log` sumber `laporan_foto` |

**Catatan Penyelamat Tim.** Bila syaratnya hanya "orang lain yang menekan tombol Closed", prestasi ini otomatis jatuh
ke Admin/Supervisor, karena merekalah yang biasanya memverifikasi. Usulan definisinya:

> Orang itu menulis update atau bukti pada PICA yang **sudah lewat tenggat** dan **bukan miliknya**, lalu PICA itu ditutup.

**Usulan tambahan** (pilih yang cocok):

| Skin | Syarat | Kelangkaan |
|---|---|---|
| Penjaga Ritme | Meter aktif ≥ 70 selama 20 hari kerja berturut-turut | Epik |
| Si Fajar | 20 laporan dikirim sebelum pukul 09.00 WITA | Langka |
| Mata Elang | Membuat 10 PICA yang kemudian ditutup (temuan yang nyata) | Langka |
| Pemadam Senyap | 5 laporan karhutla terkirim | Epik |
| Pena Emas | 10 dokumen formal (surat, memo dinas, MoM) | Langka |
| Mentor Rimba | Memverifikasi 20 PICA (untuk Admin/SPV) | Epik |
| Tanpa Cela | KPI semester ≥ 80 dan nol PICA telat dalam semester itu | **Mitis** |

**Cara kerja:**
- Tabel baru `prestasi (user_id, kode, didapat_pada)`.
- Syarat diperiksa saat XP diberikan (fungsi `beriXp`) dan saat Hitung ulang XP.
- Saat terbuka:
  - muncul banner "PRESTASI TERBUKA!" (seperti naik level)
  - muncul surat di Kotak Surat
  - skinnya masuk ke koleksi
- SHOP mendapat tab baru **Prestasi**: skin yang belum terbuka tampil sebagai siluet dengan syarat dan bilah kemajuan.

**[Putuskan] 3a.** Prestasi mana yang dipakai pada tahap pertama, dan apakah definisi Penyelamat Tim di atas disetujui.

---

## B. TEAM, KEBUN, dan Kotak Surat

### 4. Pesan ke anggota (seperti email)

Ikon amplop di setiap baris TEAM dan di panel anggota membuka formulir pesan berisi:

- **Penerima:** satu atau beberapa anggota.
- **Subjek dan isi:** teks dengan format sederhana.
- **Lampiran:** foto atau berkas, memakai unggahan yang sudah ada.
- **Tautan kerja (opsional):** ke PICA, memo, atau jadwal. Penerima tinggal mengetuk untuk membuka.
- **Penting:** tandai bila perlu, memengaruhi notifikasi (lihat 7b).

Pesan masuk ke Kotak Surat penerima, dengan balasan berutas seperti email dan tanda sudah dibaca.

Pesan bersifat **pribadi antara pengirim dan penerima**. Admin pun tidak bisa membacanya, sama seperti email kerja.
Mengirim pesan berpengaruh kecil ke wilayah Koordinasi di sistem XP (tanpa XP spam: dibatasi per hari).

Tabel baru:
- `pesan (id, pengirim, subjek, isi, tautan, penting, dibuat_pada, induk_id)`
- `pesan_penerima (pesan_id, user_id, dibaca_pada, diarsip)`

### 5. Minta dan kirim progres pekerjaan

- **Minta progres.** Tombol di panel anggota: pilih salah satu PICA miliknya, lalu kirim. Penerima mendapat surat dengan
  tombol **Kirim progres** yang langsung membuka formulir update PICA itu. Begitu ia mengisi update, peminta otomatis
  mendapat surat balasan berisi update tersebut.
- **Kirim progres saya.** Tombol di Kotak Surat untuk mengirim ringkasan kerja hari ini ke atasan. Ringkasan disusun
  otomatis dari laporan, update PICA, dan foto hari ini, dan bisa disunting sebelum dikirim.

### 6. KEBUN: hapus chip NOTIF dan FIRE

- Hapus `ChipNotif` dan `ChipFire` dari `Habitat.tsx`; keduanya tetap ada di MENU.
- Tautan FIRE dari panel cuaca/titik api di KEBUN tetap dipertahankan, karena itu jalur cepat saat ada titik panas.

### 7. KEBUN: Kotak Surat

Sebuah **kotak surat piksel** di halaman KEBUN. Benderanya naik dan ada angka bila ada surat belum dibaca, dan menu
yang sama juga tersedia di MENU.

**Isi Kotak Surat, dalam dua tab:**

**Pesan:** dari anggota (No. 4) dan permintaan progres (No. 5).

**Sistem:** pemberitahuan otomatis:
- PICA baru yang ditugaskan kepadamu, PICA kamu diverifikasi/ditolak/ditutup, dan PICA kamu besok jatuh tempo
- Kamu disebut (@) di memo atau komentar
- Kamu diberi akses ke memo rahasia
- Prestasi terbuka dan naik level
- Hitung ulang XP sudah diterapkan
- Pengumuman penting tetap di INFO; Kotak Surat hanya memberi tautan ke sana agar tidak dobel

Surat sistem disimpan di tabel `kotak_surat (id, user_id, jenis, judul, isi, tautan, dibuat_pada, dibaca_pada)` dan
dihapus otomatis setelah 90 hari.

**[Putuskan] 7b. Notifikasi HP untuk surat baru.** Saat ini notifikasi HP sengaja hanya pada jam tetap
(07.00 / 12.00 / 17.00) dan rekap WA 16.00.
- (A, disarankan) Surat biasa ikut diringkas di notifikasi 12.00; hanya surat yang ditandai **Penting** yang langsung
  berbunyi di HP.
- (B) Setiap surat langsung berbunyi.
- (C) Tidak ada notifikasi HP; surat hanya terlihat saat aplikasi dibuka.

---

## C. Memo

### 8. Sematkan (pin) memo penting

**Yang sudah ada:**
- Menu ⋮ → "Sematkan di atas".
- Server sudah mengurutkan memo tersemat lebih dulu.

**Kekurangannya:**
- Tombolnya tersembunyi.
- Di daftar halaman (sidebar), hanya memo **pribadi** yang diurutkan menurut sematan; memo **tim** tidak.
- Sematan memo tim berlaku untuk semua orang sekaligus.

**Usulan:**
- Ikon **paku** langsung terlihat di kepala halaman dan muncul saat kursor di atas baris sidebar.
- Bagian **"Disematkan"** paling atas di sidebar dan di beranda Memo.
- Dua jenis sematan:
  - **Sematkan untuk saya:** setiap orang punya sematannya sendiri (tabel baru `memo_sematan (user_id, memo_id)`).
  - **Sematkan untuk semua:** hanya pembuat memo, Admin, dan Supervisor. Memakai kolom `disematkan` yang sudah ada,
    dengan ikon paku merah.

### 9. Properti lewat "/": halaman baru bersih

Seperti halaman biasa di Notion: halaman baru hanya berisi **judul dan isi**.

- Properti (Status, Kategori, Tanggal, Lokasi, PICA, dan properti tambahan) hanya tampil bila sudah diisi.
- Tiga cara menambah properti:
  - ketik **"/properti"** atau nama properti di perintah "/" (mis. "/status", "/lokasi")
  - tombol kecil **"+ Tambah properti"** yang muncul saat kursor di bawah judul
  - menu ⋮
- Properti yang dikosongkan hilang lagi dari tampilan.
- Data lama tidak berubah; memo yang sudah berproperti tetap menampilkannya.

Catatan: ini **menggantikan keputusan 1 Oktober** ("properti terbuka secara bawaan, bisa dilipat").
Memo tim baru saat ini otomatis diberi tanggal hari ini. Tanggal itu tetap disimpan agar urutan dan rekap tidak berubah,
tetapi tidak ditampilkan sebagai properti.

### 10. Pratinjau dokumen di dalam memo

Mengetuk blok berkas membuka **penampil layar penuh di dalam memo**, tanpa mengunduh:

| Jenis | Cara tampil | Catatan |
|---|---|---|
| PDF | Halaman per halaman, bisa diperbesar, dengan nomor halaman | Memakai pdf.js, dimuat hanya saat dibutuhkan (±1 MB). Penampil PDF bawaan HP tidak bisa tampil di dalam aplikasi Android. |
| Foto (JPG/PNG) | Perbesar dan geser | |
| Excel / CSV | Tabel per sheet, bisa digulir | Memakai exceljs yang sudah terpasang |
| Word (DOCX) | Teks dan tabel, hanya baca | Memakai mammoth.js, dimuat saat dibutuhkan (±0,5 MB) |
| PowerPoint, lainnya | Kartu info dan tombol Unduh | Tidak ada penampil andal di dalam aplikasi |

Blok berkas juga mendapat **kartu pratinjau kecil** (halaman pertama PDF atau foto), bukan hanya nama berkas.
Di memo rahasia, tombol unduh dan bagikan disembunyikan; yang tersisa hanya pratinjau.

### 11. Ceklis di setiap kolom tabel (tipe kolom)

Sekarang tabel memo menebak **satu** kolom status, sehingga hanya kolom itu yang bisa dicentang. Usulannya meniru
properti database Notion: setiap kolom punya **tipe** yang dipilih dari menu judul kolom:

- Teks, Angka, Rupiah, Persen
- **Ceklis:** setiap sel menjadi kotak centang
- Tanggal
- Orang (@anggota)
- Pilihan (Open / Proses / Selesai, dsb.)
- **Rumus** (No. 13)

**Hasilnya:**
- Beberapa kolom ceklis sekaligus, mis. kolom "Bibit siap", "Lubang tanam", "Pupuk", dan "Foto" masing-masing bisa
  dicentang.
- Ringkasan dan grafik tabel bisa memilih kolom ceklis mana yang dihitung, atau menggabungkan semuanya.

**Tabel lama dan bagian lain yang membaca tabel:**
- Tabel lama tetap berjalan: semua kolom dianggap Teks, dan kolom status tetap terdeteksi seperti sekarang.
- Tipe kolom disimpan bersama blok tabel.
- Ekspor gambar/PDF, halaman bagikan, grafik, dan AI tetap membaca tabel seperti biasa; tipe kolom hanya menambah
  tampilan.

### 12. Formulir di dalam memo

Meniru Notion Forms: sebuah **blok Formulir** berisi pertanyaan. Setiap jawaban masuk sebagai satu baris di tabel
tujuan di memo yang sama, beserta nama pengirim dan waktunya.

- **Jenis pertanyaan:** sama dengan tipe kolom (teks, angka, rupiah, pilihan, tanggal, ceklis), ditambah **foto**.
- **Pengaturan:**
  - wajib diisi atau tidak
  - satu kali per orang atau boleh berulang
  - siapa yang boleh mengisi (semua anggota atau orang tertentu)
  - formulir ditutup pada tanggal tertentu
- **Pengisi tidak harus bisa melihat tabel jawabannya.** Ini penting untuk memo rahasia: pengisi hanya melihat
  formulir, bukan rekap.
- **Contoh pemakaian:** ceklis APD pagi, laporan realisasi per vendor, pendataan bibit.

**[Putuskan] 12a. Pengisi dari luar aplikasi.** Formulir yang bisa diisi **vendor tanpa akun** lewat tautan publik
berisiko keamanan (spam, data palsu).
- Disarankan: tahap pertama hanya untuk anggota yang login.
- Tautan publik untuk vendor dikerjakan belakangan, dengan kode akses per vendor dan batas pengisian.

### 13. Kalkulator di memo

Dua tingkat, seperti Notion:

1. **Baris hitung di bawah tabel.** Setiap kolom bisa memilih:
   - Jumlah, Rata-rata, Min, Maks, Median
   - Jumlah terisi, Jumlah kosong
   - % tercentang (untuk kolom ceklis)
2. **Kolom Rumus.** Dihitung per baris dari kolom lain, memakai nama kolom. Contoh untuk realisasi anggaran vendor:
   - `Sisa = Anggaran - Realisasi`
   - `Serapan = Realisasi / Anggaran * 100`
   - `Status = jika(Serapan > 100, "Lebih", "Aman")`

   Fungsi dasar: `+ − × ÷`, `jumlah`, `rata`, `min`, `maks`, `bulat`, `jika`.

**Cara perhitungan:**
- Dihitung dengan pengurai rumus sendiri yang aman, **bukan** `eval`.
- Hasilnya ikut tersimpan sebagai teks, sehingga ekspor, halaman bagikan, dan AI tetap melihat angkanya.
- Angka rupiah ditampilkan dengan pemisah ribuan (Rp 12.500.000).

Opsional: ketik `=120*3500` di baris biasa, lalu Enter, untuk mendapatkan hasilnya langsung.

### 14. Memo Rahasia

Jenis memo ketiga, di samping **Pribadi** (hanya pemilik) dan **Tim** (semua anggota):

> **Rahasia:** hanya pembuat dan orang yang ia tunjuk, satu per satu, dengan hak Lihat atau Sunting.

**Aturan yang dipasang di server:**

| Hal | Memo Tim | Memo Rahasia |
|---|---|---|
| Siapa yang melihat | Semua anggota | Hanya pembuat dan orang yang ditunjuk |
| Admin / Supervisor otomatis bisa melihat | Ya | **Tidak** (lihat 14a) |
| Muncul di daftar orang lain | Ya | Tidak, judulnya pun tidak |
| Tautan bagikan publik | Bisa | **Dimatikan** |
| Unduh, ekspor gambar/PDF, poster | Bisa | **Dimatikan**; hanya pratinjau |
| Diproses AI (Gemini, server Google) | Bisa | **Dimatikan**; tidak ikut "Tanya semua memo" |
| Lampiran | Siapa pun yang tahu kuncinya | Hanya orang yang berhak (temuan keamanan di atas) |
| Tangkapan layar di HP | Bebas | Diblokir oleh Android (`FLAG_SECURE`) selama memo terbuka |
| Catatan akses | Tidak ada | Pembuat bisa melihat siapa yang membuka dan kapan |
| Sub-halaman | Ikut induk | Ikut rahasia, aturannya sama |

**Data baru:**
- `memo.lingkup = 'rahasia'`
- tabel `memo_izin (memo_id, user_id, hak, diberi_oleh, diberi_pada)`
- tabel `memo_akses_log (memo_id, user_id, pada)`

Tugas @ di memo rahasia tetap masuk Jadwal, tetapi hanya untuk orang yang punya akses, dan judulnya disamarkan di
widget HP ("Tugas memo rahasia").

**Keterbatasan:**
- Pemilik akun Cloudflare (pengelola server/database) secara teknis tetap bisa membaca isi database.
- Bila diperlukan, isi memo rahasia bisa **dienkripsi di database** dengan kunci rahasia server. Kunci itu Anda pasang
  sendiri lewat `wrangler secret put`. Enkripsi ini melindungi dari salinan atau ekspor database, tetapi tidak dari
  orang yang mengendalikan server.
- Foto layar dengan HP lain tidak bisa dicegah. Untuk itu ada watermark nama pembaca di latar memo rahasia.

**[Putuskan] 14a. Admin/SPV dan memo rahasia.** Disarankan: Admin/SPV **tidak** otomatis bisa melihat, sesuai tujuan
"tidak boleh ada yang lihat". Konsekuensinya, bila pembuat keluar dari perusahaan dan tidak ada orang lain yang
ditunjuk, memo itu tidak bisa dibuka siapa pun. Usulan pengamannya: memo rahasia **wajib punya minimal satu orang lain
dengan hak Sunting** (mis. atasan langsung).

**[Putuskan] 14b. Enkripsi.** Apakah perlu enkripsi isi di database (lebih aman, tetapi pencarian memo rahasia hanya
bisa pada judul)?

**Keputusan pengguna:** rumus dan kalkulator Memo berdiri sendiri, **terpisah dari Money Monkey**. Contoh RAB/anggaran
hanya ilustrasi. Kegunaannya untuk perhitungan dasar di laporan apa pun: luas tanam, persentase hidup bibit,
jumlah HOK, rata-rata curah hujan, dan sejenisnya.

---

## Urutan pengerjaan yang disarankan

| Tahap | Isi | Alasan |
|---|---|---|
| 1 | No. 6, 8, 9, 1 | Cepat, langsung terasa, tanpa perubahan database besar |
| 2 | Perbaikan akses berkas, lalu No. 14 Memo Rahasia, lalu No. 10 Pratinjau dokumen | Keamanan dulu, sebelum data anggaran vendor masuk |
| 3 | No. 11 Tipe kolom, lalu No. 13 Kalkulator, lalu No. 12 Formulir | Urutannya bertingkat: formulir memakai tipe kolom, rumus memakai angka |
| 4 | No. 7 Kotak Surat, lalu No. 4 Pesan, lalu No. 5 Progres | Kotak Surat menjadi wadah bagi pesan dan progres |
| 5 | No. 2 Avatar & wallpaper, lalu No. 3 Skin Prestasi | Prestasi memakai Kotak Surat untuk kabarnya dan XP yang sudah dihitung ulang |

Setiap tahap mengikuti prosedur yang sama:
- dicek dengan typecheck
- diuji di mode demo
- tidak di-build atau di-commit sebelum Anda minta

## Daftar keputusan

1. **2a:** Foto asli tetap ada di detail profil (A) atau dihapus (B)?
2. **3a:** Prestasi mana untuk tahap pertama, dan apakah definisi Penyelamat Tim disetujui?
3. **7b:** Notifikasi HP untuk surat baru: A / B / C?
4. **12a:** Formulir tahap pertama hanya untuk anggota yang login?
5. **14a:** Admin/SPV tidak otomatis melihat memo rahasia, dan setiap memo rahasia wajib punya minimal satu penyunting lain?
6. **14b:** Isi memo rahasia dienkripsi di database?

---

## Lampiran A: Draf sejarah dan filosofi skin

Semua kisah adalah cerita dalam permainan, bukan sejarah perusahaan. Silakan disunting.

| Skin | Kelangkaan | Sejarah | Filosofi |
|---|---|---|---|
| Classic Forester | Umum | Seragam pertama yang dibagikan saat tim reklamasi dibentuk, ketika lahan bekas tambang masih berupa tanah merah terbuka. | Semua pekerjaan besar dimulai dari seragam sederhana dan niat untuk hadir setiap hari. |
| Forest Guard | Biasa | Dipakai regu patroli yang menjaga tanaman muda dari ternak, api, dan pembalakan liar. | Menanam itu sehari; menjaga itu bertahun-tahun. |
| Safety Manager | Biasa | Helm dan rompi oranye sang mandor yang memastikan setiap orang pulang dengan selamat. | Target tidak ada artinya bila ada yang terluka. Keselamatan adalah pekerjaan pertama. |
| Elite Botanist | Biasa | Ahli persemaian yang hafal setiap bedeng, tahu kapan bibit haus dan kapan siap dipindah. | Hutan yang kuat lahir dari bibit yang dirawat dengan sabar. |
| Astro Ape | Langka | Kisah monyet yang membayangkan menghijaukan planet lain, karena lahan tandus di bumi sudah berhasil ia pulihkan. | Bermimpilah jauh, tetapi mulailah dari lahan di depan mata. |
| Cyber Gorilla | Langka | Lahir ketika laporan kertas berganti menjadi data, peta, dan foto bergeotag. | Data yang rapi membuat kerja keras terlihat dan bisa dipercaya. |
| Samurai Rimba | Langka | Penjaga yang memegang janji: PICA yang ia pegang selalu selesai sebelum tenggat. | Disiplin adalah bentuk hormat pada tim. |
| Fire Monkey | Langka | Garda depan saat musim kemarau, orang pertama yang berlari ke titik panas. | Api kecil dipadamkan hari ini; api besar dicegah sejak kemarin. |
| Frost Ape | Langka | Ia tetap tenang di tengah tekanan dan berkepala dingin saat semua orang panik. | Keputusan terbaik lahir dari kepala yang dingin. |
| Ninja Monkey | Langka | Bekerja tanpa sorotan: menyelesaikan tugas yang tidak dilihat orang, tetapi terasa hasilnya. | Integritas adalah apa yang kamu lakukan saat tidak ada yang melihat. |
| Money Monkey | Epik | Penjaga koin dan RAB; setiap rupiah tercatat dan bisa dipertanggungjawabkan. | Anggaran yang jujur adalah fondasi kepercayaan. |
| Golden Monkey | Epik | Penghargaan bagi yang konsisten: bukan sekali hebat, tetapi hadir dan melapor hari demi hari. | Emas bukan bakat, tetapi kebiasaan yang diulang. |
| The Forest King | Epik | Mahkota bagi pemimpin yang membesarkan timnya, bukan dirinya sendiri. | Raja rimba melayani hutannya. |
| Phoenix Ape | Epik | Bangkit dari lahan terbakar; kisah blok yang pernah gagal tanam lalu tumbuh kembali. | Kegagalan adalah abu tempat tunas baru tumbuh. |
| Naga Rimba | Epik | Penjaga hutan purba dalam cerita lama, yang terbangun ketika lahan kembali hijau. | Kita meminjam hutan dari anak cucu. |
| Diamond Primate | Legenda | Ditempa oleh tekanan panjang, seperti lahan keras yang akhirnya ditumbuhi tanaman. | Tekanan membentuk ketangguhan. |
| Rimbawan Legenda | Legenda | Hanya untuk mereka yang ikut menghijaukan 150 hektar; namanya diingat setiap pohon yang tumbuh. | Warisan sejati adalah hutan yang tetap berdiri setelah kita pergi. |

**Skin Prestasi:**

| Skin | Kelangkaan | Sejarah | Filosofi |
|---|---|---|---|
| First Responder | Langka | Ia yang pertama tiba di titik api dan memastikan apa yang terjadi di lapangan. | Kecepatan memeriksa menyelamatkan hektar demi hektar. |
| Pemburu PICA | Epik | Ia memburu temuan sampai tuntas, bukan sekadar mencatatnya. | Masalah yang ditutup lebih berharga daripada seratus yang dicatat. |
| Penyelamat Tim | Epik | Ia turun tangan saat PICA rekannya terlambat, tanpa menunggu diminta. | Tim yang kuat tidak membiarkan anggotanya tertinggal. |
| Fotografer Lapangan | Langka | Lensanya menjadi bukti: setiap laporan disertai gambar yang jujur. | Satu foto yang jujur mengalahkan seribu kata. |
| Tanpa Cela | Mitis | Satu semester penuh aktif dan tanpa satu pun PICA terlambat. | Kesempurnaan adalah ribuan hal kecil yang dikerjakan dengan benar. |
