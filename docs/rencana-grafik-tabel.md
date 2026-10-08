# Rencana: grafik & tabel memo yang mudah dibaca (8 Okt 2026)

Permintaan: grafik lebih besar, tidak membingungkan, berlaku untuk **semua tabel** (bukan hanya PICA), ikut berubah saat tabel diisi/diimpor, ceklis interaktif tidak salah hitung, teks tabel tidak terpotong, dan grafik **mengikuti tema** (gelap ↔ terang), tidak menjadi kotak putih di layar gelap.

## Masalah yang ditemukan (dicek di peramban, mode demo)

| # | Masalah | Dampak |
|---|---|---|
| 1 | Sel tabel di penyunting berupa isian satu baris | Masalah / Akar Masalah / PIC terpotong |
| 2 | "Belum selesai" dihitung **selesai** (mengandung kata "selesai") | Ringkasan & grafik salah (contoh: Selesai 3, padahal 2) |
| 3 | Baris kosong dari "+ Baris" ikut dihitung | Muncul kategori "(Kosong)" dan total bertambah |
| 4 | Ringkasan atas tabel & grafik memakai aturan kolom status yang berbeda | Angka ringkasan dan grafik bisa tidak sama |
| 5 | Grafik menyimpan nomor kolom; kolom dihapus/disisip/diimpor ulang | Grafik diam-diam menunjuk kolom yang salah |
| 6 | Status PICA: "Continue" & "In Progress" berwarna sama, urutan acak | Irisan/batang tidak bisa dibedakan |
| 7 | Sel status tabel PICA bisa diklik "selesai/belum" | Hanya mengubah teks memo, PICA asli tidak berubah, Live Sync menimpanya |
| 8 | Status selain "Closed" abu gelap di atas abu (tema terang tak terbaca) | Status tidak terbaca |
| 9 | Huruf grafik ±8 px, donat 176 px, label dipotong 9 huruf, angka hanya saat diarahkan tetikus | Sulit dibaca, di HP angka tidak terlihat |
| 10 | Skala sumbu 0,1,2,2,3 (angka kembar); batang bernilai 1 tampak di atas garis "1" | Menyesatkan |
| 11 | Grafik garis dipakai untuk kategori (nama PIC, status) | Menyiratkan tren yang tidak ada |
| 12 | Judul tersimpan "Rekap Status PICA (6 Data)" | Jumlah di judul basi saat data berubah |
| 13 | Grafik tabel tidak ikut di halaman bagikan & gambar unduhan | Tidak "sama persis" dengan memo |

## Langkah

1. **Satu sumber grafik** — `server/src/grafik-tabel.ts`: hitungan + HTML yang sama untuk penyunting, mode baca, halaman bagikan, gambar unduhan. ✅
2. **Tampilan jelas** — kotak angka (total + tiap status, jumlah & persen), batang mendatar dengan nama utuh, angka selalu tertulis, donat 240 px, skala rapi, garis hanya untuk angka berurutan, judul tanpa jumlah basi. ✅
3. **Warna & urutan status = layar PICA** — Open (kuning) → Dikerjakan (biru) → Continue (indigo) → Menunggu Verifikasi (ungu) → Selesai (hijau). ✅
4. **Tabel tidak terpotong** — sel = kotak teks yang tumbuh ke bawah; lebar kolom menurut isi (kolom uraian lebih lebar); Enter = sel di bawah. ✅
5. **Status PICA** — lencana berwarna, tidak bisa diklik (diubah di layar PICA). Tabel biasa: lencana bisa diklik selesai/belum. ✅
6. **Ceklis interaktif** — satu aturan status untuk ringkasan, grafik, dan tombol ceklis; penyangkalan ("belum/tidak") dicek dulu; baris kosong diabaikan; label "[x] Selesai" → "Selesai". Ringkasan progres ikut tema. ✅
7. **Grafik ikut perubahan tabel** — kolom dipetakan ulang menurut nama judul saat kolom dihapus/disisip/impor; impor ke tabel yang sudah bergrafik mempertahankan grafiknya. ✅
8. **Ikut tema** — warna kartu/teks/garis lewat variabel CSS: gelap di mode gelap, terang di mode terang & memo berlatar putih; halaman bagikan gelap; gambar unduhan mengikuti tema gambarnya. ✅
9. **Halaman bagikan & gambar unduhan** — grafik tabel + lencana status ikut tampil. ✅ (tema: langkah 8)
10. **Uji** — PICA, angka (batang & garis), ceklis kumulatif, ceklis biasa, impor, hapus kolom, tema gelap/terang, layar HP 375 px; `tsc` aplikasi & server. ✅ (uji Node 44 cek lulus; peramban: PICA, angka, ceklis, + Baris, hapus kolom, tema gelap/terang/latar putih. Layar HP 375 px belum dicek ulang di peramban.)

