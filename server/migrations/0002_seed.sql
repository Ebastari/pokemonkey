-- ============================================================
-- POKEMONKEY · Data awal
-- Sumber: tabel PICA periode 31 Agustus - 4 September 2026
-- (LAPORAN KINERJA REV DAS WEEKLY 05-09-26.pptx)
-- Teks disalin apa adanya dari laporan, termasuk ejaan aslinya.
-- ============================================================

-- ---------- Pilihan dropdown (bisa ditambah kapan saja lewat aplikasi) ----------

INSERT INTO opsi (grup, nilai, label, warna, urutan) VALUES
  ('bidang','Revegetasi','Revegetasi','emerald',1),
  ('bidang','Nursery','Nursery','cyan',2),
  ('bidang','Administrasi','Administrasi','zinc',3),
  ('bidang','Pemantauan titik Api Sipongi','Pemantauan Titik Api','orange',4),

  ('prioritas','Tinggi','Tinggi','red',1),
  ('prioritas','Sedang','Sedang','amber',2),
  ('prioritas','Rendah','Rendah','zinc',3),

  ('status','Open','Open','amber',1),
  ('status','In Progress','Dikerjakan','blue',2),
  ('status','Continue','Continue','indigo',3),
  ('status','Verifikasi','Menunggu Verifikasi','purple',4),
  ('status','Closed','Selesai','emerald',5),

  ('satuan','batang','batang','zinc',1),
  ('satuan','Ha','Ha','zinc',2),
  ('satuan','%','%','zinc',3),
  ('satuan','berkas','berkas','zinc',4);

-- ---------- Kolom tambahan (contoh; tambah sendiri lewat aplikasi) ----------

INSERT INTO properti (id, label, tipe, urutan, tampil_di_tabel) VALUES
  ('blok',        'Blok reklamasi', 'teks',   1, 1),
  ('jenis',       'Jenis tanaman',  'teks',   2, 1),
  ('luas_ha',     'Luas (Ha)',      'angka',  3, 0),
  ('no_surat',    'Nomor surat',    'teks',   4, 0);

-- ---------- Tim ----------
-- Nomor WA sengaja dikosongkan: isi lewat menu Tim agar tidak ada
-- pengingat yang salah alamat. Password diatur saat login pertama.

INSERT INTO tim (id, nama, jabatan, bidang, wa, peran, password_hash) VALUES
  ('mariano','Mariano A. Simamora', NULL, 'Revegetasi', NULL, 'supervisor', NULL),
  ('daniel', 'Daniel',              NULL, 'Nursery',    NULL, 'anggota',    NULL),
  ('agung',  'Agung Laksono',       NULL, 'Revegetasi', NULL, 'admin',      NULL);

-- ---------- Periode rapat ----------

INSERT INTO periode (id, mulai, selesai, judul, sumber, terkunci) VALUES
  ('26W36','2026-08-31','2026-09-04','Weekly Rev DAS 31 Agt - 4 Sep 2026',
   'LAPORAN KINERJA REV DAS WEEKLY 05-09-26.pptx', 0);

-- ---------- 10 baris PICA ----------

INSERT INTO pica (id, nomor, periode_id, bidang, prioritas, judul, akar, tindakan,
                  pic_id, due_date, status, terkait_id, target, realisasi, satuan,
                  props, dibuat_oleh, dibuat_pada) VALUES

