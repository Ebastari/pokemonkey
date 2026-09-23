-- ============================================================
-- POKEMONKEY · Memo Internal (papan tim) + memo pribadi
-- Usulan skema: menyesuaikan desain database final nanti.
-- ============================================================

-- Memo lama semuanya pribadi; memo tim dibaca seluruh anggota.
ALTER TABLE memo ADD COLUMN lingkup   TEXT NOT NULL DEFAULT 'pribadi';  -- pribadi | tim
ALTER TABLE memo ADD COLUMN kategori  TEXT;                             -- opsi grup memo_kategori
ALTER TABLE memo ADD COLUMN tipe      TEXT;                             -- opsi grup memo_tipe
ALTER TABLE memo ADD COLUMN status    TEXT;                             -- opsi grup memo_status
ALTER TABLE memo ADD COLUMN ringkasan TEXT;                             -- teks pendek di kartu
ALTER TABLE memo ADD COLUMN tanggal   TEXT;                             -- tanggal memo (YYYY-MM-DD)

CREATE INDEX idx_memo_tim ON memo(lingkup, kategori, status);

-- Pilihan bawaan. Bisa ditambah dari aplikasi, sama seperti bidang PICA.
INSERT INTO opsi (grup, nilai, label, warna, urutan) VALUES
  ('memo_kategori', 'Revegetasi',          'Revegetasi',          'emerald', 1),
  ('memo_kategori', 'Nursery',             'Nursery',             'cyan',    2),
  ('memo_kategori', 'Administrasi',        'Administrasi',        'zinc',    3),
  ('memo_kategori', 'Operasi & K3',        'Operasi & K3',        'orange',  4),

  ('memo_tipe',     'Perubahan Kebijakan', 'Perubahan Kebijakan', 'purple',  1),
  ('memo_tipe',     'Rekap Rapat',         'Rekap Rapat',         'blue',    2),
  ('memo_tipe',     'Pengumuman',          'Pengumuman',          'indigo',  3),
  ('memo_tipe',     'Pembaruan',           'Pembaruan',           'cyan',    4),
  ('memo_tipe',     'Keputusan',           'Keputusan',           'amber',   5),

  ('memo_status',   'Draf',                'Draf',                'zinc',    1),
  ('memo_status',   'Sedang berlangsung',  'Sedang berlangsung',  'amber',   2),
  ('memo_status',   'Selesai',             'Selesai',             'emerald', 3);
