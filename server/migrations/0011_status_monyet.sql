-- ============================================================
-- POKEMONKEY · Teks status di atas kepala monyet (KEBUN)
-- ============================================================
-- Kalimat pendek yang ditulis pemakai sendiri, tampil di atas monyetnya dan
-- terlihat anggota lain di KEBUN. NULL = pakai sapaan bawaan aplikasi.
-- Aplikasi membatasi 60 karakter.

ALTER TABLE profil_game ADD COLUMN status_teks TEXT;
