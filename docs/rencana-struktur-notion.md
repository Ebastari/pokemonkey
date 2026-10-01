# Rencana: meniru alur & struktur Notion untuk Memo POKEMONKEY

Status: **draf, menunggu persetujuan**. Belum ada kode yang diubah untuk rencana ini.
Pendamping: [rencana-memo-notion.md](rencana-memo-notion.md) (tampilan halaman, ukuran, menu `/`, sampul — sampul sedang **ditunda**).

Dokumen ini menjawab: *bagaimana alur dan struktur Notion (yang punya database, halaman, blok, dan peralatan di menu `/` dari tangkapan layar Anda) disalin ke dalam aplikasi.* Yang ditiru adalah **model dan alurnya**, bukan kode sumber Notion (tertutup dan bukan milik kita).

---

## 1. Ringkasan singkat

- Notion berpegang pada satu gagasan: **semua adalah blok**. Halaman pun blok, dan database adalah kumpulan halaman yang punya **skema properti** dan beberapa **tampilan**.
- POKEMONKEY sudah punya padanan untuk sebagian besar:
  - satu database (tabel `memo`), skema properti (`opsi`, `properti`, `props`), dan tampilan (tab Ikhtisar/Status/Tabel/Kalender/Tugas);
  - **tetapi** blok masih berupa baris teks tanpa id dan tanpa bersarang, dan tampilan masih ditulis mati di kode.
- Usul: tiru struktur Notion **di lapisan kode** sekarang dengan penyimpanan teks yang diperluas (aman untuk data lama dan tanpa sinyal). Siapkan jalan ke **tabel blok** bila nanti memang perlu.

---

## 2. Cara kerja Notion (hasil belajar)

Sumber: tulisan resmi Notion *The data model behind Notion's flexibility*, dokumentasi API Notion (objek *page* dan *database*), pengukuran halaman Notion publik lewat Chrome DevTools, dan tangkapan layar menu `/` dari Anda.

### 2.1 Blok — satuan terkecil

Setiap blok punya lima atribut:

| Atribut | Arti |
|---|---|
| `id` | Pengenal unik (UUID), juga tampak di alamat halaman |
| `type` | Menentukan cara blok ditampilkan: teks, judul, to-do, toggle, gambar, halaman, … |
| `properties` | Isi blok, mis. `title` = teks kaya (tebal, tautan, sebutan orang/tanggal/halaman) |
| `content` | Daftar id blok anak → membentuk **pohon tampilan** (*render tree*) |
| `parent` | Satu id induk → dipakai untuk **izin akses** (dipisah dari pohon tampilan) |

Akibat penting dari model ini:
- **Ubah jadi (*Turn into*)** hanya mengganti `type`; isi dan anak tetap. Itu sebabnya judul bisa jadi to-do tanpa kehilangan teks.
- **Indentasi bersifat struktural.** Menekan Tab memindah blok ke dalam `content` blok di atasnya. Begitulah toggle dan daftar bersarang bekerja.
- **Halaman = blok bertipe `page`.** Anak-anaknya tampil di halaman tersendiri, sehingga halaman bisa bersarang tanpa batas.

### 2.2 Halaman

Objek halaman (API): `id`, `parent` (database / halaman / workspace), `icon` (emoji/berkas), `cover` (berkas), `properties` (nilai sesuai skema database; di luar database hanya `title`), `created_time`/`last_edited_time`, `created_by`/`last_edited_by`, `in_trash` (sampah), `public_url` (bila dipublikasikan ke web). Isi halaman = **blok anak** yang dibaca/ditambah terpisah.

### 2.3 Database, skema, dan tampilan

- **Database** = wadah berjudul, ber-ikon & sampul, berisi satu atau lebih **sumber data**.
- **Sumber data** = **skema properti** (teks, angka, select, status, orang, tanggal, relasi, rumus, rollup, …) + **baris** yang masing-masing adalah **halaman** (`parent` = database).
- **Tampilan** = cara melihat baris yang sama: jenis (tabel, papan, galeri, daftar, feed, dasbor, kalender, lini masa, peta, diagram), saringan, urutan, kelompok, properti yang ditampilkan, dan cara membuka halaman (*side peek / center peek / full page*). Setiap tampilan menyimpan pengaturannya sendiri.

### 2.4 Alur simpan & sinkron

