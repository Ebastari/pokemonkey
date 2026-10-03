# Rencana: Memo POKEMONKEY seperti halaman Notion

Status: **draf v3, menunggu persetujuan**. Belum ada pengerjaan baru sebelum rencana ini disetujui.

Perubahan:
- v2: ditambah **menu `/` lengkap** dan **tampilan database** sesuai tangkapan layar Notion dari Anda (§2.4, §2.5, Tahap F & H).
- v3: sampul diganti dari sprite skin menjadi **ilustrasi stage bergaya game 90-an yang bercerita**, mengikuti gambar acuan *Monyet Pixel Menatap Lembah Jungle* (§2.6, Tahap G).

## 1. Tujuan

1. Mengetuk satu memo membuka **satu halaman penuh** di laptop maupun HP, seperti mode *Full page* di Notion.
2. Isinya ditulis langsung dengan blok-blok seperti di Notion (menu `/` yang sama lengkapnya).
3. Daftar memo bisa dilihat dalam berbagai **tampilan** seperti database Notion.
4. Tetap berwajah POKEMONKEY: font & kotak piksel, dan **sampul bergaya game monyet 90-an**.

## 2. Hasil mempelajari Notion

Sumber: halaman Notion publik (`meilisearch.notion.site`) yang diukur lewat Chrome DevTools pada layar 1366×800 dan HP 390×844, ditambah tangkapan layar menu `/` Notion (bahasa Indonesia) dari Anda. Hanya tata letak, ukuran, dan perilaku yang ditiru; kode, logo, dan aset Notion tidak disalin.

### 2.1 Cara membuka item database

| Mode | Bentuk | Dipakai Notion untuk |
|---|---|---|
| Side peek | Panel kanan setengah layar, ada `»` (tutup) dan `⤢` (buka penuh) | Bawaan Board, Table, List |
| Center peek | Kotak di tengah | Bawaan Gallery, Calendar |
| **Full page** | Halaman sendiri, memenuhi layar | **Yang diminta** |

### 2.2 Ukuran halaman penuh

| Bagian | Laptop | HP |
|---|---|---|
| Bilah atas | Tinggi 44px. Kiri: jalur `Induk / Database / Judul`. Kanan: cari, bagikan, `•••` | Tinggi 44px: judul halaman, bagikan, menu |
| Kolom isi | Lebar 720px, di tengah layar | Penuh, tepi kiri-kanan ±20px |
| Jarak atas (tanpa ikon/sampul) | Judul ±84px di bawah bilah atas | ±28px |
| Ikon halaman | ±78px, di atas judul | Lebih kecil |
| Sampul | Pita gambar penuh di atas halaman | Sama |
| Judul | 40px tebal, tinggi baris 48px | 28px |
| Baris properti | Tinggi 34px, huruf 14px. Kiri: ikon + nama abu-abu (kolom ±200px). Kanan: nilai | Kolom nama ±130px |
| Nilai properti | Tampil polos; jadi isian/pilihan saat diketuk | Sama |
| Pemisah | Garis tipis di bawah properti, lalu isi | Sama |
| Teks isi | 16px, tinggi baris 24px | 16px |
| Judul 1 di isi | 30px, tebal 600, tinggi baris 39px | — |
| Kartu di papan | Lebar 260px, sudut 10px, bayangan halus | — |

### 2.3 Perilaku penting

- Tutup halaman: tombol kembali peramban/HP, atau jalur di bilah atas.
- "Tambah ikon" / "Tambah sampul" muncul saat kepala halaman diarahkan (HP: selalu tampil).
- Menu `•••`: Lebar penuh, Teks kecil, Font, Salin tautan, Hapus.

### 2.4 Menu `/` Notion dan padanannya di POKEMONKEY

Notion mengelompokkan menu menjadi **Blok dasar**, **Media**, **Database**, menampilkan **pintasan di kolom kanan** (`#`, `##`, `-`, `1.`, `[]`, `>`, `"`, `---`), dan menutup dengan baris **"Tutup menu — esc"**.

Kelas kesulitan: **Ada** = sudah jalan · **Mudah** = tambahan kecil · **Sedang** = butuh blok bersarang/berbaris banyak · **Besar** = butuh perubahan database.

