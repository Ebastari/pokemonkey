# Sistem XP & Nilai Keaktifan (KPI)

Keputusan 9 Oktober 2026:

- **PICA berbobot paling tinggi.**
- **Skor keaktifan terlihat semua anggota.**
- **Membuka aplikasi tetap diberi XP, kecil.**
- **Skor keaktifan dipakai sebagai nilai KPI semester**, sejalan dengan IM kewajiban pelaporan.

Karena menjadi KPI, tiga hal berlaku: XP dihitung **hanya di server**, setiap XP **bisa ditelusuri asalnya**, dan XP dari permainan **tidak ikut dinilai**.

## 1. Tiga angka yang berbeda

| Angka | Arti | Dipakai untuk |
|---|---|---|
| **XP total** | Tabungan seumur akun; tidak pernah turun | Level, evolusi, papan peringkat |
| **Saldo** | XP total − XP yang dibelanjakan | Membeli skin di SHOP |
| **Nilai Keaktifan** | Rata-rata Meter Aktif Harian pada hari kerja (0–100) | KPI semester; "Skor 7 hari" |

Membeli skin hanya mengurangi saldo, sehingga level tidak pernah turun.

## 2. Meter Aktif Harian

Setiap aksi XP termasuk satu **wilayah**. Meter hari itu adalah jumlah bobot wilayah yang tersentuh, yaitu ada minimal satu aksi yang sah:

| Wilayah | Bobot | Contoh aksi |
|---|---|---|
| **Tindak lanjut** | 40 | PICA, FIRE, menyelesaikan tugas JADWAL/MEMO, laporan yang tertaut PICA |
| **Lapor** | 30 | Laporan FEED, foto laporan, melengkapi foto dari LOG |
| **Koordinasi** | 20 | INFO, MEMO, komentar, dokumen, ROSTER, RAB |
| **Hadir** | 10 | Membuka aplikasi pada hari itu |

Wilayah `main` (pisang, Monkey Run), `bonus` (hadiah sekali dan misi tim), dan `warisan` (XP lama) **menambah XP tetapi tidak menyentuh Meter**.

**Peran Admin/Supervisor:** membuat pengumuman, mengajukan RAB, mengisi roster tim, dan membuat dokumen formal dihitung sebagai wilayah **Lapor** (laporan administrasi), sehingga mereka juga bisa mencapai 100%.

## 3. Nilai Keaktifan (KPI)

- **Hari kerja** = tanggal yang di ROSTER berkode kerja, aturan yang sama dengan sistem hati. Libur, cuti, dan izin (`OFF`, `FB`, `IK`, `L`, `C`, `I`) tidak dihitung. Tanggal tanpa isian roster juga tidak dihitung.
- **Nilai Keaktifan** pada satu rentang = rata-rata Meter Aktif Harian pada hari kerja dalam rentang itu, sampai **kemarin**. Hari ini ditampilkan terpisah karena belum selesai.
- **Skor 7 hari** = Nilai Keaktifan 7 hari terakhir. **KPI semester** = Januari–Juni atau Juli–Desember.
- Rincian per wilayah (persentase hari kerja yang tersentuh) ikut ditampilkan, supaya jelas apa yang kurang.
- Tanpa roster pada rentang itu, nilainya ditampilkan **—**, bukan 0.

## 4. Aturan XP

Batas dihitung **per hari WITA**. "Sekali" = satu kali untuk benda itu selama-lamanya.