1. **Klien** membuat operasi (blok baru, ubah isi, pindah urutan), mengumpulkannya menjadi **transaksi**, dan langsung memperbarui tampilan sendiri.
2. **Server** (`/saveTransactions`) memuat blok terkait, menerapkan operasi, memeriksa izin, lalu menyimpan semuanya sekaligus atau menolak semuanya.
3. **Klien lain** diberi tahu lewat WebSocket, lalu mengambil versi terbaru.

### 2.5 Peralatan menu `/` (dari tangkapan layar Anda)

| Kelompok | Isi |
|---|---|
| **Blok dasar** | Teks · Judul 1 `#` · Judul 2 `##` · Judul 3 `###` · Judul 4 `####` · Daftar berpoin `-` · Daftar bernomor `1.` · Daftar tugas `[]` · Toggle daftar `>` · Halaman · Callout · Kutipan `"` · Tabel · Divider `---` · Tautan ke halaman |
| **Media** | Gambar · Video · (dst.) |
| **Database** | Tampilan tabel · papan · galeri · daftar · feed · dasbor · kalender · lini masa · peta · Diagram batang vertikal · horizontal |
| Penutup | "Tutup menu — esc"; pintasan ketik tampil di kolom kanan |

---

## 3. Struktur POKEMONKEY sekarang

| Bagian | Tempat | Keterangan |
|---|---|---|
| Satu "database" memo | Tabel `memo` | Kolom: `id, user_id, lingkup (tim/pribadi), judul, isi, ringkasan, kategori, tipe, status, tanggal, warna, disematkan, pica_id, props, dibuat_pada, diubah_pada` |
| Pilihan select | Tabel `opsi` | Grup `memo_kategori`, `memo_tipe`, `memo_status` (label + warna) |
| Kolom kustom | Tabel `properti` (`entitas = 'memo'`) + `memo.props` (JSON) | Jenis: teks, angka, tanggal, select, checkbox, url, orang |
| Blok isi | `memo.isi` (teks) | Satu baris = satu blok; jenis dibaca dari awalan (`#`, `- [ ]`, `> `, `!! `, `![..](..)`) oleh `server/src/memo-blok.ts` |
| Id blok | Hanya di memori penyunting (`EditorMemo`) | Tidak disimpan |
| Bersarang | Tidak ada | |
| Tampilan | Tab di `components/MemoScreen.tsx` | Ditulis mati: Ikhtisar, Status, Kategori, Tabel, Tugas, Kalender, Pribadi |
| Simpan | `PATCH /api/memo/:id` (seluruh `isi`), jeda 700 ms; antrean di HP bila tanpa sinyal (`lib/memo-simpan.ts`) | Tanpa transaksi per blok; tanpa sinkron langsung |
| Turunan | Ceklis bertenggat → `jadwal` (memo_id); tautan publik → `tautan_bagi` | Dihitung server dari teks |
| Berkas | Tabel `lampiran` + R2 (`memo/<id>/…`) | |
| Hapus | Langsung hilang | Tidak ada Sampah |

---

## 4. Pemetaan Notion → POKEMONKEY

| Notion | POKEMONKEY sekarang | Usul |
|---|---|---|
| Workspace / Teamspace / Private | `lingkup` = `tim` / `pribadi` | Tetap |
| Database | Tabel `memo` (tampil sebagai "Memo Internal") | Tetap satu database |
| Skema properti | Kolom tetap + `opsi` + `properti` | Satu **daftar skema** di kode yang menyatukan kolom tetap & kustom (§6.3) |
| Baris database = halaman | Satu baris `memo` | Tetap |
| Ikon, sampul | — | `props.ikon`, `props.sampul` (tanpa migrasi) |
| Blok (`id`, `type`, `properties`, `content`) | Baris teks di `isi` | **Model blok di kode** (§6.1) dengan id, jenis, isi kaya, dan **anak** |
| Pohon blok (bersarang) | — | Anak = baris menjorok 2 spasi di bawah induknya |
| Ubah jadi | Ada (ganti awalan baris) | Tetap; anak ikut terbawa |
| Halaman di dalam halaman | — | Kolom baru `memo.induk_id` (migrasi) + blok "Halaman" |
| Sebutan @orang / @tanggal / halaman | `@id`, `@2026-10-05` | Tambah `[[memo:<id>\|Judul]]` |
| Tampilan + pengaturannya | Tab tetap | **Daftar definisi tampilan** (§6.4); pengaturan saringan/urutan per tampilan |
| Buka di side/center/full page | Kotak tengah | **Full page** (Tahap A rencana pendamping) |
| Transaksi + sinkron WebSocket | PATCH seluruh isi + antrean HP | Tetap PATCH (3 pengguna internal); transaksi per blok di Opsi B (§5) |
| Sampah (`in_trash`) | Hapus permanen | Kolom `memo.dihapus_pada` + tab **Sampah** (30 hari) |
| Publikasi ke web (`public_url`) | Sudah ada: `tautan_bagi` + `/lihat/memo/<token>` | Tetap |

