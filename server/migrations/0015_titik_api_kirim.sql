-- ============================================================
-- POKEMONKEY · Titik api: kiriman WA yang bisa dilacak + batas harian
-- ============================================================
-- pesan_ref = ref_id pesan WA yang memuat titik ini. Bila pesan itu akhirnya
-- gagal (Fonnte gagal 4× atau kedaluwarsa), titiknya dikembalikan dan dicoba
-- lagi selama deteksinya < 24 jam — peringatan kebakaran tidak hilang diam-diam.
-- diperingatkan: 0 = menunggu dikirim · 1 = masuk pesan WA · 2 = sengaja tidak dikirim.
ALTER TABLE titik_api ADD COLUMN pesan_ref TEXT;

-- Titik yang sudah tercatat sebelum migrasi ini tidak pernah dikirim ulang.
UPDATE titik_api SET diperingatkan = 2 WHERE diperingatkan = 0;

-- Pesan peringatan titik api per hari WITA; sisanya hanya tercatat di aplikasi.
INSERT OR IGNORE INTO pengaturan (kunci, nilai, catatan)
VALUES ('titik_api_batas_harian', '4', 'Maksimal pesan peringatan titik api ke grup WA per hari (WITA)');