Tambahan: modal **Pilih & Sisipkan Tabel PICA** — tombol saring kini berwarna sama dengan status PICA (sebelumnya Open merah, Continue kuning), lencana status baku, nomor & tombol terbaca di tema terang. ✅

Tambahan: **status di tabel PICA → menu PICA** — lencana status bisa diklik dan membuka PICA itu di menu PICA; status hanya bisa diubah/ditutup di sana oleh siapa pun (memo tidak bisa menggantinya). Tabel biasa tetap klik = selesai/belum. ✅

## Dikerjakan 8 Okt (rilis 2.16)

- **Menu "/" → Habit** (lib/habit.ts, components/ModalHabit.tsx): lacak/ubah kebiasaan 7–31 hari. Empat cara: buat langsung, contoh CSV (salin/unduh/pakai), prompt AI (ChatGPT/Gemini), unggah/tempel CSV atau Excel (kolom dicocokkan menurut judul, pemisah koma/titik koma, kumulatif dihitung ulang + peringatan bila berkas berbeda).
- **Grafik progres** (`tipe: 'progres'`): kalimat ringkas, kotak Selesai/Terlewat/Runtunan/Konsistensi/Perkiraan akhir, garis kumulatif vs target, penanda hari ini, pita fase, pita per hari. Tracker ceklis + kumulatif hasil impor otomatis memakai grafik ini.
- **Habit: hari yang belum tiba** tidak bisa dicentang ("Belum waktunya"); centang yang terlanjur ada tidak dihitung (grafik & ringkasan) dan diberi peringatan. Tracker belajar/rencana biasa boleh lebih cepat ("unggul").
- **Mode Lapangan** (tema terang): putih murni + hitam murni, teks redup ≥ ±10:1, isi lebih tebal, huruf 10/11 px naik 1 px, garis bingkai lebih tegas.
- **Kecepatan**: /api/pica?ringkas=1 (tanpa 3 subkueri per baris), cache 30 detik + satu permintaan bersama, mode baca tidak lagi memanggil /api/pica setiap render, JSZip dimuat saat impor saja.

## Usulan (belum dikerjakan)

**Mode Lapangan (terik matahari)**: latar putih murni + teks hitam murni (kontras 21:1; sekarang 14,6:1 untuk teks utama dan 6,5:1 untuk teks redup), teks redup minimal #333, huruf isi tebal 17–18 px (huruf piksel hanya untuk judul), bingkai hitam tebal tanpa transparansi, tanpa blok hitam besar, tombol ≥ 48 px, kecerahan layar otomatis maksimum saat Mode Lapangan (plugin Capacitor, perlu APK baru), opsi otomatis 07.00–17.00 WITA.

**Kurva progres ceklis + kumulatif (hasil impor Excel/CSV)**: garis realisasi kumulatif tebal + garis target lurus putus-putus (0 → total), penanda "hari ini" dengan teks "18 dari 30 selesai · target 20 · tertinggal 2", area selisih hijau/merah, pita status per hari di bawah sumbu (hijau selesai, merah terlambat, abu belum waktunya), pita fase sebagai latar, kotak angka (Selesai, Terlambat, Sisa, Perkiraan selesai). Ceklis 0/1 mentah tidak digambar sebagai garis; kumulatif dihitung dari ceklis dan beda dengan angka di berkas diberi tanda. Butuh: tanggal mulai (atau kolom tanggal) untuk menentukan "hari ini".

## Berikutnya (perlu keputusan)

- Grafik **realisasi reklamasi** (gaya Monkey Point, kartu putih) — ikut tema juga, atau tetap putih seperti slide Monkey Point?
- `lib/yolo-tracker.ts` tidak dipakai di mana pun (kode mati) — boleh dihapus?
