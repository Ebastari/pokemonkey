-- ============================================================
-- POKEMONKEY · Realisasi revegetasi per tahun
-- ============================================================
-- Sumber angka: "Realisasi Permintaan Amdal.xlsx", sheet Summary
-- (SUMMARY REALISASI REVEGETASI). Salinan yang sama ada di lib/revegetasi.ts
-- sebagai cadangan offline/demo — perbarui keduanya setiap tutup tahun.

CREATE TABLE revegetasi (
  tahun         INTEGER PRIMARY KEY,
  apl           REAL NOT NULL DEFAULT 0,   -- Areal Penggunaan Lain
  hutan         REAL NOT NULL DEFAULT 0,   -- kawasan hutan (PPKH)
  ipd           REAL NOT NULL DEFAULT 0,
  opd           REAL NOT NULL DEFAULT 0,
  timbunan_soil REAL NOT NULL DEFAULT 0,
  fasilitas     REAL NOT NULL DEFAULT 0,   -- fasilitas penunjang
  blok          TEXT NOT NULL DEFAULT '{}',-- JSON {"Blok 1": 4.93, ...}
  catatan       TEXT,
  diubah_pada   TEXT
);

INSERT INTO revegetasi (tahun, apl, hutan, ipd, opd, timbunan_soil, fasilitas, blok) VALUES
  (2017,  4.082,  0.847,  0,      4.930,  0,     0,     '{"Blok 1":4.93,"Blok 2":0,"Blok 3":0,"Blok 5":0,"Blok 6":0}'),
  (2018,  0,     38.419,  2.303, 36.115,  0,     0,     '{"Blok 1":2.303,"Blok 2":0,"Blok 3":0,"Blok 5":0,"Blok 6":36.115}'),
  (2019,  7.171, 13.883, 12.983,  8.070,  0,     0,     '{"Blok 1":17.971,"Blok 2":2.144,"Blok 3":0.939,"Blok 5":0,"Blok 6":0}'),
  (2020, 53.283, 34.547, 33.989, 53.841,  0,     0,     '{"Blok 1":69.29,"Blok 2":10.976,"Blok 3":1.271,"Blok 5":1.278,"Blok 6":5.014}'),
  (2021,  0.712,  0,      0,      0.712,  0,     0,     '{"Blok 1":0,"Blok 2":0,"Blok 3":0.712,"Blok 5":0,"Blok 6":0}'),
  (2022,  3.432,  0,      0,      3.432,  0,     0,     '{"Blok 1":0,"Blok 2":0,"Blok 3":3.432,"Blok 5":0,"Blok 6":0}'),
  (2023,  2.959, 16.035, 14.511,  4.482,  0,     0,     '{"Blok 1":17.635,"Blok 2":0.103,"Blok 3":1.256,"Blok 5":0,"Blok 6":0}'),
  (2024, 60.124,  2.082,  2.082, 56.216,  0,     3.908, '{"Blok 1":0.424,"Blok 2":7.82,"Blok 3":53.962,"Blok 5":0,"Blok 6":0}'),
  (2025, 72.740,  0,      0,     68.763,  3.873, 0.104, '{"Blok 1":0,"Blok 2":0,"Blok 3":72.74,"Blok 5":0,"Blok 6":0}'),
  (2026, 37.629,  0,      0,     37.052,  0,     0.577, '{"Blok 1":0,"Blok 2":0,"Blok 3":37.629,"Blok 5":0,"Blok 6":0}');
