-- ============================================================
-- POKEMONKEY · Memo: halaman di dalam halaman + Sampah (seperti Notion)
-- Jalankan setelah 0027_memo_notion.sql.
-- ============================================================

-- Sub-halaman: memo bisa berada di dalam memo lain (blok "Halaman" di menu "/").
-- Lingkupnya selalu sama dengan induknya. NULL = halaman teratas.
ALTER TABLE memo ADD COLUMN induk_id TEXT;
CREATE INDEX idx_memo_induk ON memo(induk_id) WHERE induk_id IS NOT NULL;

-- Sampah: "Hapus" memindahkan memo (beserta sub-halamannya) ke Sampah, bisa dipulihkan.
-- Semua baris yang dibuang bersamaan memakai dihapus_pada yang sama, sehingga
-- "Pulihkan" mengembalikan satu kelompok itu saja. Lewat 30 hari dihapus permanen oleh cron.
ALTER TABLE memo ADD COLUMN dihapus_pada TEXT;
ALTER TABLE memo ADD COLUMN dihapus_oleh TEXT;
CREATE INDEX idx_memo_sampah ON memo(dihapus_pada) WHERE dihapus_pada IS NOT NULL;