| Blok Notion | Pintasan | POKEMONKEY sekarang | Kelas | Catatan |
|---|---|---|---|---|
| Teks | — | Teks | Ada | |
| Judul 1 / 2 / 3 | `#` `##` `###` | Judul 1/2/3 | Ada | |
| Judul 4 | `####` | — | Mudah | Tambah `#### ` di pengurai; data lama aman |
| Daftar berpoin | `-` | Daftar butir | Ada | Ganti nama jadi "Daftar berpoin" |
| Daftar bernomor | `1.` | Daftar bernomor | Ada | |
| Daftar tugas | `[]` | Ceklis | Ada | Ganti nama; tetap masuk Jadwal bila bertenggat |
| Toggle daftar | `>` | — | Sedang | Butuh isi bersarang (lihat §4 Tahap F2) |
| Halaman | — | — | Besar | Sub-halaman; butuh kolom induk di tabel `memo` |
| Callout | — | Kotak penting | Ada | Ganti nama; tambah pilihan ikon emoji |
| Kutipan | `"` | Kutipan | Ada | Pintasan `"` sudah ada |
| Tabel | — | — | Sedang | Disimpan sebagai baris `\| a \| b \|` berurutan |
| Divider | `---` | Garis | Ada | |
| Tautan ke halaman | — | — | Mudah | Pilih memo lain → chip yang membukanya |
| Gambar (Media) | — | Gambar | Ada | |
| Video (Media) | — | — | Mudah | Tautan video (YouTube dll.) sebagai kartu; unggah video tidak disarankan (batas 8 MB) |
| Berkas (Media) | — | Berkas | Ada | |
| Database: Tampilan tabel/papan/galeri/… | — | Lihat §2.5 | — | Di POKEMONKEY tampilan ada di tingkat **layar Memo**, bukan di dalam isi memo |

Konflik pintasan: Notion memakai `>` untuk **toggle** dan `"` untuk **kutipan**, sedangkan POKEMONKEY menyimpan kutipan sebagai `> `. Usul: pintasan ketik mengikuti Notion (`>` + spasi → toggle, `"` + spasi → kutipan), tetapi **penyimpanan kutipan tetap `> `** supaya memo lama tidak berubah; toggle memakai penanda baru (lihat Tahap F2).

### 2.5 Tampilan database Notion dan padanannya di layar Memo

| Tampilan Notion | Layar Memo sekarang | Usul |
|---|---|---|
| Tampilan tabel | Tab **Tabel** | Ada |
| Tampilan papan | Tab **Ikhtisar** (per kategori) & **Status** | Ada |
| Tampilan daftar | Tab **Kategori** (daftar berkelompok), **Tugas** | Ada |
| Tampilan kalender | Tab **Kalender** | Ada |
| Tampilan galeri | — | **Baru**: kartu besar bersampul (pas dengan sampul POKEMONKEY) |
| Tampilan feed | — | **Baru**: memo terbaru berurutan, judul + cuplikan isi + gambar pertama |
| Tampilan lini masa | — | **Baru**: memo & tugas bertenggat di sumbu waktu (per minggu/bulan) |
| Tampilan dasbor | — | **Baru**: angka ringkas (memo per status, tugas terlambat/hari ini) |
| Diagram batang vertikal/horizontal | — | **Baru**: grafik jumlah memo per kategori/status/penulis (bagian dari Dasbor) |
| Tampilan peta | — | Ditunda: memo belum punya lokasi (butuh properti koordinat) |

### 2.6 Sampul khas POKEMONKEY (permintaan Anda)

Notion punya galeri sampul bawaan. POKEMONKEY akan punya **galeri sampul sendiri** berupa **ilustrasi piksel 16-bit bergaya game 90-an yang bercerita**, mengikuti gambar acuan Anda:

**Acuan:** `Monyet Pixel Menatap Lembah Jungle.png` (2056×765 px, rasio ±8:3, PNG 1,9 MB). Monyet cokelat di tebing berlumut, di bawah pohon besar, menatap lembah hutan, gunung biru, dan air terjun di bawah langit siang. Rasanya seperti layar pembuka sebuah *stage*.

Bukan sprite skin, melainkan **serangkaian ilustrasi "stage"** dengan tokoh monyet yang sama. Bersama-sama ilustrasi itu menceritakan perjalanan pekerjaan tim: dari lahan bekas tambang sampai hutan pulih.

