-- ============================================================
-- POKEMONKEY · Arsip laporan karhutla (FIRE) yang sudah diekspor
-- ============================================================
-- Berkas PDF dan isi laporan (JSON, termasuk foto) disimpan di R2:
--   karhutla/<id>/laporan.pdf · karhutla/<id>/data.json
-- Baris di sini hanya untuk daftar, rekap bulanan, dan status kirim.
-- Draf yang belum diekspor tetap di perangkat pembuatnya.

CREATE TABLE laporan_karhutla (
  id            TEXT PRIMARY KEY,
  nomor         TEXT NOT NULL,
  judul         TEXT NOT NULL,
  hari_titik    TEXT NOT NULL,                 -- tanggal deteksi titik (WITA), YYYY-MM-DD
  tanggal_lapor TEXT NOT NULL,                 -- tanggal di lembar laporan
  jenis_izin    TEXT NOT NULL,                 -- PPKH | IUP | Rehabilitasi DAS
  area          TEXT NOT NULL,                 -- mis. 'SK.966', 'IUP', 'SK.78 + SK.966', 'DAS'
  jumlah_titik  INTEGER NOT NULL DEFAULT 0,
  titik_ids     TEXT NOT NULL DEFAULT '[]',    -- JSON id titik_api
  pdf_kunci     TEXT NOT NULL,
  data_kunci    TEXT NOT NULL,
  dibuat_oleh   TEXT REFERENCES tim(id),
  dibuat_pada   TEXT NOT NULL,
  diekspor_pada TEXT NOT NULL,
  dikirim_pada  TEXT,                          -- terakhir ditandai dikirim ke WhatsApp
  dikirim_oleh  TEXT REFERENCES tim(id),
  jumlah_kirim  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_laporan_karhutla_hari ON laporan_karhutla(hari_titik);