('PICA-26W36-01', 1, '26W36', 'Revegetasi', 'Tinggi',
 'Target tanam MT Okt-Des 2026 dipangkas dari 47.120 batang (75,39 Ha) menjadi 19.125 batang (30,6 Ha). Area final OPD Blok III hanya 4 blok: 18,01 + 2,39 + 7,62 + 2,58 Ha.',
 'Ketersediaan lahan siap tanam tidak cukup (tertulis di slide 3).',
 'Minta jadwal pelepasan lahan tertulis dari Mine Plan/Engineering; usulkan area alternatif; ajukan revisi target resmi agar sisa 27.995 batang tidak hangus tanpa catatan.',
 'mariano', '2026-09-30', 'Open', NULL, 47120, 19125, 'batang',
 json_object('blok','OPD Blok III','luas_ha',30.6), 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-02', 2, '26W36', 'Nursery', 'Tinggi',
 'Nangka baru 27% - realisasi 7.013 dari target 26.250 batang, kekurangan 19.237 batang. Deviasi T1 mencapai -97%.',
 'Nangka tidak ada sama sekali di 10 jenis stok persemaian (Smart Nursery per 04-09-2026).',
 'Tetapkan sumber bibit nangka (semai sendiri atau beli). Bila tidak layak, ajukan substitusi jenis secara formal - jangan dibiarkan menggantung.',
 'daniel', '2026-09-19', 'Open', NULL, 26250, 7013, 'batang',
 json_object('jenis','Nangka'), 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-03', 3, '26W36', 'Revegetasi', 'Tinggi',
 'Sengon potting baru 55% - realisasi 34.312 dari 62.195 batang, kekurangan 27.883 batang. Deviasi T2 (-54%) lebih dalam daripada T1 (-34%).',
 'Terkait ketersediaan lahan (PICA no. 1); perlu konfirmasi apakah murni lahan atau juga kapasitas tanam.',
 'Pisahkan kekurangan akibat lahan dan akibat pasokan bibit/tenaga tanam, tampilkan terpisah di laporan minggu depan.',
 'agung', '2026-09-12', 'Open', 'PICA-26W36-01', 62195, 34312, 'batang',
 json_object('jenis','Sengon'), 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-04', 4, '26W36', 'Revegetasi', 'Tinggi',
 'LCC baru 11% - realisasi 10,95 dari 100 Ha, kekurangan 89,05 Ha. Realisasi T2 -100% (tidak ada penanaman sama sekali).',
 'Belum dikonfirmasi: benih, alat tabur, atau kesiapan lahan.',
 'Tetapkan rencana tabur LCC per blok reklamasi berikut kebutuhan benihnya. LCC penutup tanah menahan erosi, tidak bisa digeser ke 2027.',
 'agung', '2026-09-30', 'Open', NULL, 100, 10.95, 'Ha',
 json_object('jenis','LCC'), 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-05', 5, '26W36', 'Revegetasi', 'Sedang',
 'Persentase hidup bibit di lapangan 88% - dari 41.325 batang tertanam, 4.762 batang mati.',
 'Belum ada jadwal penyulaman untuk tanaman musim tanam Jan-Jun 2026.',
 'Susun rencana penyulaman 4.762 batang berikut kebutuhan bibitnya, masukkan ke musim tanam Okt-Des 2026.',
 'daniel', '2026-09-30', 'Open', NULL, 41325, 36563, 'batang',
 json_object('mati',4762,'hidup_persen',88), 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-06', 6, '26W36', 'Nursery', 'Sedang',
 'Mortalitas indogofera 22,2% dari 2.000 batang, sementara sembilan jenis lain 0,0%.',
 'Belum dikonfirmasi: media semai, naungan, atau penyiraman.',
 'Periksa media dan naungan bedeng indogofera, catat penyebab kematian, laporkan di weekly berikutnya.',
 'daniel', '2026-09-12', 'Open', NULL, 2000, 1556, 'batang',
 json_object('jenis','Indogofera','mortalitas_persen',22.2), 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-07', 7, '26W36', 'Nursery', 'Tinggi',
 'Komitmen 5.000 bibit lokal untuk satgas jatuh tempo 07-Sep-26, sedangkan stok jenis lokal non-sengon hanya 2.181 batang (malapari 918, tanjung 438, mahoni 302, pucuk merah 218, mangga 202, bunga sepatu 75, pete 28). Ditambah indogofera 2.000 pun baru 4.181.',
 'Stok persemaian tidak dipetakan ke komitmen sebelum tanggalnya ditetapkan.',
 'Konfirmasi ulang jumlah dan tanggal ke satgas hari ini, atau geser due date dengan pemberitahuan resmi.',
 'agung', '2026-09-07', 'Open', NULL, 5000, 4181, 'batang',
 json_object('penerima','Satgas'), 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-08', 8, '26W36', 'Nursery', 'Rendah',
 'Administrasi distribusi bibit belum tertutup: 1 surat jalan menggantung (0 diterima) dan PDF siap 0 dari 1.',
 'Berkas serah terima bibit belum diunggah/ditutup di sistem.',
 'Tutup surat jalan yang menggantung dan unggah PDF-nya.',
 'daniel', '2026-09-12', 'Open', NULL, 1, 0, 'berkas',
 '{}', 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-09', 9, '26W36', 'Administrasi', 'Sedang',
 'PICA berjalan no. 2 (pengisian media polybag potting) jatuh tempo 31-Ago-26 dan sudah lewat, tanpa angka target dan tanpa status.',
 'Format tabel PICA di deck tidak punya kolom status/realisasi.',
 'Isi angka target polybag dan statusnya; tambahkan kolom Status pada tabel PICA di deck.',
 'daniel', '2026-09-12', 'Open', 'PICA-26W36-02', NULL, NULL, NULL,
 '{}', 'agung', '2026-09-05T02:00:00Z'),

