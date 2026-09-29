-- ============================================================
-- POKEMONKEY · RAB RNR disimpan di server
-- ============================================================
-- Sebelumnya RAB RNR hanya di penyimpanan perangkat, sehingga hilang saat
-- pindah HP/laptop atau aplikasi dipasang ulang. Isi RAB (identitas, kartu
-- ajuan per minggu, penyetuju) disimpan utuh di `data` (JSON); kolom lain
-- untuk daftar dan penyaringan. Hapus bersifat lunak supaya perangkat lain
-- ikut membuang RAB tersebut saat sinkron.

CREATE TABLE rab_rnr (
  id          TEXT PRIMARY KEY,
  nomor_rab   TEXT NOT NULL DEFAULT '',
  judul       TEXT NOT NULL DEFAULT '',
  bulan       TEXT,
  tahun       INTEGER,
  status      TEXT NOT NULL DEFAULT 'Draf',
  pemohon_id  TEXT NOT NULL REFERENCES tim(id),
  data        TEXT NOT NULL,
  dihapus     INTEGER NOT NULL DEFAULT 0,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT NOT NULL,
  diubah_oleh TEXT REFERENCES tim(id)
);
CREATE INDEX idx_rab_rnr_diubah ON rab_rnr(dihapus, diubah_pada);
