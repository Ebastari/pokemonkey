-- ============================================================
-- POKEMONKEY · Halaman latihan "Panduan Memo — fitur baru & fitur lama"
-- Memo tim tersemat yang memamerkan semua fitur Memo dengan contoh hidup:
-- Bagian A = fitur baru putaran 2 (docs/rencana-skin-team-memo.md),
-- Bagian B = fitur yang sudah ada sebelumnya.
-- Penulisnya Admin aktif pertama. Jalankan setelah 0032_memo_surat_prestasi.sql.
-- Isi sama dengan lib/memo-panduan.ts (mode demo).
-- ============================================================

INSERT OR IGNORE INTO memo (id, user_id, lingkup, judul, isi, ringkasan, kategori, tipe, status, tanggal, disematkan, warna, pica_id, props, akses, induk_id, dibuat_pada)
SELECT 'memo_panduan_putaran2', t.id, 'tim', 'Panduan Memo — fitur baru & fitur lama', replace('!! Halaman ini contoh hidup: semua yang Anda lihat dibuat dengan Memo. **Bagian A** = fitur baru, **Bagian B** = fitur yang sudah ada sebelumnya. Silakan ketuk, centang, ubah angka, dan isi — ini halaman latihan tim.
!daftarisi
# Bagian A — Yang baru (Oktober 2026)
## A1. Halaman baru yang bersih
Halaman baru kini hanya berisi **judul** dan **isi**, seperti Notion. Status, kategori, tanggal, PICA, dan ringkasan muncul **hanya bila diisi**.
- Ketik **/properti** di baris kosong, atau ketuk **+ Tambah properti** di bawah judul.
- Properti yang dikosongkan hilang lagi dari tampilan.
>> Kapan dipakai di pekerjaan?
  Memo rapat cepat cukup judul + isi. Memo yang perlu dilacak (mis. perbaikan genset) baru diberi properti **Status** dan **PICA**.
## A2. Sematkan memo penting 📌
Ikon paku di kepala halaman membuat memo **selalu di atas** daftar halaman dan papan memo.
!kolom
  ### Untuk saya
  Hanya Anda yang melihatnya di atas (paku hijau).
!kolom
  ### Untuk semua
  Pembuat, Admin, dan Supervisor bisa menyematkan untuk seluruh tim (paku merah) — cocok untuk SOP atau aturan tetap.
## A3. Dilihat oleh & Suka
Tombol **mata** 👁 menunjukkan siapa yang sudah membuka memo dan kapan terakhir. Tombol **hati** ❤ untuk menyukai. Komentar tetap di ikon gelembung.
- [ ] Coba ketuk ❤ di kepala halaman ini
- [ ] Ketuk 👁 untuk melihat siapa saja yang sudah membaca
## A4. Tabel: ceklis di setiap kolom & kalkulator
Setiap judul kolom punya tombol ⚙ untuk memilih **tipe kolom**: Teks, Angka, Rupiah, Persen, **Ceklis**, Tanggal, atau **Rumus ƒx**. Di bawah tabel ada **baris hitung**: jumlah, rata-rata, terkecil, terbesar, % dicentang. Tombol **+ Kolom ☑** langsung menambah kolom ceklis.
!tabel{"kepala":true,"baris":[["Blok","Ditanam","Mati","Hidup","Persen hidup","Status","Disulam","Dicek SPV"],["Blok A","1.200","60","1.140","95","Baik","✓","✓"],["Blok B","800","240","560","70","Sulam","","✓"],["Blok C","1.000","150","850","85","Baik","✓",""]],"kolom":[null,{"t":"angka"},{"t":"angka"},{"t":"rumus","rumus":"[Ditanam] - [Mati]"},{"t":"rumus","rumus":"bulat([Hidup] / [Ditanam] * 100, 1)"},{"t":"rumus","rumus":"jika([Persen hidup] >= 80, \"Baik\", \"Sulam\")"},{"t":"ceklis"},{"t":"ceklis"}],"hitung":[null,"jumlah","jumlah","jumlah","rata",null,"persen_centang","persen_centang"]}
!! Rumus memakai nama kolom: `[Ditanam] - [Mati]`, `bulat([Hidup] / [Ditanam] * 100, 1)`, `jika([Persen hidup] >= 80, "Baik", "Sulam")`. Coba ubah angka **Mati** — kolom Hidup, Persen hidup, dan Status ikut berubah sendiri.
## A5. Formulir di dalam memo 📋
Ketik **/formulir** untuk membuat formulir. Jawaban terkumpul rapi di tab **Jawaban** lengkap dengan jumlah dan rata-ratanya.
- **Hanya anggota**: diisi dari aplikasi (bisa dibatasi satu jawaban per orang).
- **Terbuka lewat tautan**: siapa saja — mis. vendor — bisa mengisi tanpa akun; pengisi tidak bisa melihat jawaban orang lain.
!formulir{"id":"frm_panduan_putaran2","judul":"Latihan: laporan tanam harian"}
>> Ide pemakaian
  - Ceklis APD pagi sebelum ke lapangan
  - Laporan realisasi harian vendor
  - Pendataan bibit masuk persemaian
## A6. Dokumen dibaca tanpa unduh 📎
Ketuk berkas PDF, Word, Excel, PowerPoint, atau CSV di memo: dokumen terbuka layar penuh di aplikasi, bisa diperbesar, **tanpa mengunduh dulu**.
## A7. Folder Dokumen 🗂
Di daftar halaman (kiri), tepat di atas **Sampah · 30 hari**, kini ada pohon folder seperti penjelajah berkas: buka-lipat bertingkat, misalnya Laporan Triwulan › 2026 › TW 3.
- **Awan PT EBL** — folder tim: semua anggota bisa membaca dan mengunggah; Admin/Supervisor mengatur folder.
- **Pribadi** — hanya Anda yang bisa melihat.
- Khusus dokumen (PDF, Word, Excel, PowerPoint, CSV, TXT, maks. 25 MB). Foto & video tetap disimpan di memo.
## A8. Memo Rahasia 🔒
Untuk hal yang tidak boleh dilihat orang lain — misalnya **rencana anggaran tahun depan** untuk satu rekan.
- Hanya Anda dan orang yang Anda tuju; **semua yang dituju bisa menyunting**.
- Admin/Supervisor pun **tidak** bisa melihat bila tidak dituju.
- Tidak bisa dibagikan lewat tautan, tidak diproses AI, tidak bisa diunduh atau diekspor.
- Tangkapan layar diblokir di aplikasi HP, ada watermark nama pembaca, dan isinya **disandikan** di server.
## A9. Mode Word & ekspor ke Word 📝
Menu **⋯ → Mode Word** menampilkan halaman seperti lembar A4 di Microsoft Word. Menu **⋯ → Ekspor ke Word (.docx)** menghasilkan dokumen Word berisi judul, daftar, ceklis, tabel (dengan baris hitung), dan gambar — siap disunting atau dicetak.
## A10. Kotak Surat ✉
Kotak surat di **KEBUN** (dan amplop di kepala layar) berisi:
- **Pesan** antar anggota seperti email: subjek, isi, lampiran, tautan ke PICA/memo, dan balasan berutas.
- **Minta progres**: TEAM → pilih anggota → *Minta progres* → pilih PICA. Begitu ia menulis update PICA, progresnya otomatis masuk ke Kotak Surat Anda.
- **Kirim progres saya**: ringkasan kerja hari ini (laporan & update PICA) disusun otomatis untuk atasan.
- **Pemberitahuan sistem**: PICA baru untuk Anda, perubahan status, memo rahasia, dan prestasi.
## A11. Skin, foto profil, dan prestasi 🏆
- Ketuk skin di **SHOP** untuk melihatnya besar, lengkap dengan **sejarah** dan **filosofi**-nya.
- Skin yang dipakai menjadi **foto profil bawaan** di TEAM; foto sendiri tetap boleh dipasang.
- **Skin Prestasi** (Mitis) tidak dijual: *First Responder*, *Pemburu PICA*, *Penyelamat Tim*, *Fotografer Lapangan* — terbuka sendiri dari kerja nyata.
---
# Bagian B — Fitur yang sudah ada sebelumnya
!! Semua di bawah ini sudah bisa dipakai sejak versi sebelumnya — di sini lengkap dengan contoh nyatanya.
## B1. Menulis cepat dengan "/"
Ketik **/** di baris kosong untuk memilih blok. Pintasan langsung: `#` judul · `-` butir · `1.` nomor · `[]` tugas · `>` toggle · `"` kutipan · `---` garis.
### Judul 3
#### Judul 4
- Daftar berpoin
  - Anak butir (tekan Tab untuk menjorok)
1. Daftar bernomor
2. Nomor berikutnya otomatis
>> Toggle: ketuk panahnya untuk membuka
  Isi toggle tersembunyi sampai dibuka — cocok untuk rincian panjang seperti kronologi kejadian.
!! Callout: catatan yang menonjol, mis. peringatan K3 sebelum masuk area tambang.
> Kutipan: "Menanam itu sehari; menjaga itu bertahun-tahun."
---
## B2. Format teks & warna
**Tebal**, *miring*, ~~coret~~, ++garis bawah++, `kode sebaris`, dan [tautan web](https://www.menlhk.go.id).
Warna teks: {w:merah|merah} · {w:oranye|oranye} · {w:hijau|hijau} · {w:biru|biru} · {w:ungu|ungu}. Stabilo: {l:kuning|kuning} · {l:hijau|hijau} · {l:biru|biru} · {l:pink|merah muda}.
Emoji: ketik `:` lalu namanya — 🌱 🌳 🦺 🔥 💧
Rumus sebaris di dalam kalimat: luas lingkaran $$\pi r^2$$.
## B3. Tanggal, orang, PICA, dan halaman
Rapat evaluasi tanam @2026-10-24 09:00 — ketik **@** lalu pilih tanggal.
Penanggung jawab: @{ADMIN} — ketik **@** lalu nama anggota.
- [x] Contoh tugas yang sudah selesai
- [ ] Tugas yang diberi tanggal & orang (mis. `@2026-10-20 @nama`) otomatis masuk **Jadwal** dan alarm HP orang itu
!! Ketik **#PICA-…** untuk menautkan PICA, **/tautan ke halaman** untuk menautkan memo lain, dan **/halaman** untuk membuat sub-halaman.
## B4. Tata letak kolom
!kolom
  ### 🌱 Persemaian
  Stok bibit, mutasi, dan kematian harian.
!kolom
  ### 🌳 Penanaman
  Luas tanam, sulam, dan persen hidup.
!kolom
  ### 🔥 Karhutla
  Titik api, patroli, dan laporan.
## B5. Kode & rumus
!kode{"bahasa":"js","isi":"// Hitung persen hidup bibit\nconst ditanam = 1200;\nconst mati = 60;\nconst persenHidup = ((ditanam - mati) / ditanam) * 100; // 95"}
!rumus{"isi":"\\text{Persen hidup} = \\frac{\\text{Ditanam} - \\text{Mati}}{\\text{Ditanam}} \\times 100\\%"}
## B6. Tabel + grafik otomatis
Tabel berisi angka bisa langsung dijadikan grafik lewat tombol **Buat Grafik**; grafiknya ikut berubah saat angka diubah.
!tabel{"kepala":true,"baris":[["Bulan","Target (ha)","Realisasi (ha)"],["Juli","10","8"],["Agustus","12","12,5"],["September","15","13"],["Oktober","15","9"]],"grafik":{"aktif":true,"tipe":"batang","sumbuX":0,"seriY":[1,2],"mode":"nilai","judul":"Target vs realisasi tanam"}}
## B7. Tabel PICA langsung tersambung
Lewat **/Tabel PICA**: daftar PICA terbuka selalu terbaru (**Live Sync**), atau **Tetapkan** untuk membekukannya sebagai arsip rapat.
!tabel{"kepala":true,"baris":[["No","Masalah","PIC","Status","Tenggat"]],"pica":{"aktif":true,"mode":"filter","filterStatus":"open"}}
## B8. Grafik reklamasi & data lapangan
!grafik{"sumber":"reklamasi","tampil":"tahun"}
!! Blok **/Smart Nursery** dan **/Geotagging** menampilkan stok bibit dan sensus pohon langsung dari data lapangan.
## B9. Media
!penanda{"url":"https://www.menlhk.go.id","judul":"Kementerian Lingkungan Hidup dan Kehutanan","ket":"Contoh kartu tautan web (bookmark) — ketik /tautan web lalu tempel alamatnya.","situs":"menlhk.go.id"}
- **/gambar** — foto dari kamera atau galeri (bisa diatur lebar & perataannya).
- **/video** — tautan YouTube atau Drive tampil sebagai kartu video.
- **/berkas** — PDF, Excel, Word; kini bisa dibaca tanpa unduh.
- **/habit** — pelacak kebiasaan 1 bulan lengkap dengan grafik progres.
- **/impor Excel / CSV** — data dari Excel langsung jadi tabel (atau tempel saja dari Excel).
## B10. Di menu & kepala halaman
!tabel{"kepala":true,"baris":[["Fitur","Di mana","Gunanya di pekerjaan","Sudah dicoba"],["Tanya AI","Daftar halaman → Tanya AI","Cari jawaban dari semua memo, mis. \"kapan servis genset terakhir?\"",""],["Asisten AI","Kepala halaman","Rapikan tulisan, ringkas, jadikan ceklis/tabel, susun notulen",""],["Komentar","Pilih teks → Komentar","Diskusi pada kalimat tertentu tanpa mengubah isi memo",""],["Bagikan tautan","Kepala halaman → Bagikan","Tautan baca-saja untuk orang di luar aplikasi",""],["Akses edit / baca","Bagikan → Akses anggota","Atur apakah anggota lain boleh menyunting",""],["Unduh gambar","Ikon gambar di kepala halaman","Poster memo rapi untuk dikirim ke WhatsApp",""],["Ikon & sampul","Arahkan ke atas judul","Halaman mudah dikenali di daftar",""],["Huruf & latar","⋯ → Gaya huruf / Latar","Latar putih, gelap, atau mode lapangan (anti silau)",""],["Lebar penuh & teks kecil","⋯ → Tampilan halaman","Tabel lebar lebih lega dibaca",""],["Sub-halaman","Ketik /halaman","Memo bertingkat: induk → rincian per blok/bulan",""],["Sampah 30 hari","Daftar halaman → Sampah","Memo yang terhapus bisa dipulihkan",""],["Papan Memo Kerja","Menu MEMO","Kartu per kategori, saring, urutkan, ekspor Excel",""],["Internal Memo, MoM, Nomor Surat","Tab di papan memo","Dokumen formal & penomoran surat resmi",""],["Simpan otomatis","Otomatis","Ketikan tersimpan di HP saat tanpa sinyal, dikirim saat online",""]],"kolom":[null,null,null,{"t":"ceklis"}],"hitung":[null,null,null,"persen_centang"]}
---
## Latihan singkat
- [ ] Ketik /properti lalu tambahkan **Status**
- [ ] Ubah angka di tabel tanam dan lihat kolom rumus berubah
- [ ] Isi formulir latihan di atas
- [ ] Buka Folder Dokumen di daftar halaman kiri
- [ ] Kirim satu pesan percobaan ke rekan lewat Kotak Surat
- [ ] Centang kolom "Sudah dicoba" di tabel B10 untuk setiap fitur yang sudah Anda coba', '{ADMIN}', t.id),
       'Semua fitur Memo dengan contoh nyata: yang baru (halaman bersih, sematan, tabel ceklis & rumus, formulir, Folder Dokumen, Memo Rahasia, Mode Word, Kotak Surat, Skin Prestasi) dan yang sudah ada sebelumnya.',
       NULL, NULL, NULL, strftime('%Y-%m-%d', 'now', '+8 hours'), 1, NULL, NULL, '{"ikon": "✨", "versi_panduan": 2}', 'edit', NULL, strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
  FROM tim t WHERE t.peran = 'admin' AND t.aktif = 1 ORDER BY t.rowid LIMIT 1;

INSERT OR IGNORE INTO formulir (id, memo_id, judul, ket, skema, mode, token, sekali, tutup_pada, dibuat_oleh, dibuat_pada)
SELECT 'frm_panduan_putaran2', m.id, 'Latihan: laporan tanam harian', 'Formulir latihan — isi bebas untuk mencoba.', '[{"id":"nama","label":"Nama","jenis":"teks","wajib":true},{"id":"blok","label":"Blok","jenis":"pilihan","opsi":["Blok A","Blok B","Blok C"]},{"id":"tanam","label":"Bibit ditanam (batang)","jenis":"angka"},{"id":"apd","label":"APD lengkap","jenis":"ceklis"},{"id":"catatan","label":"Catatan lapangan","jenis":"paragraf"}]', 'anggota', NULL, 0, NULL, m.user_id, m.dibuat_pada
  FROM memo m WHERE m.id = 'memo_panduan_putaran2';