| No | Stage | Cerita satu kalimat | Isi gambar | Status |
|---|---|---|---|---|
| 1-1 | **Lembah Jungle** | Petualangan dimulai: sang monyet memandang tanah yang akan dijaga. | Gambar acuan Anda | **Ada** |
| 1-2 | Pit Tambang | Tanah yang terluka menunggu dipulihkan. | Pit bertingkat, alat berat kecil, monyet berhelm K3 di tepi pit | Perlu dibuat |
| 1-3 | Nursery | Menanam harapan, satu polybag demi satu. | Rumah bibit, barisan polybag, monyet menyiram | Perlu dibuat |
| 2-1 | Musim Hujan | Badai pertama menguji tanggul dan bibit. | Hujan deras, kilat jauh, monyet berteduh daun pisang | Perlu dibuat |
| 2-2 | Patroli Api | Asap di cakrawala, penjaga siaga. | Asap karhutla di kejauhan, monyet dengan teropong | Perlu dibuat |
| 2-3 | Kemah Malam | Istirahat sejenak di bawah bintang. | Api unggun, bulan, kunang-kunang | Perlu dibuat |
| 3-1 | Hutan Pulih | Bekas tambang kembali hijau. | Lahan reklamasi rimbun, burung, sungai jernih | Perlu dibuat |
| ★ | Bonus Stage | Pisang emas untuk tim yang menuntaskan PICA. | Pisang emas berkilau, latar meriah | Perlu dibuat |

**Siapa membuat gambar 1-2 s.d. ★:** saya tidak bisa melukis ilustrasi sekelas acuan. Gambar perlu dibuat dengan alat gambar AI yang Anda pakai untuk acuan (atau dipesan). Saya siapkan **teks perintah (*prompt*) per stage** supaya hasilnya seragam:

> *16-bit SNES-era pixel art, wide panoramic game background 2056×765, the same brown cartoon monkey hero as the reference (round ears, tan face, curled tail), vibrant limited palette, parallax layers, crisp pixels, no text, no UI, no logo. Scene: [isi gambar stage].*

**Aturan teknis sampul:**
- **Ukuran sumber:** ±2056×765 (8:3). Disimpan sebagai **WebP lebar 1600 px** (±150–300 KB per gambar, dari 1,9 MB).
- **Titik fokus:** tiap gambar punya titik fokus (mis. acuan: monyet di ±15% dari kiri, ±55% dari atas). Pemotongan di laptop (pita lebar) dan HP tidak memotong si monyet.
- **Tinggi sampul:** laptop ±280 px, HP ±140 px. Ikon halaman menumpang di tepi bawah sampul seperti Notion.
- **Keterangan stage:** pojok bawah sampul menampilkan label kecil bergaya game, mis. `STAGE 1-1 · LEMBAH JUNGLE` (bisa dimatikan).
- **Lokasi berkas:**
  - disertakan di aplikasi (`public/sampul/`) supaya tampil **tanpa sinyal**;
  - salinan diunggah ke R2 (`sampul/`) supaya halaman tautan publik juga bisa menampilkannya.
- **Hak gambar:** dipastikan gambar memang milik/buatan tim (bukan dari game lain).

## 3. Kondisi aplikasi sekarang

| Bagian | Sekarang | Selisih dengan Notion |
|---|---|---|
| Membuka memo tim | Kotak di tengah (`LembarMemo` di `components/MemoScreen.tsx`) | Bukan halaman penuh |
| Membuka catatan pribadi | Dua kolom: daftar kiri, penyunting kanan | Bukan halaman penuh |
| Properti | Kotak isian/pilihan bergaris, kolom nama 80px | Tidak polos, terlalu rapat |
| Judul | 22px | Notion 40px |
| Ikon & sampul | Tidak ada | — |
| Teks isi | 14px | Notion 16px |
| Menu `/` | Satu daftar tanpa kelompok & tanpa kolom pintasan | Lihat §2.4 |
| Editor blok, `@`, `+ ⋮⋮`, Bagikan tautan | Sudah ada (`components/EditorMemo.tsx`, `components/BagikanMemo.tsx`) | Sesuai |

> Catatan jujur: sebelum rencana ini, sebagian Tahap A, C, dan E sudah sempat ditulis di `components/MemoScreen.tsx` (lolos pemeriksaan tipe, **belum diuji di layar**). Kode itu akan diperiksa ulang terhadap rencana ini, bukan dianggap selesai.

## 4. Rencana kerja (bertahap)

Setiap tahap: kerjakan → uji di laptop (1366px) dan HP (390px) pada mode demo → kirim tangkapan layar → tunggu persetujuan → tahap berikutnya.

