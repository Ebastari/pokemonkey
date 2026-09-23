-- Dokumen administrasi (nomor surat, Internal Memo dinas, MoM) + foto profil.
-- Bentuk formulirnya ditentukan di layar, jadi isi utuhnya disimpan sebagai JSON;
-- kolom di luar JSON hanya untuk mengurutkan, menyaring, dan merekap.

-- 1. Foto profil: berisi KUNCI berkas di R2 (mis. 'profil/u_agung-1790.jpg'),
--    bukan data gambar, supaya bootstrap tetap ringan.
ALTER TABLE tim ADD COLUMN foto TEXT;

-- 2. Manajemen nomor surat (Internal Memo, Surat Keluar, Berita Acara, Kontrak, MoM).
CREATE TABLE IF NOT EXISTS nomor_surat (
  id            TEXT PRIMARY KEY,
  nomor_surat   TEXT NOT NULL,
  kategori      TEXT NOT NULL,                      -- 'im', 'sk', 'ba', 'kontrak', 'mom', …
  perihal       TEXT NOT NULL,                      -- namaSurat di layar
  tujuan        TEXT,
  pemohon       TEXT,
  tanggal       TEXT NOT NULL,                      -- YYYY-MM-DD
  status        TEXT NOT NULL DEFAULT 'Aktif',      -- 'Aktif', 'Dibatalkan', 'Terpakai'
  memo_dinas_id TEXT,                               -- tautan ke memo_dinas bila surat Internal Memo
  dibuat_oleh   TEXT REFERENCES tim(id),
  data_tambahan TEXT NOT NULL DEFAULT '{}',         -- JSON utuh formulir
  dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now')),
  diubah_pada   TEXT
);
-- Nomor unik per kategori: penomoran tiap kategori berjalan sendiri-sendiri.
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomor_surat_unik ON nomor_surat(kategori, nomor_surat);
CREATE INDEX IF NOT EXISTS idx_nomor_surat_tgl ON nomor_surat(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_nomor_surat_kat ON nomor_surat(kategori);

-- 3. Formulir Internal Memo perjalanan dinas.
CREATE TABLE IF NOT EXISTS memo_dinas (
  id             TEXT PRIMARY KEY,
  nomor_surat_id TEXT REFERENCES nomor_surat(id),
  nomor_memo     TEXT,
  perihal        TEXT NOT NULL DEFAULT '',
  tanggal        TEXT NOT NULL,                     -- tanggal berangkat, YYYY-MM-DD
  tujuan         TEXT,
  pemohon        TEXT,
  total_biaya    REAL NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'Draft',     -- 'Draft', 'Diajukan', 'Disetujui'
  dibuat_oleh    TEXT REFERENCES tim(id),
  data_json      TEXT NOT NULL,                     -- JSON utuh formulir
  dibuat_pada    TEXT NOT NULL DEFAULT (datetime('now')),
  diubah_pada    TEXT
);
CREATE INDEX IF NOT EXISTS idx_memo_dinas_tgl ON memo_dinas(tanggal DESC);

-- 4. Formulir Minutes of Meeting.
CREATE TABLE IF NOT EXISTS mom (
  id             TEXT PRIMARY KEY,
  nomor_surat_id TEXT REFERENCES nomor_surat(id),
  nomor_mom      TEXT,
  judul_rapat    TEXT NOT NULL DEFAULT '',
  tanggal        TEXT NOT NULL,
  tempat         TEXT,
  pimpinan_rapat TEXT,
  notulis        TEXT,
  status         TEXT NOT NULL DEFAULT 'Draft',
  dibuat_oleh    TEXT REFERENCES tim(id),
  data_json      TEXT NOT NULL,                     -- JSON utuh MoM
  dibuat_pada    TEXT NOT NULL DEFAULT (datetime('now')),
  diubah_pada    TEXT
);
CREATE INDEX IF NOT EXISTS idx_mom_tgl ON mom(tanggal DESC);