| Kode | Menu | Aksi | XP | Wilayah | Batas |
|---|---|---|---|---|---|
| `hadir` | KEBUN | Membuka aplikasi | 20 | hadir | 1/hari |
| `pica_buat` | PICA | Mencatat PICA (Admin/SPV) | 80 | tindak | 5/hari |
| `pica_mulai` | PICA | Status → Dikerjakan | 40 | tindak | sekali per PICA |
| `pica_update` | PICA | Catatan perkembangan (≥ 15 huruf) | 120 | tindak | 1×/PICA/hari, 5/hari |
| `pica_bukti` | PICA | Unggah bukti | 80 | tindak | 1×/PICA/hari, 5/hari |
| `pica_ajukan` | PICA | Status → Menunggu Verifikasi | 100 | tindak | sekali per PICA |
| `pica_tutup` | PICA | PICA ditutup (untuk PIC) | 600 | tindak | sekali per PICA |
| `pica_tepat_waktu` | PICA | Ditutup ≤ tenggat (untuk PIC) | 200 | tindak | sekali per PICA |
| `pica_verifikasi` | PICA | Memverifikasi & menutup (SPV/Admin, bukan PIC) | 150 | tindak | sekali per PICA, 5/hari |
| `laporan_kirim` | FEED | Laporan lapangan | 250 | lapor | 3/hari; ke-2 dan ke-3 setengah |
| `laporan_foto` | FEED | Foto laporan di hari yang sama | 100 | lapor | sekali per laporan, 3/hari |
| `laporan_foto_susulan` | LOG | Melengkapi foto laporan lama | 50 | lapor | sekali per laporan, 3/hari |
| `laporan_pagi` | FEED | Laporan sebelum 12.00 WITA | 50 | lapor | 1/hari |
| `laporan_capaian` | FEED | Capaian > 0 | 50 | lapor | 3/hari |
| `laporan_pica` | FEED | Laporan tertaut PICA | 50 | tindak | 3/hari |
| `titik_cek` | FIRE | Memeriksa titik api (ubah status) | 80 | tindak | sekali per titik, 5/hari |
| `titik_pertama` | FIRE | Orang pertama yang memeriksa titik itu | 120 | tindak | sekali per titik |
| `karhutla_laporan` | FIRE | Laporan karhutla tersimpan | 400 | tindak | sekali per laporan |
| `karhutla_kirim` | FIRE | Laporan karhutla dikirim ke WA | 50 | tindak | sekali per laporan |
| `jadwal_buat` | JADWAL | Membuat acara | 15 | koordinasi | 3/hari |
| `jadwal_selesai` | JADWAL | Mencentang acara/tugas, paling lambat di tanggalnya | 40 | tindak | sekali per jadwal, 5/hari |
| `memo_tulis` | MEMO | Memo/catatan berisi ≥ 50 huruf | 40 | koordinasi | 1×/memo/hari, 2/hari |
| `memo_ceklis` | MEMO | Mencentang tugas di memo | 30 | tindak | sekali per tugas, 5/hari |
| `memo_komentar` | MEMO | Menulis komentar | 20 | koordinasi | 5/hari |
| `dokumen_buat` | MEMO | MoM, Internal Memo dinas, nomor surat | 100 | koordinasi* | sekali per dokumen, 2/hari |
| `info_baca` | INFO | Membaca pengumuman ≤ 24 jam (penting: 40) | 20 | koordinasi | sekali per pengumuman |
| `info_buat` | INFO | Membuat pengumuman (Admin/SPV) | 50 | koordinasi* | 2/hari |
| `roster_tim` | ROSTER | Mengisi roster bulan depan sebelum tgl 25 (Admin/SPV) | 200 | koordinasi* | sekali per bulan |
| `rab_ajukan` | MONEY | RAB berstatus Diajukan | 150 | koordinasi* | sekali per RAB |
| `profil_foto` | TEAM | Memasang foto profil | 100 | bonus | sekali |
| `notif_aktif` | NOTIF | Mengaktifkan notifikasi HP | 100 | bonus | sekali |
| `quest_selesai` | QUEST | Misi tim selesai (semua anggota aktif) | 300 | bonus | sekali per misi |
| `pisang` | KEBUN | Mengambil pisang | 10 | main | 15/hari |
| `monkey_run` | GAME | Skor ÷ 4 | ≤ 200 | main | total 200/hari |

\* Untuk Admin/Supervisor dihitung sebagai wilayah **Lapor** (lihat §2).

SHOP tidak memberi XP. Fitur AI juga tidak memberi XP, supaya kuota token tidak terpancing.

## 5. Level

- XP untuk naik dari level L ke L+1 = **1.000 + 200 × (L − 1)**.
- Level tersimpan tidak pernah turun. Bila rumus memberi angka lebih kecil (misalnya untuk XP warisan dari rumus lama), level tetap.

## 6. Data & aturan main

- **Tabel `xp_log`**: satu baris per XP, berisi `user_id`, `sumber`, `ref`, `xp`, `wilayah`, `hari` (WITA), `pada`, dan catatan.
  - `(user_id, sumber, ref)` unik, sehingga satu kejadian tidak bisa dihargai dua kali, termasuk dari antrean luring.
- **`profil_game.xp`** = jumlah `xp_log` yang tidak dibatalkan. **`profil_game.xp_terpakai`** = XP yang dibelanjakan.
- XP lama dipindahkan sekali sebagai `sumber = 'warisan'` (wilayah `warisan`).
- **Aplikasi tidak lagi mengirim angka XP.** `POST /api/profil` mengabaikan `xp` dan `level`. Pisang dan Monkey Run lewat `POST /api/xp/main`, dibatasi server. Skin dibeli lewat `POST /api/xp/beli-skin`, memakai harga di server.
- **Pembatalan:** Admin/Supervisor dapat membatalkan satu baris XP yang tidak sah, dengan alasan. Baris itu tetap tersimpan sebagai jejak, tetapi tidak dihitung lagi di XP maupun Meter.
- **Pemberitahuan:** setiap jawaban API yang memberi XP kepada pemakai yang sedang meminta membawa header `X-XP` (jumlah, total, level, rinciannya). Aplikasi menampilkan "+N XP · sebab".

## 7. API

| Rute | Isi |
|---|---|
| `GET /api/xp/riwayat?hari=30&user=` | Baris XP (milik sendiri; Admin/SPV boleh melihat orang lain) |
| `GET /api/xp/skor` | Untuk semua anggota: level, XP total, XP 7 hari, Meter hari ini, Skor 7 hari, KPI semester beserta rincian wilayah |
| `POST /api/xp/main` | `{ jenis: 'pisang' \| 'monkey_run', nilai }` |
| `POST /api/xp/klaim` | Hadiah sekali yang hanya diketahui HP: `{ sumber: 'notif_aktif' }` |
| `POST /api/xp/beli-skin` | `{ skin }`, memakai saldo |
| `POST /api/xp/batal` | Admin/SPV: `{ id, alasan }` |

## 8. Penyetelan

Angka di §4 adalah usulan awal. Aturan dikunci per semester; perubahan dicatat di berkas ini beserta tanggal berlakunya, supaya nilai KPI dalam satu semester dihitung dengan aturan yang sama.
