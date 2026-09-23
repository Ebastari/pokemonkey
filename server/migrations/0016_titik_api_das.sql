-- ============================================================
-- POKEMONKEY · Titik api di petak Rehabilitasi DAS
-- ============================================================
-- Area kedua pemantauan titik api, ±69 km barat daya area tambang (sekitar
-- Tahura Sultan Adam). Peringatannya dikirim sebagai pesan TERPISAH dengan
-- batas harian sendiri; rekap 7 hari tetap satu pesan dengan dua bagian.

-- 'tambang' = IUP/IPPKH (bawaan untuk semua titik lama) · 'das' = petak rehab DAS.
ALTER TABLE titik_api ADD COLUMN area TEXT NOT NULL DEFAULT 'tambang';

-- Atribut petak yang bisa berubah tanpa build ulang (bentuknya di server/src/area-das.ts).
CREATE TABLE das_petak (
  nama        TEXT PRIMARY KEY,
  luas_ha     REAL,
  vendor      TEXT,
  status      TEXT,   -- status serah terima
  diubah_pada TEXT
);

INSERT INTO das_petak (nama, luas_ha, vendor, status, diubah_pada) VALUES
  ('PETAK 8 (2)', 30.66, 'KBS', 'BELUM SERAH TERIMA', datetime('now')),
  ('PETAK 9', 22.74, 'KBS', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 1', 27.93, 'KBS', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 2', 25.55, 'KBS', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 10', 22.86, 'KBS', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 8', 28.24, 'KBS', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 7', 32.45, 'ABL', 'TIDAK LOLOS SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 5 (2)', 32.04, 'ABL', 'BELUM SERAH TERIMA', datetime('now')),
  ('PETAK 6 (2)', 29.59, 'KBS', 'BELUM SERAH TERIMA', datetime('now')),
  ('PETAK 7 (2)', 30.73, 'KBS', 'BELUM SERAH TERIMA', datetime('now')),
  ('PETAK 6', 27.35, 'ABL', 'BELUM SERAH TERIMA', datetime('now')),
  ('PETAK 5', 20.41, 'ABL', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 1 (2)', 27.11, 'ABL', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 2 (2)', 31.52, 'KBS', 'TIDAK LOLOS SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 4 (2)', 27.24, 'ABL', 'BELUM SERAH TERIMA', datetime('now')),
  ('PETAK 3 (2)', 34.68, 'KBS', 'BELUM SERAH TERIMA', datetime('now')),
  ('PETAK 4', 18.32, 'ABL', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('PETAK 3', 27.77, 'ABL', 'SUDAH SERAH TERIMA TAHAP I', datetime('now')),
  ('Show Windows Tahura', 6.09, NULL, 'BELUM SERAH TERIMA', datetime('now'));

INSERT OR IGNORE INTO pengaturan (kunci, nilai, catatan)
VALUES ('titik_api_das_batas_harian', '4', 'Maksimal pesan peringatan titik api Rehab DAS ke grup WA per hari (WITA)');
