-- ============================================================
-- POKEMONKEY · Tautan berbagi baca-saja
-- Seperti "share to web" di Notion: tautan berisi token acak yang
-- membuka kalender tanpa login. Bisa dimatikan kapan saja.
-- ============================================================

CREATE TABLE tautan_bagi (
  token       TEXT PRIMARY KEY,
  cakupan     TEXT NOT NULL DEFAULT 'kalender',   -- kalender (nanti: pica)
  label       TEXT,
  dibuat_oleh TEXT REFERENCES tim(id),
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  kedaluwarsa TEXT,                                -- NULL = tanpa batas
  aktif       INTEGER NOT NULL DEFAULT 1,
  dibuka      INTEGER NOT NULL DEFAULT 0           -- berapa kali tautan dibuka
);