### Tahap A — Halaman penuh

- Memo dibuka sebagai lapisan selayar penuh, menggantikan kotak tengah.
- Bilah atas 44px:
  - kiri: `‹` kembali, jalur `Memo & Surat / Memo Internal / [ikon] Judul` (HP: hanya `‹` + judul);
  - kanan: "Diedit … lalu", status simpan, **Bagikan**, `•••`.
- Kolom isi 720px di tengah (laptop), tepi 20px (HP).
- Tombol kembali HP/peramban menutup halaman (`history.pushState`/`popstate`).
- Berlaku dari semua pintu masuk: Ikhtisar, Status, Kategori, Tabel, Tugas, Kalender, Pribadi.
- Simpan otomatis tetap seperti sekarang (termasuk "disimpan di HP" saat tanpa sinyal).

Selesai bila: memo terbuka penuh di kedua ukuran layar, kembali dengan tombol HP berfungsi, tidak ada isi yang hilang saat ditutup.

### Tahap B — Properti ala Notion

- Baris 34px, huruf 14px; kiri ikon + nama abu-abu (kolom 200px laptop / 130px HP).
- Nilai tampil polos; diketuk → pilihan/isian; keluar → polos lagi.
- Urutan: Kategori, Tipe, Status, Tanggal, Penulis, PICA, Tugas (x/y), kolom kustom, **Ringkasan**, "+ Tambah properti".
- Catatan pribadi: properti tim disembunyikan.

Selesai bila: properti sejajar seperti Notion dan semua nilai masih bisa diubah serta tersimpan.

### Tahap C — Ikon & sampul (dasar)

- "Tambah ikon" (emoji, Acak, Hapus) dan "Tambah sampul" (galeri, unggah foto, Ganti, Hapus).
- Disimpan di `memo.props` yang sudah ada (kunci `ikon`, `sampul`) — **tanpa migrasi**.
- Ikon tampil di kartu, daftar, tabel, catatan pribadi, jalur bilah atas, dan halaman tautan publik.

### Tahap D — Ukuran isi mengikuti Notion

- Teks 16px/24px; Judul 1 30px, Judul 2 24px, Judul 3 20px, Judul 4 17px; jarak antarblok seperti Notion.
- Menu `•••`: "Teks kecil" dan "Lebar penuh" (disimpan per perangkat).

### Tahap E — Catatan pribadi

- Tab Pribadi menjadi daftar kartu; "Halaman baru" + templat; diketuk → halaman penuh yang sama.
- Sematkan dan warna pindah ke menu `•••`.

### Tahap F — Menu `/` seperti Notion

**F1 (mudah)**
- Kelompok **Blok dasar / Media / Sisipkan**, kolom **pintasan** di kanan, baris **"Tutup menu — esc"**.
- Nama mengikuti Notion: Daftar berpoin, Daftar tugas, Callout, Divider.
- Blok baru: **Judul 4** (`####`), **Tautan ke halaman** (memilih memo lain), **Video** (tautan).
- Callout boleh berganti ikon emoji.

**F2 (sedang)**
- **Toggle daftar**: baris judul yang bisa dilipat, isinya blok-blok di bawahnya yang menjorok.
  - Penyimpanan: `>> Judul toggle`, anak-anaknya diawali dua spasi.
  - Memo lama tidak terpengaruh; ceklis di dalam toggle tetap masuk Jadwal.
- **Tabel**: kisi yang bisa diketik (tambah/hapus baris & kolom).
  - Penyimpanan: baris `| a | b |` berurutan (format tabel Markdown).

**F3 (besar, butuh migrasi)** — SELESAI (migrasi `0028_memo_halaman_sampah.sql`)
- **Halaman** (sub-halaman): memo di dalam memo, jalur bilah atas menampilkan induknya.
  - Kolom `memo.induk_id`; lingkup & akses ikut induk; butuh hak edit di induk.
  - Blok "Halaman" di menu "/" membuat sub-halaman lalu langsung membukanya; "+" di baris sidebar juga.
  - Teks blok tetap `[[memo:id|Judul]]`; judul tampil diambil terkini, label di teks ikut diganti saat judul berubah.
  - Sidebar berupa pohon (buka/lipat diingat per perangkat); papan memo hanya berisi halaman teratas; sub-halaman tanpa properti.
