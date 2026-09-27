-- ============================================================
-- POKEMONKEY · Katalog barang RAB (Money Monkey)
-- ============================================================
-- Daftar barang yang dicentang pemohon di form belanja RAB. Diisi Admin;
-- `kategori` = id lembar RAB (atk, bbm, catering, perdin, listrik, air,
-- telp, pantry, khl) supaya ekspor Excel tetap memakai template yang sama.
-- Harga di bawah adalah perkiraan awal — Admin menyesuaikan dengan harga
-- pemasok di lapangan.

CREATE TABLE katalog_rab (
  id          TEXT PRIMARY KEY,
  kategori    TEXT NOT NULL,
  kelompok    TEXT NOT NULL,                 -- judul kelompok di form: 'BBM Operasional Tahura', 'Nursery', …
  nama        TEXT NOT NULL,
  satuan      TEXT NOT NULL,
  harga       REAL NOT NULL DEFAULT 0,
  urutan      INTEGER NOT NULL DEFAULT 0,
  aktif       INTEGER NOT NULL DEFAULT 1,
  diubah_oleh TEXT REFERENCES tim(id),
  diubah_pada TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_katalog_rab_kategori ON katalog_rab(kategori, urutan);

INSERT INTO katalog_rab (id, kategori, kelompok, nama, satuan, harga, urutan) VALUES
  -- BBM operasional Tahura
  ('kat-bbm-01', 'bbm', 'BBM Operasional Tahura', 'Pertalite kendaraan operasional Tahura', 'Liter', 10000, 1),
  ('kat-bbm-02', 'bbm', 'BBM Operasional Tahura', 'Solar kendaraan / alat operasional Tahura', 'Liter', 6800, 2),
  ('kat-bbm-03', 'bbm', 'BBM Operasional Tahura', 'Pertalite mesin pompa air & rumput', 'Liter', 10000, 3),
  ('kat-bbm-04', 'bbm', 'BBM Operasional Tahura', 'Oli mesin 2T (mesin rumput / chainsaw)', 'Liter', 45000, 4),

  -- Nursery (bahan persemaian & perawatan bibit)
  ('kat-nur-01', 'pantry', 'Nursery', 'Polybag 15 x 20 cm', 'Kg', 30000, 10),
  ('kat-nur-02', 'pantry', 'Nursery', 'Pupuk NPK Mutiara 16-16-16', 'Kg', 18000, 11),
  ('kat-nur-03', 'pantry', 'Nursery', 'Pupuk kandang / kompos', 'Karung', 25000, 12),
  ('kat-nur-04', 'pantry', 'Nursery', 'Top soil / tanah media tanam', 'Karung', 15000, 13),
  ('kat-nur-05', 'pantry', 'Nursery', 'Paranet naungan 65%', 'Meter', 12000, 14),
  ('kat-nur-06', 'pantry', 'Nursery', 'Selang air 5/8 inci', 'Roll', 150000, 15),
  ('kat-nur-07', 'pantry', 'Nursery', 'Fungisida / insektisida bibit', 'Botol', 75000, 16),
  ('kat-nur-08', 'pantry', 'Nursery', 'Gembor penyiram 10 liter', 'Pcs', 45000, 17),

  -- Kebersihan & toiletries kamar mandi
  ('kat-keb-01', 'pantry', 'Kebersihan & Toiletries', 'Sabun mandi batang', 'Pcs', 4000, 20),
  ('kat-keb-02', 'pantry', 'Kebersihan & Toiletries', 'Sabun mandi cair (refill)', 'Pouch', 25000, 21),
  ('kat-keb-03', 'pantry', 'Kebersihan & Toiletries', 'Pembersih kamar mandi / porselen', 'Botol', 20000, 22),
  ('kat-keb-04', 'pantry', 'Kebersihan & Toiletries', 'Pembersih lantai', 'Pouch', 18000, 23),
  ('kat-keb-05', 'pantry', 'Kebersihan & Toiletries', 'Sabun cuci piring', 'Pouch', 15000, 24),
  ('kat-keb-06', 'pantry', 'Kebersihan & Toiletries', 'Deterjen bubuk (sabun cuci)', 'Kg', 25000, 25),
  ('kat-keb-07', 'pantry', 'Kebersihan & Toiletries', 'Pewangi / karbol', 'Botol', 15000, 26),
  ('kat-keb-08', 'pantry', 'Kebersihan & Toiletries', 'Tisu gulung', 'Pack', 20000, 27),
  ('kat-keb-09', 'pantry', 'Kebersihan & Toiletries', 'Sikat WC', 'Pcs', 15000, 28),
  ('kat-keb-10', 'pantry', 'Kebersihan & Toiletries', 'Kantong sampah besar', 'Pack', 15000, 29),

  -- ATK
  ('kat-atk-01', 'atk', 'ATK', 'Kertas HVS A4 70 gr', 'Rim', 55000, 40),
  ('kat-atk-02', 'atk', 'ATK', 'Pulpen gel hitam', 'Box', 35000, 41),
  ('kat-atk-03', 'atk', 'ATK', 'Spidol whiteboard', 'Pcs', 10000, 42),
  ('kat-atk-04', 'atk', 'ATK', 'Map snelhecter folio', 'Pcs', 5000, 43),
  ('kat-atk-05', 'atk', 'ATK', 'Tinta printer (botol)', 'Botol', 90000, 44),
  ('kat-atk-06', 'atk', 'ATK', 'Lakban bening', 'Roll', 12000, 45),
  ('kat-atk-07', 'atk', 'ATK', 'Isi staples no. 10', 'Box', 5000, 46),
  ('kat-atk-08', 'atk', 'ATK', 'Buku tulis / buku agenda', 'Pcs', 20000, 47);
