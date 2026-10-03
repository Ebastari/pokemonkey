-- ============================================================
-- POKEMONKEY · Catatan & batas pemakaian AI (Gemini)
-- Jalankan setelah 0029_memo_komentar.sql.
-- ============================================================

-- Satu baris per permintaan AI: siapa, fitur apa, model, dan token yang terpakai.
-- Dipakai untuk batas harian per orang dan ringkasan pemakaian tim (Admin/SPV).
-- Pencarian "Tanya semua memo" sengaja TIDAK memakai tabel virtual FTS5:
-- D1 tidak bisa mengekspor database yang memuat tabel virtual (cadangan
-- `wrangler d1 export` akan gagal), dan data memo tim masih kecil.
CREATE TABLE ai_pemakaian (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      TEXT NOT NULL,
  fitur        TEXT NOT NULL,                 -- memo:kembangkan, memo:tanya, memo:laporan, …
  model        TEXT,
  token_masuk  INTEGER NOT NULL DEFAULT 0,
  token_keluar INTEGER NOT NULL DEFAULT 0,
  berhasil     INTEGER NOT NULL DEFAULT 1,
  tanggal      TEXT NOT NULL,                 -- YYYY-MM-DD WITA (batas harian)
  pada         TEXT NOT NULL                  -- waktu UTC ISO
);
CREATE INDEX idx_ai_pemakaian_user_tanggal ON ai_pemakaian(user_id, tanggal);