- **Sampah** (Trash Notion): "Pindahkan ke Sampah" membuang memo beserta sub-halamannya (`dihapus_pada` sama).
  - Menu tersendiri: tab "Sampah" di papan memo + tombol di sidebar. Cari, saring, baca (pita merah), pulihkan, hapus permanen.
  - Hanya yang berhak menghapus yang melihatnya. Tautan bagikan & Jadwal nonaktif selama di Sampah.
  - Lewat 30 hari dihapus permanen oleh cron (tiap jam). Halaman baru yang kosong dibuang langsung (`?kosong=1`).

### Tahap G — Sampul POKEMONKEY 90-an — **DITUNDA (disimpan dulu atas permintaan Anda)**

Bahan yang sudah ada, disimpan untuk nanti:

| Berkas | Isi | Catatan |
|---|---|---|
| `Monyet Pixel Menatap Lembah Jungle.png` | Stage 1-1, ilustrasi 16-bit 2056×765 | Sumber galeri "POKEMONKEY" |
| `sampul resmi.jpg` | Kop resmi PT Energi Batubara Lestari (logo, *grow together develop the future*, pola batik), 650×91 px, 13 KB | Untuk memo resmi. Karena kecil, ditampilkan utuh di latar putih (tidak direntang/dipotong); sebaiknya minta versi lebar ≥1600 px |

Pemilih sampul nanti punya tab **Resmi**, **POKEMONKEY**, **Warna**, **Unggah foto**; pengguna bebas mengganti sampul.

- **G1:** Stage 1-1 *Lembah Jungle* (gambar acuan) diolah ke WebP 1600 px dan dipasang sebagai sampul pertama galeri "POKEMONKEY".
- **G2:** Stage berikutnya ditambahkan begitu gambarnya tersedia (cukup taruh berkas + satu baris daftar: nama stage, cerita, titik fokus).
- Pemilih sampul: tab **POKEMONKEY** (galeri stage + cerita singkat), tab **Warna**, tab **Unggah foto**, tombol **Acak**, **Atur posisi** (geser fokus naik/turun).
- Tampil sama di aplikasi (tanpa sinyal pun) dan di halaman tautan publik.

Selesai bila: sampul tajam di laptop & HP, monyet tidak terpotong, berkas kecil, dan tampil di halaman publik.

### Tahap H — Tampilan database baru di layar Memo

Urutan usulan: **Galeri** → **Dasbor (+ diagram batang)** → **Lini masa** → **Feed**.

- Galeri: kartu besar bersampul + ikon + judul + properti ringkas.
- Dasbor: kotak angka + diagram batang vertikal/horizontal (per status, kategori, penulis); bisa diunduh sebagai gambar seperti tab lain.
- Lini masa: memo bertanggal & tugas bertenggat pada sumbu minggu/bulan.
- Feed: memo terbaru berurutan dengan cuplikan isi.
- Saringan/urutan/cari yang sudah ada berlaku di semua tampilan.

## 5. Urutan pengerjaan yang disarankan

`A → B → D → F1 → C + G → E → H (Galeri, Dasbor) → F2 → H (Lini masa, Feed)`; F3 dan Tampilan peta menjadi rencana terpisah.

## 6. Berkas yang akan disentuh

| Berkas | Tahap | Perubahan |
|---|---|---|
| `components/MemoScreen.tsx` | A, B, C, E, H | Halaman penuh, daftar pribadi, ikon di kartu/tabel, tab tampilan baru |
| `components/PropertiMemo.tsx` | B | Nilai properti "polos → isian saat diketuk" |
| `components/EditorMemo.tsx` | D, F | Ukuran blok, menu `/` berkelompok, blok baru |
| `components/MemoMarkup.tsx` | D, F | Tampilan baca-saja untuk blok baru |
| `server/src/memo-blok.ts` | F | Pengurai Judul 4, toggle, tabel, tautan halaman |
| `components/SampulMemo.tsx` (baru) | C, G | Pemilih & penampil sampul |
| `lib/sampul-pokemonkey.ts` (baru) | G | Daftar stage: kode, nama, cerita, berkas, titik fokus (dipakai aplikasi & server) |
| `public/sampul/*.webp` (baru) | G | Ilustrasi stage (mulai dari Lembah Jungle) |
| `server/src/lihat-memo.ts` | C, F, G | Ikon, sampul, dan blok baru di halaman tautan publik |

Tidak menyentuh: `lib/demo.ts` dan berkas RAB (sedang diubah sesi lain), skema database (kecuali F3 bila disetujui).

