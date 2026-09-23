-- ============================================================
-- POKEMONKEY · Judul singkat PICA untuk rekap WhatsApp
-- ============================================================
-- Judul PICA berupa kalimat fakta yang panjang. Rekap WA memakai judul
-- singkat (pokok pekerjaannya saja); capaian "baru 55% (34.312 dari 62.195
-- batang)" disusun otomatis dari target & realisasi, jadi tidak ditulis di
-- sini supaya tidak basi. Kosong = rekap memotong judul panjang otomatis.

ALTER TABLE pica ADD COLUMN judul_singkat TEXT;

-- PICA periode 26W36 yang sudah ada.
UPDATE pica SET judul_singkat = 'lahan siap untuk target tanam MT Okt–Des 2026' WHERE id = 'PICA-26W36-01' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'bibit nangka'                                      WHERE id = 'PICA-26W36-02' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'sengon potting'                                    WHERE id = 'PICA-26W36-03' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'tabur LCC'                                         WHERE id = 'PICA-26W36-04' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'bibit hidup di lapangan'          WHERE id = 'PICA-26W36-05' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'bibit indigofera hidup'               WHERE id = 'PICA-26W36-06' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'komitmen 5.000 bibit lokal untuk satgas'           WHERE id = 'PICA-26W36-07' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'surat jalan distribusi bibit belum ditutup'        WHERE id = 'PICA-26W36-08' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'target polybag potting belum diisi'                WHERE id = 'PICA-26W36-09' AND judul_singkat IS NULL;
UPDATE pica SET judul_singkat = 'temuan titik api di area IPPKH'                    WHERE id = 'PICA-26W36-10' AND judul_singkat IS NULL;