---

## 5. Keputusan arsitektur utama: cara menyimpan blok

| | **Opsi A — teks diperluas (usul sekarang)** | **Opsi B — tabel blok ala Notion** |
|---|---|---|
| Penyimpanan | Tetap `memo.isi`; bersarang = indentasi 2 spasi; blok baru punya awalan baru | Tabel `memo_blok (id, memo_id, induk_id, urutan, jenis, isi_json, diubah_pada, diubah_oleh)` |
| Simpan | PATCH seluruh isi (sudah berjalan, sudah tahan sinyal hilang) | Transaksi operasi per blok (`/api/memo/:id/transaksi`) |
| Data lama | Langsung terbaca | Perlu migrasi isi → blok |
| Jadwal dari ceklis, poster gambar, ekspor, halaman publik, demo | Tetap jalan, cukup ditambah blok baru | Semua ditulis ulang |
| Dua orang mengedit memo yang sama | Yang terakhir menyimpan menang (seluruh memo) | Per blok, lebih aman |
| Tautan ke blok tertentu, komentar per blok | Sulit | Mudah |
| Ukuran pekerjaan | Kecil–sedang | Besar |

**Usul:** Opsi A sekarang. POKEMONKEY dipakai 3 orang internal dan sering tanpa sinyal di lapangan. Model blok di kode (§6.1) dibuat sama dengan Notion (id, jenis, isi, anak), sehingga bila kelak pindah ke Opsi B yang berubah hanya lapisan simpan, bukan penyunting dan tampilan.

---

## 6. Struktur kode yang diusulkan

### 6.1 Model blok (bersama untuk aplikasi & server)

```ts
// server/src/memo-blok.ts (dipakai aplikasi juga)
interface Blok {
  id: string;            // stabil selama penyuntingan; Opsi B: disimpan
  jenis: JenisBlok;      // 'teks' | 'h1'…'h4' | 'butir' | 'nomor' | 'tugas' | 'toggle' | 'halaman'
                         // | 'callout' | 'kutipan' | 'tabel' | 'divider' | 'tautan_halaman'
                         // | 'gambar' | 'video' | 'berkas'
  isi: string;           // teks kaya inline (tebal, miring, @orang, @tanggal, [[memo:…]])
  atribut?: { selesai?: boolean; ikon?: string; kunci?: string; url?: string; baris?: string[][] };
  anak: Blok[];          // pohon tampilan (toggle, daftar bersarang)
}
uraiPohon(teks): Blok[]      // teks → pohon
rakitTeks(pohon): string     // pohon → teks (bolak-balik tanpa kehilangan)
```

### 6.2 Daftar jenis blok (satu sumber untuk semua peralatan)

Seperti Notion (*type menentukan cara tampil*), setiap jenis didaftarkan **sekali**. Menu `/`, "Ubah jadi", bilah alat HP, penampil baca-saja, halaman publik, poster, dan ekspor semuanya membaca dari daftar ini.

```ts
// lib/blok/jenis.ts
interface DefinisiBlok {
  jenis: JenisBlok;
  label: string;          // 'Daftar tugas'
  grup: 'Blok dasar' | 'Media' | 'Sisipkan';
  pintasan?: string;      // '[]' — tampil di kolom kanan menu "/"
  ikon: Ikon;
  kata: string[];         // kata kunci pencarian menu "/"
  bisaAnak: boolean;      // toggle, daftar → boleh punya anak
  bisaUbahJadi: boolean;  // muncul di "Ubah jadi"
  awalan: string;         // cara disimpan di teks (Opsi A)
}
```