('PICA-26W36-10', 10, '26W36', 'Pemantauan titik Api Sipongi', 'Tinggi',
 'Temuan titk api di area IPPKH',
 'Banyak sumber api awal kebakaran berasal PPKH ATS',
 'Melaporkan ke dinas terkait berkordinasi dengan KPH dan PT Dwima Intiga',
 'daniel', '2026-09-13', 'Continue', NULL, NULL, NULL, NULL,
 '{}', 'agung', '2026-09-05T02:00:00Z');

-- ---------- KPI mingguan (angka yang tadinya terkubur di dalam kalimat) ----------

INSERT INTO kpi (periode_id, bidang, indikator, target, realisasi, satuan, pica_id) VALUES
  ('26W36','Nursery',   'Bibit nangka',        26250, 7013,  'batang','PICA-26W36-02'),
  ('26W36','Revegetasi','Sengon potting',      62195, 34312, 'batang','PICA-26W36-03'),
  ('26W36','Revegetasi','LCC',                 100,   10.95, 'Ha',    'PICA-26W36-04'),
  ('26W36','Revegetasi','Tanam MT Okt-Des',    47120, 19125, 'batang','PICA-26W36-01'),
  ('26W36','Nursery',   'Bibit lokal satgas',  5000,  4181,  'batang','PICA-26W36-07');

-- ---------- Pengaturan operasional ----------

INSERT INTO pengaturan (kunci, nilai, catatan) VALUES
  ('zona_waktu',        'WITA',  'Asia/Makassar, UTC+8'),
  ('tz_offset_menit',   '480',   'Selisih menit terhadap UTC'),
  ('jam_pengingat',     '07:00', 'Waktu lokal pengiriman pengingat harian'),
  ('jam_rekap_sore',    '16:00', 'Waktu lokal rekap Jumat'),
  ('wa_grup_id',        '',      'ID grup WhatsApp tujuan pengumuman, mis. 12036xxx@g.us. Isi lewat menu Pengaturan.'),
  ('wa_aktif',          '0',     'Saklar utama pengiriman WhatsApp. 1 = aktif.'),
  ('wa_jeda',           '5-10',  'Rentang jeda acak antar pesan (detik) untuk Fonnte'),
  ('periode_aktif',     '26W36', 'Periode rapat yang sedang berjalan'),
  ('ambang_kpi_persen', '60',    'Realisasi di bawah nilai ini memicu usulan PICA otomatis');
