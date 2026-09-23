-- ============================================================
-- POKEMONKEY · Libur nasional & jadwal multi-hari
-- ============================================================

-- Jadwal bisa berlangsung beberapa hari (mis. pelatihan Senin–Jumat).
-- NULL = satu hari saja (sama dengan kolom tanggal).
ALTER TABLE jadwal ADD COLUMN tanggal_selesai TEXT;
CREATE INDEX idx_jadwal_rentang ON jadwal(tanggal, tanggal_selesai);

-- Libur: nasional & cuti bersama dari SKB 3 Menteri, plus libur perusahaan.
-- Admin bisa merevisi bila pemerintah mengubah tanggal.
CREATE TABLE libur (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tanggal   TEXT NOT NULL,
  nama      TEXT NOT NULL,
  jenis     TEXT NOT NULL DEFAULT 'nasional',   -- nasional | cuti | perusahaan
  perkiraan INTEGER NOT NULL DEFAULT 0,          -- 1 = menunggu penetapan Menteri Agama
  sumber    TEXT,
  UNIQUE (tanggal, nama)
);
CREATE INDEX idx_libur_tanggal ON libur(tanggal);

INSERT INTO libur (tanggal, nama, jenis, perkiraan, sumber) VALUES
  -- 2026 · SKB No. 1497/2025, 2/2025, 5/2025
  ('2026-01-01','Tahun Baru 2026 Masehi','nasional',0,'SKB 2026'),
  ('2026-01-16','Isra Mikraj Nabi Muhammad SAW','nasional',0,'SKB 2026'),
  ('2026-02-16','Cuti bersama Tahun Baru Imlek','cuti',0,'SKB 2026'),
  ('2026-02-17','Tahun Baru Imlek 2577 Kongzili','nasional',0,'SKB 2026'),
  ('2026-03-18','Cuti bersama Hari Suci Nyepi','cuti',0,'SKB 2026'),
  ('2026-03-19','Hari Suci Nyepi (Tahun Baru Saka 1948)','nasional',0,'SKB 2026'),
  ('2026-03-20','Cuti bersama Idulfitri','cuti',0,'SKB 2026'),
  ('2026-03-21','Idulfitri 1447 H','nasional',0,'SKB 2026'),
  ('2026-03-22','Idulfitri 1447 H','nasional',0,'SKB 2026'),
  ('2026-03-23','Cuti bersama Idulfitri','cuti',0,'SKB 2026'),
  ('2026-03-24','Cuti bersama Idulfitri','cuti',0,'SKB 2026'),
  ('2026-04-03','Wafat Yesus Kristus','nasional',0,'SKB 2026'),
  ('2026-04-05','Kebangkitan Yesus Kristus (Paskah)','nasional',0,'SKB 2026'),
  ('2026-05-01','Hari Buruh Internasional','nasional',0,'SKB 2026'),
  ('2026-05-14','Kenaikan Yesus Kristus','nasional',0,'SKB 2026'),
  ('2026-05-15','Cuti bersama Kenaikan Yesus Kristus','cuti',0,'SKB 2026'),
  ('2026-05-27','Iduladha 1447 H','nasional',0,'SKB 2026'),
  ('2026-05-28','Cuti bersama Iduladha','cuti',0,'SKB 2026'),
  ('2026-05-31','Hari Raya Waisak 2570 BE','nasional',0,'SKB 2026'),
  ('2026-06-01','Hari Lahir Pancasila','nasional',0,'SKB 2026'),
  ('2026-06-16','1 Muharam Tahun Baru Islam 1448 H','nasional',0,'SKB 2026'),
  ('2026-08-17','Proklamasi Kemerdekaan RI','nasional',0,'SKB 2026'),
  ('2026-08-25','Maulid Nabi Muhammad SAW','nasional',0,'SKB 2026'),
  ('2026-12-24','Cuti bersama Natal','cuti',0,'SKB 2026'),
  ('2026-12-25','Kelahiran Yesus Kristus (Natal)','nasional',0,'SKB 2026'),
  -- 2027 · SKB No. 1205/2026, 3/2026, 2/2026
  ('2027-01-01','Tahun Baru 2027 Masehi','nasional',0,'SKB 2027'),
  ('2027-01-05','Isra Mikraj Nabi Muhammad SAW','nasional',1,'SKB 2027'),
  ('2027-02-05','Cuti bersama Tahun Baru Imlek','cuti',0,'SKB 2027'),
  ('2027-02-06','Tahun Baru Imlek 2578 Kongzili','nasional',0,'SKB 2027'),
  ('2027-03-08','Hari Suci Nyepi (Tahun Baru Saka 1949)','nasional',0,'SKB 2027'),
  ('2027-03-09','Cuti bersama Idulfitri','cuti',1,'SKB 2027'),
  ('2027-03-10','Idulfitri 1448 H','nasional',1,'SKB 2027'),
  ('2027-03-11','Idulfitri 1448 H','nasional',1,'SKB 2027'),
  ('2027-03-12','Cuti bersama Idulfitri','cuti',1,'SKB 2027'),
  ('2027-03-15','Cuti bersama Idulfitri','cuti',1,'SKB 2027'),
  ('2027-03-25','Cuti bersama Wafat Yesus Kristus','cuti',0,'SKB 2027'),
  ('2027-03-26','Wafat Yesus Kristus','nasional',0,'SKB 2027'),
  ('2027-03-28','Kebangkitan Yesus Kristus (Paskah)','nasional',0,'SKB 2027'),
  ('2027-05-01','Hari Buruh Internasional','nasional',0,'SKB 2027'),
  ('2027-05-06','Kenaikan Yesus Kristus','nasional',0,'SKB 2027'),
  ('2027-05-17','Iduladha 1448 H','nasional',1,'SKB 2027'),
  ('2027-05-18','Cuti bersama Iduladha','cuti',1,'SKB 2027'),
  ('2027-05-19','Cuti bersama Waisak','cuti',0,'SKB 2027'),
  ('2027-05-20','Hari Raya Waisak 2571 BE','nasional',0,'SKB 2027'),
  ('2027-06-01','Hari Lahir Pancasila','nasional',0,'SKB 2027'),
  ('2027-06-06','1 Muharam Tahun Baru Islam 1449 H','nasional',1,'SKB 2027'),
  ('2027-08-15','Maulid Nabi Muhammad SAW','nasional',1,'SKB 2027'),
  ('2027-08-17','Proklamasi Kemerdekaan RI','nasional',0,'SKB 2027'),
  ('2027-12-24','Cuti bersama Natal','cuti',0,'SKB 2027'),
  ('2027-12-25','Kelahiran Yesus Kristus (Natal)','nasional',0,'SKB 2027'),
  ('2027-12-26','Isra Mikraj Nabi Muhammad SAW','nasional',1,'SKB 2027');
