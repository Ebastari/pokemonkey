-- ============================================================
-- POKEMONKEY · Skema inti (Cloudflare D1 / SQLite)
-- Zona waktu operasional: WITA (UTC+8). Semua kolom waktu
-- disimpan sebagai teks ISO-8601 UTC; konversi ke WITA
-- dilakukan di satu tempat saja (server/src/waktu.ts).
-- ============================================================

-- ---------- 1. Orang ----------

CREATE TABLE tim (
  id            TEXT PRIMARY KEY,                   -- slug pendek: daniel, agung, mariano
  nama          TEXT NOT NULL,
  jabatan       TEXT,
  bidang        TEXT,
  wa            TEXT,                               -- format 62xxxxxxxxxx, boleh kosong dulu
  peran         TEXT NOT NULL DEFAULT 'anggota',    -- admin | supervisor | anggota | pemantau
  password_hash TEXT,                               -- pbkdf2$iterasi$salt$hash; NULL = wajib atur saat login pertama
  aktif         INTEGER NOT NULL DEFAULT 1,
  dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sesi (
  token_hash  TEXT PRIMARY KEY,                     -- token mentah tidak pernah disimpan
  user_id     TEXT NOT NULL REFERENCES tim(id),
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  kedaluwarsa TEXT NOT NULL
);
CREATE INDEX idx_sesi_user ON sesi(user_id);

-- ---------- 2. Yang membuat PICA dinamis ----------
-- Pilihan dropdown adalah DATA, bukan kode. Menambah bidang baru
-- cukup INSERT satu baris, tidak perlu deploy ulang.

CREATE TABLE opsi (
  grup   TEXT NOT NULL,                             -- bidang | prioritas | status | satuan
  nilai  TEXT NOT NULL,
  label  TEXT,
  warna  TEXT,                                      -- kelas warna retro, mis. 'amber'
  urutan INTEGER NOT NULL DEFAULT 0,
  aktif  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (grup, nilai)
);

-- Kolom tambahan gaya Notion. Nilainya tinggal di pica.props (JSON),
-- jadi menambah kolom tidak butuh migrasi database.
CREATE TABLE properti (
  id              TEXT PRIMARY KEY,                 -- kunci di dalam JSON props, mis. 'blok'
  label           TEXT NOT NULL,                    -- yang dilihat pengguna, mis. 'Blok reklamasi'
  tipe            TEXT NOT NULL,                    -- teks | angka | tanggal | select | checkbox | url
  opsi_json       TEXT,                             -- daftar pilihan bila tipe = select
  urutan          INTEGER NOT NULL DEFAULT 0,
  tampil_di_tabel INTEGER NOT NULL DEFAULT 1,
  aktif           INTEGER NOT NULL DEFAULT 1
);

-- ---------- 3. Periode rapat mingguan ----------

CREATE TABLE periode (
  id           TEXT PRIMARY KEY,                    -- 26W36 = tahun 2026 minggu ke-36
  mulai        TEXT NOT NULL,                       -- 2026-08-31
  selesai      TEXT NOT NULL,                       -- 2026-09-04
  judul        TEXT,
  sumber       TEXT,                                -- nama deck / tautan
  terkunci     INTEGER NOT NULL DEFAULT 0,          -- dikunci saat rapat mingguan
  dikunci_oleh TEXT REFERENCES tim(id),
  dikunci_pada TEXT
);

-- ---------- 4. PICA: register berjalan ----------
-- Satu baris hidup terus sampai ditutup. Tidak disalin ulang tiap minggu;
-- perkembangan mingguan masuk ke tabel pica_update.

CREATE TABLE pica (
  id          TEXT PRIMARY KEY,                     -- PICA-26W36-01
  nomor       INTEGER NOT NULL,                     -- urutan dalam periode saat diangkat
  periode_id  TEXT REFERENCES periode(id),
  bidang      TEXT NOT NULL,
  prioritas   TEXT NOT NULL DEFAULT 'Sedang',
  judul       TEXT NOT NULL,                        -- kolom "Masalah (fakta di laporan)"
  akar        TEXT,
  tindakan    TEXT,
  pic_id      TEXT REFERENCES tim(id),
  due_date    TEXT,                                 -- 2026-09-30
  status      TEXT NOT NULL DEFAULT 'Open',
  terkait_id  TEXT REFERENCES pica(id),             -- relasi ke PICA lain (no.3 -> no.1)
  target      REAL,
  realisasi   REAL,
  satuan      TEXT,                                 -- batang | Ha | % | berkas
  terkunci    INTEGER NOT NULL DEFAULT 0,           -- PIC & due date terkunci setelah rapat
  props       TEXT NOT NULL DEFAULT '{}',           -- kolom tambahan dinamis (lihat tabel properti)
  ditutup_pada TEXT,
  ditutup_oleh TEXT REFERENCES tim(id),
  dibuat_oleh TEXT REFERENCES tim(id),
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now')),
  diubah_oleh TEXT REFERENCES tim(id),
  diubah_pada TEXT,
  dihapus     INTEGER NOT NULL DEFAULT 0            -- hapus lunak; riwayat tetap utuh
);

-- Kolom JSON yang sering difilter diangkat jadi kolom terindeks,
-- tanpa mengubah cara aplikasi menulis datanya.
ALTER TABLE pica ADD COLUMN blok TEXT
  AS (json_extract(props, '$.blok')) STORED;

CREATE INDEX idx_pica_due    ON pica(due_date, status) WHERE dihapus = 0;
CREATE INDEX idx_pica_pic    ON pica(pic_id, status)   WHERE dihapus = 0;
CREATE INDEX idx_pica_bidang ON pica(bidang, status)   WHERE dihapus = 0;
CREATE INDEX idx_pica_blok   ON pica(blok);

-- Catatan perkembangan per minggu: inilah yang memberi jejak pada status "Continue".
CREATE TABLE pica_update (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pica_id    TEXT NOT NULL REFERENCES pica(id),
  periode_id TEXT REFERENCES periode(id),
  catatan    TEXT NOT NULL,
  realisasi  REAL,
  oleh       TEXT REFERENCES tim(id),
  pada       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_update_pica ON pica_update(pica_id, pada);

-- Jejak audit. Wajib begitu PIC dan due date dikunci.
CREATE TABLE pica_riwayat (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  pica_id    TEXT NOT NULL REFERENCES pica(id),
  kolom      TEXT NOT NULL,
  nilai_lama TEXT,
  nilai_baru TEXT,
  alasan     TEXT,                                  -- wajib diisi bila periode sudah terkunci
  oleh       TEXT NOT NULL REFERENCES tim(id),
  pada       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_riwayat_pica ON pica_riwayat(pica_id, pada);

-- ---------- 5. Lampiran (objek di R2) ----------

CREATE TABLE lampiran (
  id         TEXT PRIMARY KEY,
  entitas    TEXT NOT NULL,                         -- pica | laporan | pengumuman
  entitas_id TEXT NOT NULL,
  kunci_r2   TEXT NOT NULL,                         -- pica/PICA-26W36-07/1758...jpg
  nama       TEXT,
  tipe_mime  TEXT,
  ukuran     INTEGER,
  oleh       TEXT REFERENCES tim(id),
  pada       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_lampiran_entitas ON lampiran(entitas, entitas_id);

-- ---------- 6. Pengumuman ke seluruh tim ----------

CREATE TABLE pengumuman (
  id          TEXT PRIMARY KEY,
  judul       TEXT NOT NULL,
  isi         TEXT NOT NULL,
  penting     INTEGER NOT NULL DEFAULT 0,
  kirim_wa    INTEGER NOT NULL DEFAULT 1,
  oleh        TEXT REFERENCES tim(id),
  dibuat_pada TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE pengumuman_baca (
  pengumuman_id TEXT NOT NULL REFERENCES pengumuman(id),
  user_id       TEXT NOT NULL REFERENCES tim(id),
  pada          TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (pengumuman_id, user_id)
);

-- ---------- 7. Jadwal ----------

CREATE TABLE jadwal (
  id           TEXT PRIMARY KEY,
  judul        TEXT NOT NULL,
  keterangan   TEXT,
  tanggal      TEXT NOT NULL,                       -- 2026-09-16
  jam_mulai    TEXT,                                -- 07:00 WITA
  jam_selesai  TEXT,
  jenis        TEXT NOT NULL DEFAULT 'rencana',     -- rencana | rapat | tenggat
  pica_id      TEXT REFERENCES pica(id),
  pemilik_id   TEXT REFERENCES tim(id),             -- NULL = agenda seluruh tim
  rrule        TEXT,                                -- RFC 5545, mis. FREQ=WEEKLY;BYDAY=FR
  gcal_id      TEXT,                                -- id event Google Calendar bila disinkronkan
  selesai      INTEGER NOT NULL DEFAULT 0,
  dibuat_pada  TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_jadwal_tanggal ON jadwal(tanggal);

-- ---------- 8. Laporan lapangan (layar FEED yang sudah ada) ----------

CREATE TABLE laporan (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES tim(id),
  pica_id       TEXT REFERENCES pica(id),           -- laporan bisa jadi bukti sebuah PICA
  jenis         TEXT,
  capaian       REAL,
  satuan        TEXT,
  catatan       TEXT,
  lat           REAL,
  lon           REAL,
  xp            INTEGER NOT NULL DEFAULT 0,
  dibuat_pada   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_laporan_user ON laporan(user_id, dibuat_pada);

-- ---------- 9. KPI mingguan (sumber PICA otomatis) ----------

CREATE TABLE kpi (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  periode_id TEXT NOT NULL REFERENCES periode(id),
  bidang     TEXT NOT NULL,
  indikator  TEXT NOT NULL,                         -- 'Nangka', 'Sengon potting', 'LCC'
  target     REAL NOT NULL,
  realisasi  REAL NOT NULL,
  satuan     TEXT NOT NULL,
  ambang     REAL NOT NULL DEFAULT 60,              -- < ambang % -> usulkan PICA otomatis
  pica_id    TEXT REFERENCES pica(id)
);
CREATE INDEX idx_kpi_periode ON kpi(periode_id);

-- ---------- 10. Antrean WhatsApp ----------
-- Worker tidak memanggil Fonnte langsung dari permintaan pengguna.
-- Semua pesan masuk antrean ini, lalu dikirim oleh cron.

CREATE TABLE pesan_wa (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  tujuan       TEXT NOT NULL,                       -- 62xxx atau 12036xxxx@g.us
  isi          TEXT NOT NULL,
  jenis        TEXT NOT NULL,                       -- pengingat | eskalasi | rekap | pengumuman | uji
  ref_id       TEXT,                                -- id PICA / pengumuman terkait
  kirim_pada   TEXT NOT NULL,                       -- waktu paling awal boleh dikirim (UTC)
  status       TEXT NOT NULL DEFAULT 'menunggu',    -- menunggu | terkirim | gagal
  percobaan    INTEGER NOT NULL DEFAULT 0,
  fonnte_id    TEXT,
  galat        TEXT,
  dibuat_pada  TEXT NOT NULL DEFAULT (datetime('now')),
  diproses_pada TEXT
);
CREATE INDEX idx_wa_antre ON pesan_wa(status, kirim_pada);

-- Kunci anti-kirim-ganda: satu jenis pengingat, satu PICA, satu hari.
CREATE UNIQUE INDEX idx_wa_unik ON pesan_wa(ref_id, jenis, substr(kirim_pada, 1, 10))
  WHERE ref_id IS NOT NULL;

-- ---------- 11. Pengaturan ----------
-- Nilai yang boleh diubah tanpa deploy. Token Fonnte TIDAK di sini —
-- token hidup sebagai secret Worker (wrangler secret put FONNTE_TOKEN).

CREATE TABLE pengaturan (
  kunci TEXT PRIMARY KEY,
  nilai TEXT NOT NULL,
  catatan TEXT
);
