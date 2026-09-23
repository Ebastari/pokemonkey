-- ============================================================
-- POKEMONKEY · Roster bulanan, memo pribadi, misi dinamis
-- ============================================================

-- ---------- Roster: satu sel per orang per hari ----------
-- Kode diambil dari tabel opsi (grup 'roster'), jadi jenis shift baru
-- cukup ditambah dari aplikasi.

CREATE TABLE roster (
  user_id     TEXT NOT NULL REFERENCES tim(id),
  tanggal     TEXT NOT NULL,                        -- 2026-09-16
  kode        TEXT NOT NULL,                        -- M | S1 | S2 | L | C | I
  catatan     TEXT,
  diubah_oleh TEXT REFERENCES tim(id),
  diubah_pada TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, tanggal)
);
CREATE INDEX idx_roster_tanggal ON roster(tanggal);

INSERT INTO opsi (grup, nilai, label, warna, urutan) VALUES
  ('roster','M', 'Masuk',      'emerald', 1),
  ('roster','S1','Shift 1',    'cyan',    2),
  ('roster','S2','Shift 2',    'indigo',  3),
  ('roster','L', 'Libur',      'zinc',    4),
  ('roster','C', 'Cuti',       'amber',   5),
  ('roster','I', 'Izin/Sakit', 'red',     6);

-- ---------- Memo pribadi (gaya halaman Notion) ----------

CREATE TABLE memo (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES tim(id),
  judul       TEXT NOT NULL DEFAULT '',
  isi         TEXT NOT NULL DEFAULT '',            -- teks dengan markup ringan (#, -, - [ ])
  disematkan  INTEGER NOT NULL DEFAULT 0,
  warna       TEXT,
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  diubah_pada TEXT
);
CREATE INDEX idx_memo_user ON memo(user_id, disematkan, diubah_pada);

-- ---------- Misi (Quest Journal) kini data, bukan kode ----------

ALTER TABLE misi_global ADD COLUMN judul     TEXT;
ALTER TABLE misi_global ADD COLUMN tipe      TEXT NOT NULL DEFAULT 'NURSERY';
ALTER TABLE misi_global ADD COLUMN deskripsi TEXT;
ALTER TABLE misi_global ADD COLUMN target    REAL NOT NULL DEFAULT 100;
ALTER TABLE misi_global ADD COLUMN satuan    TEXT NOT NULL DEFAULT 'Ha';
ALTER TABLE misi_global ADD COLUMN xp        INTEGER NOT NULL DEFAULT 500;
ALTER TABLE misi_global ADD COLUMN kapasitas REAL NOT NULL DEFAULT 1.66;
ALTER TABLE misi_global ADD COLUMN urutan    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE misi_global ADD COLUMN aktif     INTEGER NOT NULL DEFAULT 1;

UPDATE misi_global SET judul='Penataan Lahan (3 Bulan)', tipe='LAND_PREP', deskripsi='Menata 150ha lahan kritis agar siap ditanami. Membutuhkan waktu dan ketelitian.', target=150, satuan='Ha', xp=1000, kapasitas=1.66, urutan=1 WHERE id='m1';
UPDATE misi_global SET judul='1. Persiapan Pekerja', tipe='NURSERY', deskripsi='Rekrut dan latih tim khusus persemaian.', target=10000, satuan='bibit', xp=200, kapasitas=2000, urutan=2 WHERE id='m2_1';
UPDATE misi_global SET judul='2. Media Tanam', tipe='NURSERY', deskripsi='Mixing tanah topsoil, kompos, dan pasir.', target=10000, satuan='bibit', xp=300, kapasitas=500, urutan=3 WHERE id='m2_2';
UPDATE misi_global SET judul='3. Pengisian Polybag', tipe='NURSERY', deskripsi='Mengisi polybag dengan media yang telah disiapkan.', target=10000, satuan='bibit', xp=400, kapasitas=400, urutan=4 WHERE id='m2_3';
UPDATE misi_global SET judul='6. Penyemaian Benih', tipe='NURSERY', deskripsi='Penanaman benih unggul Sengon ke tiap polybag.', target=10000, satuan='bibit', xp=500, kapasitas=800, urutan=5 WHERE id='m2_6';
UPDATE misi_global SET judul='7. Pemeliharaan Rutin', tipe='NURSERY', deskripsi='Penyiraman intensif pagi dan sore.', target=10000, satuan='bibit', xp=450, kapasitas=10000, urutan=6 WHERE id='m2_7';
UPDATE misi_global SET judul='10. Sertifikasi Bibit', tipe='NURSERY', deskripsi='Pemeriksaan akhir kesiapan bibit sebelum distribusi.', target=10000, satuan='bibit', xp=800, kapasitas=2500, urutan=7 WHERE id='m2_10';
UPDATE misi_global SET judul='Penanaman Masif', tipe='PLANTING', deskripsi='Menanam seluruh bibit ke 150ha lahan yang sudah siap.', target=150, satuan='Ha', xp=2500, kapasitas=1.66, urutan=8 WHERE id='m3';
