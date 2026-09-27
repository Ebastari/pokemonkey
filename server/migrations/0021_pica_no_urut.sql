-- ============================================================
-- POKEMONKEY · Nomor PICA berurutan sepanjang waktu
-- ============================================================
-- `nomor` lama = urutan dalam satu periode (reset tiap periode). `no_urut`
-- berjalan terus dari PICA terlama sampai terbaru dan tidak pernah dipakai
-- ulang — PICA yang dihapus tetap memegang nomornya.
-- Ditampilkan sebagai PICA-001, PICA-002, …

ALTER TABLE pica ADD COLUMN no_urut INTEGER;

UPDATE pica SET no_urut = (
  SELECT COUNT(*) FROM pica p2
   WHERE p2.dibuat_pada < pica.dibuat_pada
      OR (p2.dibuat_pada = pica.dibuat_pada AND p2.id <= pica.id)
);

CREATE UNIQUE INDEX idx_pica_no_urut ON pica(no_urut);
