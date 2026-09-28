-- ============================================================
-- POKEMONKEY · Katalog RAB RNR: uraian rutin + kode WBS
-- ============================================================
-- RAB RNR tidak lagi memakai lembar kategori (ATK, BBM, …): tiap barang
-- katalog adalah satu uraian di rekap RAB dengan kode WBS bawaannya.
-- Kolom `kategori` dibiarkan (data lama), tidak dipakai lagi.

ALTER TABLE katalog_rab ADD COLUMN wbs TEXT NOT NULL DEFAULT 'AB3.11-06.02.22.04';

-- Pengajuan yang berulang setiap bulan: tinggal dicentang di form belanja.
INSERT OR IGNORE INTO katalog_rab (id, kategori, kelompok, nama, satuan, harga, urutan, wbs) VALUES
  ('kat-rtn-01', 'rnr', 'Pengajuan Rutin', 'Kunjungan Verifikasi PNBP PKH SK 966', 'Paket', 7200000, 1, 'AB3.11-06.02.22.04'),
  ('kat-rtn-02', 'rnr', 'Pengajuan Rutin', 'Kunjungan Verifikasi PNBP PKH SK 892', 'Paket', 7200000, 2, 'AB3.11-06.02.22.04'),
  ('kat-rtn-03', 'rnr', 'Pengajuan Rutin', 'Kunjungan Verifikasi PNBP PKH SK 78', 'Paket', 7200000, 3, 'AB3.11-06.02.22.04'),
  ('kat-rtn-04', 'rnr', 'Pengajuan Rutin', 'Operasional Tahura', 'Paket', 2000000, 4, 'AB3.11-06.02.22.04');