## 7. Uji

- Mode demo, layar 1366×800 dan 390×844, tema gelap dan terang.
- Buka memo dari setiap tab; tutup lewat `‹`, jalur, dan tombol kembali.
- Ubah tiap properti → tutup → buka lagi → nilai tetap.
- Tiap blok di menu `/` dicoba: buat, ketik, ubah jenis, pindah, hapus, urungkan.
- Memo lama (berisi `> ` kutipan, ceklis bertenggat) tetap tampil dan tersimpan sama.
- Tanpa sinyal (DevTools *Offline*) → "disimpan di HP" → sinyal kembali → terkirim.
- `npx tsc --noEmit` untuk aplikasi dan `server/`.

## 8. Di luar cakupan rencana ini

- Side peek / center peek sebagai pilihan.
- Sub-halaman & sidebar pohon halaman (F3), Tampilan peta.
- Database di **dalam** isi memo (Notion bisa menyisipkan tabel/papan di halaman; di sini tampilan ada di layar Memo).
- Komentar, riwayat versi, favorit.
- Build APK, commit, deploy (menunggu perintah).

## 9. Perlu keputusan Anda

1. Setuju urutan di §5, atau ingin diubah?
2. Dikerjakan satu tahap per satu dengan tangkapan layar, atau sekaligus?
3. Judul halaman: font piksel (Pixelify) seperti sekarang, atau font biasa agar lebih mirip Notion?
4. Sampul POKEMONKEY:
   - memo baru otomatis mendapat sampul stage acak, atau dibiarkan tanpa sampul sampai dipilih?
   - daftar stage & ceritanya di §2.6 sudah pas, atau ada adegan khas lapangan lain yang ingin ditambah/diganti?
   - gambar stage berikutnya dibuat oleh Anda (dengan *prompt* dari saya), atau dipesan?
   - label `STAGE 1-1 · …` di pojok sampul ditampilkan atau tidak?
5. Pintasan `>`: ikuti Notion (toggle) dengan kutipan pindah ke `"`, atau tetap `>` = kutipan?

---

## Tambahan 2 Okt 2026 — alat menulis lanjutan & AI (sudah dikerjakan, belum dicek di peramban)

**Format sebaris** (server/src/memo-blok.ts): `++garis bawah++`, `{w:merah|teks}` warna teks, `{l:kuning|teks}` stabilo (palet tanpa Coklat, latar boleh Putih — server/src/tampil-memo.ts), `$$x^2$$` rumus sebaris (KaTeX → MathML), `<br>` baris baru di dalam blok (Shift+Enter). Tugas di dalam stabilo tetap terbaca (tenggat & PIC).