| Jenis (menu Anda) | Pintasan | Disimpan sebagai (Opsi A) | Anak? |
|---|---|---|---|
| Teks | — | `teks` | Ya (bersarang) |
| Judul 1–4 | `#`…`####` | `# `…`#### ` | Tidak |
| Daftar berpoin | `-` | `- ` | Ya |
| Daftar bernomor | `1.` | `1. ` | Ya |
| Daftar tugas | `[]` | `- [ ] ` / `- [x] ` | Ya |
| Toggle daftar | `>` | `>> ` | Ya (disembunyikan sampai dibuka) |
| Halaman | — | `[[halaman:<id>\|Judul]]` (satu baris) | Isinya di memo anak (`induk_id`) |
| Callout | — | `!! ` atau `!!💡 ` (ikon emoji) | Ya |
| Kutipan | `"` | `> ` (sama dengan sekarang) | Tidak |
| Tabel | — | baris `\| a \| b \|` berurutan | Tidak |
| Divider | `---` | `---` | Tidak |
| Tautan ke halaman | — | `[[memo:<id>\|Judul]]` | Tidak |
| Gambar | — | `![nama](kunci)` | Tidak |
| Video | — | `[▶ judul](https://…)` satu baris | Tidak |
| Berkas | — | `[nama](memo/…)` | Tidak |
| Tampilan tabel/papan/… | — | **Bukan blok** — tampilan database (§6.4) | — |

### 6.3 Daftar skema properti (padanan *data source* Notion)

```ts
// lib/database/skema.ts
interface Kolom {
  id: string;              // 'kategori' (kolom tetap) atau 'm_lokasi' (kustom)
  label: string;
  jenis: 'judul' | 'teks' | 'angka' | 'tanggal' | 'select' | 'status' | 'orang' | 'centang' | 'url' | 'pica' | 'tugas' | 'dibuat' | 'diubah' | 'penulis';
  opsi?: Opsi[];           // dari tabel opsi / properti.opsi_json
  baca(m: Memo): unknown;  // ambil nilai dari kolom tetap atau props
  tulis?(nilai): Patch;    // patch PATCH /api/memo/:id
  tetap: boolean;          // kolom bawaan tidak bisa dihapus
}
```

Halaman memo, tampilan Tabel, saringan, urutan, ekspor Excel, dan halaman publik membaca daftar yang sama. Kolom kustom baru langsung muncul di semuanya.

### 6.4 Daftar tampilan (padanan *view* Notion)

```ts
// lib/database/tampilan.ts
interface Tampilan {
  id: string;                       // 'ikhtisar', 'galeri', …
  jenis: 'papan' | 'tabel' | 'daftar' | 'kalender' | 'galeri' | 'feed' | 'lini_masa' | 'dasbor';
  label: string; ikon: Ikon;
  kelompokkan?: string;             // id kolom (papan: kategori / status)
  saring?: Saringan[]; urut?: Urutan[];
  kolomTampil?: string[];           // properti yang tampil di kartu/tabel
  bukaDi: 'penuh';                  // sesuai permintaan: halaman penuh
}
```

- Tab di layar Memo **dibangkitkan dari daftar ini**. Tab Ikhtisar/Status/Kategori/Tabel/Kalender/Tugas menjadi definisi; Galeri, Feed, Lini masa, Dasbor (+ diagram batang) ditambahkan.
- Saringan/urutan per tampilan disimpan **per perangkat** dulu. Bila ingin tampilan bersama satu tim, kelak bisa pindah ke tabel `memo_tampilan`.

### 6.5 Berkas yang berubah

| Berkas | Isi |
|---|---|
| `server/src/memo-blok.ts` | Model pohon (§6.1), pengurai jenis baru; Jadwal tetap membaca ceklis di semua tingkat |
| `lib/blok/jenis.ts` (baru) | Daftar jenis blok (§6.2) |
| `lib/database/skema.ts` (baru) | Daftar skema properti (§6.3) |
| `lib/database/tampilan.ts` (baru) | Daftar tampilan (§6.4) |
| `components/EditorMemo.tsx` | Membaca §6.2; Tab/Shift+Tab = bersarang; blok toggle/tabel/halaman |
| `components/MemoMarkup.tsx`, `server/src/lihat-memo.ts` | Penampil pohon blok |
| `components/MemoScreen.tsx` | Tab dari §6.4; halaman penuh membaca §6.3 |
| `components/tampilan/*` (baru) | Galeri, Feed, LiniMasa, Dasbor |
| `server/migrations/0028_*.sql` (baru, hanya bila disetujui) | `memo.induk_id`, `memo.dihapus_pada` |

