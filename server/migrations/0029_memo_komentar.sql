-- ============================================================
-- POKEMONKEY · Memo: komentar (seperti Comments di Notion)
-- Jalankan setelah 0028_memo_halaman_sampah.sql.
-- ============================================================

-- Komentar pada teks tertentu (kutipan) atau pada halaman (kutipan NULL).
-- Balasan menunjuk komentar pertama utasnya lewat induk_id.
-- Semua yang bisa membaca memo boleh berkomentar; teks memo tidak diubah,
-- jadi pembaca "Baca saja" tetap bisa ikut berdiskusi.
CREATE TABLE memo_komentar (
  id          TEXT PRIMARY KEY,
  memo_id     TEXT NOT NULL,
  induk_id    TEXT,
  user_id     TEXT NOT NULL,
  kutipan     TEXT,
  isi         TEXT NOT NULL,
  selesai     INTEGER NOT NULL DEFAULT 0,
  dibuat_pada TEXT NOT NULL,
  diubah_pada TEXT
);
CREATE INDEX idx_komentar_memo ON memo_komentar(memo_id, dibuat_pada);
