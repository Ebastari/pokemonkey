-- ============================================================
-- POKEMONKEY · Memo gaya Notion
-- Usulan skema: menyesuaikan desain database final nanti.
-- ============================================================
-- Gambar dan berkas memo memakai tabel `lampiran` yang sudah ada
-- (entitas = 'memo', entitas_id = id memo); tidak ada tabel baru.

-- Tautan memo ke satu PICA (opsional) dan nilai properti kustom per memo.
ALTER TABLE memo ADD COLUMN pica_id TEXT REFERENCES pica(id);
ALTER TABLE memo ADD COLUMN props   TEXT NOT NULL DEFAULT '{}';     -- JSON: kunci = properti.id
CREATE INDEX idx_memo_pica ON memo(pica_id) WHERE pica_id IS NOT NULL;

-- Definisi kolom kustom kini dipisah per entitas: PICA (bawaan) atau memo.
-- Id kolom memo berawalan 'm_' agar tidak bentrok dengan kolom PICA.
ALTER TABLE properti ADD COLUMN entitas TEXT NOT NULL DEFAULT 'pica';   -- pica | memo

-- Ceklis memo yang bertenggat menjadi baris Jadwal; baris itu dikelola dari
-- memo (ditulis ulang saat memo disimpan, dihapus saat memo dihapus).
ALTER TABLE jadwal ADD COLUMN memo_id TEXT;
CREATE INDEX idx_jadwal_memo ON jadwal(memo_id) WHERE memo_id IS NOT NULL;

-- Bagikan memo lewat tautan (seperti "Share to web" di Notion): baris tautan_bagi
-- ber-cakupan 'memo' menunjuk memonya lewat objek_id. Halaman: /lihat/memo/<token>.
ALTER TABLE tautan_bagi ADD COLUMN objek_id TEXT;
CREATE INDEX idx_bagi_objek ON tautan_bagi(objek_id) WHERE objek_id IS NOT NULL;

-- Akses anggota lain di memo tim, diatur pembuat (seperti Share di Notion):
-- 'edit' = bisa mengedit (bawaan memo baru) · 'baca' = baca saja (tetap boleh mencentang tugasnya sendiri).
-- Pembuat, Admin, dan Supervisor selalu punya akses penuh. Lihat hakMemo() di server/src/memo-blok.ts.
ALTER TABLE memo ADD COLUMN akses TEXT NOT NULL DEFAULT 'edit';
-- Memo tim yang sudah ada tetap seperti sebelumnya: hanya penulis (dan Admin/SPV) yang menyunting.
UPDATE memo SET akses = 'baca' WHERE lingkup = 'tim';