**Blok baru**: `!kode{…}` (pewarna sintaks + salin, pintasan ```` ``` ````), `!rumus{…}`, `!daftarisi`, `!kolom` (kolom bersebelahan; di HP bertumpuk), `!penanda{…}` kartu tautan web (judul/keterangan diambil server, IP/nama lokal ditolak), gambar `![…](…){"lebar":50,"rata":"tengah"}` + keterangan yang bisa diketik. Menu `/` grup Lanjutan & Warna (`/merah`, `/latar kuning`), `:emoji`, warna blok dari ⋮⋮, palet di bilah format & bilah alat HP. Semua ikut di mode baca, gambar unduhan, dan halaman bagikan.

**Komentar** (migrasi `0029_memo_komentar.sql`): pada teks terpilih atau halaman, balasan, selesai, ubah/hapus; pembaca "Baca saja" boleh berkomentar.

**Bentrok suntingan**: PATCH isi membawa `dasar_diubah`; server menjawab 409 + isi terbaru bila memo sudah berubah; aplikasi menggabung per baris (lib/gabung-isi.ts, diff3 — baris yang sama diubah keduanya: versi kita) lalu mengirim ulang. Halaman yang terbuka memeriksa perubahan orang lain tiap 20 detik.

**AI memo** (server/src/ai-memo.ts; Tahap 1–2 dari tinjauan AI):
- Hanya lewat server (kunci Gemini di aplikasi dihapus); keluaran JSON terstruktur (`responseSchema`), batas token besar + pesan bila terpotong, model bertingkat (`GEMINI_MODEL_CEPAT` / `GEMINI_MODEL_KUAT`).
- Konteks: hari ini (WITA), tim aktif, PICA terbuka, properti & sub-halaman memo; kamus sintaks POKEMONKEY di prompt; hasil disaring (Markdown → format memo, `@id`/tanggal/`#PICA` tidak sah dilepas).
- Modal: Kembangkan, Rapikan, Ringkas (hanya kolom Ringkasan), Tugas (usulan bisa disunting: centang, teks, tanggal, PIC; tidak dobel; masuk bagian "Tindak lanjut"), Tulis baru. Pratinjau memo sungguhan + perbedaan per baris; "Urungkan" 30 detik.
- Penyunting: tombol AI di bilah format & bilah alat HP untuk teks terpilih (satu/sebagian/beberapa blok); `/ai` "Tulis dengan AI" di posisi kursor; bisa Ctrl+Z.
- Juga diperbaiki: ai.ts memeriksa kunci Gemini untuk semua rute sesudahnya (kunci kosong = /api/lapangan ikut 503).

**Tahap 3 (migrasi `0030_ai_pemakaian.sql`)**:
- *Tanya semua memo* (tombol "Tanya AI" di papan Memo Kerja & sidebar): kata kunci dicari dengan LIKE di memo yang boleh dibaca penanya (memo tim + catatan pribadinya), 8 memo teratas dikutip, AI menjawab HANYA dari kutipan dengan sumber [[memo:id|judul]] (judul dari data, tautan palsu dilepas). Sengaja tanpa FTS5: D1 tidak bisa mengekspor database bertabel virtual.
- *Laporan otomatis* (tab Laporan di Asisten Memo): PICA (terbuka/telat/baru/ditutup), realisasi reklamasi, Smart Nursery, Geotagging untuk 7 hari / bulan ini; angka persis dari data; laporan memuat blok hidup `!grafik{…}` dan `!data{…}`.
- *Batas & catatan pemakaian*: tabel `ai_pemakaian` (fitur, model, token); batas harian `AI_BATAS_HARIAN` (bawaan 60; Admin/SPV ×3, Pemantau ÷3) → 429; Admin/SPV melihat pemakaian tim bulan ini. Tanpa migrasi, AI tetap jalan (tidak tercatat).

**Grafik realisasi reklamasi** (`!grafik{"sumber":"reklamasi","tampil":"tahun|kegiatan|blok|lengkap","dari","sampai"}`; menu `/` → Data lapangan): tampilan sama dengan slide Monkey Point (kartu putih, kotak angka, batang bertumpuk APL + Hutan, batang per kegiatan & per blok); data /api/revegetasi dengan cadangan lokal; ikut di mode baca, gambar unduhan (lib/gambar-memo.ts), dan halaman bagikan (server/src/grafik-memo.ts).

## Pengecekan 3 Okt 2026 (peramban, mode demo)

Lulus dicoba di layar: stabilo, warna teks, garis bawah (Ctrl+U), rumus sebaris (`$$…$$` langsung tampil) & blok rumus, Shift+Enter, blok kode (``` → kode, ganti bahasa SQL, pewarnaan), daftar isi (lompat), 2 kolom, kartu tautan (`/tautan`), lebar 75% & rata kanan gambar, keterangan gambar, komentar pada teks terpilih, penggabungan suntingan dua orang (judul versi kita + paragraf versi orang lain, keduanya tersimpan).

Diperbaiki:
- Blok rumus menampilkan batang gulir putih (isi 37px di kotak 32px) → `overflow-y: hidden` (aplikasi & halaman bagikan).
- Palet warna terpotong di bawah layar → terbuka ke atas bila ruang bawah sempit.
- Bilah format terpotong di tepi kiri/kanan → digeser masuk layar.
- Blok kode/khusus di akhir memo: klik di bawahnya tidak membuat baris baru → area klik bawah 30vh seperti Notion.
- Menu `/`: "/kolom" menaruh Tabel di atas "2 kolom" → hasil diurutkan (label diawali kueri > kata di label > kata kunci).
- Kolom kini **berdampingan juga saat menyunting** (layar ≥640px; di HP bertumpuk); seret blok ke dalam kolom tertentu, seret keluar kolom = ikut tingkat tujuan.
- HP: batang gulir bilah alat disembunyikan; papan memo: tab satu baris yang digeser (MoM disingkat), subjudul disembunyikan, tombol "Baru"/"Tanya AI" tidak terlipat.

Catatan: APK membungkus `dist`, jadi HP baru menampilkan semua ini setelah APK dibuild ulang.
