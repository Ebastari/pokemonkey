-- ============================================================
-- POKEMONKEY · Buku besar XP & Nilai Keaktifan (KPI)
-- Jalankan setelah 0030_ai_pemakaian.sql. Aturan: docs/sistem-xp.md
-- ============================================================

-- Satu baris per XP yang diberikan. (user_id, sumber, ref) unik: satu kejadian
-- tidak pernah dihargai dua kali, termasuk dari antrean luring yang terkirim ulang
-- atau dari hitung ulang riwayat. Baris yang dibatalkan Admin/SPV tetap disimpan sebagai jejak.
CREATE TABLE xp_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id         TEXT NOT NULL,
  sumber          TEXT NOT NULL,                 -- kode aturan, mis. pica_update
  ref             TEXT NOT NULL,                 -- benda/kejadian, mis. id PICA + tanggal
  xp              INTEGER NOT NULL,
  wilayah         TEXT NOT NULL,                 -- tindak | lapor | koordinasi | hadir | main | bonus | warisan
  hari            TEXT NOT NULL,                 -- tanggal WITA (YYYY-MM-DD)
  pada            TEXT NOT NULL,
  catatan         TEXT,
  dibatalkan_oleh TEXT,
  dibatalkan_pada TEXT,
  alasan_batal    TEXT
);
CREATE UNIQUE INDEX idx_xp_unik ON xp_log(user_id, sumber, ref);
CREATE INDEX idx_xp_user_hari ON xp_log(user_id, hari);
CREATE INDEX idx_xp_hari ON xp_log(hari);

-- XP yang dibelanjakan di SHOP. Saldo = xp − xp_terpakai; level dihitung dari xp (tidak turun).
ALTER TABLE profil_game ADD COLUMN xp_terpakai INTEGER NOT NULL DEFAULT 0;

-- Potret sebelum sistem baru, dipakai sekali oleh "Hitung ulang XP" (POST /api/xp/hitung-ulang):
-- riwayat lama dihitung dengan aturan baru, dan tidak ada yang XP/saldonya berkurang.
ALTER TABLE profil_game ADD COLUMN xp_lama INTEGER;
ALTER TABLE profil_game ADD COLUMN skin_lama TEXT;
UPDATE profil_game SET xp_lama = xp, skin_lama = skin_dimiliki;

-- Waktu sistem XP baru mulai: kejadian sebelum ini hanya masuk lewat hitung ulang.
INSERT OR REPLACE INTO pengaturan (kunci, nilai, catatan)
VALUES ('xp_mulai', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), 'Awal buku besar XP (migrasi 0031)');
