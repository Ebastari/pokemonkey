-- ============================================================
-- POKEMONKEY · Pengingat acara kalender
-- ============================================================
-- Berapa menit sebelum acara pemakai ingin diingatkan. NULL = tidak diingatkan.
-- Nilai yang dipakai aplikasi: 5, 10, 15, 30, 60, 120, dan 1440 (satu hari).

ALTER TABLE jadwal ADD COLUMN ingatkan_menit INTEGER;

-- Hanya baris yang punya pengingat yang pernah ditanyakan.
CREATE INDEX idx_jadwal_pengingat ON jadwal(ingatkan_menit) WHERE ingatkan_menit IS NOT NULL;

-- Rapat rutin diberi pengingat 30 menit; sisanya dibiarkan kosong agar
-- pemakainya sendiri yang memutuskan.
UPDATE jadwal SET ingatkan_menit = 30 WHERE rrule IS NOT NULL;