Tidak disentuh: `lib/demo.ts` & berkas RAB (sedang diubah sesi lain) kecuali dikoordinasikan.

---

## 7. Alur yang ditiru (langkah pengguna → yang terjadi di kode)

1. **Buka Memo** → layar membaca daftar tampilan (§6.4) → tab tampil → tampilan aktif menyaring/mengurutkan/mengelompokkan baris `memo` memakai skema (§6.3).
2. **Klik kartu/baris** → halaman penuh terbuka (riwayat peramban bertambah satu langkah) → kepala halaman: ikon, sampul, judul, properti dari skema → isi: teks `isi` diurai jadi pohon blok (§6.1).
3. **Ketik `/`** → menu berkelompok dari daftar jenis (§6.2) dengan pintasan di kanan → pilih → blok diubah jenisnya (*Turn into*) atau blok baru disisipkan.
4. **Tab / Shift+Tab** → blok masuk/keluar dari anak blok di atasnya (pohon berubah, seperti Notion).
5. **Setiap perubahan** → pohon dirakit kembali jadi teks → disimpan setelah jeda 700 ms (atau diantrekan di HP bila tanpa sinyal) → server menyimpan, memperbarui Jadwal dari ceklis bertenggat, dan halaman tautan publik ikut terbaru.
6. **Kembali** (tombol HP/peramban/`‹`) → simpan terakhir → kembali ke tampilan semula.
7. **Hapus** → masuk Sampah (bila §4 disetujui) → bisa dipulihkan 30 hari.

---

## 8. Tahapan

| Tahap | Isi | Terlihat oleh pengguna? |
|---|---|---|
| S1 | Daftar jenis blok (§6.2) + menu `/` berkelompok dengan pintasan & "Tutup menu — esc"; Judul 4, Tautan ke halaman, Video | Ya (menu `/`) |
| S2 | Model pohon + bersarang: Tab/Shift+Tab, **Toggle daftar**, daftar bersarang | Ya |
| S3 | **Tabel** (kisi yang bisa diketik) | Ya |
| S4 | Daftar skema properti (§6.3) dipakai halaman, Tabel, ekspor | Sedikit (urutan & kolom konsisten) |
| S5 | Daftar tampilan (§6.4) + **Galeri**, **Dasbor + diagram batang**, **Lini masa**, **Feed** | Ya |
| S6 | (butuh migrasi) **Halaman** di dalam halaman + **Sampah** | Ya |
| S7 | (opsional, nanti) Opsi B: tabel blok + transaksi | Tidak (di balik layar) |

Tahapan halaman penuh, properti ala Notion, ukuran isi, dan catatan pribadi ada di rencana pendamping (Tahap A, B, D, E). Usul gabungan: **A → B → D → S1 → S2 → S4 → S5 → S3 → E → S6**.

Uji tiap tahap: mode demo di 1366×800 dan 390×844; memo lama tetap terbaca & tersimpan sama; ceklis bertenggat tetap masuk Jadwal (juga yang di dalam toggle); `npx tsc --noEmit` aplikasi & server.

---

## 9. Risiko

- **Bolak-balik teks ↔ pohon harus tanpa kehilangan.** Dijaga dengan uji: setiap memo contoh diurai lalu dirakit kembali dan hasilnya harus sama persis.
- **Indentasi 2 spasi** bisa bentrok dengan teks lama yang kebetulan diawali spasi. Diatasi dengan hanya menganggap baris menjorok sebagai anak bila baris di atasnya boleh punya anak.
- **Dua orang mengedit memo yang sama** tetap "yang terakhir menang" pada Opsi A; diberi peringatan "memo ini baru diubah X" saat dibuka.
- `lib/demo.ts` sedang diubah sesi lain; perubahan mode demo dikoordinasikan.

---

## 10. Perlu keputusan Anda

1. **Opsi A** (teks diperluas, usul) atau **Opsi B** (tabel blok ala Notion) untuk penyimpanan blok?
2. Setuju urutan gabungan di §8?
3. Perlu **Sampah** dan **Halaman di dalam halaman** (dua-duanya butuh migrasi `0028`)?
4. Tampilan baru mana yang dipakai: Galeri, Dasbor + diagram batang, Lini masa, Feed? (Peta ditunda karena memo belum punya lokasi.)
5. Pengaturan saringan/urutan tampilan cukup **per perangkat**, atau harus **sama untuk satu tim**?
