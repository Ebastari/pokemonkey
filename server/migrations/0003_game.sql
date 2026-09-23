-- ============================================================
-- POKEMONKEY · Fitur game yang sudah ada, dipindah dari Apps Script
-- (XP & skin per orang, pemain lain di layar KEBUN, misi global)
-- ============================================================

CREATE TABLE profil_game (
  user_id        TEXT PRIMARY KEY REFERENCES tim(id),
  xp             INTEGER NOT NULL DEFAULT 0,
  level          INTEGER NOT NULL DEFAULT 1,
  skin_aktif     TEXT NOT NULL DEFAULT 'classic',
  skin_dimiliki  TEXT NOT NULL DEFAULT '["classic"]',
  luas_tanam     REAL NOT NULL DEFAULT 0,
  pos_x          REAL,
  pos_y          REAL,
  stamina        REAL,
  terakhir_aktif TEXT
);
CREATE INDEX idx_profil_aktif ON profil_game(terakhir_aktif);

-- Progres misi dipakai bersama seluruh tim. Penambahan capaian dilakukan
-- di server (current = current + nilai), sehingga dua laporan yang masuk
-- bersamaan tidak saling menimpa seperti di versi lama.
CREATE TABLE misi_global (
  id          TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'AVAILABLE',
  current     REAL NOT NULL DEFAULT 0,
  diubah_pada TEXT
);

INSERT INTO misi_global (id) VALUES
  ('m1'), ('m2_1'), ('m2_2'), ('m2_3'), ('m2_6'), ('m2_7'), ('m2_10'), ('m3');

INSERT INTO profil_game (user_id) SELECT id FROM tim;
